"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500, 4500];

function sanitizeFolderName(raw: string): string {
  let name = raw.replace(/[\\/:*?"<>|#%]/g, "_");
  name = name.replace(/[_\s]+/g, "_");
  name = name.replace(/^[.\s_]+|[.\s_]+$/g, "");
  if (name.length > 200) name = name.slice(0, 200);
  return name || "klient";
}

function buildClientFolderName(contactName: string): string {
  return sanitizeFolderName(contactName);
}

function buildQuoteSubfolderName(
  code: string,
  createdAt: number,
  clientName: string,
): string {
  const date = new Date(createdAt);
  const dateStr = date.toISOString().split("T")[0];
  return `${code}_${dateStr}_${sanitizeFolderName(clientName)}`;
}

async function getGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph auth failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function ensureFolder(
  token: string,
  driveId: string,
  parentPath: string,
  folderName: string,
): Promise<{ id: string; webUrl: string }> {
  const encodedPath = parentPath
    ? encodeURIComponent(parentPath).replace(/%2F/g, "/")
    : "";

  const base = "https://graph.microsoft.com/v1.0";

  const checkUrl = encodedPath
    ? `${base}/drives/${driveId}/root:/${encodedPath}/${encodeURIComponent(folderName)}`
    : `${base}/drives/${driveId}/root:/${encodeURIComponent(folderName)}`;

  const createUrl = encodedPath
    ? `${base}/drives/${driveId}/root:/${encodedPath}:/children`
    : `${base}/drives/${driveId}/root/children`;

  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.ok) {
    const existing = (await checkRes.json()) as { id: string; webUrl: string };
    return { id: existing.id, webUrl: existing.webUrl };
  }

  if (checkRes.status !== 404) {
    const text = await checkRes.text();
    throw new Error(`Graph check failed ${checkRes.status}: ${text}`);
  }

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (createRes.status === 409) {
    const retryRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (retryRes.ok) {
      const existing = (await retryRes.json()) as { id: string; webUrl: string };
      return { id: existing.id, webUrl: existing.webUrl };
    }
  }

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Graph create folder failed ${createRes.status}: ${text}`);
  }

  const created = (await createRes.json()) as {
    id: string;
    webUrl: string;
    parentReference?: { driveId: string };
  };
  return { id: created.id, webUrl: created.webUrl };
}

async function ensureSubfolderById(
  token: string,
  driveId: string,
  parentItemId: string,
  folderName: string,
): Promise<{ id: string }> {
  const base = "https://graph.microsoft.com/v1.0";
  const checkUrl = `${base}/drives/${driveId}/items/${parentItemId}:/${encodeURIComponent(folderName)}`;

  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (checkRes.ok) {
    const existing = (await checkRes.json()) as { id: string };
    return { id: existing.id };
  }
  if (checkRes.status !== 404) {
    const text = await checkRes.text();
    throw new Error(`Graph subfolder check failed ${checkRes.status}: ${text}`);
  }

  const createRes = await fetch(
    `${base}/drives/${driveId}/items/${parentItemId}/children`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    },
  );
  if (createRes.status === 409) {
    const retryRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (retryRes.ok) {
      const existing = (await retryRes.json()) as { id: string };
      return { id: existing.id };
    }
  }
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Graph subfolder create failed ${createRes.status}: ${text}`);
  }
  const created = (await createRes.json()) as { id: string };
  return { id: created.id };
}

async function deleteFolder(
  token: string,
  driveId: string,
  itemId: string,
): Promise<void> {
  const base = "https://graph.microsoft.com/v1.0";
  const url = `${base}/drives/${driveId}/items/${itemId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Graph delete failed ${res.status}: ${text}`);
  }
}

export const deleteQuoteFolders = internalAction({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.runQuery(internal.quotes._getInternal, { quoteId });
    if (!quote?.sharepoint?.subfolderItemId) return;

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;

    if (!tenantId || !clientId || !clientSecret || !driveId) {
      console.warn("[sharepoint] Brak env config — pomijam usuwanie folderów wyceny");
      return;
    }

    try {
      const token = await getGraphToken(tenantId, clientId, clientSecret);
      await deleteFolder(token, driveId, quote.sharepoint.subfolderItemId);
      console.log(`[sharepoint] Usunięty folder wyceny: ${quote.code}`);
    } catch (err) {
      console.error(
        `[sharepoint] Błąd usunięcia folderu wyceny ${quote.code}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  },
});

export const deleteOldSharepointFolders = internalAction({
  args: {},
  handler: async (ctx) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;

    if (!tenantId || !clientId || !clientSecret || !driveId) {
      console.warn("[sharepoint] Brak env config — pomijam migrację");
      return;
    }

    const quotes = await ctx.runQuery(internal.quotes._getAll, {});
    const token = await getGraphToken(tenantId, clientId, clientSecret);

    let deleted = 0;
    let failed = 0;

    for (const quote of quotes) {
      if (!quote.sharepoint?.subfolderItemId || quote.sharepoint.status !== "created") {
        continue;
      }

      try {
        await deleteFolder(token, driveId, quote.sharepoint.subfolderItemId);
        if (quote.sharepoint.parentFolderItemId) {
          await deleteFolder(token, driveId, quote.sharepoint.parentFolderItemId);
        }
        await ctx.runMutation(internal.quotes._clearSharepoint, {
          quoteId: quote._id,
        });
        deleted++;
        console.log(`[sharepoint] Usunięty folder: ${quote.code}`);
      } catch (err) {
        failed++;
        console.error(
          `[sharepoint] Błąd usunięcia ${quote.code}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    console.log(
      `[sharepoint] Migracja: usunięto ${deleted}, błędy ${failed}`,
    );
  },
});

export const listQuoteFiles = action({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId) return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.subfolderItemId}/children` +
        `?$select=id,name,size,lastModifiedDateTime,file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) {
      console.warn(
        `[sharepoint] Subfolder ${sp.subfolderItemId} wyceny ${quoteId} nie istnieje — czyszczę stan`,
      );
      await ctx.runMutation(internal.quotes._clearSharepoint, { quoteId });
      return [];
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list files ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
      }>;
    };

    return data.value
      .filter((item) => !!item.file)
      .map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        mimeType: item.file?.mimeType ?? "",
      }));
  },
});

const PUBLIC_ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "dwg",
  "dxf",
];

const PUBLIC_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

export const createPublicUploadSession = action({
  args: {
    quoteId: v.id("quotes"),
    token: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
  },
  handler: async (
    ctx,
    { quoteId, token, fileName, fileSize },
  ): Promise<{ uploadUrl: string }> => {
    if (fileSize > PUBLIC_MAX_FILE_BYTES) {
      throw new Error("Plik jest za duży (max 20 MB)");
    }
    const ext = getFileExtension(fileName);
    if (!PUBLIC_ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(
        `Nieobsługiwany typ pliku (.${ext || "?"}). Dozwolone: ${PUBLIC_ALLOWED_EXTENSIONS.join(", ")}`,
      );
    }

    const quote = await ctx.runQuery(internal.quotes._getForPublicUpload, {
      quoteId,
      token,
    });
    if (!quote) {
      throw new Error("Sesja uploadu wygasła lub jest nieprawidłowa");
    }
    const sp = quote.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId || sp.status !== "created") {
      throw new Error("Folder dla wyceny nie jest jeszcze gotowy");
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token2 = await getGraphToken(tenantId, clientId, clientSecret);

    const attachmentFolder = await ensureSubfolderById(
      token2,
      sp.driveId,
      sp.subfolderItemId,
      "Załącznik",
    );

    const encodedName = encodeURIComponent(fileName);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${attachmentFolder.id}:/${encodedName}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token2}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph public upload session ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { uploadUrl: string };
    return { uploadUrl: data.uploadUrl };
  },
});

export const createUploadSession = action({
  args: { quoteId: v.id("quotes"), fileName: v.string(), targetFolderId: v.optional(v.string()) },
  handler: async (ctx, { quoteId, fileName, targetFolderId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId) {
      throw new Error("Brak folderu SharePoint dla tej wyceny");
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const encodedName = encodeURIComponent(fileName);
    const folderToUse = targetFolderId || sp.subfolderItemId;
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${folderToUse}:/${encodedName}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graf upload session ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { uploadUrl: string };
    return { uploadUrl: data.uploadUrl };
  },
});

export const listQuoteFolderContents = action({
  args: { quoteId: v.id("quotes"), folderId: v.optional(v.string()) },
  handler: async (ctx, { quoteId, folderId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId) return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const targetFolderId = folderId || sp.subfolderItemId;
    
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${targetFolderId}/children` +
        `?$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) {
      if (!folderId) {
        console.warn(`[sharepoint] Subfolder ${sp.subfolderItemId} wyceny ${quoteId} nie istnieje — czyszczę stan`);
        await ctx.runMutation(internal.quotes._clearSharepoint, { quoteId });
      }
      return [];
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list folder contents ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
        folder?: any;
        webUrl?: string;
      }>;
    };

    return data.value.map((item) => ({
      id: item.id,
      name: item.name,
      isFolder: !!item.folder,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime,
      mimeType: item.file?.mimeType ?? "",
      url: item.webUrl,
    }));
  },
});

export const createQuoteFolder = action({
  args: { quoteId: v.id("quotes"), parentFolderId: v.string(), name: v.string() },
  handler: async (ctx, { quoteId, parentFolderId, name }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint dla tej wyceny");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) throw new Error("SharePoint nie jest skonfigurowany");

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    await ensureSubfolderById(token, sp.driveId, parentFolderId, name);
  },
});

export const deleteQuoteItem = action({
  args: { quoteId: v.id("quotes"), itemId: v.string() },
  handler: async (ctx, { quoteId, itemId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint dla tej wyceny");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) throw new Error("SharePoint nie jest skonfigurowany");

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    await deleteFolder(token, sp.driveId, itemId);
  },
});

export const getFileForPreview = action({
  args: { quoteId: v.id("quotes"), fileId: v.string() },
  handler: async (ctx, { quoteId, fileId }): Promise<{ base64: string; contentType: string }> => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) throw new Error(`Nie można pobrać pliku (${res.status})`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new Error("Plik jest za duży do podglądu (max 8 MB)");
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return { base64, contentType };
  },
});

export const ensureClientFolder = action({
  args: { clientId: v.id("clients") },
  handler: async (
    ctx,
    { clientId },
  ): Promise<{ webUrl: string; itemId: string; driveId: string } | null> => {
    const client = await ctx.runQuery(api.clients.get, { id: clientId });
    if (!client) throw new Error("Klient nie istnieje");

    const existing = client.sharepointFolder;
    if (existing?.status === "created" && existing.itemId && existing.driveId) {
      return {
        webUrl: existing.webUrl,
        itemId: existing.itemId,
        driveId: existing.driveId,
      };
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientIdEnv = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;
    const parentPath = process.env.SHAREPOINT_PARENT_PATH ?? "Klienci";

    if (!tenantId || !clientIdEnv || !clientSecret || !driveId) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientIdEnv, clientSecret);
    const folderName = sanitizeFolderName(client.name);
    const { id, webUrl } = await ensureFolder(
      token,
      driveId,
      parentPath,
      folderName,
    );

    await ctx.runMutation(internal.clients._attachSharepointFolder, {
      clientId,
      itemId: id,
      driveId,
      webUrl,
    });

    return { webUrl, itemId: id, driveId };
  },
});

export const listClientFiles = action({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.runQuery(api.clients.get, { id: clientId });
    const sp = client?.sharepointFolder;
    if (!sp?.itemId || !sp?.driveId) return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientIdEnv = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientIdEnv || !clientSecret) return [];

    const token = await getGraphToken(tenantId, clientIdEnv, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.itemId}/children` +
        `?$select=id,name,size,lastModifiedDateTime,file,folder`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list client files ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
        folder?: { childCount: number };
      }>;
    };

    return data.value.map((item) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime,
      mimeType: item.file?.mimeType ?? "",
      isFolder: !!item.folder,
    }));
  },
});

export const createClientUploadSession = action({
  args: { clientId: v.id("clients"), fileName: v.string() },
  handler: async (ctx, { clientId, fileName }) => {
    const client = await ctx.runQuery(api.clients.get, { id: clientId });
    const sp = client?.sharepointFolder;
    if (!sp?.itemId || !sp?.driveId) {
      throw new Error("Brak folderu SharePoint dla tego klienta");
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientIdEnv = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientIdEnv || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientIdEnv, clientSecret);
    const encodedName = encodeURIComponent(fileName);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.itemId}:/${encodedName}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph client upload session ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { uploadUrl: string };
    return { uploadUrl: data.uploadUrl };
  },
});

export const getClientFileForPreview = action({
  args: { clientId: v.id("clients"), fileId: v.string() },
  handler: async (
    ctx,
    { clientId, fileId },
  ): Promise<{ base64: string; contentType: string }> => {
    const client = await ctx.runQuery(api.clients.get, { id: clientId });
    const sp = client?.sharepointFolder;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientIdEnv = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientIdEnv || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientIdEnv, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) throw new Error(`Nie można pobrać pliku (${res.status})`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new Error("Plik jest za duży do podglądu (max 8 MB)");
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const contentType =
      res.headers.get("content-type") ?? "application/octet-stream";
    return { base64, contentType };
  },
});

export const deleteClientCascade = action({
  args: { clientId: v.id("clients") },
  handler: async (
    ctx,
    { clientId },
  ): Promise<{ removedQuotes: number; sharepointDeleted: boolean }> => {
    const data = await ctx.runQuery(internal.clients._getCascadeData, {
      clientId,
    });
    if (!data) throw new Error("Klient nie istnieje");

    const tenantId = process.env.MS_TENANT_ID;
    const clientIdEnv = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;

    let sharepointDeleted = false;

    if (tenantId && clientIdEnv && clientSecret && driveId) {
      try {
        const token = await getGraphToken(tenantId, clientIdEnv, clientSecret);

        for (const quote of data.quotes) {
          const sp = quote.sharepoint;
          if (sp?.subfolderItemId) {
            try {
              await deleteFolder(token, driveId, sp.subfolderItemId);
            } catch (err) {
              console.error(
                `[sharepoint] Nie usunięto subfolderu wyceny ${quote.code}:`,
                err instanceof Error ? err.message : String(err),
              );
            }
          }
        }

        const clientFolderId = data.client.sharepointFolder?.itemId;
        if (clientFolderId) {
          await deleteFolder(token, driveId, clientFolderId);
          sharepointDeleted = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[sharepoint] Błąd usuwania folderów klienta ${data.client.name}:`,
          msg,
        );
        throw new Error(
          `Nie udało się usunąć folderu klienta z SharePoint (${msg}). Klient nie został usunięty z systemu.`,
        );
      }
    } else {
      console.warn(
        "[sharepoint] Brak konfiguracji env — usuwam klienta tylko z bazy",
      );
    }

    await ctx.runMutation(internal.clients._deleteCascade, { clientId });

    return { removedQuotes: data.quotes.length, sharepointDeleted };
  },
});

export const listWycenaSubfolderFiles = action({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId || sp.status !== "created") return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.subfolderItemId}:/Wycena:/children` +
        `?$select=id,name,size,lastModifiedDateTime,file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) return [];

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list Wycena files ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
      }>;
    };

    return data.value
      .filter((item) => !!item.file && item.name.toLowerCase().endsWith(".pdf"))
      .map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        mimeType: item.file?.mimeType ?? "application/pdf",
      }));
  },
});

export const runOcrForFile = action({
  args: {
    quoteId: v.id("quotes"),
    fileItemId: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, { quoteId, fileItemId, fileName }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint dla tej wyceny");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const ocrProvider = await ctx.runQuery(api.systemSettings.getOcrProvider);
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    if (ocrProvider === "gemini") {
      if (!geminiKey) {
        throw new Error("Brak klucza GEMINI_API_KEY w konfiguracji Convex");
      }
    } else {
      if (!anthropicKey) {
        throw new Error("Brak klucza ANTHROPIC_API_KEY w konfiguracji Convex");
      }
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${fileItemId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!fileRes.ok) {
      throw new Error(`Nie można pobrać pliku z SharePoint (${fileRes.status})`);
    }

    const buffer = await fileRes.arrayBuffer();
    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new Error("Plik jest za duży do OCR (max 10 MB)");
    }
    const base64 = Buffer.from(buffer).toString("base64");

    const modelsToTry = [
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet-latest",
      "claude-3-haiku-20240307",
    ];

    const promptText = `Przeanalizuj ten dokument oferty/wyceny i wyodrębnij WSZYSTKIE dostępne dane.

Zwróć TYLKO czysty JSON (bez znaczników markdown, bez \`\`\`json), w tej strukturze. Pola których nie znajdziesz ustaw na null. Nie pomijaj żadnych danych z dokumentu — wszystko co nie pasuje do standardowych pól umieść w "dodatkowe".

{
  "dokument": {
    "numer": "numer dokumentu lub null",
    "data": "data dokumentu lub null",
    "tytul": "tytuł/nazwa dokumentu lub null"
  },
  "dostawca": {
    "nazwa": "nazwa firmy/dostawcy lub null",
    "nip": "NIP lub null",
    "adres": "adres lub null"
  },
  "odbiorca": {
    "nazwa": "nazwa odbiorcy lub null",
    "nip": "NIP lub null",
    "adres": "adres lub null"
  },
  "zakres_oferty": {
    "zawiera": ["lista zakresów np. konstrukcje, szkło, montaż, obróbki, malowanie — lub null"],
    "systemy_aluminiowe": [
      {
        "producent": "nazwa producenta lub null",
        "system": "nazwa/kod systemu lub null"
      }
    ],
    "ilosc_pozycji": liczba_lub_null,
    "ilosc_konstrukcji": liczba_lub_null,
    "calkowita_powierzchnia_m2": liczba_lub_null,
    "calkowity_obwod_m": liczba_lub_null,
    "kolor_profili": "kolor profili lub null",
    "kolor_okuc": "kolor okuć lub null",
    "szyby_rodzaje": ["lista rodzajów szyb lub null"],
    "statyka": {
      "norma": "norma lub null",
      "strefa": "strefa lub null",
      "teren": "teren lub null",
      "budynek_z": "wysokość budynku lub null",
      "pk": "obciążenie pk lub null"
    }
  },
  "pozycje": [
    {
      "lp": 1,
      "opis": "opis pozycji",
      "ilosc": "ilość lub null",
      "jednostka": "jednostka miary lub null",
      "cena_netto": wartość_liczbowa_lub_null,
      "wartosc_netto": wartość_liczbowa_lub_null
    }
  ],
  "podsumowanie": {
    "netto": wartość_liczbowa_lub_null,
    "vat": wartość_liczbowa_lub_null,
    "brutto": wartość_liczbowa_lub_null,
    "waluta": "PLN"
  },
  "uwagi": "dodatkowe uwagi lub null",
  "dodatkowe": {}
}

Pole "dodatkowe" wypełnij wszelkimi informacjami z dokumentu które nie zmieściły się w powyższych polach (np. warunki płatności, terminy realizacji, gwarancja, certyfikaty, warunki handlowe itp.).`;

    let rawText = "";

    if (ocrProvider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const geminiRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        throw new Error(`Błąd API Gemini (${geminiRes.status}): ${await geminiRes.text()}`);
      }

      const geminiData = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      let anthropicRes: Response | null = null;
      let lastErrorText = "";

      async function tryModel(modelName: string): Promise<Response> {
        return await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey!,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "pdfs-2024-09-25",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: base64,
                    },
                  },
                  {
                    type: "text",
                    text: promptText,
                  },
                ],
              },
            ],
          }),
        });
      }

      for (const model of modelsToTry) {
        const res = await tryModel(model);
        if (res.ok) {
          anthropicRes = res;
          break;
        } else {
          const text = await res.text();
          lastErrorText = text;
          if (res.status === 404 || text.includes("not_found_error")) {
            console.warn(`Model ${model} niedostępny, próbuję kolejny...`);
            continue;
          }
          throw new Error(`Błąd API Claude (${res.status}): ${text.slice(0, 250)}`);
        }
      }

      // If all standard models returned 404, check available models dynamically from Anthropic API
      if (!anthropicRes || !anthropicRes.ok) {
        const modelsListRes = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": anthropicKey!,
            "anthropic-version": "2023-06-01",
          },
        });

        let availableModelsInfo = "";
        if (modelsListRes.ok) {
          const modelsJson = (await modelsListRes.json()) as { data?: Array<{ id: string }> };
          const availableIds = (modelsJson.data ?? []).map((m) => m.id);
          if (availableIds.length > 0) {
            // Try the first available model that hasn't been tried yet
            for (const dynModel of availableIds) {
              if (modelsToTry.includes(dynModel)) continue;
              const res = await tryModel(dynModel);
              if (res.ok) {
                anthropicRes = res;
                break;
              } else {
                lastErrorText = await res.text();
              }
            }
            if (!anthropicRes || !anthropicRes.ok) {
              availableModelsInfo = `Dostępne modele dla tego klucza w API to: [${availableIds.join(", ")}].`;
            }
          } else {
            availableModelsInfo = "API Anthropic zwróciło 0 dostępnych modeli dla Twojego klucza API.";
          }
        } else {
          availableModelsInfo = `Nie udało się pobrać listy modeli (${modelsListRes.status}): ${await modelsListRes.text()}`;
        }

        if (!anthropicRes || !anthropicRes.ok) {
          throw new Error(
            `Klucz API Anthropic nie ma dostępu do modeli lub konto nie ma aktywnych środków (Credits/Billing). ${availableModelsInfo} Ostatni błąd API: ${lastErrorText.slice(0, 200)}`
          );
        }
      }

      const anthropicData = (await anthropicRes.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      rawText = anthropicData.content.find((c) => c.type === "text")?.text ?? "";
    }

    function cleanAndParseJson(raw: string): any {
      try {
        return JSON.parse(raw);
      } catch {}

      let cleaned = raw
        .replace(/^```[a-z]*\s*/im, "")
        .replace(/\s*```$/im, "")
        .trim();
      try {
        return JSON.parse(cleaned);
      } catch {}

      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const substring = raw.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(substring);
        } catch {}
      }

      return { raw };
    }

    function parseNumeric(val: unknown): number | null {
      if (typeof val === "number" && !isNaN(val)) return val;
      if (val == null) return null;
      const str = String(val)
        .replace(/\s+/g, "")
        .replace(/PLN|EUR|USD|zł|szt\.|szt|m2|kg|m/gi, "")
        .replace(/,/g, ".");
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    }

    const ocrJson = cleanAndParseJson(rawText) as Record<string, unknown> & {
      podsumowanie?: { netto?: unknown; vat?: unknown; brutto?: unknown; waluta?: string | null } | null;
      pozycje?: Array<{
        lp?: unknown;
        opis?: unknown;
        ilosc?: unknown;
        jednostka?: unknown;
        cena_netto?: unknown;
        wartosc_netto?: unknown;
      }> | null;
    };

    // Save raw OCR result (legacy table kept for backward compat)
    await ctx.runMutation(internal.quoteOcr._saveResult, {
      quoteId,
      fileItemId,
      fileName,
      ocrJson,
    });

    // Build structured quoteVersion entry
    const podsumowanie = ocrJson.podsumowanie ?? null;
    const vatRate = 23; // default VAT rate for Stolarka Aluminiowa
    const valueNetto = parseNumeric(podsumowanie?.netto) ?? 0;
    const valueBrutto = parseNumeric(podsumowanie?.brutto) ?? valueNetto * (1 + vatRate / 100);
    const valueVat = parseNumeric(podsumowanie?.vat) ?? (valueBrutto - valueNetto);

    const items = Array.isArray(ocrJson.pozycje)
      ? ocrJson.pozycje.map((p, idx) => ({
          lp: parseNumeric(p.lp) ?? idx + 1,
          description: p.opis != null ? String(p.opis) : "",
          quantity: parseNumeric(p.ilosc),
          unit: p.jednostka != null ? String(p.jednostka) : undefined,
          priceNetto: parseNumeric(p.cena_netto),
          valueNetto: parseNumeric(p.wartosc_netto),
        }))
      : [];

    // Extract additional structured data (supplier info, scope, etc.)
    const { pozycje: _p, podsumowanie: _s, ...additionalData } = ocrJson;

    await ctx.runMutation(internal.quoteVersions._saveOcrVersion, {
      quoteId,
      fileItemId,
      fileName,
      valueNetto,
      valueVat,
      valueBrutto,
      vatRate,
      items,
      additionalData,
    });

    return ocrJson;
  },
});

export const listFolderContents = action({
  args: { quoteId: v.id("quotes"), folderId: v.optional(v.string()) },
  handler: async (ctx, { quoteId, folderId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId) return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const targetId = folderId ?? sp.subfolderItemId;
    const token = await getGraphToken(tenantId, clientId, clientSecret);

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${targetId}/children` +
        `?$select=id,name,size,lastModifiedDateTime,file,folder`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list folder ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
        folder?: { childCount: number };
      }>;
    };

    const items = data.value.map((item) => ({
      id: item.id,
      name: item.name,
      isFolder: !!item.folder,
      size: item.size ?? 0,
      lastModifiedDateTime: item.lastModifiedDateTime ?? "",
      mimeType: item.file?.mimeType ?? "",
      childCount: item.folder?.childCount ?? 0,
    }));

    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "pl");
    });

    return items;
  },
});

export const createSharepointSubfolder = action({
  args: { quoteId: v.id("quotes"), parentItemId: v.string(), name: v.string() },
  handler: async (ctx, { quoteId, parentItemId, name }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const cleanName = sanitizeFolderName(name);
    if (!cleanName) throw new Error("Nieprawidłowa nazwa folderu");

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${parentItemId}/children`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph create folder ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      name: string;
      lastModifiedDateTime: string;
    };

    return {
      id: data.id,
      name: data.name,
      isFolder: true as const,
      size: 0,
      lastModifiedDateTime: data.lastModifiedDateTime ?? new Date().toISOString(),
      mimeType: "",
      childCount: 0,
    };
  },
});

export const deleteSharepointItem = action({
  args: { quoteId: v.id("quotes"), itemId: v.string() },
  handler: async (ctx, { quoteId, itemId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    await deleteFolder(token, sp.driveId, itemId);
  },
});

export const createUploadSessionInFolder = action({
  args: { quoteId: v.id("quotes"), parentItemId: v.string(), fileName: v.string() },
  handler: async (ctx, { quoteId, parentItemId, fileName }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const encodedName = encodeURIComponent(fileName);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${parentItemId}:/${encodedName}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph upload session ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { uploadUrl: string };
    return { uploadUrl: data.uploadUrl };
  },
});

const QUOTE_SUBFOLDERS = ["Wycena", "Produkcja", "Załącznik", "Zamówienia", "Dokumentacja", "Umowy"];

async function createQuoteSubfolders(
  token: string,
  driveId: string,
  parentPath: string,
  quoteFolderName: string,
): Promise<{ wycenaFolderId: string | null }> {
  let wycenaFolderId: string | null = null;
  for (const folderName of QUOTE_SUBFOLDERS) {
    const folder = await ensureFolder(token, driveId, `${parentPath}/${quoteFolderName}`, folderName);
    if (folderName === "Wycena") {
      wycenaFolderId = folder.id;
    }
  }
  return { wycenaFolderId };
}

export const createFolderForQuote = internalAction({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;
    const parentPath = process.env.SHAREPOINT_PARENT_PATH ?? "Klienci";

    if (!tenantId || !clientId || !clientSecret || !driveId) {
      console.warn(
        "[sharepoint] Brak konfiguracji env (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_GRAPH_DRIVE_ID) — pomijam tworzenie folderu",
      );
      return;
    }

    const quote = (await ctx.runQuery(internal.quotes._getInternal, { quoteId })) as {
      _id: Id<"quotes">;
      code: string;
      contact: { name: string };
      clientId?: Id<"clients">;
      _creationTime: number;
    } | null;

    if (!quote) {
      console.warn(`[sharepoint] Wycena ${quoteId} nie istnieje — pomijam`);
      return;
    }

    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 2]));
        }

        const token = await getGraphToken(tenantId, clientId, clientSecret);

        let client = null;
        if (quote.clientId) {
          client = (await ctx.runQuery(api.clients.get, { id: quote.clientId })) as {
            name: string;
            type?: string;
            nip?: string;
          } | null;
        }

        let clientFolderName;
        if (client && client.type === "business" && client.nip) {
          const cleanNip = client.nip.replace(/\D/g, "");
          clientFolderName = `${sanitizeFolderName(client.name)}_${cleanNip}`;
        } else {
          clientFolderName = buildClientFolderName(quote.contact.name);
        }

        const { id: clientFolderId, webUrl: clientWebUrl } = await ensureFolder(
          token,
          driveId,
          parentPath,
          clientFolderName,
        );

        if (quote.clientId) {
          await ctx.runMutation(internal.clients._attachSharepointFolder, {
            clientId: quote.clientId,
            itemId: clientFolderId,
            driveId,
            webUrl: clientWebUrl,
          });
        }

        const quoteFolderName = buildQuoteSubfolderName(
          quote.code,
          quote._creationTime,
          client && client.type === "business" ? client.name : quote.contact.name,
        );
        const { id: quoteFolderId, webUrl: quoteWebUrl } = await ensureFolder(
          token,
          driveId,
          `${parentPath}/${clientFolderName}`,
          quoteFolderName,
        );

        const { wycenaFolderId } = await createQuoteSubfolders(
          token,
          driveId,
          `${parentPath}/${clientFolderName}`,
          quoteFolderName,
        );

        await ctx.runMutation(internal.quotes._attachSharepoint, {
          quoteId,
          parentFolderItemId: clientFolderId,
          subfolderItemId: quoteFolderId,
          driveId,
          webUrl: quoteWebUrl,
        });

        // Trigger SharePoint webhook registration
        if (wycenaFolderId) {
          const siteUrl = process.env.CONVEX_SITE_URL;
          if (siteUrl && !siteUrl.includes("127.0.0.1") && !siteUrl.includes("localhost")) {
            const notificationUrl = `${siteUrl}/api/sharepoint/webhook`;
            console.log(`[sharepoint] Rejestracja webhooka dla folderu Wycena: ${wycenaFolderId}`);
            await ctx.scheduler.runAfter(0, internal.sharepointWebhook.subscribeToWycenaFolder, {
              quoteId,
              driveId,
              itemId: wycenaFolderId,
              notificationUrl,
            });
          } else {
            console.warn(
              `[sharepoint] Pomijam rejestrację webhooka dla localhost/brak siteUrl (${siteUrl}).`,
            );
          }
        }

        console.log(
          `[sharepoint] Folder wyceny: ${quoteFolderName} → ${quoteWebUrl} (próba ${attempt})`,
        );
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[sharepoint] Próba ${attempt}/${MAX_ATTEMPTS} nieudana:`, lastError);
      }
    }

    await ctx.runMutation(internal.quotes._markSharepointFailed, {
      quoteId,
      error: lastError,
      attempts: MAX_ATTEMPTS,
    });
  },
});

export const createFolderForOrder = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;
    const parentPath = process.env.SHAREPOINT_PARENT_PATH ?? "Klienci";

    if (!tenantId || !clientId || !clientSecret || !driveId) {
      console.warn(
        "[sharepoint] Brak konfiguracji env — pomijam tworzenie folderu dla zlecenia",
      );
      return;
    }

    const order = (await ctx.runQuery(internal.orders._getInternal, { orderId })) as {
      _id: Id<"orders">;
      orderNumber: string;
      clientName: string;
      clientId?: Id<"clients">;
      createdAt: number;
    } | null;

    if (!order) {
      console.warn(`[sharepoint] Zlecenie ${orderId} nie istnieje — pomijam`);
      return;
    }

    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 2]));
        }

        const token = await getGraphToken(tenantId, clientId, clientSecret);

        let client = null;
        if (order.clientId) {
          client = (await ctx.runQuery(api.clients.get, { id: order.clientId })) as {
            name: string;
            type?: string;
            nip?: string;
          } | null;
        }

        let clientFolderName;
        if (client && client.type === "business" && client.nip) {
          const cleanNip = client.nip.replace(/\D/g, "");
          clientFolderName = `${sanitizeFolderName(client.name)}_${cleanNip}`;
        } else {
          clientFolderName = buildClientFolderName(order.clientName);
        }

        const { id: clientFolderId, webUrl: clientWebUrl } = await ensureFolder(
          token,
          driveId,
          parentPath,
          clientFolderName,
        );

        if (order.clientId) {
          await ctx.runMutation(internal.clients._attachSharepointFolder, {
            clientId: order.clientId,
            itemId: clientFolderId,
            driveId,
            webUrl: clientWebUrl,
          });
        }

        const orderFolderName = buildQuoteSubfolderName(
          order.orderNumber,
          order.createdAt,
          client && client.type === "business" ? client.name : order.clientName,
        );
        const { id: orderFolderId, webUrl: orderWebUrl } = await ensureFolder(
          token,
          driveId,
          `${parentPath}/${clientFolderName}`,
          orderFolderName,
        );

        // Tworzymy podfoldery
        const ORDER_SUBFOLDERS = ["Produkcja", "Załącznik", "Zamówienia", "Dokumentacja", "Umowy"];
        for (const folderName of ORDER_SUBFOLDERS) {
          await ensureFolder(
            token,
            driveId,
            `${parentPath}/${clientFolderName}/${orderFolderName}`,
            folderName
          );
        }
        await ctx.runMutation(internal.orders._attachSharepoint, {
          orderId,
          parentFolderItemId: clientFolderId,
          subfolderItemId: orderFolderId,
          driveId,
          webUrl: orderWebUrl,
        });

        console.log(
          `[sharepoint] Folder zlecenia: ${orderFolderName} → ${orderWebUrl} (próba ${attempt})`,
        );
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[sharepoint] Próba ${attempt}/${MAX_ATTEMPTS} nieudana dla zlecenia:`, lastError);
      }
    }

    await ctx.runMutation(internal.orders._markSharepointFailed, {
      orderId,
      error: lastError,
      attempts: MAX_ATTEMPTS,
    });
  },
});

// ─── Internal variants for webhook-triggered OCR ──────────────────────────────

// Internal version of listWycenaSubfolderFiles (no auth check)
export const listWycenaSubfolderFilesInternal = internalAction({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.runQuery(api.quotes.get, { id: quoteId });
    const sp = quote?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId || sp.status !== "created") return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.subfolderItemId}:/Wycena:/children` +
        `?$select=id,name,size,lastModifiedDateTime,file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) return [];
    if (!res.ok) return [];

    const data = (await res.json()) as {
      value: Array<{ id: string; name: string; size: number; lastModifiedDateTime: string; file?: { mimeType: string } }>;
    };

    return data.value
      .filter((item) => !!item.file && item.name.toLowerCase().endsWith(".pdf"))
      .map((item) => ({ id: item.id, name: item.name }));
  },
});

// Internal version of runOcrForFile (called from webhook handler)
export const runOcrForFileInternal = internalAction({
  args: {
    quoteId: v.id("quotes"),
    fileItemId: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Delegate to the public action — it has all the logic
    await ctx.runAction(api.sharepoint.runOcrForFile, args);
  },
});

export const listAvailableAnthropicModels = action({
  args: {},
  handler: async (ctx) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return { error: "Brak ANTHROPIC_API_KEY w konfiguracji Convex" };
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      return { status: res.status, errorText: await res.text() };
    }
    const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string; created_at?: string }> };
    return { status: res.status, models: data.data ?? [] };
  },
});


// --- ORDER SHAREPOINT METHODS ---
export const listOrderFolderContents = action({
  args: { orderId: v.id("orders"), folderId: v.optional(v.string()) },
  handler: async (ctx, { orderId, folderId }) => {
    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    const sp = order?.sharepoint;
    if (!sp?.subfolderItemId || !sp?.driveId) return [];

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) return [];

    const targetId = folderId ?? sp.subfolderItemId;
    const token = await getGraphToken(tenantId, clientId, clientSecret);

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${targetId}/children` +
        `?$select=id,name,size,lastModifiedDateTime,file,folder`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph list folder ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        file?: { mimeType: string };
        folder?: { childCount: number };
      }>;
    };

    const items = data.value.map((item) => ({
      id: item.id,
      name: item.name,
      isFolder: !!item.folder,
      size: item.size ?? 0,
      lastModifiedDateTime: item.lastModifiedDateTime ?? "",
      mimeType: item.file?.mimeType ?? "",
      childCount: item.folder?.childCount ?? 0,
    }));

    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "pl");
    });

    return items;
  },
});

export const createOrderSharepointSubfolder = action({
  args: { orderId: v.id("orders"), parentItemId: v.string(), name: v.string() },
  handler: async (ctx, { orderId, parentItemId, name }) => {
    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    const sp = order?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const cleanName = sanitizeFolderName(name);
    if (!cleanName) throw new Error("Nieprawidłowa nazwa folderu");

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${parentItemId}/children`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph create folder ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      name: string;
      lastModifiedDateTime: string;
    };

    return {
      id: data.id,
      name: data.name,
      isFolder: true as const,
      size: 0,
      lastModifiedDateTime: data.lastModifiedDateTime ?? new Date().toISOString(),
      mimeType: "",
      childCount: 0,
    };
  },
});

export const getOrderFileForPreview = action({
  args: { orderId: v.id("orders"), fileId: v.string() },
  handler: async (ctx, { orderId, fileId }): Promise<{ base64: string; contentType: string }> => {
    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    const sp = order?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) throw new Error(`Nie można pobrać pliku (${res.status})`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new Error("Plik jest za duży do podglądu (max 8 MB)");
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return { base64, contentType };
  },
});

export const deleteOrderSharepointItem = action({
  args: { orderId: v.id("orders"), itemId: v.string() },
  handler: async (ctx, { orderId, itemId }) => {
    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    const sp = order?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    await deleteFolder(token, sp.driveId, itemId);
  },
});

export const createOrderUploadSessionInFolder = action({
  args: { orderId: v.id("orders"), parentItemId: v.string(), fileName: v.string() },
  handler: async (ctx, { orderId, parentItemId, fileName }) => {
    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    const sp = order?.sharepoint;
    if (!sp?.driveId) throw new Error("Brak folderu SharePoint");

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const encodedName = encodeURIComponent(fileName);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${parentItemId}:/${encodedName}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "rename" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph upload session ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { uploadUrl: string };
    return { uploadUrl: data.uploadUrl };
  },
});

export const uploadPartnerFileToOrder = internalAction({
  args: {
    orderIdOrNumber: v.string(),
    fileType: v.union(v.literal("RW"), v.literal("Rysunek")),
    fileName: v.string(),
    fileBase64: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find the order by ID or orderNumber
    let order = null;
    if (args.orderIdOrNumber.length === 32) {
      order = await ctx.runQuery(internal.orders._getInternal, { orderId: args.orderIdOrNumber as any });
    }
    if (!order) {
      order = await ctx.runQuery(internal.orders.getByOrderNumberInternal, { orderNumber: args.orderIdOrNumber });
    }
    if (!order) throw new Error("Nie znaleziono zlecenia.");

    const targetOrderId = order._id;

    let sp = order.sharepoint;
    if (!sp?.driveId || !sp?.subfolderItemId) {
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        const refetched = await ctx.runQuery(internal.orders._getInternal, { orderId: targetOrderId });
        sp = refetched?.sharepoint;
        if (sp?.driveId && sp?.subfolderItemId) {
          order = refetched;
          break;
        }
      }
    }

    if (!sp?.driveId || !sp?.subfolderItemId) {
      try {
        await ctx.runAction(internal.sharepoint.createFolderForOrder, { orderId: targetOrderId });
        order = await ctx.runQuery(internal.orders._getInternal, { orderId: targetOrderId });
        sp = order?.sharepoint;
      } catch (e) {
        console.error("Błąd synchronicznego tworzenia folderu SharePoint:", e);
      }
    }

    if (!sp?.driveId || !sp?.subfolderItemId) {
      throw new Error("Zlecenie nie ma utworzonego folderu SharePoint.");
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany w zmiennych środowiskowych.");
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);

    // 2. Upload to "Dokumentacja" subfolder on SharePoint if present, otherwise main folder
    let targetFolderId = sp.subfolderItemId;
    try {
      const folderRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.subfolderItemId}:/Dokumentacja`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (folderRes.ok) {
        const folderData = (await folderRes.json()) as { id: string };
        targetFolderId = folderData.id;
      }
    } catch (e) {
      console.warn("Nie udało się odnaleźć podfolderu Dokumentacja, zapisuję w folderze głównym:", e);
    }

    // 3. Upload file content to SharePoint under targetFolderId
    const binaryBuffer = Buffer.from(args.fileBase64, "base64");

    // Format the filename: e.g. "RW_specyfikacja.pdf" or "Rysunek_layout.png"
    const prefixedName = `${args.fileType}_${args.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const encodedName = encodeURIComponent(prefixedName);

    const uploadRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${targetFolderId}:/${encodedName}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: binaryBuffer,
      }
    );

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      throw new Error(`Graph file upload failed ${uploadRes.status}: ${txt}`);
    }

    const uploadData = await uploadRes.json() as { id: string; name: string; webUrl: string };

    // 4. Log order activity
    await ctx.runMutation(internal.orders.logFileActivity, {
      orderId: targetOrderId,
      title: "Przesłano dokument przez API",
      detail: `Dodano plik ${prefixedName} do głównego folderu zlecenia w SharePoint`,
    });

    return {
      success: true,
      fileId: uploadData.id,
      fileName: uploadData.name,
      webUrl: uploadData.webUrl,
    };
  },
});



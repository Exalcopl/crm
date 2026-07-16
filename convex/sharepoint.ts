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
  args: { quoteId: v.id("quotes"), fileName: v.string() },
  handler: async (ctx, { quoteId, fileName }) => {
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
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${sp.driveId}/items/${sp.subfolderItemId}:/${encodedName}:/createUploadSession`,
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
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("SharePoint nie jest skonfigurowany");
    }
    if (!anthropicKey) {
      throw new Error("Brak klucza ANTHROPIC_API_KEY w konfiguracji Convex");
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

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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
                text: `Przeanalizuj ten dokument oferty/wyceny i wyodrębnij WSZYSTKIE dostępne dane.

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

Pole "dodatkowe" wypełnij wszelkimi informacjami z dokumentu które nie zmieściły się w powyższych polach (np. warunki płatności, terminy realizacji, gwarancja, certyfikaty, warunki handlowe itp.).`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const text = await anthropicRes.text();
      throw new Error(`Błąd API Claude (${anthropicRes.status}): ${text.slice(0, 200)}`);
    }

    const anthropicData = (await anthropicRes.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const rawText =
      anthropicData.content.find((c) => c.type === "text")?.text ?? "";

    let ocrJson: Record<string, unknown> & {
      podsumowanie?: { netto?: number | null; vat?: number | null; brutto?: number | null; waluta?: string | null } | null;
      pozycje?: Array<{
        lp?: number | null;
        opis?: string | null;
        ilosc?: string | number | null;
        jednostka?: string | null;
        cena_netto?: number | null;
        wartosc_netto?: number | null;
      }> | null;
    };
    try {
      ocrJson = JSON.parse(rawText) as typeof ocrJson;
    } catch {
      ocrJson = { raw: rawText };
    }

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
    const valueNetto = typeof podsumowanie?.netto === "number" ? podsumowanie.netto : 0;
    const valueBrutto = typeof podsumowanie?.brutto === "number"
      ? podsumowanie.brutto
      : valueNetto * (1 + vatRate / 100);
    const valueVat = valueBrutto - valueNetto;

    const items = (ocrJson.pozycje ?? []).map((p, idx) => ({
      lp: typeof p.lp === "number" ? p.lp : idx + 1,
      description: p.opis ?? "",
      quantity: typeof p.ilosc === "number" ? p.ilosc : (p.ilosc != null ? parseFloat(String(p.ilosc)) || null : null),
      unit: p.jednostka ?? undefined,
      priceNetto: typeof p.cena_netto === "number" ? p.cena_netto : null,
      valueNetto: typeof p.wartosc_netto === "number" ? p.wartosc_netto : null,
    }));

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
): Promise<void> {
  for (const folderName of QUOTE_SUBFOLDERS) {
    await ensureFolder(token, driveId, `${parentPath}/${quoteFolderName}`, folderName);
  }
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

        await createQuoteSubfolders(
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
  handler: async (ctx, args) => {
    // Delegate to the public action — it has all the logic
    return await ctx.runAction(api.sharepoint.runOcrForFile, args);
  },
});


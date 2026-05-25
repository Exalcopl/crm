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

        const clientFolderName = buildClientFolderName(quote.contact.name);
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
          quote.contact.name,
        );
        const { id: quoteFolderId, webUrl: quoteWebUrl } = await ensureFolder(
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

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500, 4500];

function sanitizeFolderName(raw: string): string {
  // Remove characters forbidden by SharePoint
  let name = raw.replace(/[\\/:*?"<>|#%]/g, "_");
  // Collapse multiple underscores/spaces
  name = name.replace(/[_\s]+/g, "_");
  // Remove leading/trailing dots, spaces, underscores
  name = name.replace(/^[.\s_]+|[.\s_]+$/g, "");
  // Truncate to 200 chars (SharePoint limit is 255, we leave room for prefix)
  if (name.length > 200) name = name.slice(0, 200);
  return name || "klient";
}

function buildFolderName(code: string, contactName: string): string {
  const sanitized = sanitizeFolderName(contactName);
  return `${code}_${sanitized}`;
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
  const parentRef = encodedPath
    ? `/drives/${driveId}/root:/${encodedPath}`
    : `/drives/${driveId}/root`;

  // First check if folder already exists
  const checkUrl = `https://graph.microsoft.com/v1.0${parentRef}:/${encodeURIComponent(folderName)}`;
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

  // Create the folder
  const createUrl = `https://graph.microsoft.com/v1.0${parentRef}/children`;
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
    // Concurrent creation race — re-check
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

export const createFolderForQuote = internalAction({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const driveId = process.env.MS_GRAPH_DRIVE_ID;
    const parentPath = process.env.SHAREPOINT_PARENT_PATH ?? "";

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
    } | null;

    if (!quote) {
      console.warn(`[sharepoint] Wycena ${quoteId} nie istnieje — pomijam`);
      return;
    }

    const folderName = buildFolderName(quote.code, quote.contact.name);
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 2]));
        }

        const token = await getGraphToken(tenantId, clientId, clientSecret);
        const { id: folderId, webUrl } = await ensureFolder(
          token,
          driveId,
          parentPath,
          folderName,
        );

        await ctx.runMutation(internal.quotes._attachSharepoint, {
          quoteId,
          folderId,
          driveId,
          itemId: folderId,
          webUrl,
        });

        console.log(
          `[sharepoint] Folder utworzony: ${folderName} → ${webUrl} (próba ${attempt})`,
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

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Webhook subscription management ─────────────────────────────────────────

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

// Subscribe to SharePoint webhook notifications for a quote's "Wycena" subfolder
export const subscribeToWycenaFolder = internalAction({
  args: {
    quoteId: v.id("quotes"),
    driveId: v.string(),
    itemId: v.string(), // itemId of the "Wycena" subfolder
    notificationUrl: v.string(),
  },
  handler: async (ctx, { quoteId, driveId, itemId, notificationUrl }) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      console.warn("[webhook] Brak konfiguracji MS — nie subskrybuję webhooków");
      return;
    }

    const token = await getGraphToken(tenantId, clientId, clientSecret);

    // SharePoint webhook subscriptions expire after max 180 days
    const expirationDateTime = new Date(Date.now() + 179 * 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "updated",
        notificationUrl,
        resource: `/drives/${driveId}/items/${itemId}`,
        expirationDateTime,
        clientState: `quoteId:${quoteId}`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[webhook] Subskrypcja nieudana (${res.status}): ${text}`);
      return;
    }

    const data = (await res.json()) as { id: string; expirationDateTime: string };
    console.log(`[webhook] Subskrybowano: ${data.id} expires ${data.expirationDateTime}`);

    await ctx.runMutation(internal.sharepointWebhookDb._saveSubscription, {
      subscriptionId: data.id,
      driveId,
      itemId,
      quoteId,
      expirationDateTime: data.expirationDateTime,
    });
  },
});

// Called when SharePoint notifies us of changes in the Wycena folder.
// Lists current PDF files and for each that has no version yet → runs OCR.
export const handleWycenaFolderChanged = internalAction({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, { quoteId }) => {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      console.warn("[webhook] Brak konfiguracji MS — pomijam OCR");
      return;
    }

    // Get current files from Wycena subfolder
    let files: Array<{ id: string; name: string }>;
    try {
      files = await ctx.runAction(internal.sharepoint.listWycenaSubfolderFilesInternal, {
        quoteId,
      });
    } catch (err) {
      console.error("[webhook] Błąd listowania plików:", err);
      return;
    }

    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) return;

    // For each PDF, check if a version already exists for this file
    const existingFileIds = await ctx.runQuery(internal.quoteVersions._listFileIds, {
      quoteId,
    });
    const processedFileIds = new Set(existingFileIds);

    for (const file of pdfFiles) {
      if (!processedFileIds.has(file.id)) {
        console.log(`[webhook] Nowy plik wykryty: ${file.name} — uruchamiam OCR`);
        try {
          await ctx.runAction(internal.sharepoint.runOcrForFileInternal, {
            quoteId,
            fileItemId: file.id,
            fileName: file.name,
          });
        } catch (err) {
          console.error(`[webhook] OCR nieudany dla ${file.name}:`, err);
        }
      }
    }
  },
});

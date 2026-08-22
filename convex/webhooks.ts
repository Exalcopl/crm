"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Akcja wysyłająca powiadomienie (webhook) do systemu Partnera w tle.
export const triggerPartnerWebhook = internalAction({
  args: {
    partnerId: v.id("partners"),
    orderId: v.id("orders"),
    orderNumber: v.string(),
    oldStatus: v.string(),
    newStatus: v.string(),
    deliveryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Pobierz dane partnera (webhookUrl, webhookSecret)
    const partner = await ctx.runQuery(internal.partners.getInternal, { id: args.partnerId });
    if (!partner || !partner.webhookUrl || !partner.isActive) {
      console.log(`[webhook] Pomijanie partnera: ${partner?.name || "Nieznany"} (brak aktywnego URL)`);
      return;
    }

    const order = await ctx.runQuery(internal.orders._getInternal, { id: args.orderId });

    const payload = {
      event: "order.updated",
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      oldStatus: args.oldStatus,
      newStatus: args.newStatus,
      status: args.newStatus,
      deliveryDate: args.deliveryDate || order?.deliveryDate || order?.acceptanceDate || undefined,
      timestamp: Date.now(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Exalco-CRM-Webhook/1.0",
    };

    // Podpisz payload HMAC SHA-256 jeśli secret jest ustawiony
    if (partner.webhookSecret) {
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", partner.webhookSecret);
      const signature = hmac.update(JSON.stringify(payload)).digest("hex");
      headers["X-Exalco-Signature"] = signature;
    }

    console.log(`[webhook] Wysyłanie powiadomienia do ${partner.name} (${partner.webhookUrl})...`);

    try {
      const res = await fetch(partner.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`[webhook] Partner ${partner.name} webhook odpowiedział statusem ${res.status}`);
      } else {
        console.log(`[webhook] Pomyślnie dostarczono webhook do ${partner.name}`);
      }
    } catch (err) {
      console.error(`[webhook] Błąd podczas wysyłania do ${partner.name}:`, err);
    }
  },
});

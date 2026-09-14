import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const list = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const notes = await ctx.db
      .query("orderNotes")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("asc")
      .collect();

    if (notes.length > 0) {
      return notes;
    }

    // Fallback dla niezmigrowanych starych zleceń z polem order.notes
    const order = await ctx.db.get(orderId);
    if (!order?.notes || !order.notes.trim()) {
      return [];
    }

    // Rozbicie połączonych notatek ze starego pola orders.notes
    const rawParts = order.notes.split(/\n\n---\n\n/);
    const virtualNotes = rawParts.map((part, index) => {
      let text = part.trim();
      let authorName = "System / Wycena";

      // Parsowanie nagłówków w klamrach [ ... ]
      const match = text.match(/^(\[[^\]]+\]|📍 \[NOTATKA DO LOKALIZACJI\]):\n/);
      if (match) {
        authorName = match[1].replace(/^\[|\]$/g, "");
        text = text.substring(match[0].length).trim();
      }

      return {
        _id: `legacy-${orderId}-${index}` as any,
        orderId,
        text,
        authorId: null,
        authorName,
        createdAt: order._creationTime + index * 1000,
        isLegacy: true,
      };
    });

    return virtualNotes;
  },
});

export const add = mutation({
  args: {
    orderId: v.id("orders"),
    text: v.string(),
    authorName: v.string(),
    isPartner: v.optional(v.boolean()),
    isPartnerThread: v.optional(v.boolean()),
    threadId: v.optional(v.id("orderNotes")),
  },
  handler: async (ctx, { orderId, text, authorName, isPartner, isPartnerThread, threadId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId && !isPartner) throw new Error("Brak autoryzacji");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Treść notatki nie może być pusta");
    const createdAt = Date.now();

    const isThreadRoot = !!isPartnerThread && !threadId;
    const initialThreadStatus = isThreadRoot ? "pending_response" : undefined;

    const noteId = await ctx.db.insert("orderNotes", {
      orderId,
      text: trimmed,
      authorId: callerId ?? null,
      authorName,
      createdAt,
      isPartner: isPartner ?? false,
      threadId: threadId ?? undefined,
      parentNoteId: threadId ?? undefined,
      isPartnerThreadRoot: isThreadRoot ? true : undefined,
      threadStatus: initialThreadStatus,
    });

    // Jeśli to odpowiedź w istniejącym wątku wysłana przez Exalco, przywróć status "pending_response"
    if (threadId && !isPartner) {
      const rootNote = await ctx.db.get(threadId);
      if (rootNote && rootNote.threadStatus !== "closed") {
        await ctx.db.patch(threadId, { threadStatus: "pending_response" });
      }
    }

    // Wysyłaj Webhook do ADK Okna TYLKO jeśli wiadomość jest jawnie skierowana do partnera
    // (jest korzeniem nowego wątku partnera LUB jest odpowiedzią w wątku partnera)
    const shouldSendToPartner = (isThreadRoot || !!threadId) && !isPartner;
    if (shouldSendToPartner) {
      const order = await ctx.db.get(orderId);
      if (order && order.partnerId) {
        const targetThreadId = isThreadRoot ? noteId : threadId!;
        await ctx.scheduler.runAfter(0, internal.webhooks.triggerPartnerWebhook, {
          partnerId: order.partnerId,
          orderId: order._id,
          orderNumber: order.orderNumber,
          event: "order.note_added",
          note: {
            text: trimmed,
            authorName,
            createdAt,
            threadId: targetThreadId,
            noteId,
          },
        });
      }
    }

    return noteId;
  },
});

export const update = mutation({
  args: { id: v.id("orderNotes"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const note = await ctx.db.get(id);
    if (!note) throw new Error("Notatka nie istnieje");

    // Zabezpieczenie spójności audytowej — notatki oficjalnej komunikacji z ADK są zablokowane
    if (note.isPartner || note.isPartnerThreadRoot || note.threadId) {
      throw new Error("Nie można edytować wiadomości przesłanych do lub odebranych od ADK Okna");
    }

    if (note.authorId && note.authorId !== callerId) {
      throw new Error("Możesz edytować tylko swoje wpisy");
    }
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Treść notatki nie może być pusta");
    await ctx.db.patch(id, { text: trimmed });
  },
});

export const remove = mutation({
  args: { id: v.id("orderNotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const caller = await ctx.db.get(callerId);
    const role = caller?.roleId ? await ctx.db.get(caller.roleId) : null;
    if (role?.name !== "admin" && role?.name !== "super_admin") {
      throw new Error("Wpisy może usuwać tylko administrator");
    }
    const note = await ctx.db.get(id);
    if (!note) return;

    // Zabezpieczenie spójności audytowej — notatki oficjalnej komunikacji z ADK są zablokowane
    if (note.isPartner || note.isPartnerThreadRoot || note.threadId) {
      throw new Error("Nie można usuwać wiadomości stanowiących część oficjalnej komunikacji z ADK Okna");
    }

    await ctx.db.delete(id);
  },
});

export const closeThread = mutation({
  args: { threadId: v.id("orderNotes") },
  handler: async (ctx, { threadId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const note = await ctx.db.get(threadId);
    if (!note) throw new Error("Wątek nie istnieje");

    await ctx.db.patch(threadId, { threadStatus: "closed" });
  },
});

export const reopenThread = mutation({
  args: { threadId: v.id("orderNotes") },
  handler: async (ctx, { threadId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const note = await ctx.db.get(threadId);
    if (!note) throw new Error("Wątek nie istnieje");

    await ctx.db.patch(threadId, { threadStatus: "pending_response" });
  },
});

// Migracja jednorazowa: przenieś stare pola orders.notes do tabeli orderNotes
export const migrateAllLegacyOrderNotes = mutation({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    let migratedCount = 0;

    for (const order of orders) {
      const existingNotes = await ctx.db
        .query("orderNotes")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      if (existingNotes.length > 0) continue;

      const legacyText = (order.notes ?? "").trim();
      if (!legacyText) continue;

      const rawParts = legacyText.split(/\n\n---\n\n/);
      for (let i = 0; i < rawParts.length; i++) {
        let text = rawParts[i].trim();
        let authorName = "Import / Wycena";

        const match = text.match(/^(\[[^\]]+\]|📍 \[NOTATKA DO LOKALIZACJI\]):\n/);
        if (match) {
          authorName = match[1].replace(/^\[|\]$/g, "");
          text = text.substring(match[0].length).trim();
        }

        await ctx.db.insert("orderNotes", {
          orderId: order._id,
          text,
          authorId: null,
          authorName,
          createdAt: order.createdAt + i * 1000,
        });
      }
      migratedCount++;
    }

    return { migratedCount };
  },
});

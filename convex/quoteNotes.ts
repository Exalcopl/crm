import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db
      .query("quoteNotes")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .order("asc")
      .collect();
  },
});

export const add = mutation({
  args: {
    quoteId: v.id("quotes"),
    text: v.string(),
    authorName: v.string(),
  },
  handler: async (ctx, { quoteId, text, authorName }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Treść notatki nie może być pusta");
    return await ctx.db.insert("quoteNotes", {
      quoteId,
      text: trimmed,
      authorId: callerId,
      authorName,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { id: v.id("quoteNotes"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const note = await ctx.db.get(id);
    if (!note) throw new Error("Notatka nie istnieje");
    if (note.authorId && note.authorId !== callerId) throw new Error("Możesz edytować tylko swoje wpisy");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Treść notatki nie może być pusta");
    await ctx.db.patch(id, { text: trimmed });
  },
});

export const remove = mutation({
  args: { id: v.id("quoteNotes") },
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
    await ctx.db.delete(id);
  },
});

// Migracja jednorazowa: przenieś stare pole quote.notes do feedu quoteNotes
export const migrateLegacyNotesToFeed = mutation({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    let migrated = 0;
    for (const q of quotes) {
      const legacy = (q.notes ?? "").trim();
      if (!legacy) continue;
      let authorName = "Import";
      if (q.ownerId) {
        const owner = await ctx.db.get(q.ownerId);
        authorName = owner?.name ?? owner?.email ?? "Import";
      }
      await ctx.db.insert("quoteNotes", {
        quoteId: q._id,
        text: legacy,
        authorId: q.ownerId ?? null,
        authorName,
        createdAt: q._creationTime,
      });
      await ctx.db.patch(q._id, { notes: undefined });
      migrated++;
    }
    return { migrated };
  },
});

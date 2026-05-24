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

export const remove = mutation({
  args: { id: v.id("quoteNotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.delete(id);
  },
});

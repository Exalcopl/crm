import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    return await ctx.db
      .query("clientNotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .order("asc")
      .collect();
  },
});

export const add = mutation({
  args: {
    clientId: v.id("clients"),
    text: v.string(),
    authorName: v.string(),
  },
  handler: async (ctx, { clientId, text, authorName }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Treść notatki nie może być pusta");
    return await ctx.db.insert("clientNotes", {
      clientId,
      text: trimmed,
      authorId: callerId,
      authorName,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("clientNotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.delete(id);
  },
});

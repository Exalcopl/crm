import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];
    return ctx.db
      .query("quoteActivity")
      .withIndex("by_quote_created", (q) => q.eq("quoteId", quoteId))
      .order("desc")
      .collect();
  },
});

export const logInternal = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    type: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("quoteActivity", {
      quoteId: args.quoteId,
      type: args.type,
      title: args.title,
      detail: args.detail,
      authorId: args.authorId as Id<"users"> | null,
      authorName: args.authorName,
      createdAt: Date.now(),
    });
  },
});

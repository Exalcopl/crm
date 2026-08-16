import { v } from "convex/values";
import { mutation, internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];
    return ctx.db
      .query("orderActivity")
      .withIndex("by_order_created", (q) => q.eq("orderId", orderId))
      .order("desc")
      .collect();
  },
});

export const logInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    type: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("orderActivity", {
      orderId: args.orderId,
      type: args.type,
      title: args.title,
      detail: args.detail,
      authorId: args.authorId as Id<"users"> | null,
      authorName: args.authorName,
      createdAt: Date.now(),
    });
  },
});

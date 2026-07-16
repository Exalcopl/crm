import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ─── DB helpers (no "use node" — standard runtime) ────────────────────────────

export const _saveSubscription = internalMutation({
  args: {
    subscriptionId: v.string(),
    driveId: v.string(),
    itemId: v.string(),
    quoteId: v.id("quotes"),
    expirationDateTime: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sharepointWebhookSubscriptions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { expirationDateTime: args.expirationDateTime });
    } else {
      await ctx.db.insert("sharepointWebhookSubscriptions", {
        ...args,
        createdAt: Date.now(),
      });
    }
  },
});

export const _getSubscriptionByQuote = internalQuery({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db
      .query("sharepointWebhookSubscriptions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .first();
  },
});

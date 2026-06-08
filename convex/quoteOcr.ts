import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

export const listByQuote = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db
      .query("quoteOcrResults")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
  },
});

export const _saveResult = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    fileItemId: v.string(),
    fileName: v.string(),
    ocrJson: v.any(),
  },
  handler: async (ctx, { quoteId, fileItemId, fileName, ocrJson }) => {
    const existing = await ctx.db
      .query("quoteOcrResults")
      .withIndex("by_quote_file", (q) =>
        q.eq("quoteId", quoteId).eq("fileItemId", fileItemId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ocrJson,
        fileName,
        processedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("quoteOcrResults", {
        quoteId,
        fileItemId,
        fileName,
        ocrJson,
        processedAt: Date.now(),
      });
    }
  },
});

export const deleteResult = mutation({
  args: { id: v.id("quoteOcrResults") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

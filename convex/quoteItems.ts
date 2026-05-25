import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function recomputeQuoteValue(
  ctx: MutationCtx,
  quoteId: Id<"quotes">,
): Promise<number | null> {
  const items = await ctx.db
    .query("quoteItems")
    .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
    .collect();
  if (items.length === 0) {
    await ctx.db.patch(quoteId, { value: null });
    return null;
  }
  const total = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const rounded = Math.round(total * 100) / 100;
  await ctx.db.patch(quoteId, { value: rounded });
  return rounded;
}

function computeLineTotal(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice * 100) / 100;
}

export const list = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

export const add = mutation({
  args: {
    quoteId: v.id("quotes"),
    name: v.string(),
    dimensions: v.optional(v.string()),
    material: v.optional(v.string()),
    qty: v.number(),
    unitPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const existing = await ctx.db
      .query("quoteItems")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .collect();
    const nextOrder =
      existing.length === 0
        ? 1
        : Math.max(...existing.map((it) => it.order)) + 1;

    const itemId = await ctx.db.insert("quoteItems", {
      quoteId: args.quoteId,
      name: args.name.trim() || "Pozycja",
      dimensions: args.dimensions?.trim() || undefined,
      material: args.material?.trim() || undefined,
      qty: args.qty,
      unitPrice: args.unitPrice,
      lineTotal: computeLineTotal(args.qty, args.unitPrice),
      order: nextOrder,
    });

    await recomputeQuoteValue(ctx, args.quoteId);
    return itemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("quoteItems"),
    name: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    material: v.optional(v.string()),
    qty: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const item = await ctx.db.get(id);
    if (!item) throw new Error("Pozycja nie istnieje");

    const next = {
      name: patch.name !== undefined ? (patch.name.trim() || "Pozycja") : item.name,
      dimensions:
        patch.dimensions !== undefined
          ? (patch.dimensions.trim() || undefined)
          : item.dimensions,
      material:
        patch.material !== undefined
          ? (patch.material.trim() || undefined)
          : item.material,
      qty: patch.qty !== undefined ? patch.qty : item.qty,
      unitPrice:
        patch.unitPrice !== undefined ? patch.unitPrice : item.unitPrice,
    };

    await ctx.db.patch(id, {
      ...next,
      lineTotal: computeLineTotal(next.qty, next.unitPrice),
    });

    await recomputeQuoteValue(ctx, item.quoteId);
  },
});

export const remove = mutation({
  args: { id: v.id("quoteItems") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.delete(id);
    await recomputeQuoteValue(ctx, item.quoteId);
  },
});

export const reorder = mutation({
  args: {
    quoteId: v.id("quotes"),
    orderedIds: v.array(v.id("quoteItems")),
  },
  handler: async (ctx, { quoteId, orderedIds }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    for (let i = 0; i < orderedIds.length; i++) {
      const it = await ctx.db.get(orderedIds[i]);
      if (!it || it.quoteId !== quoteId) continue;
      await ctx.db.patch(orderedIds[i], { order: i + 1 });
    }
  },
});

export const _deleteByQuote = internalMutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    await Promise.all(items.map((it) => ctx.db.delete(it._id)));
  },
});

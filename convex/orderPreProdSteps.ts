import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Pobiera wszystkie etapy przedprodukcyjne danego zlecenia, posortowane wg pola order */
export const list = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("asc")
      .collect();
  },
});

/** Dodaje nowy etap na końcu listy */
export const add = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
  },
  handler: async (ctx, { orderId, title }) => {
    const existing = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;
    return await ctx.db.insert("orderPreProdSteps", {
      orderId,
      title: title.trim(),
      done: false,
      order: nextOrder,
      createdAt: Date.now(),
    });
  },
});

/** Aktualizuje daty etapu (wywoływane po przeciągnięciu paska na osi czasu) */
export const updateDates = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { id, startDate, endDate }) => {
    await ctx.db.patch(id, {
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });
  },
});

/** Aktualizuje tytuł etapu */
export const updateTitle = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, { title: title.trim() });
  },
});

/** Toggle ukończenia etapu */
export const setDone = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    done: v.boolean(),
  },
  handler: async (ctx, { id, done }) => {
    await ctx.db.patch(id, { done });
  },
});

/** Przypisuje osobę do etapu */
export const setAssignee = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, assigneeId }) => {
    await ctx.db.patch(id, { assigneeId: assigneeId ?? undefined });
  },
});

/** Zmienia kolejność etapu */
export const reorder = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    order: v.number(),
  },
  handler: async (ctx, { id, order }) => {
    await ctx.db.patch(id, { order });
  },
});

/** Usuwa etap */
export const remove = mutation({
  args: { id: v.id("orderPreProdSteps") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

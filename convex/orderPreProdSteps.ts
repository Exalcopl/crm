import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Pobiera wszystkie kroki (zadania + podzadania) zlecenia, posortowane wg pola order */
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

/**
 * Pobiera WSZYSTKIE zadania przedprodukcyjne (ze wszystkich zleceń),
 * które mają przypisanego użytkownika — do wyświetlenia na panelu.
 * Wzbogaca każde zadanie o dane zlecenia: orderNumber, clientName.
 */
export const listAllWithAssignee = query({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db
      .query("orderPreProdSteps")
      .collect();

    // Filtruj tylko te z przypisanym użytkownikiem (zależnie od tego czy użyto assigneeId czy assigneeIds)
    const withAssignee = steps.filter((s) => (s.assigneeIds && s.assigneeIds.length > 0) || !!s.assigneeId);

    // Pobierz unikalne zlecenia
    const orderIds = [...new Set(withAssignee.map((s) => s.orderId))];
    const orders = await Promise.all(orderIds.map((id) => ctx.db.get(id)));
    const ordersMap = new Map(
      orders
        .filter(Boolean)
        .map((o) => [o!._id, { orderNumber: o!.orderNumber, clientName: o!.clientName }])
    );

    return withAssignee.map((s) => {
      // normalizacja assigneeIds
      const assigneeIds = s.assigneeIds ?? (s.assigneeId ? [s.assigneeId] : []);
      return {
        ...s,
        assigneeIds,
        orderNumber: ordersMap.get(s.orderId)?.orderNumber ?? "—",
        clientName: ordersMap.get(s.orderId)?.clientName ?? "—",
      };
    });
  },
});


/** Dodaje nowe zadanie lub podzadanie */
export const add = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    parentId: v.optional(v.id("orderPreProdSteps")),
  },
  handler: async (ctx, { orderId, title, parentId }) => {
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
      parentId,
      createdAt: Date.now(),
    });
  },
});

/** Aktualizuje daty zadania (wywoływane po przeciągnięciu paska na osi czasu) */
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

/** Aktualizuje tytuł zadania */
export const updateTitle = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, { title: title.trim() });
  },
});

/** Toggle ukończenia zadania */
export const setDone = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    done: v.boolean(),
  },
  handler: async (ctx, { id, done }) => {
    await ctx.db.patch(id, { done });
  },
});

/** Przypisuje osoby do zadania (tablica ID) */
export const setAssigneeIds = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, { id, assigneeIds }) => {
    await ctx.db.patch(id, {
      assigneeIds,
      assigneeId: assigneeIds.length > 0 ? assigneeIds[0] : undefined,
    });
  },
});

/** Przypisuje osobę do zadania (legacy single) */
export const setAssignee = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, assigneeId }) => {
    const ids = assigneeId ? [assigneeId] : [];
    await ctx.db.patch(id, {
      assigneeId: assigneeId ?? undefined,
      assigneeIds: ids,
    });
  },
});

/** Ustawia rodzica (podzadanie) */
export const setParent = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    parentId: v.union(v.id("orderPreProdSteps"), v.null()),
  },
  handler: async (ctx, { id, parentId }) => {
    await ctx.db.patch(id, { parentId: parentId ?? undefined });
  },
});

/** Zmienia kolejność zadania */
export const reorder = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    order: v.number(),
  },
  handler: async (ctx, { id, order }) => {
    await ctx.db.patch(id, { order });
  },
});

/** Usuwa zadanie (i jego podzadania) */
export const remove = mutation({
  args: { id: v.id("orderPreProdSteps") },
  handler: async (ctx, { id }) => {
    // Usuń podzadania
    const children = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_parent", (q) => q.eq("parentId", id))
      .collect();
    for (const child of children) {
      await ctx.db.delete(child._id);
    }
    await ctx.db.delete(id);
  },
});

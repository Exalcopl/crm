import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    orderId: v.id("orders"),
    supplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Generowanie numeru zamówienia
    const year = new Date().getFullYear();
    const orderNumber = `ZAM/${year}/${Math.floor(Math.random() * 10000)}`;

    const subOrderId = await ctx.db.insert("subOrders", {
      orderId: args.orderId,
      supplierId: args.supplierId,
      status: "utworzono",
      orderNumber,
      createdAt: Date.now(),
    });

    return subOrderId;
  },
});

export const listForOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subOrders")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
  },
});

export const get = query({
  args: { subOrderId: v.id("subOrders") },
  handler: async (ctx, args) => {
    const subOrder = await ctx.db.get(args.subOrderId);
    if (!subOrder) throw new Error("Not found");
    
    const items = await ctx.db
      .query("subOrderItems")
      .withIndex("by_subOrder", (q) => q.eq("subOrderId", args.subOrderId))
      .collect();

    const populatedItems = await Promise.all(
      items.map(async (item) => {
        let product = null;
        let imageUrl = null;
        if (item.productId) {
          product = await ctx.db.get(item.productId);
          if (product) {
            if (product.imageUrl) {
              imageUrl = product.imageUrl;
            } else if (product.imageId) {
              imageUrl = await ctx.storage.getUrl(product.imageId);
            }
          }
        }
        return {
          ...item,
          product,
          imageUrl,
        };
      })
    );

    // Możemy tu też pobrać dane dostawcy
    let supplier = null;
    if (subOrder.supplierId) {
      supplier = await ctx.db.get(subOrder.supplierId);
    }

    return { ...subOrder, items: populatedItems, supplier };
  },
});

export const updateStatus = mutation({
  args: {
    subOrderId: v.id("subOrders"),
    status: v.union(
      v.literal("utworzono"),
      v.literal("do_zamowienia"),
      v.literal("zamowiono"),
      v.literal("odbior"),
      v.literal("zamkniete")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subOrderId, { status: args.status });
  },
});

export const addItem = mutation({
  args: {
    subOrderId: v.id("subOrders"),
    productId: v.optional(v.id("products")),
    customName: v.optional(v.string()),
    customValueNetto: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const subOrder = await ctx.db.get(args.subOrderId);
    if (!subOrder) throw new Error("Nie znaleziono zamówienia");

    const lockedStatuses = ["zamowiono", "odbior", "zamkniete"];
    if (lockedStatuses.includes(subOrder.status)) {
      throw new Error("Nie można dodawać pozycji do zamówienia o statusie 'Zamówiono' lub późniejszym.");
    }

    let name = args.customName || "Nowa pozycja";
    let priceNetto = args.customValueNetto || 0;

    if (args.productId) {
      const product = await ctx.db.get(args.productId);
      if (product) {
        name = product.name;
        priceNetto = product.priceNetto ?? 0;
      }
    }

    const existingItems = await ctx.db
      .query("subOrderItems")
      .withIndex("by_subOrder", (q) => q.eq("subOrderId", args.subOrderId))
      .collect();
    const order = existingItems.length;

    await ctx.db.insert("subOrderItems", {
      subOrderId: args.subOrderId,
      productId: args.productId,
      status: "todo",
      order,
      name,
      priceNetto,
      quantity: 1,
    });
  },
});

export const updateExternalOrderNumber = mutation({
  args: {
    subOrderId: v.id("subOrders"),
    externalOrderNumber: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subOrderId, { externalOrderNumber: args.externalOrderNumber });
  },
});

export const updateOrderNumber = mutation({
  args: {
    subOrderId: v.id("subOrders"),
    orderNumber: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.orderNumber.trim()) throw new Error("Numer zamówienia nie może być pusty");
    await ctx.db.patch(args.subOrderId, { orderNumber: args.orderNumber.trim() });
  },
});

export const updatePickupDate = mutation({
  args: {
    subOrderId: v.id("subOrders"),
    pickupDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subOrderId, { pickupDate: args.pickupDate });
  },
});

export const updateItemDates = mutation({
  args: {
    itemId: v.id("subOrderItems"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      startDate: args.startDate,
      endDate: args.endDate,
    });
    
    // Auto-scheduling: przesuwanie zależnych elementów
    await autoSchedule(ctx, args.itemId, args.endDate);
  },
});

export const updateItemStatus = mutation({
  args: {
    itemId: v.id("subOrderItems"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { status: args.status });
  },
});

export const updateItemDependency = mutation({
  args: {
    itemId: v.id("subOrderItems"),
    dependsOn: v.optional(v.id("subOrderItems")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { dependsOn: args.dependsOn });
  },
});

export const removeItem = mutation({
  args: {
    itemId: v.id("subOrderItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return;

    const subOrder = await ctx.db.get(item.subOrderId);
    if (subOrder && ["zamowiono", "odbior", "zamkniete"].includes(subOrder.status)) {
      throw new Error("Nie można usuwać pozycji z zamówienia o statusie 'Zamówiono' lub późniejszym.");
    }

    // Check if anything depends on this
    const dependents = await ctx.db
      .query("subOrderItems")
      .withIndex("by_dependsOn", (q) => q.eq("dependsOn", args.itemId))
      .collect();
    
    for (const dep of dependents) {
      await ctx.db.patch(dep._id, { dependsOn: undefined });
    }

    await ctx.db.delete(args.itemId);
  },
});

// Helper do auto-schedulingu (bardzo uproszczony)
async function autoSchedule(ctx: any, parentId: Id<"subOrderItems">, newParentEndDate: string) {
  const dependents = await ctx.db
    .query("subOrderItems")
    .withIndex("by_dependsOn", (q: any) => q.eq("dependsOn", parentId))
    .collect();

  for (const dep of dependents) {
    // Przesuń dependent tak, aby startDate == newParentEndDate
    const oldStart = new Date(dep.startDate);
    const oldEnd = new Date(dep.endDate);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(newParentEndDate);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const newStartStr = newStart.toISOString().split("T")[0];
    const newEndStr = newEnd.toISOString().split("T")[0];

    await ctx.db.patch(dep._id, {
      startDate: newStartStr,
      endDate: newEndStr,
    });

    // Rekurencja dla dalszych powiązań
    await autoSchedule(ctx, dep._id, newEndStr);
  }
}

export const listAllWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const subOrders = await ctx.db.query("subOrders").collect();
    const result = await Promise.all(
      subOrders.map(async (so) => {
        const order = await ctx.db.get(so.orderId);
        const client = order?.clientId ? await ctx.db.get(order.clientId) : null;
        const supplier = so.supplierId ? await ctx.db.get(so.supplierId) : null;
        const items = await ctx.db
          .query("subOrderItems")
          .withIndex("by_subOrder", (q) => q.eq("subOrderId", so._id))
          .collect();

        const populatedItems = await Promise.all(
          items.map(async (item) => {
            let product = null;
            let imageUrl = null;
            if (item.productId) {
              product = await ctx.db.get(item.productId);
              if (product) {
                if (product.imageUrl) {
                  imageUrl = product.imageUrl;
                } else if (product.imageId) {
                  imageUrl = await ctx.storage.getUrl(product.imageId);
                }
              }
            }
            return {
              ...item,
              product,
              imageUrl,
            };
          })
        );

        const valueNetto = items.reduce((acc, item) => acc + (item.priceNetto || 0) * (item.quantity || 1), 0);

        return {
          ...so,
          orderNumber: so.orderNumber,
          externalOrderNumber: so.externalOrderNumber,
          status: so.status,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
            clientName: order.clientName,
            clientId: order.clientId,
          } : null,
          client: client ? {
            _id: client._id,
            name: client.name,
          } : null,
          supplier: supplier ? {
            _id: supplier._id,
            name: supplier.name,
          } : null,
          itemsCount: items.length,
          items: populatedItems,
          valueNetto,
        };
      })
    );
    return result;
  },
});

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    type: v.optional(
      v.union(
        v.literal("product"),
        v.literal("service"),
        v.literal("outsourcing")
      )
    ),
    category: v.optional(v.string()),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    let products = await ctx.db
      .query("products")
      .withIndex("by_name")
      .collect();

    if (args.supplierId) {
      products = products.filter((p) => p.supplierId === args.supplierId);
    }

    if (args.type) {
      products = products.filter((p) => p.type === args.type);
    }

    if (args.category) {
      products = products.filter((p) => p.category === args.category);
    }

    if (args.onlyActive) {
      products = products.filter((p) => p.isActive);
    }

    if (args.search && args.search.trim()) {
      const q = args.search.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q) ||
          (p.supplierCode ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
      );
    }

    // Attach supplier info and image URL
    const supplierIds = Array.from(
      new Set(products.map((p) => p.supplierId).filter(Boolean))
    );
    const suppliersMap = new Map();
    for (const sId of supplierIds) {
      if (sId) {
        const sup = await ctx.db.get(sId);
        if (sup) {
          suppliersMap.set(sId, { _id: sup._id, name: sup.name, nip: sup.nip });
        }
      }
    }

    const resolvedProducts = await Promise.all(
      products.map(async (p) => {
        let imageUrl = p.imageUrl;
        if (p.imageId) {
          const storageUrl = await ctx.storage.getUrl(p.imageId);
          if (storageUrl) imageUrl = storageUrl;
        }
        return {
          ...p,
          imageUrl,
          supplier: p.supplierId ? suppliersMap.get(p.supplierId) ?? null : null,
        };
      })
    );

    return resolvedProducts;
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    await getAuthUserId(ctx);
    const product = await ctx.db.get(id);
    if (!product) return null;

    let supplier = null;
    if (product.supplierId) {
      const sup = await ctx.db.get(product.supplierId);
      if (sup) {
        supplier = {
          _id: sup._id,
          name: sup.name,
          nip: sup.nip,
          phone: sup.phone,
          email: sup.email,
          city: sup.city,
        };
      }
    }

    let imageUrl = product.imageUrl;
    if (product.imageId) {
      const storageUrl = await ctx.storage.getUrl(product.imageId);
      if (storageUrl) imageUrl = storageUrl;
    }

    return {
      ...product,
      imageUrl,
      supplier,
    };
  },
});

export const listBySupplier = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, { supplierId }) => {
    await getAuthUserId(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q) => q.eq("supplierId", supplierId))
      .collect();

    return await Promise.all(
      products.map(async (p) => {
        let imageUrl = p.imageUrl;
        if (p.imageId) {
          const storageUrl = await ctx.storage.getUrl(p.imageId);
          if (storageUrl) imageUrl = storageUrl;
        }
        return { ...p, imageUrl };
      })
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.optional(v.string()),
    type: v.union(
      v.literal("product"),
      v.literal("service"),
      v.literal("outsourcing")
    ),
    description: v.optional(v.string()),
    unit: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    supplierCode: v.optional(v.string()),
    priceNetto: v.optional(v.number()),
    priceBrutto: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    category: v.optional(v.string()),
    parameters: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.string(),
          unit: v.optional(v.string()),
        })
      )
    ),
    notes: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    const now = Date.now();
    return await ctx.db.insert("products", {
      name: args.name,
      code: args.code,
      type: args.type,
      description: args.description,
      unit: args.unit,
      supplierId: args.supplierId,
      supplierCode: args.supplierCode,
      priceNetto: args.priceNetto,
      priceBrutto: args.priceBrutto,
      vatRate: args.vatRate ?? 23,
      currency: args.currency ?? "PLN",
      leadTimeDays: args.leadTimeDays,
      category: args.category,
      parameters: args.parameters,
      notes: args.notes,
      imageId: args.imageId,
      imageUrl: args.imageUrl,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("product"),
        v.literal("service"),
        v.literal("outsourcing")
      )
    ),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    supplierCode: v.optional(v.string()),
    priceNetto: v.optional(v.number()),
    priceBrutto: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    category: v.optional(v.string()),
    parameters: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.string(),
          unit: v.optional(v.string()),
        })
      )
    ),
    notes: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await getAuthUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Produkt/usługa nie istnieje.");

    const patch: Record<string, unknown> = { ...fields, updatedAt: Date.now() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.patch(id, patch as any);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    await getAuthUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Produkt/usługa nie istnieje.");

    // If product has an imageId in storage, delete it too
    if (existing.imageId) {
      try {
        await ctx.storage.delete(existing.imageId);
      } catch (e) {
        console.error("Nie udało się usunąć pliku z storage:", e);
      }
    }

    await ctx.db.delete(id);
  },
});

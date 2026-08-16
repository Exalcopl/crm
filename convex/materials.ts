import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.search && args.search.trim().length > 0) {
      const results = await ctx.db
        .query("materials")
        .withSearchIndex("search_name", (q) => {
          let sq = q.search("name", args.search!);
          if (args.category) sq = sq.eq("category", args.category);
          return sq;
        })
        .collect();
      return results.filter((m) => m.isActive !== false);
    }

    if (args.category) {
      return ctx.db
        .query("materials")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.neq(q.field("isActive"), false))
        .order("asc")
        .collect();
    }

    return ctx.db
      .query("materials")
      .filter((q) => q.neq(q.field("isActive"), false))
      .order("asc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("materials") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    unit: v.string(),
    priceUnit: v.number(),
    category: v.string(),
    sku: v.optional(v.string()),
    supplier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const now = Date.now();
    return ctx.db.insert("materials", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("materials"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    priceUnit: v.optional(v.number()),
    category: v.optional(v.string()),
    sku: v.optional(v.string()),
    supplier: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const { id, ...rest } = args;
    const material = await ctx.db.get(id);
    if (!material) throw new Error("Materiał nie istnieje.");
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("materials") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    // Soft delete
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
  },
});

// Seed testowych materiałów dla kategorii typowych w RW
export const seedSampleMaterials = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const now = Date.now();
    const samples = [
      // PROFILE
      { name: "Profil PVC 70mm biały", unit: "mb.", priceUnit: 28.50, category: "PROFILE", sku: "PRF-70-BIA" },
      { name: "Profil PVC 80mm biały", unit: "mb.", priceUnit: 34.00, category: "PROFILE", sku: "PRF-80-BIA" },
      { name: "Profil PVC 60mm biały", unit: "mb.", priceUnit: 22.00, category: "PROFILE", sku: "PRF-60-BIA" },
      { name: "Profil słupka T 70mm", unit: "mb.", priceUnit: 31.00, category: "PROFILE", sku: "PRF-SLP-70" },
      // PROFILE DODATKOWE
      { name: "Uszczelka obwodowa EPDM", unit: "mb.", priceUnit: 1.20, category: "PROFILE_DODATKOWE", sku: "USC-OBW" },
      { name: "Uszczelka środkowa EPDM", unit: "mb.", priceUnit: 1.00, category: "PROFILE_DODATKOWE", sku: "USC-SRD" },
      { name: "Pręt zbrojeniowy 40x20", unit: "mb.", priceUnit: 8.50, category: "PROFILE_DODATKOWE", sku: "PRET-40-20" },
      // AKCESORIA
      { name: "Kotwa montażowa L50", unit: "szt.", priceUnit: 0.85, category: "AKCESORIA", sku: "KOT-L50" },
      { name: "Kotwa montażowa L100", unit: "szt.", priceUnit: 1.20, category: "AKCESORIA", sku: "KOT-L100" },
      { name: "Zaślepka narożna", unit: "szt.", priceUnit: 0.35, category: "AKCESORIA", sku: "ZAS-NAR" },
      { name: "Odprowadzacz wody", unit: "szt.", priceUnit: 0.50, category: "AKCESORIA", sku: "ODPROW" },
      // OKUCIA
      { name: "Samozamykacz góra/dół standardowy", unit: "kpl.", priceUnit: 45.00, category: "OKUCIA", sku: "SAMOZ-STD" },
      { name: "Samozamykacz góra/dół premium", unit: "kpl.", priceUnit: 89.00, category: "OKUCIA", sku: "SAMOZ-PRE" },
      { name: "Klamka okienna standard", unit: "szt.", priceUnit: 18.00, category: "OKUCIA", sku: "KLAM-OKN" },
      { name: "Zawias 3D regulowany", unit: "szt.", priceUnit: 12.50, category: "OKUCIA", sku: "ZAW-3D" },
      { name: "Klamka drzwiowa standard", unit: "kpl.", priceUnit: 35.00, category: "OKUCIA", sku: "KLAM-DRZ" },
      // WYPELNIENIA
      { name: "Szyba float 4mm", unit: "m²", priceUnit: 32.00, category: "WYPELNIENIA", sku: "SZY-FL-4" },
      { name: "Szyba zespolona 4/16/4 argon", unit: "m²", priceUnit: 85.00, category: "WYPELNIENIA", sku: "SZY-ZES-4-16-4" },
      { name: "Szyba VSG 4+4", unit: "m²", priceUnit: 120.00, category: "WYPELNIENIA", sku: "SZY-VSG" },
    ];

    const ids: string[] = [];
    for (const s of samples) {
      const id = await ctx.db.insert("materials", { ...s, isActive: true, createdAt: now, updatedAt: now });
      ids.push(id);
    }

    return { status: "OK", inserted: ids.length };
  },
});

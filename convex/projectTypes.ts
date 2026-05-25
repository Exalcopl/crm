import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projectTypes").order("asc").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("projectTypes").order("asc").collect();
    return all.filter((t) => t.isActive);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    categoryName: v.string(),
    categoryCode: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const existing = await ctx.db
      .query("projectTypes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) throw new Error(`Typ projektu "${args.name}" już istnieje`);

    return await ctx.db.insert("projectTypes", {
      name: args.name.trim(),
      color: args.color,
      description: args.description?.trim() || undefined,
      categoryName: args.categoryName.trim(),
      categoryCode: args.categoryCode.trim().slice(0, 2).toUpperCase(),
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projectTypes"),
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    categoryName: v.string(),
    categoryCode: v.string(),
  },
  handler: async (ctx, { id, ...fields }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const existing = await ctx.db
      .query("projectTypes")
      .withIndex("by_name", (q) => q.eq("name", fields.name))
      .first();
    if (existing && existing._id !== id) {
      throw new Error(`Typ projektu "${fields.name}" już istnieje`);
    }

    await ctx.db.patch(id, {
      name: fields.name.trim(),
      color: fields.color,
      description: fields.description?.trim() || undefined,
      categoryName: fields.categoryName.trim(),
      categoryCode: fields.categoryCode.trim().slice(0, 2).toUpperCase(),
    });
  },
});

export const toggleActive = mutation({
  args: { id: v.id("projectTypes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const type = await ctx.db.get(id);
    if (!type) throw new Error("Typ projektu nie istnieje");

    await ctx.db.patch(id, { isActive: !type.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("projectTypes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const type = await ctx.db.get(id);
    if (!type) throw new Error("Typ projektu nie istnieje");

    const quotes = await ctx.db.query("quotes").collect();
    const usedInQuote = quotes.some(
      (q) => Array.isArray(q.projectType) && q.projectType.includes(type.name),
    );
    if (usedInQuote) {
      throw new Error(
        `Nie można usunąć — typ "${type.name}" jest przypisany do co najmniej jednej wyceny`,
      );
    }

    await ctx.db.delete(id);
  },
});

export const initSeedAction = action({
  args: {},
  handler: async (ctx): Promise<{ skipped: boolean; count: number }> => {
    return await ctx.runMutation(
      internal.projectTypes.seedProjectTypes,
      {},
    ) as { skipped: boolean; count: number };
  },
});

export const seedProjectTypes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projectTypes").first();
    if (existing) return { skipped: true, count: 0 };

    const SEED = [
      { name: "Zadaszenia", color: "#79c0ff", categoryName: "Zadaszenia", categoryCode: "ZA" },
      { name: "Pergola", color: "#56d364", categoryName: "Pergola", categoryCode: "PE" },
      { name: "Stolarka", color: "#ffa657", categoryName: "Stolarka", categoryCode: "ST" },
      { name: "Ogrodzenie", color: "#d2a8ff", categoryName: "Ogrodzenie", categoryCode: "OG" },
      { name: "Osłony okienne", color: "#56d4c1", categoryName: "Osłony okienne", categoryCode: "OS" },
      { name: "Inne", color: "#c9d1d9", categoryName: "Inne", categoryCode: "IN" },
    ];

    let count = 0;
    for (const t of SEED) {
      await ctx.db.insert("projectTypes", { ...t, isActive: true });
      count++;
    }
    return { skipped: false, count };
  },
});

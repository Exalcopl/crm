import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const types = await ctx.db.query("projectTypes").order("asc").collect();
    const allQuestions = await ctx.db.query("projectTypeQuestions").collect();
    const countByType = new Map<string, number>();
    for (const q of allQuestions) {
      const key = q.projectTypeId as unknown as string;
      countByType.set(key, (countByType.get(key) ?? 0) + 1);
    }
    const allGalleryImages = await ctx.db.query("projectTypeGalleryImages").collect();
    const galleryCountByType = new Map<string, number>();
    for (const img of allGalleryImages) {
      const key = img.projectTypeId as unknown as string;
      galleryCountByType.set(key, (galleryCountByType.get(key) ?? 0) + 1);
    }
    return types.map((t) => ({
      ...t,
      questionsCount: countByType.get(t._id as unknown as string) ?? 0,
      galleryCount: galleryCountByType.get(t._id as unknown as string) ?? 0,
    }));
  },
});

export const get = query({
  args: { id: v.id("projectTypes") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
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

    const questions = await ctx.db
      .query("projectTypeQuestions")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", id))
      .collect();
    for (const q of questions) {
      const answers = await ctx.db
        .query("quoteAnswers")
        .withIndex("by_question", (qa) => qa.eq("questionId", q._id))
        .collect();
      for (const a of answers) await ctx.db.delete(a._id);
      await ctx.db.delete(q._id);
    }

    // Delete gallery images
    const galleryImages = await ctx.db
      .query("projectTypeGalleryImages")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", id))
      .collect();
    for (const img of galleryImages) {
      await ctx.storage.delete(img.storageId);
      await ctx.db.delete(img._id);
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

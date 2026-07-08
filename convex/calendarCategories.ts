import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Seed Defaults ──────────────────────────────────────────────────────────
export const checkAndSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("calendarCategories").collect();
    if (existing.length === 0) {
      const defaults = [
        { name: "Spotkanie", color: "#3b82f6", code: "spotkanie" },
        { name: "Montaż", color: "#10b981", code: "montaz" },
        { name: "Pomiary", color: "#f59e0b", code: "pomiary" },
        { name: "Urlop", color: "#8b5cf6", code: "urlop" },
        { name: "Inne", color: "#9ca3af", code: "inne" },
      ];
      for (const item of defaults) {
        await ctx.db.insert("calendarCategories", item);
      }
    }
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("calendarCategories").collect();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Użytkownik nie istnieje");
    if (user.roleId) {
      const role = await ctx.db.get(user.roleId);
      if (role?.name !== "admin" && role?.name !== "super_admin") {
        throw new Error("Brak uprawnień administratora");
      }
    } else {
      throw new Error("Brak roli");
    }

    const name = args.name.trim();
    if (!name) throw new Error("Nazwa kategorii nie może być pusta");

    const id = await ctx.db.insert("calendarCategories", {
      name,
      color: args.color,
      code: "",
    });

    await ctx.db.patch(id, { code: id });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarCategories"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Użytkownik nie istnieje");
    if (user.roleId) {
      const role = await ctx.db.get(user.roleId);
      if (role?.name !== "admin" && role?.name !== "super_admin") {
        throw new Error("Brak uprawnień administratora");
      }
    } else {
      throw new Error("Brak roli");
    }

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Kategoria nie istnieje");

    const name = args.name.trim();
    if (!name) throw new Error("Nazwa kategorii nie może być pusta");

    await ctx.db.patch(args.id, {
      name,
      color: args.color,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("calendarCategories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Użytkownik nie istnieje");
    if (user.roleId) {
      const role = await ctx.db.get(user.roleId);
      if (role?.name !== "admin" && role?.name !== "super_admin") {
        throw new Error("Brak uprawnień administratora");
      }
    } else {
      throw new Error("Brak roli");
    }

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Kategoria nie istnieje");

    await ctx.db.delete(args.id);
  },
});

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// ─── Queries ──────────────────────────────────────────────────────────────────
export const list = query({
  args: { projectTypeId: v.id("projectTypes") },
  handler: async (ctx, { projectTypeId }) => {
    const docs = await ctx.db
      .query("projectTypeDefaultTasks")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", projectTypeId))
      .collect();
    return docs.sort((a, b) => a.order - b.order);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    projectTypeId: v.id("projectTypes"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const title = args.title.trim();
    if (!title) throw new Error("Tytuł zadania nie może być pusty");

    const existing = await ctx.db
      .query("projectTypeDefaultTasks")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", args.projectTypeId))
      .collect();
    const maxOrder = existing.reduce((m, q) => Math.max(m, q.order), -1);

    return await ctx.db.insert("projectTypeDefaultTasks", {
      projectTypeId: args.projectTypeId,
      title,
      description: args.description?.trim() || undefined,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projectTypeDefaultTasks"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { id, title, description }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const trimmed = title.trim();
    if (!trimmed) throw new Error("Tytuł zadania nie może być pusty");

    await ctx.db.patch(id, {
      title: trimmed,
      description: description?.trim() || undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("projectTypeDefaultTasks") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.delete(id);
  },
});

export const move = mutation({
  args: {
    id: v.id("projectTypeDefaultTasks"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { id, direction }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const current = await ctx.db.get(id);
    if (!current) throw new Error("Zadanie nie istnieje");

    const siblings = await ctx.db
      .query("projectTypeDefaultTasks")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", current.projectTypeId))
      .collect();
    siblings.sort((a, b) => a.order - b.order);

    const idx = siblings.findIndex((s) => s._id === id);
    if (idx < 0) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const other = siblings[swapIdx];
    await ctx.db.patch(current._id, { order: other.order });
    await ctx.db.patch(other._id, { order: current.order });
  },
});

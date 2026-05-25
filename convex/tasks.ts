import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const TASK_STATUS = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
);

export const list = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const docs = await ctx.db
      .query("tasks")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    return docs.sort((a, b) => {
      if (a.status !== b.status) {
        const order = { todo: 0, in_progress: 1, done: 2 } as const;
        return order[a.status] - order[b.status];
      }
      return a.order - b.order;
    });
  },
});

export const add = mutation({
  args: {
    quoteId: v.id("quotes"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    dueDate: v.optional(v.string()),
    status: v.optional(TASK_STATUS),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const title = args.title.trim();
    if (!title) throw new Error("Tytuł zadania nie może być pusty");

    const status = args.status ?? "todo";
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_quote_status", (q) =>
        q.eq("quoteId", args.quoteId).eq("status", status),
      )
      .collect();
    const maxOrder = existing.reduce((acc, t) => Math.max(acc, t.order), -1);

    return await ctx.db.insert("tasks", {
      quoteId: args.quoteId,
      title,
      description: args.description?.trim() || undefined,
      status,
      assigneeId: args.assigneeId ?? null,
      dueDate: args.dueDate || undefined,
      createdAt: Date.now(),
      createdBy: callerId,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, title, description, dueDate }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const patch: Record<string, unknown> = {};
    if (title !== undefined) {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Tytuł zadania nie może być pusty");
      patch.title = trimmed;
    }
    if (description !== undefined) {
      patch.description = description.trim() || undefined;
    }
    if (dueDate !== undefined) {
      patch.dueDate = dueDate === null || dueDate === "" ? undefined : dueDate;
    }
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(id, patch);
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: TASK_STATUS,
  },
  handler: async (ctx, { id, status }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const task = await ctx.db.get(id);
    if (!task) throw new Error("Zadanie nie istnieje");

    if (task.status === status) return;

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_quote_status", (q) =>
        q.eq("quoteId", task.quoteId).eq("status", status),
      )
      .collect();
    const maxOrder = existing.reduce((acc, t) => Math.max(acc, t.order), -1);

    await ctx.db.patch(id, {
      status,
      order: maxOrder + 1,
      completedAt: status === "done" ? Date.now() : undefined,
    });
  },
});

export const assign = mutation({
  args: {
    id: v.id("tasks"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, assigneeId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { assigneeId });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.delete(id);
  },
});

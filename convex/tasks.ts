import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const mapped = docs.map((t) => ({
      ...t,
      assigneeIds: t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []),
    }));
    return mapped.sort((a, b) => {
      if (a.status !== b.status) {
        const order = { todo: 0, in_progress: 1, done: 2 } as const;
        return order[a.status] - order[b.status];
      }
      return a.order - b.order;
    });
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];

    const caller = await ctx.db.get(callerId);
    const role = caller?.roleId ? await ctx.db.get(caller.roleId) : null;
    const isSuperAdmin = role?.name === "super_admin";

    let tasks;
    if (isSuperAdmin) {
      tasks = await ctx.db
        .query("tasks")
        .filter((q) => q.neq(q.field("archived"), true))
        .collect();
    } else {
      const allTasks = await ctx.db
        .query("tasks")
        .filter((q) => q.neq(q.field("archived"), true))
        .collect();
      tasks = allTasks.filter((t) => {
        const ids = t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []);
        return ids.includes(callerId);
      });
    }

    if (tasks.length === 0) return [];

    const uniqueQuoteIds = Array.from(
      new Set(tasks.map((t) => t.quoteId).filter(Boolean) as string[]),
    );
    const quotes = await Promise.all(
      uniqueQuoteIds.map((id) =>
        ctx.db.get(id as Id<"quotes">),
      ),
    );
    const quoteById = new Map<
      string,
      { code: string; contactName: string; archived: boolean }
    >();
    for (const q of quotes) {
      if (!q) continue;
      quoteById.set(q._id as unknown as string, {
        code: q.code,
        contactName: q.contact?.name ?? "—",
        archived: q.archived === true,
      });
    }

    const enriched = tasks
      .map((t) => {
        const ids = t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []);
        if (!t.quoteId) {
          return {
            ...t,
            assigneeIds: ids,
            quote: null,
          };
        }
        const ctxQuote = quoteById.get(t.quoteId as unknown as string);
        if (!ctxQuote) return null;
        if (ctxQuote.archived) return null;
        return {
          ...t,
          assigneeIds: ids,
          quote: { code: ctxQuote.code, contactName: ctxQuote.contactName },
        };
      })
      .filter((t) => t !== null) as Array<typeof tasks[number] & { assigneeIds: Id<"users">[]; quote: { code: string; contactName: string } | null }>;

    return enriched.sort((a, b) => {
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
    quoteId: v.optional(v.id("quotes")),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    assigneeIds: v.optional(v.array(v.id("users"))),
    dueDate: v.optional(v.string()),
    status: v.optional(TASK_STATUS),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const title = args.title.trim();
    if (!title) throw new Error("Tytuł zadania nie może być pusty");

    const status = args.status ?? "todo";
    
    let maxOrder = -1;
    if (args.quoteId) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_quote_status", (q) =>
          q.eq("quoteId", args.quoteId!).eq("status", status),
        )
        .collect();
      maxOrder = existing.reduce((acc, t) => Math.max(acc, t.order), -1);
    }

    const ids = args.assigneeIds ?? (args.assigneeId ? [args.assigneeId] : []);

    return await ctx.db.insert("tasks", {
      quoteId: args.quoteId,
      title,
      description: args.description?.trim() || undefined,
      status,
      assigneeId: args.assigneeId ?? null,
      assigneeIds: ids,
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

    let maxOrder = -1;
    if (task.quoteId) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_quote_status", (q) =>
          q.eq("quoteId", task.quoteId!).eq("status", status),
        )
        .collect();
      maxOrder = existing.reduce((acc, t) => Math.max(acc, t.order), -1);
    }

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
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    assigneeIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { id, assigneeId, assigneeIds }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    
    const patch: Record<string, any> = {};
    if (assigneeIds !== undefined) {
      patch.assigneeIds = assigneeIds;
    }
    if (assigneeId !== undefined) {
      patch.assigneeId = assigneeId;
      if (assigneeIds === undefined) {
        patch.assigneeIds = assigneeId ? [assigneeId] : [];
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
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

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];

    const caller = await ctx.db.get(callerId);
    const role = caller?.roleId ? await ctx.db.get(caller.roleId) : null;
    const isSuperAdmin = role?.name === "super_admin";

    let tasks;
    if (isSuperAdmin) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_archived", (q) => q.eq("archived", true))
        .collect();
    } else {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_archived", (q) => q.eq("archived", true))
        .collect();
      tasks = allTasks.filter((t) => {
        const ids = t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []);
        return ids.includes(callerId);
      });
    }

    if (tasks.length === 0) return [];

    const uniqueQuoteIds = Array.from(
      new Set(tasks.map((t) => t.quoteId).filter(Boolean) as string[]),
    );
    const quotes = await Promise.all(
      uniqueQuoteIds.map((id) =>
        ctx.db.get(id as Id<"quotes">).then((q) => (q ? { id: q._id, code: q.code, contactName: q.contact.name } : null)),
      ),
    );
    const quoteMap = new Map(quotes.filter(Boolean).map((q) => [q!.id, q]));

    const mapped = tasks.map((t) => ({
      ...t,
      assigneeIds: t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []),
      quote: t.quoteId ? quoteMap.get(t.quoteId) : undefined,
    }));

    return mapped.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  },
});

export const archiveOldTasks = mutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_archived")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const now = Date.now();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

    for (const task of tasks) {
      if (task.status === "done" && task.completedAt && now - task.completedAt >= FIVE_DAYS) {
        await ctx.db.patch(task._id, { archived: true });
      }
    }
  },
});

export const archiveAllDoneNow = mutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_archived")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    for (const task of tasks) {
      if (task.status === "done") {
        await ctx.db.patch(task._id, { archived: true });
      }
    }
  },
});

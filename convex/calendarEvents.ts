import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("calendarEvents")
      .withIndex("by_createdBy_date", (q) =>
        q.eq("createdBy", userId).eq("date", date),
      )
      .collect();
  },
});

export const listByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const all = await ctx.db
      .query("calendarEvents")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .collect();

    return all.filter((e) => e.date >= startDate && e.date <= endDate);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const title = args.title.trim();
    if (!title) throw new Error("Tytuł nie może być pusty");

    return await ctx.db.insert("calendarEvents", {
      title,
      description: args.description?.trim() || undefined,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      color: args.color || undefined,
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const event = await ctx.db.get(id);
    if (!event) throw new Error("Wydarzenie nie istnieje");
    if (event.createdBy !== userId)
      throw new Error("Brak uprawnień do edycji tego wydarzenia");

    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) {
      const t = fields.title.trim();
      if (!t) throw new Error("Tytuł nie może być pusty");
      patch.title = t;
    }
    if (fields.description !== undefined) {
      patch.description =
        fields.description === null
          ? undefined
          : fields.description.trim() || undefined;
    }
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.color !== undefined) {
      patch.color = fields.color === null ? undefined : fields.color;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const event = await ctx.db.get(id);
    if (!event) throw new Error("Wydarzenie nie istnieje");
    if (event.createdBy !== userId)
      throw new Error("Brak uprawnień do usunięcia tego wydarzenia");

    await ctx.db.delete(id);
  },
});

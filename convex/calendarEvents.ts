import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";

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

export const listByDateAndUsers = query({
  args: { date: v.string(), userIds: v.array(v.id("users")) },
  handler: async (ctx, { date, userIds }) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return [];

    const allForDate = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();

    const filtered = allForDate.filter((e) => userIds.includes(e.createdBy));

    return filtered.map((e) => {
      const isOwner = e.createdBy === currentUserId;
      if (e.isPrivate && !isOwner) {
        return {
          ...e,
          title: "🔒 Zajęty",
          description: undefined,
        };
      }
      return e;
    });
  },
});

export const listCompanyEventsByRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();

    return events.filter((e) => e.type === "company");
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

// ─── Helpers for Recurring Dates ──────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    color: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    recurrence: v.optional(
      v.union(
        v.literal("none"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
      ),
    ),
    recurrenceEndDate: v.optional(v.string()),
    type: v.optional(v.union(v.literal("private"), v.literal("company"))),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const title = args.title.trim();
    if (!title) throw new Error("Tytuł nie może być pusty");

    const now = Date.now();
    const rec = args.recurrence || "none";

    // 1. Create base event
    const parentId = await ctx.db.insert("calendarEvents", {
      title,
      description: args.description?.trim() || undefined,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      color: args.color || undefined,
      isPrivate: !!args.isPrivate,
      recurrence: rec,
      recurrenceEndDate: args.recurrenceEndDate || undefined,
      type: args.type || "private",
      category: args.category || undefined,
      createdBy: userId,
      createdAt: now,
    });

    // 2. Generate recurring instances if requested
    if (rec !== "none") {
      const dates: string[] = [];
      const endLimit = args.recurrenceEndDate || addMonths(args.date, 6);
      let maxCount = rec === "daily" ? 90 : rec === "weekly" ? 52 : 12;

      let step = 1;
      while (maxCount-- > 0) {
        let nextDate: string;
        if (rec === "daily") {
          nextDate = addDays(args.date, step);
        } else if (rec === "weekly") {
          nextDate = addDays(args.date, step * 7);
        } else {
          nextDate = addMonths(args.date, step);
        }

        if (nextDate > endLimit) break;
        dates.push(nextDate);
        step++;
      }

      for (const d of dates) {
        await ctx.db.insert("calendarEvents", {
          title,
          description: args.description?.trim() || undefined,
          date: d,
          startTime: args.startTime,
          endTime: args.endTime,
          color: args.color || undefined,
          isPrivate: !!args.isPrivate,
          recurrence: rec,
          parentEventId: parentId,
          type: args.type || "private",
          category: args.category || undefined,
          createdBy: userId,
          createdAt: now,
        });
      }
    }

    return parentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    date: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    isPrivate: v.optional(v.boolean()),
    type: v.optional(v.union(v.literal("private"), v.literal("company"))),
    category: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const event = await ctx.db.get(id);
    if (!event) throw new Error("Wydarzenie nie istnieje");
    if (event.createdBy !== userId)
      throw new Error("Brak uprawnień do edycji tego wydarzenia");

    const patch: Record<string, unknown> = {};
    if (fields.date !== undefined) patch.date = fields.date;
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
    if (fields.isPrivate !== undefined) {
      patch.isPrivate = fields.isPrivate;
    }
    if (fields.type !== undefined) {
      patch.type = fields.type;
    }
    if (fields.category !== undefined) {
      patch.category = fields.category === null ? undefined : fields.category;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("calendarEvents"),
    removeAllSeries: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, removeAllSeries }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const event = await ctx.db.get(id);
    if (!event) throw new Error("Wydarzenie nie istnieje");
    if (event.createdBy !== userId)
      throw new Error("Brak uprawnień do usunięcia tego wydarzenia");

    await ctx.db.delete(id);

    if (removeAllSeries) {
      const seriesRootId = event.parentEventId || id;
      const allEvents = await ctx.db
        .query("calendarEvents")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
        .collect();

      for (const ev of allEvents) {
        if (ev._id === seriesRootId || ev.parentEventId === seriesRootId) {
          await ctx.db.delete(ev._id);
        }
      }
    }
  },
});

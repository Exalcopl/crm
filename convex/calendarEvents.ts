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

export const listPrivateEventsByRange = query({
  args: { startDate: v.string(), endDate: v.string(), userIds: v.array(v.id("users")) },
  handler: async (ctx, { startDate, endDate, userIds }) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId || userIds.length === 0) return [];

    const maxPastDate = addDays(startDate, -60);

    const allInRange = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.gte("date", maxPastDate).lte("date", endDate))
      .collect();

    const filtered = allInRange.filter((e) => {
      if (!userIds.includes(e.createdBy)) return false;
      if (e.type === "company") return false;
      const eventEnd = e.endDate || e.date;
      return eventEnd >= startDate && e.date <= endDate;
    });

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

    // Assuming no event spans more than 60 days in the past
    const maxPastDate = addDays(startDate, -60);

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.gte("date", maxPastDate).lte("date", endDate))
      .collect();

    return events.filter((e) => {
      if (e.type !== "company") return false;
      const eventEnd = e.endDate || e.date;
      return eventEnd >= startDate && e.date <= endDate;
    });
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

function addYears(dateStr: string, years: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
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
    isAllDay: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
    color: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    recurrence: v.optional(
      v.union(
        v.literal("none"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
    ),
    recurrenceInterval: v.optional(v.number()),
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
    const interval = args.recurrenceInterval || 1;

    // 1. Create base event
    const parentId = await ctx.db.insert("calendarEvents", {
      title,
      description: args.description?.trim() || undefined,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay,
      endDate: args.endDate,
      color: args.color || undefined,
      isPrivate: !!args.isPrivate,
      recurrence: rec,
      recurrenceInterval: args.recurrenceInterval || undefined,
      recurrenceEndDate: args.recurrenceEndDate || undefined,
      type: args.type || "private",
      category: args.category || undefined,
      createdBy: userId,
      createdAt: now,
    });

    // 2. Generate recurring instances if requested
    if (rec !== "none") {
      const dates: string[] = [];
      const endLimit = args.recurrenceEndDate || addYears(args.date, 1);
      let maxCount = rec === "daily" ? 90 : rec === "weekly" ? 52 : rec === "monthly" ? 12 : 5;

      let step = 1;
      while (maxCount-- > 0) {
        let nextDate: string;
        if (rec === "daily") {
          nextDate = addDays(args.date, step * interval);
        } else if (rec === "weekly") {
          nextDate = addDays(args.date, step * 7 * interval);
        } else if (rec === "monthly") {
          nextDate = addMonths(args.date, step * interval);
        } else {
          nextDate = addYears(args.date, step * interval);
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
          recurrenceInterval: args.recurrenceInterval || undefined,
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
    isAllDay: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
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
    if (event.createdBy !== userId && event.type !== "company")
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
    if (fields.isAllDay !== undefined) patch.isAllDay = fields.isAllDay;
    if (fields.endDate !== undefined) patch.endDate = fields.endDate;
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
    if (event.createdBy !== userId && event.type !== "company")
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

// ─── Terminy zlecenia (wydarzenia powiązane ze zleceniem) ───────────────────────

async function categoryMeta(ctx: { db: { query: (t: "calendarCategories") => any } }, code: string | undefined) {
  if (!code) return { name: undefined as string | undefined, color: undefined as string | undefined };
  const cat = await ctx.db
    .query("calendarCategories")
    .withIndex("by_code", (q: any) => q.eq("code", code))
    .first();
  return { name: cat?.name as string | undefined, color: cat?.color as string | undefined };
}

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    return events.sort((a, b) =>
      `${a.date}${a.startTime ?? ""}`.localeCompare(`${b.date}${b.startTime ?? ""}`),
    );
  },
});

export const createForOrder = mutation({
  args: {
    orderId: v.id("orders"),
    category: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje");

    // jedno wydarzenie na kategorię w obrębie zlecenia
    const existing = await ctx.db
      .query("calendarEvents")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    if (existing.some((e) => e.category === args.category)) {
      throw new Error("Dla tej kategorii istnieje już wydarzenie w tym zleceniu");
    }

    const { name: catName, color } = await categoryMeta(ctx, args.category);
    const title = `${order.orderNumber} – ${catName ?? args.category}${order.clientName ? ` (${order.clientName})` : ""}`;

    const id = await ctx.db.insert("calendarEvents", {
      title,
      description: args.description?.trim() || undefined,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      color,
      isPrivate: false,
      recurrence: "none",
      type: "company",
      category: args.category,
      orderId: args.orderId,
      quoteId: order.quoteId,
      createdBy: order.ownerId ?? userId,
      createdAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("quoteActivity", {
      quoteId: order.quoteId,
      type: "order_event_added",
      title: "Dodano termin",
      detail: `${catName ?? args.category}: ${args.date} ${args.startTime}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateForOrder = mutation({
  args: {
    id: v.id("calendarEvents"),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");
    const event = await ctx.db.get(id);
    if (!event || !event.orderId) throw new Error("Wydarzenie nie istnieje");
    const order = await ctx.db.get(event.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje");

    const patch: Record<string, unknown> = {};
    if (fields.date !== undefined) patch.date = fields.date;
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.description !== undefined)
      patch.description = fields.description === null ? undefined : fields.description.trim() || undefined;
    await ctx.db.patch(id, patch);

    const { name: catName } = await categoryMeta(ctx, event.category);
    const user = await ctx.db.get(userId);
    await ctx.db.insert("quoteActivity", {
      quoteId: order.quoteId,
      type: "order_event_updated",
      title: "Zmieniono termin",
      detail: `${catName ?? event.category ?? "termin"}: ${fields.date ?? event.date} ${fields.startTime ?? event.startTime}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const removeForOrder = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");
    const event = await ctx.db.get(id);
    if (!event) throw new Error("Wydarzenie nie istnieje");
    const order = event.orderId ? await ctx.db.get(event.orderId) : null;
    await ctx.db.delete(id);
    if (order) {
      const { name: catName } = await categoryMeta(ctx, event.category);
      const user = await ctx.db.get(userId);
      await ctx.db.insert("quoteActivity", {
        quoteId: order.quoteId,
        type: "order_event_removed",
        title: "Usunięto termin",
        detail: `${catName ?? event.category ?? "termin"}: ${event.date}`,
        authorId: userId,
        authorName: user?.name || "System",
        createdAt: Date.now(),
      });
    }
  },
});

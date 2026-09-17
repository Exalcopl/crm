import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Pobiera wszystkie kroki (zadania + podzadania) zlecenia, posortowane wg pola order */
export const list = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("asc")
      .collect();
  },
});

/**
 * Pobiera WSZYSTKIE zadania przedprodukcyjne (ze wszystkich zleceń),
 * które mają przypisanego użytkownika — do wyświetlenia na panelu.
 * Wzbogaca każde zadanie o dane zlecenia: orderNumber, clientName.
 */
export const listAllWithAssignee = query({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db
      .query("orderPreProdSteps")
      .collect();

    // Filtruj tylko te z przypisanym użytkownikiem (zależnie od tego czy użyto assigneeId czy assigneeIds) i nie zarchiwizowane
    const withAssignee = steps.filter((s) => !s.archived && ((s.assigneeIds && s.assigneeIds.length > 0) || !!s.assigneeId));

    // Pobierz unikalne zlecenia
    const orderIds = [...new Set(withAssignee.map((s) => s.orderId))];
    const orders = await Promise.all(orderIds.map((id) => ctx.db.get(id)));
    const ordersMap = new Map(
      orders
        .filter(Boolean)
        .map((o) => [o!._id, { orderNumber: o!.orderNumber, clientName: o!.clientName }])
    );

    return withAssignee.map((s) => {
      // normalizacja assigneeIds
      const assigneeIds = s.assigneeIds ?? (s.assigneeId ? [s.assigneeId] : []);
      return {
        ...s,
        assigneeIds,
        orderNumber: ordersMap.get(s.orderId)?.orderNumber ?? "—",
        clientName: ordersMap.get(s.orderId)?.clientName ?? "—",
      };
    });
  },
});


/** Dodaje nowe zadanie lub podzadanie */
export const add = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    parentId: v.optional(v.id("orderPreProdSteps")),
  },
  handler: async (ctx, { orderId, title, parentId }) => {
    const existing = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;
    return await ctx.db.insert("orderPreProdSteps", {
      orderId,
      title: title.trim(),
      done: false,
      status: "todo",
      order: nextOrder,
      parentId,
      createdAt: Date.now(),
    });
  },
});

async function shiftSubtaskDates(
  ctx: any,
  parentId: any,
  deltaMs: number
) {
  if (!deltaMs) return;

  const children = await ctx.db
    .query("orderPreProdSteps")
    .withIndex("by_parent", (q: any) => q.eq("parentId", parentId))
    .collect();

  for (const child of children) {
    let newStart = child.startDate;
    let newEnd = child.endDate;

    if (child.startDate) {
      const d = new Date(child.startDate);
      d.setTime(d.getTime() + deltaMs);
      newStart = d.toISOString().split("T")[0];
    }
    if (child.endDate) {
      const d = new Date(child.endDate);
      d.setTime(d.getTime() + deltaMs);
      newEnd = d.toISOString().split("T")[0];
    }

    await ctx.db.patch(child._id, {
      startDate: newStart,
      endDate: newEnd,
    });

    await shiftSubtaskDates(ctx, child._id, deltaMs);
  }
}

/** Aktualizuje daty zadania (wywoływane po przeciągnięciu paska na osi czasu lub z poziomu checklisty) */
export const updateDates = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    shiftSubtasks: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, startDate, endDate, shiftSubtasks = true }) => {
    const step = await ctx.db.get(id);
    if (!step) return;

    const ns = startDate ?? undefined;
    const ne = endDate ?? undefined;

    let deltaMs = 0;
    if (shiftSubtasks && ne && step.endDate) {
      const oldMs = new Date(step.endDate).getTime();
      const newMs = new Date(ne).getTime();
      if (!isNaN(oldMs) && !isNaN(newMs)) {
        deltaMs = newMs - oldMs;
      }
    } else if (shiftSubtasks && ns && step.startDate) {
      const oldMs = new Date(step.startDate).getTime();
      const newMs = new Date(ns).getTime();
      if (!isNaN(oldMs) && !isNaN(newMs)) {
        deltaMs = newMs - oldMs;
      }
    }

    await ctx.db.patch(id, {
      startDate: ns,
      endDate: ne,
    });

    if (deltaMs !== 0) {
      await shiftSubtaskDates(ctx, id, deltaMs);
    }

    // Auto-sync calendar event if step is linked to one
    if (step.calendarEventId && ns) {
      const calEvent = await ctx.db.get(step.calendarEventId);
      if (calEvent) {
        const neDate = ne ?? ns;
        const isMultiDay = ns !== neDate;
        await ctx.db.patch(step.calendarEventId, {
          date: ns,
          endDate: neDate,
          isAllDay: isMultiDay || calEvent.isAllDay || false,
        });
      }
    }
  },
});


/** Tworzy, aktualizuje lub usuwa powiązane wydarzenie w kalendarzu dla danego kroku Gantt */
export const saveCalendarIntegration = mutation({
  args: {
    stepId: v.id("orderPreProdSteps"),
    addToCalendar: v.boolean(),
    type: v.optional(v.union(v.literal("private"), v.literal("company"))),
    category: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isAllDay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx).catch(() => null);
    if (!userId) throw new Error("Brak autoryzacji");

    const step = await ctx.db.get(args.stepId);
    if (!step) throw new Error("Krok nie istnieje");

    // Jeśli użytkownik odznaczył "Dodaj do kalendarza"
    if (!args.addToCalendar) {
      if (step.calendarEventId) {
        const calEvent = await ctx.db.get(step.calendarEventId);
        if (calEvent) {
          await ctx.db.delete(step.calendarEventId);
        }
        await ctx.db.patch(args.stepId, { calendarEventId: undefined });
      }
      return null;
    }

    // Dodaj lub zaktualizuj w kalendarzu
    const order = await ctx.db.get(step.orderId);
    const orderPrefix = order ? `[${order.orderNumber}] ` : "";
    const eventTitle = `${orderPrefix}${step.title}`;

    const date = step.startDate || new Date().toISOString().split("T")[0];
    const endDate = step.endDate || date;
    const isMultiDay = date !== endDate;
    const isAllDay = args.isAllDay !== undefined ? args.isAllDay : isMultiDay;
    const startTime = args.startTime || "08:00";
    const endTime = args.endTime || "16:00";
    const eventType = args.type || "company";
    const isPrivate = eventType === "private";
    const category = eventType === "company" ? (args.category || "montaz") : undefined;

    if (step.calendarEventId) {
      const existingCal = await ctx.db.get(step.calendarEventId);
      if (existingCal) {
        await ctx.db.patch(step.calendarEventId, {
          title: eventTitle,
          date,
          endDate,
          startTime,
          endTime,
          isAllDay,
          type: eventType,
          isPrivate,
          category,
        });
        return step.calendarEventId;
      }
    }

    // Utwórz nowy wpis w calendarEvents
    const newCalId = await ctx.db.insert("calendarEvents", {
      title: eventTitle,
      date,
      endDate,
      startTime,
      endTime,
      isAllDay,
      type: eventType,
      isPrivate,
      category,
      orderId: step.orderId,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.stepId, { calendarEventId: newCalId });
    return newCalId;
  },
});

/** Aktualizuje tytuł zadania */
export const updateTitle = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, { title: title.trim() });
  },
});

/** Toggle ukończenia zadania z wykresu Gantta lub modułu checkboxów */
export const setDone = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    done: v.boolean(),
  },
  handler: async (ctx, { id, done }) => {
    // Pobierz aktualnego użytkownika (opcjonalnie — może być null w sesjach PIN)
    const userId = await getAuthUserId(ctx).catch(() => null);

    const now = Date.now();

    await ctx.db.patch(id, {
      done,
      status: done ? "done" : "todo",
      completedAt: done ? now : undefined,
      completedBy: done && userId ? userId : undefined,
    });

    // Auto-propagacja: gdy zaznaczono jako done, sprawdź rodzeństwo → zaktualizuj rodzica
    const step = await ctx.db.get(id);
    if (step?.parentId) {
      const siblings = await ctx.db
        .query("orderPreProdSteps")
        .withIndex("by_parent", (q) => q.eq("parentId", step.parentId!))
        .collect();
      // Użyj aktualnego stanu done przekazanego do mutacji (step.done może być jeszcze stary)
      const allDone = siblings.every((s) => (s._id === id ? done : s.done));
      if (done && allDone) {
        // Wszystkie rodzeństwa są done → rodzic też done
        await ctx.db.patch(step.parentId, {
          done: true,
          status: "done",
          completedAt: now,
          completedBy: userId ?? undefined,
        });
        // Sprawdź jeden poziom wyżej (pod-podzadania → podzadania → zadanie główne)
        const parent = await ctx.db.get(step.parentId);
        if (parent?.parentId) {
          const grandSiblings = await ctx.db
            .query("orderPreProdSteps")
            .withIndex("by_parent", (q) => q.eq("parentId", parent.parentId!))
            .collect();
          const allGrandDone = grandSiblings.every((s) => (s._id === step.parentId ? true : s.done));
          if (allGrandDone) {
            await ctx.db.patch(parent.parentId, {
              done: true,
              status: "done",
              completedAt: now,
              completedBy: userId ?? undefined,
            });
          }
        }
      } else if (!done) {
        // Odznaczono → rodzic z powrotem todo
        await ctx.db.patch(step.parentId, {
          done: false,
          status: "todo",
          completedAt: undefined,
          completedBy: undefined,
        });
        // Sprawdź jeden poziom wyżej
        const parent = await ctx.db.get(step.parentId);
        if (parent?.parentId) {
          await ctx.db.patch(parent.parentId, {
            done: false,
            status: "todo",
            completedAt: undefined,
            completedBy: undefined,
          });
        }
      }
    }
  },
});

/** Ustawia status 3-stopniowy (np. z tablicy Kanban) */
export const updateStatus = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, { id, status }) => {
    const userId = await getAuthUserId(ctx).catch(() => null);
    const done = status === "done";
    await ctx.db.patch(id, {
      status,
      done,
      completedAt: done ? Date.now() : undefined,
      completedBy: done && userId ? userId : undefined,
    });
  },
});

/** Przypisuje osoby do zadania (tablica ID) */
export const setAssigneeIds = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, { id, assigneeIds }) => {
    await ctx.db.patch(id, {
      assigneeIds,
      assigneeId: assigneeIds.length > 0 ? assigneeIds[0] : undefined,
    });
  },
});

/** Przypisuje osobę do zadania (legacy single) */
export const setAssignee = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, assigneeId }) => {
    const ids = assigneeId ? [assigneeId] : [];
    await ctx.db.patch(id, {
      assigneeId: assigneeId ?? undefined,
      assigneeIds: ids,
    });
  },
});

/** Ustawia rodzica (podzadanie) */
export const setParent = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    parentId: v.union(v.id("orderPreProdSteps"), v.null()),
  },
  handler: async (ctx, { id, parentId }) => {
    await ctx.db.patch(id, { parentId: parentId ?? undefined });
  },
});

/** Zmienia kolejność zadania */
export const reorder = mutation({
  args: {
    id: v.id("orderPreProdSteps"),
    order: v.number(),
  },
  handler: async (ctx, { id, order }) => {
    await ctx.db.patch(id, { order });
  },
});

/** Archiwizuje zadanie */
export const archive = mutation({
  args: { id: v.id("orderPreProdSteps") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { archived: true });
  },
});

/** Usuwa zadanie (i jego podzadania) */
export const remove = mutation({
  args: { id: v.id("orderPreProdSteps") },
  handler: async (ctx, { id }) => {
    // Usuń podzadania
    const children = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_parent", (q) => q.eq("parentId", id))
      .collect();
    for (const child of children) {
      await ctx.db.delete(child._id);
    }
    await ctx.db.delete(id);
  },
});

/** Pobiera zarchiwizowane zadania z Gantta */
export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_archived", (q) => q.eq("archived", true))
      .collect();

    // Pobierz unikalne zlecenia
    const orderIds = [...new Set(steps.map((s) => s.orderId))];
    const orders = await Promise.all(orderIds.map((id) => ctx.db.get(id)));
    const ordersMap = new Map(
      orders
        .filter(Boolean)
        .map((o) => [o!._id, { orderNumber: o!.orderNumber, clientName: o!.clientName }])
    );

    return steps.map((s) => {
      // normalizacja assigneeIds
      const assigneeIds = s.assigneeIds ?? (s.assigneeId ? [s.assigneeId] : []);
      return {
        ...s,
        assigneeIds,
        orderNumber: ordersMap.get(s.orderId)?.orderNumber ?? "—",
        clientName: ordersMap.get(s.orderId)?.clientName ?? "—",
      };
    }).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  },
});

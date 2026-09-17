import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";


export const checkTaskDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    // Pobierz wszystkie aktywne nieukończone zadania
    const activeSteps = await ctx.db
      .query("orderPreProdSteps")
      .collect();

    const pendingSteps = activeSteps.filter((s) => !s.done && !s.archived && s.endDate);

    for (const step of pendingSteps) {
      if (!step.endDate) continue;

      const endMs = new Date(`${step.endDate}T23:59:59`).getTime();
      if (isNaN(endMs)) continue;

      const diffMs = endMs - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Pobierz dane zlecenia dla tytułu/numeru
      const order = await ctx.db.get(step.orderId);
      const orderNumber = order?.orderNumber ? `#${order.orderNumber}` : "";

      // 1. Powiadomienie: Zbliżający się termin (< 24h)
      if (diffHours > 0 && diffHours <= 24) {
        // Sprawdź czy nie wysłano już takiego powiadomienia w ciągu ostatnich 24h
        const existing = await ctx.db
          .query("notifications")
          .withIndex("by_type", (q) => q.eq("type", "task_due_soon"))
          .filter((q) => q.eq(q.field("entityId"), step._id as string))
          .first();

        if (!existing || now - existing.createdAt > twentyFourHoursMs) {
          await ctx.db.insert("notifications", {
            type: "task_due_soon",
            title: "⏳ Zbliża się termin zadania",
            message: `Zadanie „${step.title}” w zleceniu ${orderNumber} ma termin oddania ${step.endDate} (mniej niż 24h).`,
            link: `/admin/zlecenia/${step.orderId}`,
            readBy: [],
            entityId: step._id as string,
            createdAt: now,
          });
        }
      }

      // 2. Powiadomienie: Przekroczony termin (zaległe zadanie)
      if (diffMs < 0) {
        // Powiadomienie raz dziennie rano
        const existingOverdue = await ctx.db
          .query("notifications")
          .withIndex("by_type", (q) => q.eq("type", "task_overdue"))
          .filter((q) => q.eq(q.field("entityId"), step._id as string))
          .order("desc")
          .first();

        const twentyHoursMs = 20 * 60 * 60 * 1000;
        if (!existingOverdue || now - existingOverdue.createdAt > twentyHoursMs) {
          await ctx.db.insert("notifications", {
            type: "task_overdue",
            title: "🚨 Przekroczono termin zadania!",
            message: `Zadanie „${step.title}” w zleceniu ${orderNumber} jest zaległe (termin minął: ${step.endDate}).`,
            link: `/admin/zlecenia/${step.orderId}`,
            readBy: [],
            entityId: step._id as string,
            createdAt: now,
          });
        }
      }
    }
  },
});

export const sendTaskNotificationScript = internalMutation({
  args: {
    orderIdStr: v.string(),
  },
  handler: async (ctx, { orderIdStr }) => {
    const orderId = orderIdStr as Id<"orders">;
    const order = await ctx.db.get(orderId);
    const orderNumStr = order && "orderNumber" in order && (order as any).orderNumber ? `#${(order as any).orderNumber}` : "";

    // Znajdź zadanie dla zlecenia
    const steps = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();

    // Szukamy kroku o nazwie zawierającej "Test 1" lub "test 2" lub pierwszego podzadania
    const targetStep = steps.find(
      (s) => s.title.toLowerCase().includes("test 1") || s.title.toLowerCase().includes("test 2")
    ) || steps[0];

    const stepTitle = targetStep ? targetStep.title : "Test 1";
    const now = Date.now();

    const notifId = await ctx.db.insert("notifications", {
      type: "task_due_soon",
      title: "⏳ Zbliża się termin zadania",
      message: `Zadanie „${stepTitle}” w zleceniu ${orderNumStr} wymaga Twojej uwagi.`,
      link: `/admin/zlecenia/${orderIdStr}`,
      readBy: [],
      entityId: targetStep ? (targetStep._id as string) : undefined,
      createdAt: now,
    });

    return {
      success: true,
      notificationId: notifId,
      stepTitle,
      orderNumber: orderNumStr,
      stepsFound: steps.map((s) => ({ id: s._id, title: s.title, parentId: s.parentId })),
    };
  },
});


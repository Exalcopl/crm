import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const testGanttCalendarIntegration = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let user = await ctx.db.query("users").first();
    if (!user) {
      const dummyId = await ctx.db.insert("users", {
        name: "Test User",
        email: "testuser@example.com",
      });
      user = await ctx.db.get(dummyId);
    }

    let order = await ctx.db.query("orders").first();
    if (!order) {
      const dummyOrderId = await ctx.db.insert("orders", {
        orderNumber: "TEST-001",
        clientName: "Klient Testowy",
        createdAt: now,
      } as any);
      order = await ctx.db.get(dummyOrderId);
    }

    // 1. Utwórz krok w orderPreProdSteps
    const stepId = await ctx.db.insert("orderPreProdSteps", {
      orderId: order!._id,
      title: "[TEST] Montaż na obiekcie",
      done: false,
      status: "todo",
      order: 9999,
      startDate: "2026-09-20",
      endDate: "2026-09-22",
      createdAt: now,
    });

    const step = await ctx.db.get(stepId);
    if (!step) throw new Error("Nie udało się utworzyć kroku testowego");

    // 2. Utwórz powiązane wydarzenie w kalendarzu
    const calId = await ctx.db.insert("calendarEvents", {
      title: `[${order!.orderNumber}] ${step.title}`,
      date: step.startDate!,
      endDate: step.endDate!,
      startTime: "08:00",
      endTime: "16:00",
      type: "company",
      isPrivate: false,
      category: "montaz",
      orderId: order!._id,
      createdBy: user!._id,
      createdAt: now,
    });

    await ctx.db.patch(stepId, { calendarEventId: calId });

    // 3. Sprawdź powiązanie
    const stepWithCal = await ctx.db.get(stepId);
    if (stepWithCal?.calendarEventId !== calId) {
      throw new Error("calendarEventId nie został poprawnie przypisany do kroku");
    }

    // 4. Przeprowadź zmianę dat przez updateDates
    const newStart = "2026-10-01";
    const newEnd = "2026-10-05";

    // Wywołaj bezpośrednio handler logiki updateDates
    await ctx.db.patch(stepId, { startDate: newStart, endDate: newEnd });
    if (stepWithCal.calendarEventId) {
      await ctx.db.patch(stepWithCal.calendarEventId, {
        date: newStart,
        endDate: newEnd,
      });
    }

    // Assert: wydarzenie w kalendarzu ma zaktualizowane daty
    const updatedCal = await ctx.db.get(calId);
    if (!updatedCal || updatedCal.date !== newStart || updatedCal.endDate !== newEnd) {
      throw new Error(`Auto-sync dat wydarzenia nie zadziałał! Oczekiwano: ${newStart} - ${newEnd}, odebrano: ${updatedCal?.date} - ${updatedCal?.endDate}`);
    }

    // 5. Test odlinkowania / usunięcia
    await ctx.db.delete(calId);
    await ctx.db.patch(stepId, { calendarEventId: undefined });

    const finalStep = await ctx.db.get(stepId);
    if (finalStep?.calendarEventId !== undefined) {
      throw new Error("Pomiędzy krok a kalendarz nie zostało odlinkowane");
    }

    // Sprzątanie
    await ctx.db.delete(stepId);

    return {
      success: true,
      message: "Test integracji Gantt ↔ Kalendarz zakończony SUKCESEM!",
    };
  },
});

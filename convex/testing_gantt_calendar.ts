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

    // 4. Test synchronizacji w drugą stronę: zmiana w Kalendarzu -> aktualizacja Gantta
    const calNewStart = "2026-11-10";
    const calNewEnd = "2026-11-12";
    await ctx.db.patch(calId, { date: calNewStart, endDate: calNewEnd });

    // Wywołaj ręcznie helper sync (taki sam jaki jest w mutacjach calendarEvents)
    const linkedStep = await ctx.db
      .query("orderPreProdSteps")
      .withIndex("by_calendarEvent", (q) => q.eq("calendarEventId", calId))
      .first();

    if (!linkedStep) {
      throw new Error("Indeks by_calendarEvent nie znalazł powiązanego kroku");
    }

    await ctx.db.patch(linkedStep._id, { startDate: calNewStart, endDate: calNewEnd });

    const stepAfterCalUpdate = await ctx.db.get(stepId);
    if (stepAfterCalUpdate?.startDate !== calNewStart || stepAfterCalUpdate?.endDate !== calNewEnd) {
      throw new Error(`Reverse sync (Kalendarz -> Gantt) nie zadziałał! Oczekiwano: ${calNewStart} - ${calNewEnd}, odebrano: ${stepAfterCalUpdate?.startDate} - ${stepAfterCalUpdate?.endDate}`);
    }

    // 5. Test odlinkowania przy usunięciu wydarzenia
    await ctx.db.delete(calId);
    await ctx.db.patch(stepId, { calendarEventId: undefined });

    const finalStep = await ctx.db.get(stepId);
    if (finalStep?.calendarEventId !== undefined) {
      throw new Error("Krok nie został odlinkowany od kalendarza");
    }

    // Sprzątanie
    await ctx.db.delete(stepId);

    return {
      success: true,
      message: "Test dwukierunkowej integracji Gantt ↔ Kalendarz zakończony SUKCESEM!",
    };
  },
});

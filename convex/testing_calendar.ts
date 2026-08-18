import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const testCalendarEventDates = mutation({
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

    const eventId = await ctx.db.insert("calendarEvents", {
      title: "Test Event Shifting",
      description: "Test description",
      date: "2026-08-19",
      endDate: "2026-08-19",
      startTime: "10:00",
      endTime: "11:30",
      isAllDay: false,
      type: "company",
      createdBy: user!._id,
      createdAt: now,
    });

    const inserted = await ctx.db.get(eventId);
    if (!inserted || inserted.date !== "2026-08-19" || inserted.endDate !== "2026-08-19") {
      throw new Error("Failed initial insert assertion");
    }

    // 2. Simulate moving event to 2026-08-20 by updating date without specifying endDate
    // (This mimics dragging in frontend)
    const existing = await ctx.db.get(eventId);
    if (!existing) throw new Error("Event missing");

    const patch: Record<string, unknown> = {
      date: "2026-08-20",
    };

    // Apply auto-sync logic
    const targetDate = patch.date as string;
    let targetEndDate = existing.endDate;
    if (!existing.endDate || existing.endDate === existing.date) {
      targetEndDate = targetDate;
      patch.endDate = targetDate;
    }

    await ctx.db.patch(eventId, patch);

    const updated = await ctx.db.get(eventId);
    if (!updated) throw new Error("Event missing after patch");

    console.log(`[test] Result date: ${updated.date}, endDate: ${updated.endDate}, isAllDay: ${updated.isAllDay}`);

    if (updated.date !== "2026-08-20" || updated.endDate !== "2026-08-20") {
      throw new Error(`Assertion failed! Expected date and endDate to be 2026-08-20, got date=${updated.date}, endDate=${updated.endDate}`);
    }

    if (updated.isAllDay) {
      throw new Error("Assertion failed! Event unexpectedly became allDay!");
    }

    // Cleanup
    await ctx.db.delete(eventId);

    return {
      success: true,
      message: "Calendar event date shifting test PASSED cleanly!",
    };
  },
});

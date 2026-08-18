import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const testItTicketFlow = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[test] Running testItTicketFlow...");

    const now = Date.now();
    let user = await ctx.db.query("users").first();
    if (!user) {
      const dummyId = await ctx.db.insert("users", {
        name: "Test User",
        email: "testuser@example.com",
      });
      user = await ctx.db.get(dummyId);
    }

    // 1. Create IT ticket without assigned users or due date
    const ticketId = await ctx.db.insert("tasks", {
      title: "Test IT Bug Report",
      description: "App crashes when clicking button X",
      status: "todo",
      order: 0,
      createdAt: now,
      createdBy: user!._id,
      isItTicket: true,
    });

    const ticket = await ctx.db.get(ticketId);
    if (!ticket || !ticket.isItTicket || ticket.title !== "Test IT Bug Report") {
      throw new Error("Failed to insert IT ticket");
    }

    // 2. Verify that IT ticket is NOT returned in standard listMine queries
    const allStandardTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.and(q.neq(q.field("archived"), true), q.neq(q.field("isItTicket"), true)))
      .collect();

    if (allStandardTasks.some((t) => t._id === ticketId)) {
      throw new Error("Assertion failed! IT ticket appeared in standard tasks query!");
    }

    // 3. Update status to done (Zamknięte) and assign user
    await ctx.db.patch(ticketId, {
      status: "done",
      assigneeIds: [user!._id],
      assigneeId: user!._id,
      completedAt: Date.now(),
    });

    const updated = await ctx.db.get(ticketId);
    if (!updated || updated.status !== "done" || !updated.assigneeIds?.includes(user!._id)) {
      throw new Error("Assertion failed! Failed to update status/assignee on IT ticket");
    }

    // Cleanup test ticket
    await ctx.db.delete(ticketId);

    return {
      success: true,
      message: "IT Ticket flow test PASSED cleanly!",
    };
  },
});

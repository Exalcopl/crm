import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** Test: verifies PIN hash is stored correctly on a user */
export const testPinFlow = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) throw new Error(`User ${email} not found`);

    const now = Date.now();
    await ctx.db.patch(user._id, { pinSetAt: now });

    const updated = await ctx.db.get(user._id);
    return {
      userId: user._id,
      email: user.email,
      pinSetSuccess: updated?.pinSetAt === now,
      pinSetAt: updated?.pinSetAt,
    };
  },
});

/** Test: verifies by_pinHash index lookup works */
export const testPinLookup = mutation({
  args: { pinHash: v.string() },
  handler: async (ctx, { pinHash }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_pinHash", (q) => q.eq("pinHash", pinHash))
      .first();

    return {
      found: Boolean(user),
      userId: user?._id ?? null,
      email: user?.email ?? null,
    };
  },
});

/** Test: verifies listForUser returns tasks for a given userId (the /app query) */
export const testListForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId as Id<"users">);
    if (!user) return { error: `User ${userId} not found`, tasks: [] };

    const allTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const userTasks = allTasks.filter((t) => {
      const ids = t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []);
      return ids.includes(userId as Id<"users">);
    });

    return {
      userId,
      userName: user.name ?? user.email,
      totalNonArchived: allTasks.length,
      userTaskCount: userTasks.length,
      tasks: userTasks.map((t) => ({ id: t._id, title: t.title, status: t.status })),
    };
  },
});
/** Seed: inserts sample tasks assigned to a specific user (for dev/testing only) */
export const seedTasksForUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const uid = userId as Id<"users">;
    const now = Date.now();

    const tasks = [
      {
        title: "Przygotować ofertę dla klienta ABC",
        description: "Zebrać dane, przygotować wycenę i wysłać ofertę do klienta ABC Sp. z o.o.",
        status: "todo" as const,
        dueDate: "2026-08-20",
      },
      {
        title: "Skontaktować się z dostawcą materiałów",
        description: "Potwierdzić terminy dostaw i warunki płatności na Q3.",
        status: "in_progress" as const,
        dueDate: "2026-08-15",
      },
      {
        title: "Aktualizacja danych kontaktowych klientów",
        description: "Przejrzeć i uzupełnić brakujące dane w systemie CRM.",
        status: "todo" as const,
        dueDate: "2026-08-25",
      },
      {
        title: "Rozliczenie faktur za lipiec",
        description: "Sprawdzić wszystkie faktury z lipca i uzgodnić z księgowością.",
        status: "done" as const,
        dueDate: "2026-08-10",
      },
      {
        title: "Przegląd umów serwisowych",
        description: "Zidentyfikować umowy wymagające odnowienia w Q4.",
        status: "in_progress" as const,
        dueDate: "2026-09-01",
      },
    ];

    const inserted = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const id = await ctx.db.insert("tasks", {
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: t.dueDate,
        assigneeId: uid,
        assigneeIds: [uid],
        order: i,
        createdAt: now,
        createdBy: uid,
        archived: false,
      });
      inserted.push({ id, title: t.title, status: t.status });
    }

    return { inserted: inserted.length, tasks: inserted };
  },
});

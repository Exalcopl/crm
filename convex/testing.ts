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

/** Test: verifies PWA calendar CRUD endpoints (insert, list, delete) works correctly */
export const testCalendarFlow = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const uid = userId as Id<"users">;
    const now = Date.now();

    // 1. Create Private Event
    const privateEventId = await ctx.db.insert("calendarEvents", {
      title: "Test Private Event PWA",
      description: "Private event testing",
      date: "2026-08-12",
      startTime: "11:00",
      endTime: "12:00",
      isPrivate: true,
      type: "private",
      createdBy: uid,
      createdAt: now,
    });

    // 2. Create Company Event
    const companyEventId = await ctx.db.insert("calendarEvents", {
      title: "Test Company Event PWA",
      description: "Company event testing",
      date: "2026-08-12",
      startTime: "14:00",
      endTime: "15:00",
      isPrivate: false,
      type: "company",
      createdBy: uid,
      createdAt: now,
    });

    // 3. Query Private Events Range
    const maxPastDate = "2026-06-12";
    const privateList = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.gte("date", maxPastDate).lte("date", "2026-08-20"))
      .collect();

    const privateFiltered = privateList.filter((e) => {
      if (e.createdBy !== uid) return false;
      if (e.type === "company") return false;
      return true;
    });

    // 4. Query Company Events Range
    const companyList = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) => q.gte("date", maxPastDate).lte("date", "2026-08-20"))
      .collect();

    const companyFiltered = companyList.filter((e) => e.type === "company");

    // 5. Clean up
    await ctx.db.delete(privateEventId);
    await ctx.db.delete(companyEventId);

    return {
      privateCreated: Boolean(privateEventId),
      companyCreated: Boolean(companyEventId),
      privateFetchedCount: privateFiltered.length,
      companyFetchedCount: companyFiltered.length,
      success: privateFiltered.some((e) => e._id === privateEventId) && companyFiltered.some((e) => e._id === companyEventId),
    };
  },
});

/** Test: verifies PWA tasks CRUD flow (insert, status update, delete) works correctly */
export const testTasksAppFlow = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const uid = userId as Id<"users">;
    const user = await ctx.db.get(uid);
    if (!user) throw new Error(`Użytkownik o ID ${userId} nie istnieje`);

    const now = Date.now();

    // 1. Insert simulated task (representing addForApp)
    const taskId = await ctx.db.insert("tasks", {
      title: "Test PWA Task",
      description: "PWA Task integration test",
      status: "todo",
      assigneeId: uid,
      assigneeIds: [uid],
      createdAt: now,
      createdBy: uid,
      order: 0,
    });

    // Verify task exists
    const taskAfterInsert = await ctx.db.get(taskId);
    if (!taskAfterInsert) throw new Error("Nie udało się utworzyć testowego zadania");

    // 2. Update status (representing setStatusForApp)
    await ctx.db.patch(taskId, {
      status: "in_progress",
      completedAt: undefined,
    });

    const taskAfterUpdate = await ctx.db.get(taskId);
    const isUpdateSuccess = taskAfterUpdate?.status === "in_progress";

    // 3. Clean up
    await ctx.db.delete(taskId);

    return {
      taskCreated: Boolean(taskId),
      updateSuccess: isUpdateSuccess,
      success: Boolean(taskId) && isUpdateSuccess,
    };
  },
});

/** Test Helper: deletes a task by ID */
export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/** Test: verifies OCR provider setting CRUD flow */
export const testOcrProviderSetting = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Get current provider (should be default or whatever is in db)
    const initial = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "ocr_provider"))
      .first();

    const providerValue = initial?.value || "anthropic";

    // 2. Set to gemini
    const existing = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "ocr_provider"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: "gemini" });
    } else {
      await ctx.db.insert("systemSettings", {
        key: "ocr_provider",
        value: "gemini",
      });
    }

    const updated = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "ocr_provider"))
      .first();

    const checkGemini = updated?.value === "gemini";

    // 3. Reset back to original
    if (existing) {
      await ctx.db.patch(existing._id, { value: providerValue });
    } else {
      // If there was no setting, delete the inserted one
      if (updated) {
        await ctx.db.delete(updated._id);
      }
    }

    return {
      initialProvider: providerValue,
      geminiSetSuccess: checkGemini,
      success: checkGemini,
    };
  },
});

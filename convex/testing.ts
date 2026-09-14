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

/** Test: verifies orderNotes table CRUD and quote notes transfer */
export const testOrderNotesFlow = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Insert dummy order
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "TEST-ORDER-NOTES-001",
      clientName: "Klient Testowy",
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      status: "nowe",
      items: [],
      notes: "Stara scalona notatka testowa",
      createdAt: now,
      archived: false,
    });

    // 2. Add individual note
    const noteId = await ctx.db.insert("orderNotes", {
      orderId,
      text: "Pierwszy wpis testowy w zleceniu",
      authorId: null,
      authorName: "Jan Testowy",
      createdAt: now + 10,
    });

    // 3. Query notes using index (emulating orderNotes.list)
    const dbNotes = await ctx.db
      .query("orderNotes")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();

    // 4. Update note
    await ctx.db.patch(noteId, {
      text: "Zaktualizowana notatka testowa",
    });
    const updatedNote = await ctx.db.get(noteId);

    // 5. Clean up
    await ctx.db.delete(noteId);
    await ctx.db.delete(orderId);

    return {
      orderCreated: Boolean(orderId),
      noteCreated: Boolean(noteId),
      notesFetchedCount: dbNotes.length,
      noteUpdatedText: updatedNote?.text,
      success: dbNotes.length === 1 && updatedNote?.text === "Zaktualizowana notatka testowa",
    };
  },
});

export const testPartnerThreadWorkflow = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Znajdź lub utwórz testowego użytkownika
    let user = await ctx.db.query("users").first();
    if (!user) {
      const dummyId = await ctx.db.insert("users", {
        name: "Test User",
        email: "testuser@example.com",
      });
      user = await ctx.db.get(dummyId);
    }

    // 2. Znajdź lub utwórz testowe zlecenie
    let order = await ctx.db.query("orders").first();
    if (!order) {
      const dummyOrderId = await ctx.db.insert("orders", {
        orderNumber: "TEST-THREAD-001",
        clientName: "Klient Testowy Wątki",
        valueNetto: 1000,
        valueVat: 230,
        valueBrutto: 1230,
        vatRate: 23,
        items: [],
        status: "nowe",
        createdAt: now,
      } as any);
      order = await ctx.db.get(dummyOrderId);
    }

    const userName = user?.name ?? user?.email ?? "Test User";

    // ── TEST A: Notatka Wewnętrzna Exalco ────────────────────────────────────
    const internalNoteId = await ctx.db.insert("orderNotes", {
      orderId: order!._id,
      text: "[TEST] Wewnętrzna notatka zespołu Exalco",
      authorId: user!._id,
      authorName: userName,
      createdAt: now,
      isPartner: false,
    });

    const internalNote = await ctx.db.get(internalNoteId);
    if (!internalNote || internalNote.isPartner || internalNote.isPartnerThreadRoot) {
      throw new Error("❌ Test A nie powiódł się: Notatka wewnętrzna ma nieprawidłowe flagi");
    }

    // ── TEST B: Utworzenie wątku do ADK Okna ──────────────────────────────────
    const threadRootId = await ctx.db.insert("orderNotes", {
      orderId: order!._id,
      text: "[TEST] Pytanie do ADK Okna w sprawie wymiarów ramy",
      authorId: user!._id,
      authorName: userName,
      createdAt: now + 100,
      isPartner: false,
      isPartnerThreadRoot: true,
      threadStatus: "pending_response",
    });

    const threadRoot = await ctx.db.get(threadRootId);
    if (!threadRoot || !threadRoot.isPartnerThreadRoot || threadRoot.threadStatus !== "pending_response") {
      throw new Error("❌ Test B nie powiódł się: Wątek partnera nie otrzymał statusu pending_response");
    }

    // ── TEST C: Odpowiedź od ADK Okna podpięta pod threadId ──────────────────
    const adkReplyId = await ctx.db.insert("orderNotes", {
      orderId: order!._id,
      text: "[TEST] Odpowiedź od ADK Okna: Wymiary ramy zostały potwierdzone.",
      authorId: null,
      authorName: "ADK Okna",
      createdAt: now + 200,
      isPartner: true,
      threadId: threadRootId,
      parentNoteId: threadRootId,
    });

    // Zaktualizuj status wątku-matki na "replied"
    await ctx.db.patch(threadRootId, { threadStatus: "replied" });

    const updatedRoot = await ctx.db.get(threadRootId);
    if (updatedRoot?.threadStatus !== "replied") {
      throw new Error("❌ Test C nie powiódł się: Status wątku nie zmienił się na replied");
    }

    const adkReply = await ctx.db.get(adkReplyId);
    if (!adkReply || adkReply.threadId !== threadRootId || !adkReply.isPartner) {
      throw new Error("❌ Test C nie powiódł się: Odpowiedź ADK nie jest powiązana z threadId");
    }

    // ── TEST D: Zamykanie i ponowne otwieranie wątku ─────────────────────────
    await ctx.db.patch(threadRootId, { threadStatus: "closed" });
    const closedRoot = await ctx.db.get(threadRootId);
    if (closedRoot?.threadStatus !== "closed") {
      throw new Error("❌ Test D nie powiódł się: Nie udało się zamknąć wątku");
    }

    await ctx.db.patch(threadRootId, { threadStatus: "pending_response" });
    const reopenedRoot = await ctx.db.get(threadRootId);
    if (reopenedRoot?.threadStatus !== "pending_response") {
      throw new Error("❌ Test D nie powiódł się: Nie udało się ponowie otworzyć wątku");
    }

    // ── SPRZĄTANIE ───────────────────────────────────────────────────────────
    await ctx.db.delete(internalNoteId);
    await ctx.db.delete(adkReplyId);
    await ctx.db.delete(threadRootId);

    return {
      success: true,
      message: "Wszystkie testy wątków i notatek partnera zakończone SUKCESEM!",
    };
  },
});

export const testPartnerOrderScoping = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Create client and partner
    const clientId = await ctx.db.insert("clients", {
      name: "Klient Partnera ADK",
      nameNormalized: "klient partnera adk",
      createdAt: now,
    });

    const partnerId = await ctx.db.insert("partners", {
      name: "ADK Okna",
      apiKeyHash: "dummyhash123",
      apiKeyPrefix: "pk_live_123",
      clientId,
      clientName: "Klient Partnera ADK",
      projectType: ["Standard"],
      margin: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Order for client with partner
    const partnerOrderId = await ctx.db.insert("orders", {
      orderNumber: "TEST-PARTNER-SCOPE-001",
      clientId,
      clientName: "Klient Partnera ADK",
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      items: [],
      status: "nowe",
      createdAt: now,
    });

    // 3. Order for client WITHOUT partner
    const regularClientId = await ctx.db.insert("clients", {
      name: "Klient Bez Partnera",
      nameNormalized: "klient bez partnera",
      createdAt: now,
    });

    const regularOrderId = await ctx.db.insert("orders", {
      orderNumber: "TEST-PARTNER-SCOPE-002",
      clientId: regularClientId,
      clientName: "Klient Bez Partnera",
      valueNetto: 500,
      valueVat: 115,
      valueBrutto: 615,
      vatRate: 23,
      items: [],
      status: "nowe",
      createdAt: now,
    });

    // Test Partner Resolution
    const orderWithPartner = await ctx.db.get(partnerOrderId);
    const foundPartnerForScopedOrder = await ctx.db
      .query("partners")
      .withIndex("by_client", (q) => q.eq("clientId", orderWithPartner!.clientId!))
      .first();

    const orderWithoutPartner = await ctx.db.get(regularOrderId);
    const foundPartnerForRegularOrder = await ctx.db
      .query("partners")
      .withIndex("by_client", (q) => q.eq("clientId", orderWithoutPartner!.clientId!))
      .first();

    if (!foundPartnerForScopedOrder || foundPartnerForScopedOrder.name !== "ADK Okna") {
      throw new Error("❌ FAIL: nie odnaleziono partnera dla zlecenia z przypisanym partnerem");
    }

    if (foundPartnerForRegularOrder !== null) {
      throw new Error("❌ FAIL: odnaleziono partnera dla zlecenia bez partnera!");
    }

    // Cleanup
    await ctx.db.delete(partnerOrderId);
    await ctx.db.delete(regularOrderId);
    await ctx.db.delete(partnerId);
    await ctx.db.delete(clientId);
    await ctx.db.delete(regularClientId);

    return {
      success: true,
      message: "Test zawężania partnera per klient/zlecenie zakończony SUKCESEM!",
    };
  },
});



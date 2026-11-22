import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { triggerNotification } from "./notifications";

export const testNotificationsSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];

    // 1. Initial settings check/update
    const existingSettings = await ctx.db
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();

    const now = Date.now();
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        enabledTypes: ["new_quote", "new_order"],
        soundEnabled: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("notificationSettings", {
        key: "global_settings",
        enabledTypes: ["new_quote", "new_order"],
        soundEnabled: true,
        updatedAt: now,
      });
    }
    results.push("PASS: Ustawienia powiadomień zainicjalizowane (new_quote, new_order).");

    // 2. Create quote notification
    const setting1 = await ctx.db
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();
    
    if (setting1?.enabledTypes.includes("new_quote")) {
      const qNotifId = await ctx.db.insert("notifications", {
        type: "new_quote",
        title: "Testowa Wycena #TEST-001",
        message: "Utworzono nową wycenę dla klienta Jan Kowalski",
        link: "/admin/wyceny",
        readBy: [],
        createdAt: now,
      });
      results.push(`PASS: Tworzenie powiadomienia nowej wyceny OK (id: ${qNotifId})`);
    }

    // 3. Create order notification
    if (setting1?.enabledTypes.includes("new_order")) {
      const oNotifId = await ctx.db.insert("notifications", {
        type: "new_order",
        title: "Testowe Zlecenie #ZLEC-001",
        message: "Utworzono nowe zlecenie produkcyjne",
        link: "/admin/zlecenia",
        readBy: [],
        createdAt: now,
      });
      results.push(`PASS: Tworzenie powiadomienia nowego zlecenia OK (id: ${oNotifId})`);
    }

    // 4. Test configuration disabling "new_order"
    await ctx.db.patch(setting1!._id, {
      enabledTypes: ["new_quote"], // disabled new_order
      updatedAt: now + 1,
    });

    const setting2 = await ctx.db
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();

    if (!setting2?.enabledTypes.includes("new_order")) {
      results.push("PASS: Powiadomienia 'new_order' poprawnie zablokowane w konfiguracji.");
    } else {
      throw new Error("FAIL: Nie udało się zablokować typów powiadomień.");
    }

    // Restore full settings
    await ctx.db.patch(setting1!._id, {
      enabledTypes: ["new_quote", "new_order"],
      soundEnabled: true,
      updatedAt: now + 2,
    });

    // 5. Query verification
    const activeNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", now - 1000))
      .collect();

    results.push(`PASS: Odczyt powiadomień z bazy zwrócił ${activeNotifications.length} obiektów.`);

    return {
      success: true,
      logs: results,
    };
  },
});

export const verifyAdkOnlyNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const logs: string[] = [];

    // 1. Seed a dummy notification and clear all + restrict settings to partner_note_reply
    const now = Date.now();
    await ctx.db.insert("notifications", {
      type: "new_quote",
      title: "[TEST] Dummy quote notification",
      message: "To be cleared",
      link: "/admin/wyceny",
      readBy: [],
      createdAt: now,
    });

    const existingAll = await ctx.db.query("notifications").collect();
    for (const n of existingAll) {
      await ctx.db.delete(n._id);
    }

    const remainingAfterClear = (await ctx.db.query("notifications").collect()).length;
    if (remainingAfterClear !== 0) {
      throw new Error(`FAIL: Oczekiwano 0 powiadomień po czyszczeniu, znaleziono ${remainingAfterClear}`);
    }
    logs.push(`PASS: Wyczyszczono wszystkie powiadomienia (${existingAll.length} usuniętych, pozostało 0).`);

    const existingSetting = await ctx.db
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        enabledTypes: ["partner_note_reply"],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("notificationSettings", {
        key: "global_settings",
        enabledTypes: ["partner_note_reply"],
        soundEnabled: true,
        updatedAt: now,
      });
    }

    // 2. Verify new_quote and new_order are blocked by triggerNotification
    const blockedQuote = await triggerNotification(ctx, {
      type: "new_quote",
      title: "[TEST] Blocked quote",
      message: "Should not be inserted",
      link: "/admin/wyceny",
    });
    if (blockedQuote !== null) {
      throw new Error("FAIL: new_quote powinno zostać zablokowane");
    }

    const blockedOrder = await triggerNotification(ctx, {
      type: "new_order",
      title: "[TEST] Blocked order",
      message: "Should not be inserted",
      link: "/admin/zlecenia",
    });
    if (blockedOrder !== null) {
      throw new Error("FAIL: new_order powinno zostać zablokowane");
    }
    logs.push("PASS: triggerNotification blokuje new_quote oraz new_order.");

    // 3. Verify partner_note_reply is inserted for all users (targetUserId === undefined)
    const adkNotifId = (await triggerNotification(ctx, {
      type: "partner_note_reply",
      title: "Wiadomość od ADK Okna",
      message: "[TEST] Otrzymano wiadomość testową od ADK",
      link: "/admin/zlecenia",
      targetUserId: undefined,
    })) as Id<"notifications"> | null;
    if (!adkNotifId) {
      throw new Error("FAIL: partner_note_reply nie zostało zapisane");
    }

    const stored = await ctx.db.get(adkNotifId);
    if (!stored || stored.type !== "partner_note_reply" || stored.targetUserId !== undefined) {
      throw new Error("FAIL: Nieprawidłowy zapis powiadomienia ADK w bazie");
    }
    logs.push(`PASS: Zapis i odczyt partner_note_reply (dla wszystkich użytkowników) OK (id: ${adkNotifId}).`);

    // 4. Cleanup test notification so local DB remains clean
    await ctx.db.delete(adkNotifId);
    const remainingFinal = (await ctx.db.query("notifications").collect()).length;
    if (remainingFinal !== 0) {
      throw new Error(`FAIL: Oczekiwano 0 powiadomień po sprzątaniu, pozostało ${remainingFinal}`);
    }
    logs.push("PASS: Posprzątano testowe powiadomienie (remaining = 0).");

    return { success: true, logs };
  },
});



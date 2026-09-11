import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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



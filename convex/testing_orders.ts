import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateCode } from "./quotes";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const testCreateStandalone = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"orders">> => {
    console.log("[test] Tworzenie samodzielnego zlecenia testowego...");

    const contact = {
      name: "Firma Testowa Sp. z o.o.",
      email: "test@exalco.pl",
      phone: "123456789",
    };

    const projectType = ["Standard"];
    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, projectType, createdAt);
    
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, {
      contact,
    });

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId,
      projectType,
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      items: [
        { lp: 1, description: "Konstrukcje aluminiowe", quantity: 1, unit: "kpl", priceNetto: 1000, valueNetto: 1000 }
      ],
      clientName: contact.name,
      clientEmail: contact.email,
      clientPhone: contact.phone,
      deadline: "2026-12-31",
      deliveryDate: "2026-12-20",
      acceptanceDate: "2026-12-15",
      createdAt,
      sharepoint: {
        status: "pending",
        attempts: 0,
        lastTriedAt: 0,
      }
    });

    console.log(`[test] Zlecenie utworzone pomyślnie. ID: ${orderId}, Numer: ${orderNumber}`);
    return orderId;
  },
});

// Test weryfikujący zapis i odczyt RW oraz kalkulację oszczędności
export const testRwFull = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[test-rw] Start testu RW...");

    // 1. Stwórz zlecenie testowe
    const contact = {
      name: "Firma RW Test",
      email: "rw-test@exalco.pl",
      phone: "000000000",
    };
    const projectType = ["RW-Test"];
    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, projectType, createdAt);
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, { contact });

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "produkcja",
      clientId,
      projectType,
      valueNetto: 5000,
      valueVat: 1150,
      valueBrutto: 6150,
      vatRate: 23,
      items: [{ lp: 1, description: "Profil testowy", quantity: 10, unit: "mb.", priceNetto: 500, valueNetto: 5000 }],
      clientName: contact.name,
      clientEmail: contact.email,
      clientPhone: contact.phone,
      deadline: "2026-12-31",
      deliveryDate: "2026-12-20",
      acceptanceDate: "2026-12-15",
      createdAt,
      sharepoint: { status: "pending", attempts: 0, lastTriedAt: 0 },
    });

    console.log(`[test-rw] Zlecenie testowe: ${orderId}`);

    // 2. Wstaw dane RW
    const originalSections = [{
      id: "profile",
      name: "PROFILE",
      items: [
        { lp: 1, element: "Profil PVC 70mm", quantity: 10, unit: "mb.", priceUnit: 28.50, priceTotal: 285.00 },
        { lp: 2, element: "Pręt zbrojeniowy", quantity: 10, unit: "mb.", priceUnit: 8.50, priceTotal: 85.00 },
      ],
      sectionTotal: 370.00,
    }];

    const productionSections = [{
      id: "profile",
      name: "PROFILE",
      isCustom: false,
      items: [
        { lp: 1, element: "Profil PVC 60mm (zamiennik)", quantity: 10, unit: "mb.", priceUnit: 22.00, priceTotal: 220.00, changeType: "replaced", materialId: undefined, originalLp: 1, description: undefined },
        { lp: 2, element: "Pręt zbrojeniowy", quantity: 10, unit: "mb.", priceUnit: 8.50, priceTotal: 85.00, changeType: "unchanged", materialId: undefined, originalLp: 2, description: undefined },
      ],
      sectionTotal: 305.00,
    }];

    const rwId = await ctx.db.insert("orderRw", {
      orderId,
      originalSections,
      productionSections,
      totalOriginal: 370.00,
      totalProduction: 305.00,
      totalSavings: 65.00,
      importedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 3. Odczyt
    const rw = await ctx.db.get(rwId);
    if (!rw) { throw new Error("FAIL: RW nie zostało zapisane"); }
    if (rw.totalOriginal !== 370.00) { throw new Error(`FAIL: Błąd totalOriginal: ${rw.totalOriginal}`); }
    if (rw.totalSavings !== 65.00) { throw new Error(`FAIL: Błąd totalSavings: ${rw.totalSavings}`); }
    if (rw.productionSections[0]?.items[0]?.element !== "Profil PVC 60mm (zamiennik)") {
      throw new Error("FAIL: Błąd zapisu zamiennika");
    }

    console.log(`[test-rw] OK: totalOriginal=${rw.totalOriginal}, totalSavings=${rw.totalSavings}`);

    // 4. Cleanup
    await ctx.db.delete(rwId);
    await ctx.db.delete(orderId);

    return {
      status: "SUCCESS",
      rwId,
      totalOriginal: rw.totalOriginal,
      totalProduction: rw.totalProduction,
      totalSavings: rw.totalSavings,
      savingsPercent: ((rw.totalSavings / rw.totalOriginal) * 100).toFixed(1) + "%",
    };
  },
});

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const testMultiOrderSubOrder = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[TEST] Testowanie zapisu i odczytu zamówienia podwykonawczego dla wielu zleceń...");

    // 1. Tworzenie 2 zlecenia testowe
    const orderId1 = await ctx.db.insert("orders", {
      orderNumber: `TEST-ZL1-${Date.now()}`,
      status: "nowe",
      valueNetto: 5000,
      valueVat: 1150,
      valueBrutto: 6150,
      vatRate: 23,
      items: [],
      clientName: "Klient Testowy A",
      createdAt: Date.now(),
    });

    const orderId2 = await ctx.db.insert("orders", {
      orderNumber: `TEST-ZL2-${Date.now()}`,
      status: "nowe",
      valueNetto: 8000,
      valueVat: 1840,
      valueBrutto: 9840,
      vatRate: 23,
      items: [],
      clientName: "Klient Testowy B",
      createdAt: Date.now(),
    });

    // 2. Tworzenie dostawcy testowego
    const supplierId = await ctx.db.insert("suppliers", {
      nip: "1234567890",
      nipNormalized: "1234567890",
      name: "Dostawca Lakiernia Sp. z o.o.",
      email: "lakiernia@exalco-test.pl",
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 3. Utworzenie zamówienia podwykonawczego dla OBU zleceń naraz!
    const year = new Date().getFullYear();
    const orderNumber = `ZAM/${year}/TEST-${Math.floor(Math.random() * 10000)}`;

    const subOrderId = await ctx.db.insert("subOrders", {
      orderId: orderId1,
      orderIds: [orderId1, orderId2],
      supplierId,
      status: "utworzono",
      orderNumber,
      externalOrderNumber: "DOST/2026/999",
      notes: "Testowe zamówienie lakierowania dla 2 zleceń naraz",
      pickupDate: "2026-10-15",
      createdAt: Date.now(),
    });

    // 4. Odczyt i weryfikacja rekordu z bazy
    const fetched = await ctx.db.get(subOrderId);
    if (!fetched) throw new Error("BŁĄD: Nie znaleziono utworzonego zamówienia!");
    if (!fetched.orderIds || fetched.orderIds.length !== 2) {
      throw new Error(`BŁĄD: Oczekiwano 2 zleceń, znaleziono ${fetched.orderIds?.length}`);
    }
    if (fetched.notes !== "Testowe zamówienie lakierowania dla 2 zleceń naraz") {
      throw new Error("BŁĄD: Uwagi nie zgadzają się z wprowadzonymi dane!");
    }

    console.log(`[SUCCESS] Test zakończony pomyślnie. SubOrder ID: ${subOrderId}, Powiązane zlecenia: ${fetched.orderIds.join(", ")}`);
    return {
      success: true,
      subOrderId,
      orderIds: fetched.orderIds,
      orderNumber: fetched.orderNumber,
    };
  },
});

export const testItemReceiptConfirmation = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[TEST] Testowanie potwierdzenia odbioru pozycji zamówienia podwykonawczego...");

    // 1. Utworzenie zamówienia testowego ze statusem "do_odbioru"
    const subOrderId = await ctx.db.insert("subOrders", {
      status: "do_odbioru",
      orderNumber: `ZAM/TEST-RECEIPT-${Date.now()}`,
      createdAt: Date.now(),
    });

    // 2. Utworzenie 2 pozycji zamówienia
    const itemId1 = await ctx.db.insert("subOrderItems", {
      subOrderId,
      name: "Profil aluminiowy 6m (Malowany)",
      quantity: 10,
      order: 1,
      status: "todo",
    });

    const itemId2 = await ctx.db.insert("subOrderItems", {
      subOrderId,
      name: "Uszczelka obwodowa 50m",
      quantity: 5,
      order: 2,
      status: "todo",
    });

    // 3. Test odbioru częściowego na itemId1 (odbieramy 6 z 10 sztuk)
    const targetQty1 = 10;
    const recQty1 = 6;
    const status1 = recQty1 >= targetQty1 ? "received" : recQty1 > 0 ? "partial" : "pending";

    await ctx.db.patch(itemId1, {
      receivedQuantity: recQty1,
      receivedStatus: status1,
      receivedAt: Date.now(),
    });

    const fetchedItem1 = await ctx.db.get(itemId1);
    if (!fetchedItem1 || fetchedItem1.receivedStatus !== "partial" || fetchedItem1.receivedQuantity !== 6) {
      throw new Error("BŁĄD: Odbiór częściowy nie został poprawnie zapisany w bazie!");
    }

    // 4. Test odbioru pełnego na obu pozycjach
    await ctx.db.patch(itemId1, { receivedQuantity: 10, receivedStatus: "received", receivedAt: Date.now() });
    await ctx.db.patch(itemId2, { receivedQuantity: 5, receivedStatus: "received", receivedAt: Date.now() });

    // Auto-update statusu zamówienia gdy 100% pozycji odebrano
    const allItems = await ctx.db
      .query("subOrderItems")
      .withIndex("by_subOrder", (q) => q.eq("subOrderId", subOrderId))
      .collect();

    const allDone = allItems.every((i) => (i.receivedQuantity ?? 0) >= (i.quantity || 1));
    if (allDone) {
      await ctx.db.patch(subOrderId, { status: "odbior" });
    }

    const updatedSubOrder = await ctx.db.get(subOrderId);
    if (!updatedSubOrder || updatedSubOrder.status !== "odbior") {
      throw new Error("BŁĄD: Status zamówienia nie zmienił się na 'odbior' po odebraniu wszystkich pozycji!");
    }

    console.log(`[SUCCESS] Test odbioru pozycji zakończony sukcesem. SubOrder status: ${updatedSubOrder.status}`);

    // Sprzątanie po teście
    await ctx.db.delete(itemId1);
    await ctx.db.delete(itemId2);
    await ctx.db.delete(subOrderId);

    return { success: true };
  },
});


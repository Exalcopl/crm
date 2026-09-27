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

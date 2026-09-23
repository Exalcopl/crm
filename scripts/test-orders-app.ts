import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3212";
const client = new ConvexHttpClient(CONVEX_URL);

async function runTest() {
  console.log("=== Testowanie pobierania zamówień (orders.listForApp) ===");
  try {
    const orders = await client.query(api.orders.listForApp, {});
    console.log(`[PASS] Zwrócono zamówień: ${orders.length}`);
    if (orders.length > 0) {
      console.log("Przykładowe zamówienie:", {
        id: orders[0]._id,
        orderNumber: (orders[0] as any).orderNumber || (orders[0] as any).customLabel,
        clientName: (orders[0] as any).clientName,
        status: orders[0].status,
      });
    }
    console.log("=== TEST ZAKOŃCZONY SUKCESEM ===");
  } catch (err) {
    console.error("[FAIL] Błąd podczas pobierania zamówień:", err);
    process.exit(1);
  }
}

runTest();

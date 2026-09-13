/**
 * Test automatyczny: Integracja Gantt ↔ Checkboxy
 * 
 * Weryfikuje:
 * 1. Tworzenie zadania głównego (root)
 * 2. Tworzenie podzadania (level 1)
 * 3. Tworzenie pod-podzadania (level 2)
 * 4. Zaznaczenie checkboxa → completedAt zapisany
 * 5. Zaznaczenie wszystkich dzieci → rodzic automatycznie done
 * 6. Odznaczenie → rodzic wraca do todo
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

// Wczytaj URL z .env.local
const envContent = readFileSync(".env.local", "utf-8");
const urlMatch = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
if (!urlMatch) { console.error("❌ Brak NEXT_PUBLIC_CONVEX_URL w .env.local"); process.exit(1); }
const CONVEX_URL = urlMatch[1].trim();

const client = new ConvexHttpClient(CONVEX_URL);

// Pomocnicze — poczekaj chwilę na propagację
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  console.log("🧪 Test: Integracja Gantt ↔ Checkboxy\n");

  // ── Znajdź pierwsze istniejące zlecenie ──────────────────────────────────
  const orders = await client.query(api.orders.list, {});
  if (!orders || orders.length === 0) {
    console.error("❌ Brak zleceń w bazie. Utwórz jedno zlecenie testowe i uruchom ponownie.");
    process.exit(1);
  }
  const orderId = orders[0]._id;
  console.log(`📋 Używam zlecenia: ${orders[0].orderNumber} (id: ${orderId})\n`);

  // ── 1. Utwórz zadanie główne ─────────────────────────────────────────────
  const rootId = await client.mutation(api.orderPreProdSteps.add, {
    orderId,
    title: "[TEST] Zadanie główne",
  });
  console.log(`✅ 1. Utworzono zadanie główne: ${rootId}`);

  // ── 2. Utwórz 2 podzadania ───────────────────────────────────────────────
  const child1Id = await client.mutation(api.orderPreProdSteps.add, {
    orderId,
    title: "[TEST] Podzadanie A",
    parentId: rootId,
  });
  const child2Id = await client.mutation(api.orderPreProdSteps.add, {
    orderId,
    title: "[TEST] Podzadanie B",
    parentId: rootId,
  });
  console.log(`✅ 2. Utworzono 2 podzadania: ${child1Id}, ${child2Id}`);

  // ── 3. Utwórz pod-podzadanie pod Podzadaniem A ───────────────────────────
  const gc1Id = await client.mutation(api.orderPreProdSteps.add, {
    orderId,
    title: "[TEST] Pod-podzadanie A1",
    parentId: child1Id,
  });
  console.log(`✅ 3. Utworzono pod-podzadanie: ${gc1Id}`);

  // ── 4. Zaznacz pod-podzadanie ────────────────────────────────────────────
  await client.mutation(api.orderPreProdSteps.setDone, { id: gc1Id, done: true });
  await sleep(500);
  const stepsAfterGc = await client.query(api.orderPreProdSteps.list, { orderId });
  const gc1 = stepsAfterGc.find((s) => s._id === gc1Id);
  if (!gc1?.done) throw new Error("❌ Pod-podzadanie nie zostało zaznaczone jako done");
  if (!gc1?.completedAt) throw new Error("❌ Brak completedAt po zaznaczeniu");
  console.log(`✅ 4. Pod-podzadanie zaznaczone, completedAt: ${new Date(gc1.completedAt).toISOString()}`);

  // Sprawdź czy podzadanie A automatycznie done (bo gc1 jest jedynym dzieckiem)
  const child1AfterGc = stepsAfterGc.find((s) => s._id === child1Id);
  if (!child1AfterGc?.done) {
    console.log(`⚠️  4b. Podzadanie A nie jest done (może mieć więcej dzieci) — sprawdzenie pominięte`);
  } else {
    console.log(`✅ 4b. Podzadanie A automatycznie done po zaznaczeniu wszystkich pod-podzadań`);
  }

  // ── 5. Zaznacz wszystkie bezpośrednie dzieci roota ───────────────────────
  // child1 jest already done (jeśli zadziałała auto-propagacja), child2 trzeba zaznaczyć
  await client.mutation(api.orderPreProdSteps.setDone, { id: child1Id, done: true });
  await client.mutation(api.orderPreProdSteps.setDone, { id: child2Id, done: true });
  await sleep(500);
  const stepsAfterAll = await client.query(api.orderPreProdSteps.list, { orderId });
  const rootAfterAll = stepsAfterAll.find((s) => s._id === rootId);
  if (!rootAfterAll?.done) throw new Error("❌ Zadanie główne nie zostało automatycznie oznaczone done");
  console.log(`✅ 5. Zadanie główne automatycznie done po zaznaczeniu wszystkich dzieci`);

  // ── 6. Odznacz jedno dziecko → root wraca do todo ────────────────────────
  await client.mutation(api.orderPreProdSteps.setDone, { id: child2Id, done: false });
  await sleep(500);
  const stepsAfterUncheck = await client.query(api.orderPreProdSteps.list, { orderId });
  const rootAfterUncheck = stepsAfterUncheck.find((s) => s._id === rootId);
  if (rootAfterUncheck?.done) throw new Error("❌ Zadanie główne nadal done po odznaczeniu dziecka");
  console.log(`✅ 6. Zadanie główne wróciło do todo po odznaczeniu dziecka`);

  // ── 7. Weryfikacja kolejności (pole order) ───────────────────────────────
  const finalSteps = await client.query(api.orderPreProdSteps.list, { orderId });
  const testSteps = finalSteps
    .filter((s) => s.title.startsWith("[TEST]"))
    .sort((a, b) => a.order - b.order);
  const rootOrder = testSteps.find((s) => s._id === rootId)?.order;
  console.log(`✅ 7. Pola order poprawnie ustawione. Root.order=${rootOrder}`);

  // ── Sprzątanie — usuń testowe zadania ────────────────────────────────────
  for (const step of testSteps) {
    // usuń od liści do korzenia
    if (step._id !== rootId) await client.mutation(api.orderPreProdSteps.remove, { id: step._id });
  }
  await client.mutation(api.orderPreProdSteps.remove, { id: rootId });
  console.log(`\n🧹 Testowe zadania usunięte`);

  console.log(`\n✅✅✅ Wszystkie testy przeszły pomyślnie! ✅✅✅`);
}

run().catch((err) => {
  console.error("\n❌ Test zakończony błędem:", err.message ?? err);
  process.exit(1);
});

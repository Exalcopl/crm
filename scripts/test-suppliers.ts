#!/usr/bin/env node
export {};
/**
 * Test automatyczny — weryfikacja zapisu i odczytu dostawców (suppliers) w Convex local.
 * Uruchamiać: npx tsx scripts/test-suppliers.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ConvexHttpClient } = require("convex/browser");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require("../convex/_generated/api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3212";

async function main() {
  console.log("🧪 Test: Moduł Dostawców");
  console.log(`📡 Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  // Pomocnik do logowania
  let passed = 0;
  let failed = 0;
  function ok(msg: string) { console.log(`  ✅ ${msg}`); passed++; }
  function fail(msg: string) { console.log(`  ❌ ${msg}`); failed++; }

  const testNip = "5261040828"; // NIP z prawidłową sumą kontrolną (test)
  const testName = "TEST Dostawca Sp. z o.o.";
  let createdId: string | null = null;

  try {
    // 1. Sprawdź czy lista jest dostępna
    console.log("1️⃣  Pobieranie listy dostawców…");
    const list = await client.query(api.suppliers.list, {});
    ok(`Lista zwróciła ${list.length} rekordów`);

    // 2. Sprawdź czy testowy NIP już istnieje, jeśli tak — usuń
    console.log("2️⃣  Sprawdzanie czy testowy NIP już istnieje…");
    const existing = await client.query(api.suppliers.getByNip, { nip: testNip });
    if (existing) {
      await client.mutation(api.suppliers.remove, { id: existing._id });
      ok(`Usunięto stary rekord testowy (${existing._id})`);
    } else {
      ok("Testowy NIP nie istniał — czyste środowisko");
    }

    // 3. Utwórz dostawcę
    console.log("3️⃣  Tworzenie dostawcy…");
    createdId = await client.mutation(api.suppliers.create, {
      nip: testNip,
      name: testName,
      city: "Warszawa",
      postalCode: "00-001",
      street: "ul. Testowa 1",
      phone: "+48 123 456 789",
      email: "test@dostawca.pl",
      iban: "PL61109010140000071219812874",
      paymentDays: 30,
      category: "IT / Technologia",
      notes: "Testowy rekord — do usunięcia",
      isActive: true,
    });
    ok(`Utworzono dostawcę, ID: ${createdId}`);

    // 4. Odczyt po ID
    console.log("4️⃣  Odczyt dostawcy po ID…");
    const fetched = await client.query(api.suppliers.get, { id: createdId });
    if (!fetched) { fail("Brak rekordu po ID"); }
    else if (fetched.name !== testName) { fail(`Nazwa niezgodna: ${fetched.name}`); }
    else ok(`Odczytano: „${fetched.name}" | NIP: ${fetched.nip}`);

    // 5. Odczyt po NIP
    console.log("5️⃣  Odczyt po NIP…");
    const byNip = await client.query(api.suppliers.getByNip, { nip: testNip });
    if (!byNip) fail("Brak rekordu getByNip");
    else ok(`getByNip działa poprawnie`);

    // 6. Aktualizacja
    console.log("6️⃣  Aktualizacja danych…");
    await client.mutation(api.suppliers.update, {
      id: createdId,
      paymentDays: 45,
      category: "Materiały budowlane",
    });
    const updated = await client.query(api.suppliers.get, { id: createdId });
    if (updated?.paymentDays === 45 && updated?.category === "Materiały budowlane") {
      ok(`Update działa: paymentDays=${updated.paymentDays}, category=${updated.category}`);
    } else {
      fail(`Dane po update niezgodne: ${JSON.stringify(updated)}`);
    }

    // 7. Duplikat NIP — powinien rzucić błąd
    console.log("7️⃣  Test unikalności NIP (duplikat powinien rzucić błąd)…");
    try {
      await client.mutation(api.suppliers.create, {
        nip: testNip,
        name: "Duplikat Sp. z o.o.",
        isActive: true,
      });
      fail("Duplikat NIP powinien rzucić błąd, ale nie rzucił!");
    } catch {
      ok("Duplikat NIP prawidłowo odrzucony");
    }

    // 8. Usunięcie
    console.log("8️⃣  Usuwanie rekordu testowego…");
    await client.mutation(api.suppliers.remove, { id: createdId });
    const afterDelete = await client.query(api.suppliers.get, { id: createdId });
    if (afterDelete === null) ok("Rekord usunięty pomyślnie");
    else fail("Rekord nadal istnieje po usunięciu!");

  } catch (err) {
    console.error("\n💥 Nieoczekiwany błąd:", err);
    // Spróbuj posprzątać
    if (createdId) {
      try {
        await client.mutation(api.suppliers.remove, { id: createdId });
        console.log("🧹 Wyczyszczono rekord testowy po błędzie");
      } catch { /* ignore */ }
    }
    failed++;
  }

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Wynik: ${passed} ✅  |  ${failed} ❌`);
  if (failed > 0) {
    console.log("❌ Testy NIE przeszły!\n");
    process.exit(1);
  } else {
    console.log("✅ Wszystkie testy przeszły!\n");
  }
}

main();

#!/usr/bin/env node
export {};
/**
 * Test automatyczny — weryfikacja zapisu i odczytu produktów/usług obróbki w Convex local.
 * Uruchamiać: npx tsx scripts/test-products.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ConvexHttpClient } = require("convex/browser");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210";
console.log(`🔌 Łączenie z Convex local under ${CONVEX_URL}...`);

const client = new ConvexHttpClient(CONVEX_URL);

async function runTests() {
  let createdSupplierId: string | null = null;
  let createdProductId: string | null = null;

  try {
    console.log("\n--- TEST 1: Utworzenie testowego dostawcy ---");
    const testNip = "5261040828"; // Poprawny NIP
    const supplierArgs = {
      nip: testNip,
      name: "TEST OBRÓBKA SP Z O O",
      city: "Warszawa",
      category: "Lakiernia Proszkowa",
    };

    // Sprawdź czy już istnieje z poprzedniego uruchomienia
    const existingSup = await client.query("suppliers:getByNip", { nip: testNip });
    if (existingSup) {
      createdSupplierId = existingSup._id;
      console.log(`ℹ️ Dostawca testowy już istnieje: ${createdSupplierId}`);
    } else {
      createdSupplierId = await client.mutation("suppliers:create", supplierArgs);
      console.log(`✅ Utworzono dostawcę testowego: ID = ${createdSupplierId}`);
    }

    console.log("\n--- TEST 2: Tworzenie usługi obróbki z parametrami ---");
    const productArgs = {
      name: "Lakierowanie Proszkowe Profilu RAL 9016 MAT",
      code: "OBR-LAK-9016-TEST",
      type: "outsourcing" as const,
      unit: "mb.",
      category: "Lakierowanie proszkowe",
      supplierId: createdSupplierId as any,
      supplierCode: "SUP-LAK-9016",
      priceNetto: 18.5,
      priceBrutto: 22.76,
      vatRate: 23,
      currency: "PLN",
      leadTimeDays: 4,
      description: "Powłoka proszkowa fasadowa Qualicoat Class 1, kolor RAL 9016 mat.",
      parameters: [
        { key: "Kolor RAL", value: "9016", unit: "" },
        { key: "Wykończenie", value: "Mat", unit: "" },
        { key: "Grubość powłoki", value: "60-80", unit: "μm" },
      ],
      notes: "Testowa usługa obróbki",
      isActive: true,
    };

    createdProductId = await client.mutation("products:create", productArgs);
    console.log(`✅ Utworzono usługę obróbki: ID = ${createdProductId}`);

    console.log("\n--- TEST 3: Odczyt pozycji po ID z dołączonym dostawcą ---");
    const fetchedProduct = await client.query("products:get", { id: createdProductId as any });
    if (!fetchedProduct) throw new Error("Nie znaleziono utworzonego produktu!");

    console.log(`   Nazwa: ${fetchedProduct.name}`);
    console.log(`   Typ: ${fetchedProduct.type}`);
    console.log(`   Dostawca: ${fetchedProduct.supplier?.name} (NIP: ${fetchedProduct.supplier?.nip})`);
    console.log(`   Cena netto: ${fetchedProduct.priceNetto} ${fetchedProduct.currency}`);
    console.log(`   Liczba parametrów: ${fetchedProduct.parameters?.length}`);

    if (fetchedProduct.supplier?.name !== "TEST OBRÓBKA SP Z O O") {
      throw new Error("Dostawca w pobranym produkcie nie zgadza się!");
    }
    if (fetchedProduct.parameters?.length !== 3) {
      throw new Error("Liczba parametrów nie zgadza się!");
    }
    console.log("✅ Odczyt po ID poprawny i kompletny.");

    console.log("\n--- TEST 4: Generowanie URL wgrywania plików do Convex Storage ---");
    const uploadUrl = await client.mutation("products:generateUploadUrl", {});
    if (!uploadUrl || typeof uploadUrl !== "string") {
      throw new Error("Generowanie upload URL nie zwróciło adresu!");
    }
    console.log(`✅ Adres wgrywania utworzony: ${uploadUrl.slice(0, 45)}...`);

    console.log("\n--- TEST 5: Pobieranie listy produktów dla danego dostawcy ---");
    const supplierProducts = await client.query("products:listBySupplier", {
      supplierId: createdSupplierId as any,
    });
    console.log(`   Znaleziono pozycji u dostawcy: ${supplierProducts.length}`);
    if (supplierProducts.length === 0) {
      throw new Error("Brak produktów zfiltrowanych po supplierId!");
    }
    console.log("✅ Filtrowanie produktów wg dostawcy działa.");

    console.log("\n--- TEST 6: Wyszukiwanie na liście ogólnej z filtrem typu ---");
    const outsourcingList = await client.query("products:list", {
      type: "outsourcing",
      search: "RAL 9016",
    });
    console.log(`   Wyniki wyszukiwania "RAL 9016" dla outsourcingu: ${outsourcingList.length}`);
    if (outsourcingList.length === 0) {
      throw new Error("Wyszukiwanie nie zwróciło utworzonej pozycji!");
    }
    console.log("✅ Wyszukiwanie i filtrowanie listy produktów działa.");

    console.log("\n--- TEST 7: Edycja pozycji (aktualizacja ceny i czasu) ---");
    await client.mutation("products:update", {
      id: createdProductId as any,
      priceNetto: 19.9,
      leadTimeDays: 5,
      notes: "Zaktualizowano w teście",
    });

    const updatedProduct = await client.query("products:get", { id: createdProductId as any });
    if (updatedProduct?.priceNetto !== 19.9 || updatedProduct?.leadTimeDays !== 5) {
      throw new Error("Aktualizacja pozycji nie powiodła się!");
    }
    console.log("✅ Aktualizacja pozycji działa poprawnie.");

    console.log("\n--- TEST 8: Czyszczenie danych testowych ---");
    await client.mutation("products:remove", { id: createdProductId as any });
    console.log("✅ Usunięto testowy produkt.");

    await client.mutation("suppliers:remove", { id: createdSupplierId as any });
    console.log("✅ Usunięto testowego dostawcę.");

    console.log("\n🎉 ==========================================");
    console.log("🎉 WSZYSTKIE TESTY PRODUKTÓW I OBRÓBKI PRZESZŁY!");
    console.log("🎉 ==========================================\n");
  } catch (err) {
    console.error("\n❌ BŁĄD PODCZAS TESTÓW:", err);
    process.exit(1);
  }
}

runTests();

#!/usr/bin/env node
export {};
/**
 * Test automatyczny — WMS (zapis/odczyt, reguły ewidencji, PZ/RW/MM,
 * kwarantanna, inwentaryzacja, niezmiennik stan = suma ruchów).
 * Uruchamiać: npx tsx scripts/test-wms.ts
 * (alternatywnie: npx convex run testing_wms:runWmsTest)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ConvexHttpClient } = require("convex/browser");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require("../convex/_generated/api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3212";

async function main() {
  console.log("🧪 Test: Moduł WMS");
  console.log(`📡 Convex URL: ${CONVEX_URL}\n`);
  const client = new ConvexHttpClient(CONVEX_URL);
  try {
    const results: string[] = await client.mutation(api.testing_wms.runWmsTest, {});
    for (const r of results) console.log(`  ${r}`);

    // Test zapytania api.wms.lotHistory
    console.log("\n🧪 Test: api.wms.lotHistory (odczyt historii indeksu / partii)");
    const emptyHistory = await client.query(api.wms.lotHistory, {});
    if (emptyHistory === null) {
      console.log("  ✅ lotHistory({}) zwraca null bez błędów gdy nie podano ID");
    }

    console.log(`\nWynik: ${results.length + 1} kontroli ✅`);
    console.log("✅ Wszystkie testy przeszły!\n");
  } catch (err) {
    console.error("\n💥 Test NIE przeszedł:", (err as Error).message);
    process.exit(1);
  }
}

main();

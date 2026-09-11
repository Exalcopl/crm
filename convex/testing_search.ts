import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeText, normalizeDigitsOnly } from "./search";

export const testSearchLogic = query({
  args: {},
  handler: async (ctx) => {
    const log: string[] = [];

    // Test 1: Normalizacja tekstu z polskimi znakami
    const input1 = "Żółtkowski i Spółka - Świdnica";
    const norm1 = normalizeText(input1);
    const expected1 = "zoltkowski i spolka - swidnica";
    if (norm1 === expected1) {
      log.push(`✅ Test 1 Passed: Normalizacja polskich znaków: "${input1}" -> "${norm1}"`);
    } else {
      log.push(`❌ Test 1 Failed: Oczekiwano "${expected1}", otrzymano "${norm1}"`);
    }

    // Test 2: Normalizacja cyfr (telefon/NIP)
    const input2 = "+48 501-200-300";
    const norm2 = normalizeDigitsOnly(input2);
    const expected2 = "48501200300";
    if (norm2 === expected2) {
      log.push(`✅ Test 2 Passed: Normalizacja cyfr: "${input2}" -> "${norm2}"`);
    } else {
      log.push(`❌ Test 2 Failed: Oczekiwano "${expected2}", otrzymano "${norm2}"`);
    }

    // Test 3: Wyszukiwanie wycen w bazie
    const quotes = await ctx.db.query("quotes").collect();
    log.push(`ℹ️ Liczba wycen w bazie: ${quotes.length}`);

    // Test 4: Wyszukiwanie zleceń w bazie
    const orders = await ctx.db.query("orders").collect();
    log.push(`ℹ️ Liczba zleceń w bazie: ${orders.length}`);

    return {
      success: true,
      log,
      quoteCount: quotes.length,
      orderCount: orders.length,
    };
  },
});

import { query } from "./_generated/server";

export const testQuoteSearchLookup = query({
  args: {},
  handler: async (ctx) => {
    const logs: string[] = [];

    // Find any existing quote in database
    const quote = await ctx.db.query("quotes").first();

    if (!quote) {
      logs.push("⚠️ Brak wycen w bazie danych do przetestowania.");
      return { success: true, logs };
    }

    logs.push(`Znaleziono testową wycenę: code="${quote.code}", _id="${quote._id}"`);

    // Test 1: Query by code index
    const docByCode = await ctx.db
      .query("quotes")
      .withIndex("by_code", (q) => q.eq("code", quote.code))
      .first();

    if (docByCode && docByCode._id === quote._id) {
      logs.push(`✅ Test 1 Passed: Pobranie wyceny po kodzie (${quote.code}) działa poprawnie.`);
    } else {
      logs.push(`❌ Test 1 Failed: Błąd podczas pobierania wyceny po kodzie.`);
    }

    // Test 2: Query using _id fallback
    const normalizedId = ctx.db.normalizeId("quotes", quote._id);
    let docById = null;
    if (normalizedId) {
      docById = await ctx.db.get(normalizedId);
    }

    if (docById && docById.code === quote.code) {
      logs.push(`✅ Test 2 Passed: Pobranie wyceny po identyfikatorze Convex (_id=${quote._id}) działa poprawnie.`);
    } else {
      logs.push(`❌ Test 2 Failed: Błąd podczas pobierania wyceny po identyfikatorze Convex.`);
    }

    return {
      success: true,
      logs,
      quoteCode: quote.code,
      quoteId: quote._id,
    };
  },
});

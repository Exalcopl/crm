import { query } from "./_generated/server";
import { getByCode } from "./quotes";

export const testQuoteSearchLookup = query({
  args: {},
  handler: async (ctx) => {
    const logs: string[] = [];

    // Test specific ID mentioned in issue
    const targetId = "ks7cng8k7fcrnnye0n7wkvpvg98drr8v";
    const normalizedTargetId = ctx.db.normalizeId("quotes", targetId);
    if (normalizedTargetId) {
      const doc = await ctx.db.get(normalizedTargetId);
      if (doc) {
        logs.push(`Znaleziono konkretną wycenę z zgłoszenia: code="${doc.code}", _id="${doc._id}"`);
      }
    }

    // Find any existing quote in database
    const quote = await ctx.db.query("quotes").first();

    if (!quote) {
      logs.push("⚠️ Brak wycen w bazie danych do przetestowania.");
      return { success: true, logs };
    }

    // Test getByCode with code
    const resByCode = await getByCode.handler(ctx, { code: quote.code });
    if (resByCode && resByCode._id === quote._id) {
      logs.push(`✅ Test 1 Passed: getByCode z kodem ("${quote.code}") zwrócił wycenę.`);
    } else {
      logs.push(`❌ Test 1 Failed: getByCode z kodem nie zwrócił wyceny.`);
    }

    // Test getByCode with _id (the bug fix)
    const resById = await getByCode.handler(ctx, { code: quote._id });
    if (resById && resById.code === quote.code) {
      logs.push(`✅ Test 2 Passed: getByCode z identyfikatorem Convex ("${quote._id}") zwrócił wycenę.`);
    } else {
      logs.push(`❌ Test 2 Failed: getByCode z identyfikatorem Convex nie zwrócił wyceny.`);
    }

    return {
      success: true,
      logs,
    };
  },
});

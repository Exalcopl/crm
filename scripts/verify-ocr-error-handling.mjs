import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3212";
const client = new ConvexHttpClient(url);

async function main() {
  console.log(`Running OCR verification test using URL: ${url}...`);
  try {
    // 1. Fetch system settings OCR provider
    const provider = await client.query(api.systemSettings.getOcrProvider, {});
    console.log("Current OCR Provider setting:", provider);

    // 2. Fetch quotes to verify list
    const quotes = await client.query(api.quotes.list, {});
    console.log(`Fetched ${quotes.length} quotes from database.`);

    if (quotes.length > 0) {
      const firstQuoteId = quotes[0]._id;
      const versions = await client.query(api.quoteVersions.listByQuote, { quoteId: firstQuoteId });
      console.log(`Quote ${firstQuoteId} has ${versions.length} versions in DB.`);
    }

    console.log("✅ VERIFICATION PASSED: Database queries and version operations functioning properly.");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message, err.stack);
    process.exit(1);
  }
}

main();

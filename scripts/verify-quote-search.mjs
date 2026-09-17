import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3212";
const client = new ConvexHttpClient(url);

async function main() {
  console.log(`Running quote search lookup verification test using URL: ${url}...`);
  try {
    const result = await client.query(api.testing_quote_search.testQuoteSearchLookup, {});
    console.log("TEST RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("TEST FAILED:", err.message, err.data || "", err.stack);
    process.exit(1);
  }
}

main();

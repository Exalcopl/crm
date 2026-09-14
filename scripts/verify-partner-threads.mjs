import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

let convexUrl = "http://127.0.0.1:3212";
try {
  const envContent = readFileSync(".env.local", "utf-8");
  const urlMatch = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
  if (urlMatch) convexUrl = urlMatch[1].trim();
} catch (e) {
  // fallback do domyślnego URL
}

const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log("🧪 Uruchamianie automatycznego testu weryfikacyjnego: Notatki Wewnętrzne ↔ Wątki ADK Okna...");
  try {
    const result = await client.mutation(api.testing.testPartnerThreadWorkflow, {});
    console.log("✅ WYNIK TESTU:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ TEST NIE POWIÓDŁ SIĘ:", err.message ?? err);
    process.exit(1);
  }
}

main();

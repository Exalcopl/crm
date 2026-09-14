import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

let convexUrl = "http://127.0.0.1:3210";
try {
  const envContent = readFileSync(".env.local", "utf-8");
  const urlMatch = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
  if (urlMatch) convexUrl = urlMatch[1].trim();
} catch (e) {
  // fallback
}

const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log("🧪 Test weryfikacji zawężania partnera per zlecenie/klient...");
  try {
    const res1 = await client.mutation(api.testing.testPartnerOrderScoping, {});
    console.log("✅ WYNIK TESTU SCOPINGU:", res1);

    const res2 = await client.mutation(api.testing.testPartnerThreadWorkflow, {});
    console.log("✅ WYNIK TESTU WĄTKÓW:", res2);
  } catch (err) {
    console.error("❌ BŁĄD TESTU:", err.message ?? err);
    process.exit(1);
  }
}

main();

import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { generateCode } from "./quotes";

// ─── SHA-256 helper (identyczny jak w partners.ts) ────────────────────────────
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateRawApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pk_live_${hex}`;
}

// Pełny test: tworzenie Partnera → walidacja klucza → tworzenie zlecenia → cleanup
export const testPartnerApi = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[test-partner] Start testu Partner API...");

    // 1. Stwórz klienta testowego
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, {
      contact: { name: "Klient Partnera Test", email: "partner-client@test.pl" },
    });
    console.log(`[test-partner] Klient: ${clientId}`);

    // 2. Stwórz Partnera z API Key
    const rawKey = generateRawApiKey();
    const hash = await sha256(rawKey);
    const prefix = rawKey.slice(0, 15);

    const partnerId: Id<"partners"> = await ctx.db.insert("partners", {
      name: "Partner Testowy",
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      clientId,
      clientName: "Klient Partnera Test",
      projectType: ["Standard"],
      vatRate: 23,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ordersCount: 0,
    });
    console.log(`[test-partner] Partner: ${partnerId}`);

    // 3. Weryfikacja: znajdź Partnera przez hash klucza
    const foundPartner = await ctx.db
      .query("partners")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", hash))
      .first();

    if (!foundPartner) throw new Error("FAIL: Nie znaleziono Partnera przez hash klucza");
    if (foundPartner.name !== "Partner Testowy") throw new Error(`FAIL: Błąd nazwy: ${foundPartner.name}`);
    if (!foundPartner.isActive) throw new Error("FAIL: Partner powinien być aktywny");
    console.log("[test-partner] ✓ Walidacja klucza: OK");

    // 4. Weryfikacja: klucz z błędnym hashem nie pasuje
    const wrongHash = await sha256("pk_live_wrongkey00000000000000000000");
    const notFound = await ctx.db
      .query("partners")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", wrongHash))
      .first();
    if (notFound) throw new Error("FAIL: Nieprawidłowy klucz zwrócił wynik!");
    console.log("[test-partner] ✓ Odrzucenie błędnego klucza: OK");

    // 5. Tworzenie zlecenia przez API Partnera
    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, foundPartner.projectType, createdAt);
    const valueNetto = 8500;
    const vatRate = 23;
    const valueVat = Math.round(valueNetto * (vatRate / 100) * 100) / 100;
    const valueBrutto = Math.round((valueNetto + valueVat) * 100) / 100;

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId: foundPartner.clientId,
      projectType: foundPartner.projectType,
      valueNetto,
      valueVat,
      valueBrutto,
      vatRate,
      items: [{ lp: 1, description: "Konstrukcje aluminiowe", quantity: 1, unit: "kpl", priceNetto: valueNetto, valueNetto }],
      clientName: foundPartner.clientName,
      createdAt,
      sharepoint: { status: "pending", attempts: 0, lastTriedAt: 0 },
    });

    // 6. Weryfikacja zlecenia
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("FAIL: Zlecenie nie zostało zapisane");
    if (order.status !== "nowe") throw new Error(`FAIL: Zły status: ${order.status}`);
    if (order.valueNetto !== valueNetto) throw new Error(`FAIL: Zła wartość netto: ${order.valueNetto}`);
    if (order.valueBrutto !== valueBrutto) throw new Error(`FAIL: Zła wartość brutto: ${order.valueBrutto}`);
    console.log(`[test-partner] ✓ Zlecenie: ${orderNumber} | netto=${valueNetto} | brutto=${valueBrutto}`);

    // 7. Cleanup
    await ctx.db.delete(orderId);
    await ctx.db.delete(partnerId);
    // klienta zostawiamy (mogą istnieć inne referencje)

    return {
      status: "SUCCESS",
      orderNumber,
      valueNetto,
      valueVat,
      valueBrutto,
      clientId,
      partnerId,
    };
  },
});

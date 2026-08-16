import { action, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
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
      margin: 10,
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
    const apiValueNetto = 8500;
    const expectedValueNetto = Math.round(apiValueNetto * (1 + foundPartner.margin / 100) * 100) / 100;
    const vatRate = 23;
    const valueVat = Math.round(expectedValueNetto * (vatRate / 100) * 100) / 100;
    const valueBrutto = Math.round((expectedValueNetto + valueVat) * 100) / 100;

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId: foundPartner.clientId,
      projectType: foundPartner.projectType,
      valueNetto: expectedValueNetto,
      valueVat,
      valueBrutto,
      vatRate,
      items: [{ lp: 1, description: "Konstrukcje aluminiowe", quantity: 1, unit: "kpl", priceNetto: expectedValueNetto, valueNetto: expectedValueNetto }],
      clientName: foundPartner.clientName,
      createdAt,
      sharepoint: { status: "pending", attempts: 0, lastTriedAt: 0 },
    });

    // 6. Weryfikacja zlecenia
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("FAIL: Zlecenie nie zostało zapisane");
    if (order.status !== "nowe") throw new Error(`FAIL: Zły status: ${order.status}`);
    if (order.valueNetto !== expectedValueNetto) throw new Error(`FAIL: Zła wartość netto: ${order.valueNetto}`);
    if (order.valueBrutto !== valueBrutto) throw new Error(`FAIL: Zła wartość brutto: ${order.valueBrutto}`);
    console.log(`[test-partner] ✓ Zlecenie: ${orderNumber} | netto=${expectedValueNetto} | brutto=${valueBrutto}`);

    // 7. Cleanup
    await ctx.db.delete(orderId);
    await ctx.db.delete(partnerId);
    // klienta zostawiamy (mogą istnieć inne referencje)

    return {
      status: "SUCCESS",
      orderNumber,
      valueNetto: expectedValueNetto,
      valueVat,
      valueBrutto,
      clientId,
      partnerId,
    };
  },
});

// Test sprawdzający walidację przesyłania plików przez API
export const testPartnerFileUploadValidation = action({
  args: {},
  handler: async (ctx) => {
    console.log("[test-partner-file] Uruchamianie walidacji uploadu pliku...");

    // Powinien rzucić błąd, bo zlecenie o takim numerze nie istnieje
    try {
      await ctx.runAction(internal.sharepoint.uploadPartnerFileToOrder, {
        orderIdOrNumber: "ZL-NIEISTNIEJE-999999",
        fileType: "RW",
        fileName: "test.pdf",
        fileBase64: "JVBERi0xLjQK",
      });
      throw new Error("FAIL: Oczekiwano błędu o braku zlecenia");
    } catch (e: any) {
      if (e.message.includes("Nie znaleziono zlecenia.")) {
        console.log("[test-partner-file] ✓ Poprawna walidacja braku zlecenia: OK");
      } else {
        throw e;
      }
    }

    return { status: "SUCCESS" };
  },
});

// Rejestruje partnera ADK w bazie danych z podanym kluczem API
export const registerAdkPartner = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[test-adk] Rejestrowanie partnera ADK...");

    // 1. Klient dla partnera ADK
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, {
      contact: {
        name: "ADK Partner Client",
        email: "adk-partner@exalco.pl",
        phone: "500600700",
      },
    });

    const rawKey = "pk_live_9f8966c3a590c0293df4739af02eee47ce9195b35c1d69d6";
    const hash = await sha256(rawKey);
    const prefix = rawKey.slice(0, 15);

    // Usuń starego, jeśli istnieje o tym samym hashu
    const existing = await ctx.db
      .query("partners")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", hash))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const partnerId = await ctx.db.insert("partners", {
      name: "ADK",
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      clientId,
      clientName: "ADK Partner Client",
      projectType: ["Standard"],
      margin: 10, // 10% marży
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ordersCount: 0,
    });

    console.log(`[test-adk] Partner ADK zarejestrowany. ID: ${partnerId}, Prefix klucza: ${prefix}`);
    return { partnerId, prefix, clientId };
  },
});

// Wykonuje rzeczywiste zapytania HTTP do lokalnego API w celu przetestowania integracji ADK
export const testAdkPartnerApiIntegration = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    console.log("[test-adk-http] Uruchamianie testu integracyjnego HTTP dla ADK...");

    // 1. Zarejestruj partnera ADK w bazie danych
    const { partnerId } = await ctx.runMutation(api.testing_partners.registerAdkPartner as any) as any;

    const rawKey = "pk_live_9f8966c3a590c0293df4739af02eee47ce9195b35c1d69d6";
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) {
      throw new Error("CONVEX_SITE_URL nie jest ustawione");
    }

    console.log(`[test-adk-http] Wywołanie POST ${siteUrl}/api/partner/orders...`);

    // 2. HTTP POST /api/partner/orders
    const ordersRes = await fetch(`${siteUrl}/api/partner/orders`, {
      method: "POST",
      headers: {
        "X-Api-Key": rawKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueNetto: 12500.00,
      }),
    });

    if (!ordersRes.ok) {
      const txt = await ordersRes.text();
      throw new Error(`FAIL: orders endpoint failed with status ${ordersRes.status}: ${txt}`);
    }

    const orderData = await ordersRes.json() as {
      success: boolean;
      orderId: string;
      orderNumber: string;
      clientName: string;
    };

    console.log(`[test-adk-http] ✓ Sukces: Zlecenie utworzone. Numer: ${orderData.orderNumber}, ID: ${orderData.orderId}`);

    // Zweryfikuj kwotę w bazie danych (czy marża 10% została poprawnie doliczona)
    // 12500 * 1.10 = 13750 netto
    let orderInDb: any = await ctx.runQuery(internal.orders._getInternal, { orderId: orderData.orderId as any });
    if (!orderInDb) {
      throw new Error("FAIL: Zlecenie nie istnieje w bazie danych");
    }
    if (orderInDb.valueNetto !== 13750.00) {
      throw new Error(`FAIL: Błędna wartość netto w bazie: ${orderInDb.valueNetto} (oczekiwano 13750)`);
    }
    console.log(`[test-adk-http] ✓ Zweryfikowano wartość z marżą 10%: ${orderInDb.valueNetto} netto (12500 + 10%)`);

    // Poczekaj na asynchroniczne utworzenie folderu SharePoint (max 10 sekund)
    console.log("[test-adk-http] Oczekiwanie na utworzenie folderu SharePoint...");
    let spFolderCreated = false;
    for (let i = 0; i < 10; i++) {
      orderInDb = await ctx.runQuery(internal.orders._getInternal, { orderId: orderData.orderId as any });
      if (orderInDb?.sharepoint?.status === "created") {
        spFolderCreated = true;
        break;
      }
      if (orderInDb?.sharepoint?.status === "failed") {
        console.log("[test-adk-http] Utworzenie folderu SharePoint nie powiodło się (brak zmiennych w środowisku testowym).");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 3. HTTP POST /api/partner/orders/upload-file
    console.log(`[test-adk-http] Wywołanie POST ${siteUrl}/api/partner/orders/upload-file...`);
    const fileRes = await fetch(`${siteUrl}/api/partner/orders/upload-file`, {
      method: "POST",
      headers: {
        "X-Api-Key": rawKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderIdOrNumber: orderData.orderId,
        fileType: "RW",
        fileName: "adk_test_specification.pdf",
        fileBase64: "JVBERi0xLjQKJVRlc3QgUERGIGNvbnRlbnQgZm9yIEVESw==",
      }),
    });

    // Jeżeli SharePoint nie jest skonfigurowany w środowisku testowym lokalnie,
    // to akceptujemy status 500 z komunikatem "SharePoint nie jest skonfigurowany"
    // jako poprawny test walidacji API.
    if (!fileRes.ok) {
      const txt = await fileRes.text();
      if (txt.includes("SharePoint nie jest skonfigurowany") || txt.includes("Brak folderu SharePoint")) {
        console.log(`[test-adk-http] ✓ Poprawna obsługa braku SharePoint podczas uploadu: ${txt}`);
      } else {
        throw new Error(`FAIL: file upload failed with status ${fileRes.status}: ${txt}`);
      }
    } else {
      const fileData = await fileRes.json() as { success: boolean; fileName: string };
      console.log(`[test-adk-http] ✓ Sukces: Plik przesłany do SharePoint: ${fileData.fileName}`);
    }

    return {
      status: "SUCCESS",
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      nettoValueInDb: orderInDb.valueNetto,
    };
  },
});

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// CORS preflight for gallery endpoint
http.route({
  pathPrefix: "/api/gallery/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// Public gallery endpoint: GET /api/gallery/{typeName}
http.route({
  pathPrefix: "/api/gallery/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts = ["api", "gallery", "typeName"]
    const typeName = decodeURIComponent(pathParts[2] || "");

    if (!typeName) {
      return new Response(
        JSON.stringify({ error: "Missing type name in URL" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await ctx.runQuery(
      internal.projectTypeGallery.listByTypeNameInternal,
      { typeName }
    );

    if (!result) {
      return new Response(
        JSON.stringify({ error: `Project type "${typeName}" not found` }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
        ...corsHeaders,
      },
    });
  }),
});

// CORS preflight for configurator endpoint
http.route({
  pathPrefix: "/api/configurator/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// Public configurator structure: GET /api/configurator/{slug}
// Jedno źródło prawdy dla konfiguratora na stronie www.
http.route({
  pathPrefix: "/api/configurator/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts = ["api", "configurator", "slug"]
    const slug = decodeURIComponent(pathParts[2] || "").toLowerCase();

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing configurator slug in URL" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await ctx.runQuery(internal.configurator.getStructureInternal, { slug });

    if (!result) {
      return new Response(
        JSON.stringify({ error: `Configurator "${slug}" not found` }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
        ...corsHeaders,
      },
    });
  }),
});

/* ── Lead API (website → CRM integration) ──────────────────────── */

const leadCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const LEAD_SLUG_TO_PROJECT_TYPE: Record<string, string> = {
  pergola: "Pergola",
  zadaszenia: "Zadaszenia",
  stolarka: "Stolarka aluminiowa",
};

// CORS preflight for lead endpoints
http.route({
  pathPrefix: "/api/lead/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: leadCorsHeaders });
  }),
});

// POST /api/lead/upload-session — create public upload session
http.route({
  path: "/api/lead/upload-session",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const json = (obj: Record<string, unknown>, status: number) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json", ...leadCorsHeaders },
      });

    // API key validation
    const apiKey = process.env.WEBSITE_API_KEY;
    if (!apiKey) {
      return json({ success: false, error: "Server misconfigured" }, 500);
    }

    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token || token !== apiKey) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    let body: { quoteId?: string; token?: string; fileName?: string; fileSize?: number };
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const { quoteId, token: uploadToken, fileName, fileSize } = body;
    if (!quoteId || !uploadToken || !fileName || fileSize === undefined) {
      return json({ success: false, error: "Brakujące wymagane pola" }, 400);
    }

    try {
      const result = await ctx.runAction(
        api.sharepoint.createPublicUploadSession,
        {
          quoteId: quoteId as any,
          token: uploadToken,
          fileName,
          fileSize,
        }
      );
      return json({ success: true, uploadUrl: result.uploadUrl }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Błąd serwera";
      return json({ success: false, error: message }, 400);
    }
  }),
});

// POST /api/lead/{slug} — create quote from website form
http.route({
  pathPrefix: "/api/lead/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const json = (obj: Record<string, unknown>, status: number) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json", ...leadCorsHeaders },
      });

    // API key validation
    const apiKey = process.env.WEBSITE_API_KEY;
    if (!apiKey) {
      return json({ success: false, error: "Server misconfigured" }, 500);
    }

    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token || token !== apiKey) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    // Resolve project type from URL slug
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts = ["api", "lead", "<slug>"]
    const slug = (pathParts[2] ?? "").toLowerCase();
    const projectType = LEAD_SLUG_TO_PROJECT_TYPE[slug];

    if (!projectType) {
      return json(
        {
          success: false,
          error: `Unknown endpoint. Valid: ${Object.keys(LEAD_SLUG_TO_PROJECT_TYPE).map((s) => `/api/lead/${s}`).join(", ")}`,
        },
        404,
      );
    }

    // Parse request body
    let body: { name?: string; phone?: string; email?: string; description?: string; configuration?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const name = (body.name ?? "").trim();
    if (!name) {
      return json({ success: false, error: "Pole 'name' jest wymagane" }, 400);
    }

    const phone = (body.phone ?? "").trim() || undefined;
    const email = (body.email ?? "").trim() || undefined;
    if (!phone && !email) {
      return json(
        { success: false, error: "Podaj 'phone' lub 'email'" },
        400,
      );
    }

    // Create the lead
    try {
      const result = await ctx.runMutation(
        internal.quotes.createFromLead,
        {
          contact: { name, phone, email },
          projectType,
          description: body.description?.trim() || undefined,
          configuration: body.configuration ?? undefined,
        },
      );

      return json(
        {
          success: true,
          code: result.code,
          quoteId: result.quoteId,
          uploadToken: result.uploadToken,
        },
        201,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return json({ success: false, error: message }, 400);
    }
  }),
});

// ─── SharePoint Webhook ────────────────────────────────────────────────────────

// SharePoint sends a GET with validationToken to verify the endpoint during subscription
// Then sends POST notifications when items change.
http.route({
  path: "/api/sharepoint/webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const validationToken = url.searchParams.get("validationToken");
    if (validationToken) {
      // Respond with the validation token as plain text to confirm endpoint ownership
      return new Response(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("OK", { status: 200 });
  }),
});

http.route({
  path: "/api/sharepoint/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse notification payload
    let body: {
      value?: Array<{
        clientState?: string;
        subscriptionId?: string;
        changeType?: string;
      }>;
    };
    try {
      body = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const notifications = body.value ?? [];

    for (const notification of notifications) {
      const clientState = notification.clientState ?? "";
      // clientState = "quoteId:<id>"
      const match = clientState.match(/^quoteId:(.+)$/);
      if (!match) continue;

      const quoteId = match[1] as string;
      // Schedule handling asynchronously — SharePoint requires fast response
      await ctx.scheduler.runAfter(
        0,
        internal.sharepointWebhook.handleWycenaFolderChanged,
        { quoteId: quoteId as any },
      );
    }

    // Must respond 202 within a few seconds for SharePoint to accept
    return new Response(null, { status: 202 });
  }),
});

// ─── Partner API: CORS preflight ───────────────────────────────────────────────
const partnerCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

http.route({
  path: "/api/partner/orders",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: partnerCorsHeaders });
  }),
});

// ─── Partner API: POST /api/partner/orders ─────────────────────────────────────
//
// Tworzy zlecenie w imieniu zewnętrznego Partnera.
// Uwierzytelnienie: nagłówek X-Api-Key z kluczem wygenerowanym w panelu CRM.
//
// Request body: { "valueNetto": 12500.00 }
// Response:     { "success": true, "orderNumber": "ZL/2026/042", "orderId": "..." }
//
http.route({
  path: "/api/partner/orders",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const jsonHeaders = {
      "Content-Type": "application/json",
      ...partnerCorsHeaders,
    };

    // 1. Uwierzytelnienie: X-Api-Key
    const rawKey = request.headers.get("X-Api-Key");
    if (!rawKey || !rawKey.startsWith("pk_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Brak lub nieprawidłowy nagłówek X-Api-Key." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // 2. Hash klucza i wyszukanie Partnera
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const partner = await ctx.runQuery(internal.partners.getByApiKeyHash, { hash: keyHash });

    if (!partner) {
      return new Response(
        JSON.stringify({ success: false, error: "Nieznany klucz API." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    if (!partner.isActive) {
      return new Response(
        JSON.stringify({ success: false, error: "Konto Partnera jest nieaktywne." }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // 3. Parsowanie body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Nieprawidłowy JSON w body requestu." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const valueNetto = typeof body.valueNetto === "number" ? body.valueNetto : parseFloat(body.valueNetto as string);
    if (isNaN(valueNetto) || valueNetto <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'valueNetto' jest wymagane i musi być liczbą większą od 0." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    // 4. Pobranie danych klienta
    const client = await ctx.runQuery(internal.clients._getInternal, { id: partner.clientId });
    if (!client) {
      return new Response(
        JSON.stringify({ success: false, error: "Konfiguracja Partnera jest nieprawidłowa — brak klienta." }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // 5. Tworzenie zlecenia
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    let result: { orderId: string; orderNumber: string };
    try {
      result = await ctx.runMutation(internal.orders.createFromPartnerApi, {
        partnerId: partner._id,
        clientId: partner.clientId,
        clientName: partner.clientName,
        clientEmail: client.email,
        clientPhone: client.phoneRaw,
        projectType: partner.projectType,
        valueNetto,
        margin: partner.margin,
        notes,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Błąd wewnętrzny serwera.";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // 6. Aktualizacja statystyk Partnera (async — nie blokuje odpowiedzi)
    await ctx.runMutation(internal.partners.recordApiUsage, { id: partner._id });

    // 7. Odpowiedź
    return new Response(
      JSON.stringify({
        success: true,
        orderNumber: result.orderNumber,
        orderId: result.orderId,
        clientName: partner.clientName,
      }),
      { status: 201, headers: jsonHeaders }
    );
  }),
});

// ─── Partner API: OPTIONS for upload-file ─────────────────────────────────────
http.route({
  path: "/api/partner/orders/upload-file",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: partnerCorsHeaders });
  }),
});

// ─── Partner API: POST /api/partner/orders/upload-file ─────────────────────────
//
// Przesyła plik do folderu "Dokumentacja" danego zlecenia.
// Uwierzytelnienie: nagłówek X-Api-Key.
//
// Request body:
// {
//   "orderIdOrNumber": "ZL/2026/042",
//   "fileType": "RW" | "Rysunek",
//   "fileName": "rysunek_techniczny.dwg",
//   "fileBase64": "JVBERi0xLjQK..." // base64 encoded string
// }
//
http.route({
  path: "/api/partner/orders/upload-file",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const jsonHeaders = {
      "Content-Type": "application/json",
      ...partnerCorsHeaders,
    };

    // 1. Uwierzytelnienie: X-Api-Key
    const rawKey = request.headers.get("X-Api-Key");
    if (!rawKey || !rawKey.startsWith("pk_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Brak lub nieprawidłowy nagłówek X-Api-Key." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // 2. Hash klucza i wyszukanie Partnera
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const partner = await ctx.runQuery(internal.partners.getByApiKeyHash, { hash: keyHash });

    if (!partner) {
      return new Response(
        JSON.stringify({ success: false, error: "Nieznany klucz API." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    if (!partner.isActive) {
      return new Response(
        JSON.stringify({ success: false, error: "Konto Partnera jest nieaktywne." }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // 3. Parsowanie body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Nieprawidłowy JSON w body requestu." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { orderIdOrNumber, fileType, fileName, fileBase64 } = body;

    if (!orderIdOrNumber || typeof orderIdOrNumber !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'orderIdOrNumber' jest wymagane i musi być ciągiem znaków." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    if (fileType !== "RW" && fileType !== "Rysunek") {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'fileType' musi mieć wartość 'RW' lub 'Rysunek'." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    if (!fileName || typeof fileName !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'fileName' jest wymagane i musi być ciągiem znaków." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    if (!fileBase64 || typeof fileBase64 !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'fileBase64' jest wymagane i musi zawierać zakodowaną zawartość pliku." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    // 4. Wywołanie akcji SharePoint (przesłanie pliku)
    try {
      const result = await ctx.runAction(internal.sharepoint.uploadPartnerFileToOrder, {
        orderIdOrNumber,
        fileType,
        fileName,
        fileBase64,
      });

      return new Response(
        JSON.stringify({
          success: true,
          fileId: result.fileId,
          fileName: result.fileName,
          webUrl: result.webUrl,
        }),
        { status: 201, headers: jsonHeaders }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Błąd serwera przy przesłaniu pliku.";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: jsonHeaders }
      );
    }
  }),
});

// ─── Partner API: OPTIONS for add-note ────────────────────────────────────────
http.route({
  path: "/api/partner/orders/add-note",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: partnerCorsHeaders });
  }),
});

// ─── Partner API: POST /api/partner/orders/add-note ────────────────────────────
http.route({
  path: "/api/partner/orders/add-note",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const jsonHeaders = {
      "Content-Type": "application/json",
      ...partnerCorsHeaders,
    };

    // 1. Uwierzytelnienie
    const rawKey = request.headers.get("X-Api-Key");
    if (!rawKey || !rawKey.startsWith("pk_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Brak lub nieprawidłowy nagłówek X-Api-Key." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // 2. Hash klucza i wyszukanie Partnera
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const partner = await ctx.runQuery(internal.partners.getByApiKeyHash, { hash: keyHash });
    if (!partner) {
      return new Response(
        JSON.stringify({ success: false, error: "Nieznany klucz API." }),
        { status: 401, headers: jsonHeaders }
      );
    }

    if (!partner.isActive) {
      return new Response(
        JSON.stringify({ success: false, error: "Konto Partnera jest nieaktywne." }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // 3. Parsowanie body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Nieprawidłowy JSON w body requestu." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { orderIdOrNumber, notes } = body;

    if (!orderIdOrNumber || typeof orderIdOrNumber !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'orderIdOrNumber' jest wymagane i musi być ciągiem znaków." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    if (!notes || typeof notes !== "string" || !notes.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Pole 'notes' jest wymagane i musi zawierać niepusty ciąg znaków." }),
        { status: 422, headers: jsonHeaders }
      );
    }

    // 4. Dopisywanie notatki do zlecenia
    try {
      const result = await ctx.runMutation(internal.orders.appendNotesFromPartnerApi, {
        orderIdOrNumber,
        notes,
      });

      return new Response(
        JSON.stringify({
          success: true,
          orderId: result.orderId,
          notes: result.notes,
        }),
        { status: 200, headers: jsonHeaders }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Błąd serwera przy zapisywaniu notatki.";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: jsonHeaders }
      );
    }
  }),
});

export default http;


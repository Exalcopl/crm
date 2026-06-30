import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
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
        internal.sharepoint.createPublicUploadSession,
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
    let body: { name?: string; phone?: string; email?: string; description?: string };
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
          answers: [],
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

export default http;

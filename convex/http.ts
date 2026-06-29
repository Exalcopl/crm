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

export default http;

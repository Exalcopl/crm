import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Pomocnicze: hash SHA-256 ──────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generuje bezpieczny losowy API Key w formacie: pk_live_<32 hex chars>
function generateRawApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pk_live_${hex}`;
}

// ─── Zapytania (admin) ─────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    return ctx.db.query("partners").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    return ctx.db.get(args.id);
  },
});

// ─── Zapytania (internal – używane przez HTTP action) ──────────────────────────

export const getByApiKeyHash = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("partners")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", args.hash))
      .first();
  },
});

// ─── Mutacje (admin) ───────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    clientId: v.id("clients"),
    clientName: v.string(),
    projectType: v.array(v.string()),
    margin: v.optional(v.number()),
    webhookUrl: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const rawKey = generateRawApiKey();
    const hash = await sha256(rawKey);
    const prefix = rawKey.slice(0, 15); // "pk_live_" + 7 znaków hex

    const now = Date.now();
    const id = await ctx.db.insert("partners", {
      name: args.name,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      clientId: args.clientId,
      clientName: args.clientName,
      projectType: args.projectType,
      margin: args.margin ?? 0,
      webhookUrl: args.webhookUrl,
      webhookSecret: args.webhookSecret,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ordersCount: 0,
    });

    // Zwracamy pełny klucz TYLKO przy tworzeniu — nie jest nigdzie przechowywany
    return { id, apiKey: rawKey, prefix };
  },
});

export const update = mutation({
  args: {
    id: v.id("partners"),
    name: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    clientName: v.optional(v.string()),
    projectType: v.optional(v.array(v.string())),
    margin: v.optional(v.number()),
    webhookUrl: v.optional(v.union(v.string(), v.null())),
    webhookSecret: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const { id, ...rest } = args;
    const partner = await ctx.db.get(id);
    if (!partner) throw new Error("Partner nie istnieje.");
    // Filter out undefined and convert nulls to undefined to clear values in db if needed
    const patch: any = {};
    for (const [key, val] of Object.entries(rest)) {
      if (val !== undefined) {
        patch[key] = val === null ? undefined : val;
      }
    }
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const regenerateApiKey = mutation({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const partner = await ctx.db.get(args.id);
    if (!partner) throw new Error("Partner nie istnieje.");

    const rawKey = generateRawApiKey();
    const hash = await sha256(rawKey);
    const prefix = rawKey.slice(0, 15);

    await ctx.db.patch(args.id, {
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      updatedAt: Date.now(),
    });

    // Nowy klucz — tylko jednorazowo
    return { apiKey: rawKey, prefix };
  },
});

export const remove = mutation({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const partner = await ctx.db.get(args.id);
    if (!partner) throw new Error("Partner nie istnieje.");
    await ctx.db.delete(args.id);
  },
});

// ─── Mutacje (internal – używane przez HTTP action) ────────────────────────────

export const recordApiUsage = internalMutation({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.id);
    if (!partner) return;
    await ctx.db.patch(args.id, {
      lastUsedAt: Date.now(),
      ordersCount: (partner.ordersCount ?? 0) + 1,
    });
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});


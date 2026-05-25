import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const STATUS_VALUES = v.union(
  v.literal("Do zrobienia"),
  v.literal("Kontakt z klientem"),
  v.literal("Pomiary i uzgodnienia"),
  v.literal("Zrobione"),
);

const PROJECT_TYPE_VALUE = v.string();

const CONTACT_VALUE = v.object({
  name: v.string(),
  street: v.optional(v.string()),
  postalCity: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateCode(ctx: { db: any }): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await ctx.db
    .query("quoteCounters")
    .withIndex("by_year", (q: { eq: (field: string, val: number) => unknown }) => q.eq("year", year))
    .first();

  let seq: number;
  if (!counter) {
    seq = 701;
    await ctx.db.insert("quoteCounters", { year, seq });
  } else {
    seq = counter.seq + 1;
    await ctx.db.patch(counter._id, { seq });
  }

  return `WC-${year}-${String(seq).padStart(4, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClientQuote(doc: any) {
  return { ...doc, id: doc.code as string };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("quotes")
      .order("desc")
      .collect();
    return docs
      .filter((d) => d.archived !== true)
      .map(toClientQuote);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("quotes")
      .order("desc")
      .collect();
    return docs
      .filter((d) => d.archived === true)
      .map(toClientQuote);
  },
});

export const get = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    return toClientQuote(doc);
  },
});

export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const docs = await ctx.db
      .query("quotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    return docs
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(toClientQuote);
  },
});

export const create = mutation({
  args: {
    contact: CONTACT_VALUE,
    value: v.union(v.number(), v.null()),
    status: STATUS_VALUES,
    deadline: v.string(),
    projectType: v.array(PROJECT_TYPE_VALUE),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (
    ctx,
    args: {
      contact: { name: string; street?: string; postalCity?: string; phone?: string; email?: string };
      value: number | null;
      status: string;
      deadline: string;
      projectType: string[];
      ownerId: Id<"users"> | null;
    },
  ): Promise<{ _id: Id<"quotes">; code: string }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const code = await generateCode(ctx);
    const clientId = await ctx.runMutation(internal.clients.getOrCreate, {
      contact: args.contact,
    });

    const quoteId: Id<"quotes"> = await ctx.db.insert("quotes", {
      code,
      clientId,
      contact: args.contact,
      value: args.value,
      status: args.status as "Do zrobienia" | "Kontakt z klientem" | "Pomiary i uzgodnienia" | "Zrobione",
      deadline: args.deadline,
      projectType: args.projectType,
      ownerId: args.ownerId,
      archived: false,
    });

    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId,
    });

    return { _id: quoteId, code };
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("quotes"),
    status: STATUS_VALUES,
  },
  handler: async (ctx, { id, status }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { status });
  },
});

export const setOwner = mutation({
  args: {
    id: v.id("quotes"),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, ownerId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { ownerId, ownerLegacy: undefined });
  },
});

export const setInvestment = mutation({
  args: {
    id: v.id("quotes"),
    investment: v.union(
      v.object({
        name: v.optional(v.string()),
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
      v.null(),
    ),
  },
  handler: async (ctx, { id, investment }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    if (investment === null) {
      await ctx.db.patch(id, { investment: undefined });
      return;
    }
    const trim = (s?: string) => (s?.trim() ? s.trim() : undefined);
    await ctx.db.patch(id, {
      investment: {
        name: trim(investment.name),
        address: trim(investment.address),
        placeId: trim(investment.placeId),
        lat: investment.lat,
        lng: investment.lng,
        notes: trim(investment.notes),
      },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { archived: true });
  },
});

export const restore = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { archived: false });
  },
});

export const remove = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const notes = await ctx.db
      .query("quoteNotes")
      .withIndex("by_quote", (q) => q.eq("quoteId", id))
      .collect();
    await Promise.all(notes.map((n) => ctx.db.delete(n._id)));
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_quote", (q) => q.eq("quoteId", id))
      .collect();
    await Promise.all(tasks.map((t) => ctx.db.delete(t._id)));
    const items = await ctx.db
      .query("quoteItems")
      .withIndex("by_quote", (q) => q.eq("quoteId", id))
      .collect();
    await Promise.all(items.map((it) => ctx.db.delete(it._id)));
    await ctx.db.delete(id);
  },
});

export const retrySharepoint = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const quote = await ctx.db.get(id);
    if (!quote) throw new Error("Wycena nie istnieje");
    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId: id,
    });
  },
});

export const _attachSharepoint = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    parentFolderItemId: v.string(),
    subfolderItemId: v.string(),
    driveId: v.string(),
    webUrl: v.string(),
  },
  handler: async (ctx, { quoteId, parentFolderItemId, subfolderItemId, driveId, webUrl }) => {
    await ctx.db.patch(quoteId, {
      sharepoint: {
        parentFolderItemId,
        subfolderItemId,
        driveId,
        webUrl,
        status: "created",
        attempts: 1,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _markSharepointFailed = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    error: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, { quoteId, error, attempts }) => {
    await ctx.db.patch(quoteId, {
      sharepoint: {
        webUrl: "",
        driveId: "",
        status: "failed",
        error,
        attempts,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _getInternal = internalQuery({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db.get(quoteId);
  },
});

export const _getAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("quotes").collect();
  },
});

export const _clearSharepoint = internalMutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    await ctx.db.patch(quoteId, { sharepoint: undefined });
  },
});

export const seedInitialQuotes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("quotes").first();
    if (existing) return { skipped: true, count: 0 };

    const SEED_DATA = [
      { code: "WC-2026-0730", contact: { name: "ProBud Inwestycje" }, value: 642800, status: "Do zrobienia" as const, deadline: "2026-05-20", projectType: ["Zadaszenia" as const] },
      { code: "WC-2026-0732", contact: { name: "Lewandowski Development" }, value: null, status: "Do zrobienia" as const, deadline: "2026-05-25", projectType: ["Pergola" as const] },
      { code: "WC-2026-0721", contact: { name: "Vistula Dev." }, value: 384000, status: "Do zrobienia" as const, deadline: "2026-06-02", projectType: ["Pergola" as const] },
      { code: "WC-2026-0729", contact: { name: "Anna Kowalska" }, value: 92400, status: "Kontakt z klientem" as const, deadline: "2026-05-10", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0727", contact: { name: "Studio Architektury MW" }, value: 412000, status: "Kontakt z klientem" as const, deadline: "2026-05-09", projectType: ["Ogrodzenie" as const] },
      { code: "WC-2026-0731", contact: { name: "Marwit Sp. z o.o." }, value: 184200, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-15", projectType: ["Osłony okienne" as const] },
      { code: "WC-2026-0733", contact: { name: "Pawlak & Synowie" }, value: null, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-14", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0728", contact: { name: "Gmina Brzesko" }, value: 218600, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-12", projectType: ["Zadaszenia" as const] },
      { code: "WC-2026-0725", contact: { name: "Hotel Nadwiślański" }, value: 78400, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-18", projectType: ["Pergola" as const] },
      { code: "WC-2026-0718", contact: { name: "Bartolini S.A." }, value: 296400, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-22", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0712", contact: { name: "Nowak Bud Sp.j." }, value: 488200, status: "Zrobione" as const, deadline: "2026-04-28", projectType: ["Ogrodzenie" as const] },
      { code: "WC-2026-0705", contact: { name: "Architekci Pracownia 7" }, value: 96400, status: "Zrobione" as const, deadline: "2026-04-22", projectType: ["Inne" as const] },
    ];

    let count = 0;
    for (const row of SEED_DATA) {
      await ctx.db.insert("quotes", {
        code: row.code,
        contact: row.contact,
        value: row.value,
        status: row.status,
        deadline: row.deadline,
        projectType: row.projectType,
        ownerId: null,
        ownerLegacy: undefined,
        archived: false,
      });
      count++;
    }

    const year = 2026;
    await ctx.db.insert("quoteCounters", { year, seq: 733 });

    return { skipped: false, count };
  },
});

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const ITEM_SCHEMA = v.object({
  lp: v.number(),
  description: v.string(),
  quantity: v.union(v.number(), v.null()),
  unit: v.optional(v.string()),
  priceNetto: v.union(v.number(), v.null()),
  valueNetto: v.union(v.number(), v.null()),
});

// ─── Queries ────────────────────────────────────────────────────────────────

export const listByQuote = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db
      .query("quoteVersions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("quoteVersions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Returns set of fileItemIds that already have a version for this quote
export const _listFileIds = internalQuery({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const versions = await ctx.db
      .query("quoteVersions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    return versions.map((v) => v.fileItemId).filter(Boolean) as string[];
  },
});

// ─── Internal helpers ────────────────────────────────────────────────────────

async function nextVersionNumber(
  ctx: any,
  quoteId: string,
) {
  const existing = await ctx.db
    .query("quoteVersions")
    .withIndex("by_quote", (q: any) => q.eq("quoteId", quoteId))
    .collect();
  return existing.length + 1;
}

// ─── Internal mutation: called from sharepoint action ────────────────────────

export const _saveOcrVersion = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    fileItemId: v.string(),
    fileName: v.string(),
    valueNetto: v.number(),
    valueVat: v.number(),
    valueBrutto: v.number(),
    vatRate: v.number(),
    items: v.array(ITEM_SCHEMA),
    additionalData: v.optional(v.any()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Upsert: if a version with this fileItemId already exists, update it
    const existing = await ctx.db
      .query("quoteVersions")
      .withIndex("by_quote_file", (q) =>
        q.eq("quoteId", args.quoteId).eq("fileItemId", args.fileItemId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fileName: args.fileName,
        title: `Wersja z pliku: ${args.fileName}`,
        valueNetto: args.valueNetto,
        valueVat: args.valueVat,
        valueBrutto: args.valueBrutto,
        vatRate: args.vatRate,
        items: args.items,
        additionalData: args.additionalData,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    const versionNumber = await nextVersionNumber(ctx as any, args.quoteId);
    const id = await ctx.db.insert("quoteVersions", {
      quoteId: args.quoteId,
      versionNumber,
      source: "ocr",
      fileItemId: args.fileItemId,
      fileName: args.fileName,
      title: `Wersja z pliku: ${args.fileName}`,
      valueNetto: args.valueNetto,
      valueVat: args.valueVat,
      valueBrutto: args.valueBrutto,
      vatRate: args.vatRate,
      items: args.items,
      additionalData: args.additionalData,
      notes: undefined,
      status: "draft",
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });
    return id;
  },
});

// ─── Public mutations ────────────────────────────────────────────────────────

export const updateNotes = mutation({
  args: {
    id: v.id("quoteVersions"),
    notes: v.string(),
  },
  handler: async (ctx, { id, notes }) => {
    const version = await ctx.db.get(id);
    if (!version) throw new Error("Wersja nie istnieje");
    await ctx.db.patch(id, { notes });
  },
});

export const updateItems = mutation({
  args: {
    id: v.id("quoteVersions"),
    items: v.array(ITEM_SCHEMA),
    valueNetto: v.number(),
    valueVat: v.number(),
    valueBrutto: v.number(),
  },
  handler: async (ctx, { id, items, valueNetto, valueVat, valueBrutto }) => {
    const version = await ctx.db.get(id);
    if (!version) throw new Error("Wersja nie istnieje");
    if (version.status === "accepted") throw new Error("Nie można edytować zaakceptowanej wyceny");
    await ctx.db.patch(id, { items, valueNetto, valueVat, valueBrutto });
  },
});

export const acceptVersion = mutation({
  args: { id: v.id("quoteVersions") },
  handler: async (ctx, { id }) => {
    const version = await ctx.db.get(id);
    if (!version) throw new Error("Wersja nie istnieje");

    // Mark all other versions of this quote as rejected (if they were accepted)
    const allVersions = await ctx.db
      .query("quoteVersions")
      .withIndex("by_quote", (q) => q.eq("quoteId", version.quoteId))
      .collect();

    for (const v of allVersions) {
      if (v._id !== id && v.status === "accepted") {
        await ctx.db.patch(v._id, { status: "draft" });
      }
    }

    // Accept this version
    await ctx.db.patch(id, { status: "accepted" });

    // Update the main quote value with Netto
    await ctx.db.patch(version.quoteId, { value: version.valueNetto });
  },
});

export const rejectVersion = mutation({
  args: { id: v.id("quoteVersions") },
  handler: async (ctx, { id }) => {
    const version = await ctx.db.get(id);
    if (!version) throw new Error("Wersja nie istnieje");
    await ctx.db.patch(id, { status: "rejected" });

    // If this was the accepted version, also null the quote value
    if (version.status === "accepted") {
      await ctx.db.patch(version.quoteId, { value: null });
    }
  },
});

export const deleteVersion = mutation({
  args: { id: v.id("quoteVersions") },
  handler: async (ctx, { id }) => {
    const version = await ctx.db.get(id);
    if (!version) throw new Error("Wersja nie istnieje");
    if (version.status === "accepted") {
      throw new Error("Nie można usunąć zaakceptowanej wyceny. Najpierw ją odrzuć.");
    }
    await ctx.db.delete(id);
  },
});

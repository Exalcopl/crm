import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizePhone, normalizeName } from "./_lib/phone";
import type { Id } from "./_generated/dataModel";

const CONTACT_VALUE = v.object({
  name: v.string(),
  street: v.optional(v.string()),
  postalCity: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
});

export const findMatch = internalQuery({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, phone, email }) => {
    const phoneNorm = normalizePhone(phone);
    const nameNorm = normalizeName(name);

    if (phoneNorm) {
      const byPhone = await ctx.db
        .query("clients")
        .withIndex("by_phone_normalized", (q) =>
          q.eq("phoneNormalized", phoneNorm),
        )
        .first();
      if (byPhone) return byPhone;
    }

    const byName = await ctx.db
      .query("clients")
      .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", nameNorm))
      .first();
    if (byName) return byName;

    return null;
  },
});

export const getOrCreate = internalMutation({
  args: {
    contact: CONTACT_VALUE,
  },
  handler: async (ctx, { contact }) => {
    const phoneNorm = normalizePhone(contact.phone);
    const nameNorm = normalizeName(contact.name);

    let existing = null;

    if (phoneNorm) {
      existing = await ctx.db
        .query("clients")
        .withIndex("by_phone_normalized", (q) =>
          q.eq("phoneNormalized", phoneNorm),
        )
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("clients")
        .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", nameNorm))
        .first();
    }

    if (existing) {
      if (contact.phone && !existing.phoneRaw) {
        await ctx.db.patch(existing._id, { phoneRaw: contact.phone });
      }
      if (contact.email && !existing.email) {
        await ctx.db.patch(existing._id, { email: contact.email });
      }
      if (contact.street && !existing.street) {
        await ctx.db.patch(existing._id, { street: contact.street });
      }
      if (contact.postalCity && !existing.postalCity) {
        await ctx.db.patch(existing._id, { postalCity: contact.postalCity });
      }
      return existing._id;
    }

    const newClientId = await ctx.db.insert("clients", {
      name: contact.name,
      nameNormalized: normalizeName(contact.name),
      phoneRaw: contact.phone,
      phoneNormalized: normalizePhone(contact.phone),
      email: contact.email,
      street: contact.street,
      postalCity: contact.postalCity,
      createdAt: Date.now(),
    });
    return newClientId;
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clients").order("desc").collect();
  },
});

export const findMatchPublic = query({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { name, phone }) => {
    const phoneNorm = normalizePhone(phone);
    const nameNorm = normalizeName(name);

    if (phoneNorm) {
      const byPhone = await ctx.db
        .query("clients")
        .withIndex("by_phone_normalized", (q) =>
          q.eq("phoneNormalized", phoneNorm),
        )
        .first();
      if (byPhone) return byPhone;
    }

    const byName = await ctx.db
      .query("clients")
      .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", nameNorm))
      .first();
    if (byName) return byName;

    return null;
  },
});

export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    street: v.optional(v.union(v.string(), v.null())),
    postalCity: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...patch }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const client = await ctx.db.get(id);
    if (!client) throw new Error("Klient nie istnieje");

    const toOptional = (v: string | null | undefined): string | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    };

    const updates: Partial<{
      name: string;
      nameNormalized: string;
      phoneRaw: string | undefined;
      phoneNormalized: string | undefined;
      email: string | undefined;
      street: string | undefined;
      postalCity: string | undefined;
    }> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error("Nazwa klienta nie może być pusta");
      updates.name = name;
      updates.nameNormalized = normalizeName(name);
    }
    if (patch.phone !== undefined) {
      const phone = toOptional(patch.phone);
      updates.phoneRaw = phone;
      updates.phoneNormalized = normalizePhone(phone);
    }
    if (patch.email !== undefined) updates.email = toOptional(patch.email);
    if (patch.street !== undefined) updates.street = toOptional(patch.street);
    if (patch.postalCity !== undefined)
      updates.postalCity = toOptional(patch.postalCity);

    await ctx.db.patch(id, updates);
  },
});

export const getStats = query({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_client", (q) => q.eq("clientId", id))
      .collect();

    const total = quotes.length;
    const active = quotes.filter(
      (q) => q.status !== "Zrobione" && q.archived !== true,
    ).length;
    const done = quotes.filter((q) => q.status === "Zrobione").length;
    const archived = quotes.filter((q) => q.archived === true).length;
    const wonValue = quotes
      .filter((q) => q.status === "Zrobione" && typeof q.value === "number")
      .reduce((acc, q) => acc + (q.value ?? 0), 0);
    const lastActivity = quotes.reduce<number | null>((max, q) => {
      const t = q._creationTime;
      return max === null || t > max ? t : max;
    }, null);

    return { total, active, done, archived, wonValue, lastActivity };
  },
});

export const ensureLinkedToQuote = mutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }): Promise<Id<"clients">> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const quote = await ctx.db.get(quoteId);
    if (!quote) throw new Error("Wycena nie istnieje");

    if (quote.clientId) return quote.clientId;

    const clientId: Id<"clients"> = await ctx.runMutation(
      internal.clients.getOrCreate,
      { contact: quote.contact },
    );
    await ctx.db.patch(quoteId, { clientId });
    return clientId;
  },
});

export const migrateFromLocal = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        street: v.optional(v.string()),
        postalCity: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    let imported = 0;
    let merged = 0;

    for (const it of items) {
      const phoneNorm = normalizePhone(it.phone);
      const nameNorm = normalizeName(it.name);

      let existing = null;
      if (phoneNorm) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_phone_normalized", (q) =>
            q.eq("phoneNormalized", phoneNorm),
          )
          .first();
      }
      if (!existing) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_name_normalized", (q) =>
            q.eq("nameNormalized", nameNorm),
          )
          .first();
      }

      if (existing) {
        const patch: Record<string, string> = {};
        if (it.phone && !existing.phoneRaw) patch.phoneRaw = it.phone;
        if (it.email && !existing.email) patch.email = it.email;
        if (it.street && !existing.street) patch.street = it.street;
        if (it.postalCity && !existing.postalCity)
          patch.postalCity = it.postalCity;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }
        merged++;
        continue;
      }

      await ctx.db.insert("clients", {
        name: it.name,
        nameNormalized: nameNorm,
        phoneRaw: it.phone,
        phoneNormalized: phoneNorm,
        email: it.email,
        street: it.street,
        postalCity: it.postalCity,
        createdAt: Date.now(),
      });
      imported++;
    }

    return { imported, merged };
  },
});

export const _attachSharepointFolder = internalMutation({
  args: {
    clientId: v.id("clients"),
    itemId: v.string(),
    driveId: v.string(),
    webUrl: v.string(),
  },
  handler: async (ctx, { clientId, itemId, driveId, webUrl }) => {
    await ctx.db.patch(clientId, {
      sharepointFolder: {
        itemId,
        driveId,
        webUrl,
        status: "created",
        attempts: 1,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _getCascadeData = internalQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return null;
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    return { client, quotes };
  },
});

export const _deleteCascade = internalMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client) return;

    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    for (const quote of quotes) {
      const notes = await ctx.db
        .query("quoteNotes")
        .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
        .collect();
      await Promise.all(notes.map((n) => ctx.db.delete(n._id)));

      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
        .collect();
      await Promise.all(tasks.map((t) => ctx.db.delete(t._id)));

      const items = await ctx.db
        .query("quoteItems")
        .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
        .collect();
      await Promise.all(items.map((it) => ctx.db.delete(it._id)));

      await ctx.db.delete(quote._id);
    }

    const clientNotes = await ctx.db
      .query("clientNotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    await Promise.all(clientNotes.map((n) => ctx.db.delete(n._id)));

    await ctx.db.delete(clientId);
  },
});

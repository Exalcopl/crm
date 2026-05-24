import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
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

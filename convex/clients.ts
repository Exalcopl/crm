import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
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
  nip: v.optional(v.string()),
  clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
  contactPerson: v.optional(v.string()),
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
    const clientType = contact.clientType ?? "individual";
    const nipNorm = contact.nip ? contact.nip.replace(/\D/g, "") : undefined;

    let existing = null;

    if (clientType === "business" && nipNorm) {
      existing = await ctx.db
        .query("clients")
        .withIndex("by_nip_normalized", (q) =>
          q.eq("nipNormalized", nipNorm)
        )
        .first();
    } else {
      if (phoneNorm) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_phone_normalized", (q) =>
            q.eq("phoneNormalized", phoneNorm)
          )
          .first();
      }

      if (!existing) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", nameNorm))
          .first();
      }
    }

    if (existing) {
      const patch: any = {};
      if (contact.phone && !existing.phoneRaw) {
        patch.phoneRaw = contact.phone;
        patch.phoneNormalized = phoneNorm;
      }
      if (contact.email && !existing.email) {
        patch.email = contact.email;
      }
      if (contact.street && !existing.street) {
        patch.street = contact.street;
      }
      if (contact.postalCity && !existing.postalCity) {
        patch.postalCity = contact.postalCity;
      }
      if (clientType === "business" && contact.contactPerson && !existing.contactPerson) {
        patch.contactPerson = contact.contactPerson;
      }
      if (clientType === "business" && contact.nip && !existing.nip) {
        patch.nip = contact.nip;
        patch.nipNormalized = nipNorm;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    const newClientId = await ctx.db.insert("clients", {
      name: contact.name,
      nameNormalized: nameNorm,
      phoneRaw: contact.phone,
      phoneNormalized: phoneNorm,
      email: contact.email,
      street: contact.street,
      postalCity: contact.postalCity,
      createdAt: Date.now(),
      type: clientType,
      nip: contact.nip,
      nipNormalized: nipNorm,
      contactPerson: contact.contactPerson,
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
    type: v.optional(v.union(v.literal("individual"), v.literal("business"))),
    nip: v.optional(v.union(v.string(), v.null())),
    contactPerson: v.optional(v.union(v.string(), v.null())),
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
      type: "individual" | "business";
      nip: string | undefined;
      nipNormalized: string | undefined;
      contactPerson: string | undefined;
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
    if (patch.type !== undefined) updates.type = patch.type;
    if (patch.nip !== undefined) {
      const nip = toOptional(patch.nip);
      updates.nip = nip;
      updates.nipNormalized = nip ? nip.replace(/\D/g, "") : undefined;
    }
    if (patch.contactPerson !== undefined)
      updates.contactPerson = toOptional(patch.contactPerson);

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
        type: v.optional(v.union(v.literal("individual"), v.literal("business"))),
        nip: v.optional(v.string()),
        contactPerson: v.optional(v.string()),
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
      const clientType = it.type ?? "individual";
      const nipNorm = it.nip ? it.nip.replace(/\D/g, "") : undefined;

      let existing = null;
      if (clientType === "business" && nipNorm) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_nip_normalized", (q) =>
            q.eq("nipNormalized", nipNorm)
          )
          .first();
      } else {
        if (phoneNorm) {
          existing = await ctx.db
            .query("clients")
            .withIndex("by_phone_normalized", (q) =>
              q.eq("phoneNormalized", phoneNorm)
            )
            .first();
        }
        if (!existing) {
          existing = await ctx.db
            .query("clients")
            .withIndex("by_name_normalized", (q) =>
              q.eq("nameNormalized", nameNorm)
            )
            .first();
        }
      }

      if (existing) {
        const patch: any = {};
        if (it.phone && !existing.phoneRaw) {
          patch.phoneRaw = it.phone;
          patch.phoneNormalized = phoneNorm;
        }
        if (it.email && !existing.email) patch.email = it.email;
        if (it.street && !existing.street) patch.street = it.street;
        if (it.postalCity && !existing.postalCity)
          patch.postalCity = it.postalCity;
        if (clientType === "business" && it.nip && !existing.nip) {
          patch.nip = it.nip;
          patch.nipNormalized = nipNorm;
        }
        if (clientType === "business" && it.contactPerson && !existing.contactPerson) {
          patch.contactPerson = it.contactPerson;
        }
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
        type: clientType,
        nip: it.nip,
        nipNormalized: nipNorm,
        contactPerson: it.contactPerson,
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

function parsePolishAddress(fullAddress: string) {
  if (!fullAddress) return { street: "", postalCity: "" };
  const zipRegex = /(\d{2}-\d{3})\s+([^\n,]+)/;
  const match = fullAddress.match(zipRegex);
  if (match) {
    const postalCity = `${match[1]} ${match[2].trim()}`;
    const street = fullAddress.replace(match[0], "").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    return { street, postalCity };
  }
  return { street: fullAddress, postalCity: "" };
}

export const fetchNipData = action({
  args: { nip: v.string() },
  handler: async (ctx, { nip }) => {
    const cleanNip = nip.replace(/\D/g, "");
    if (cleanNip.length !== 10) {
      throw new Error("Niepoprawny format NIP (musi mieć 10 cyfr)");
    }
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${cleanNip}?date=${today}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Przekroczono limit zapytań do bazy Białej Listy VAT (spróbuj jutro)");
        }
        throw new Error(`Błąd API Białej Listy: status ${response.status}`);
      }
      const data = await response.json();
      const subject = data?.result?.subject;
      if (!subject) {
        throw new Error("Nie znaleziono firmy o podanym NIP w bazie Białej Listy VAT");
      }

      const fullAddress = subject.workingAddress || subject.residenceAddress || "";
      const { street, postalCity } = parsePolishAddress(fullAddress);

      return {
        name: subject.name,
        nip: subject.nip,
        street,
        postalCity,
      };
    } catch (err: any) {
      throw new Error(err.message || "Błąd podczas pobierania danych z Białej Listy VAT");
    }
  },
});

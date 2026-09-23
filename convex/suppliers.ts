import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query } from "./_generated/server";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeNip(nip: string): string {
  return nip.replace(/\D/g, "");
}

/** Walidacja NIP: 10 cyfr + suma kontrolna */
function validateNip(nip: string): boolean {
  const digits = normalizeNip(nip);
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce(
    (acc, w, i) => acc + w * parseInt(digits[i]!, 10),
    0
  );
  return sum % 11 === parseInt(digits[9]!, 10);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    search: v.optional(v.string()),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { search, onlyActive }) => {
    await getAuthUserId(ctx);

    let suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_name")
      .collect();

    if (onlyActive) {
      suppliers = suppliers.filter((s) => s.isActive);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      suppliers = suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.nip.includes(q) ||
          (s.city ?? "").toLowerCase().includes(q) ||
          (s.category ?? "").toLowerCase().includes(q)
      );
    }

    return suppliers;
  },
});

export const get = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, { id }) => {
    await getAuthUserId(ctx);
    return await ctx.db.get(id);
  },
});

export const getByNip = query({
  args: { nip: v.string() },
  handler: async (ctx, { nip }) => {
    await getAuthUserId(ctx);
    const norm = normalizeNip(nip);
    return await ctx.db
      .query("suppliers")
      .withIndex("by_nip", (q) => q.eq("nipNormalized", norm))
      .first();
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    nip: v.string(),
    name: v.string(),
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    iban: v.optional(v.string()),
    paymentDays: v.optional(v.number()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);

    const nipNorm = normalizeNip(args.nip);

    if (!validateNip(args.nip)) {
      throw new Error("Nieprawidłowy NIP — suma kontrolna nie zgadza się.");
    }

    // Sprawdź unikalność NIP
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_nip", (q) => q.eq("nipNormalized", nipNorm))
      .first();
    if (existing) {
      throw new Error(`Dostawca z NIP ${args.nip} już istnieje.`);
    }

    const now = Date.now();
    return await ctx.db.insert("suppliers", {
      nip: args.nip,
      nipNormalized: nipNorm,
      name: args.name,
      street: args.street,
      city: args.city,
      postalCode: args.postalCode,
      phone: args.phone,
      email: args.email,
      iban: args.iban,
      paymentDays: args.paymentDays,
      category: args.category,
      notes: args.notes,
      isActive: args.isActive ?? true,
      clientId: args.clientId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    nip: v.optional(v.string()),
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    iban: v.optional(v.string()),
    paymentDays: v.optional(v.number()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, { id, nip, ...fields }) => {
    await getAuthUserId(ctx);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Dostawca nie istnieje.");

    const patch: Record<string, unknown> = { ...fields, updatedAt: Date.now() };

    if (nip !== undefined) {
      const nipNorm = normalizeNip(nip);
      if (!validateNip(nip)) {
        throw new Error("Nieprawidłowy NIP — suma kontrolna nie zgadza się.");
      }
      // Sprawdź unikalność tylko jeśli NIP się zmienił
      if (nipNorm !== existing.nipNormalized) {
        const dup = await ctx.db
          .query("suppliers")
          .withIndex("by_nip", (q) => q.eq("nipNormalized", nipNorm))
          .first();
        if (dup) throw new Error(`Dostawca z NIP ${nip} już istnieje.`);
      }
      patch.nip = nip;
      patch.nipNormalized = nipNorm;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.patch(id, patch as any);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, { id }) => {
    await getAuthUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Dostawca nie istnieje.");
    await ctx.db.delete(id);
  },
});

// ─── GUS / REGON Action ──────────────────────────────────────────────────────

/**
 * Pobiera dane firmy z publicznego API wyszukiwarki NIP.
 * Używa api.podatki.gov.pl (bezpłatne, bez klucza) - Biała Lista Podatników VAT.
 * Zwraca dane adresowe lub null jeśli nie znaleziono.
 */
export const fetchFromGus = action({
  args: { nip: v.string() },
  handler: async (_ctx, { nip }) => {
    const nipNorm = nip.replace(/\D/g, "");

    // Walidacja NIP po stronie akcji
    if (nipNorm.length !== 10) {
      throw new Error("NIP musi mieć dokładnie 10 cyfr.");
    }

    try {
      // Biała Lista Podatników VAT - Ministerstwo Finansów (bez klucza API)
      const today = new Date().toISOString().slice(0, 10);
      const url = `https://wl-api.mf.gov.pl/api/search/nip/${nipNorm}?date=${today}`;

      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        if (res.status === 404) return null; // NIP nie znaleziony
        throw new Error(`GUS API error: ${res.status}`);
      }

      const data = (await res.json()) as {
        result?: {
          subject?: {
            name?: string;
            workingAddress?: string;
            residenceAddress?: string;
            nip?: string;
          };
        };
      };

      const subject = data?.result?.subject;
      if (!subject) return null;

      // Parsuj adres — format: "ul. Kowalska 5, 00-001 Warszawa"
      const rawAddress =
        subject.workingAddress ?? subject.residenceAddress ?? "";
      const parsed = parseAddress(rawAddress);

      return {
        name: subject.name ?? "",
        nip: subject.nip ?? nipNorm,
        ...parsed,
      };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("GUS API error")) {
        throw err;
      }
      // Timeout lub inny błąd sieciowy
      throw new Error("Nie można połączyć z API Białej Listy MF. Sprawdź połączenie.");
    }
  },
});

/**
 * Parsuje adres z formatu API MF: "ul. Kowalska 5, 00-001 Warszawa"
 */
function parseAddress(raw: string): {
  street?: string;
  postalCode?: string;
  city?: string;
} {
  if (!raw) return {};

  // Podziel po przecinku
  const parts = raw.split(",").map((p) => p.trim());

  // Pierwsza część to ulica (bez "ul.", "al." itp.)
  const street = parts[0]?.replace(/^(ul\.|al\.|os\.|pl\.|skr\.)\s*/i, "").trim();

  // Druga część: "00-001 Warszawa"
  const cityPart = parts[1] ?? parts[0] ?? "";
  const postalMatch = cityPart.match(/(\d{2}-\d{3})\s+(.*)/);

  return {
    street: street ?? undefined,
    postalCode: postalMatch?.[1],
    city: postalMatch?.[2]?.trim(),
  };
}

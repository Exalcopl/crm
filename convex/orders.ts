import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    
    return await ctx.db.query("orders").collect();
  },
});

export const get = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    
    return await ctx.db.get(args.id);
  },
});

export const getByQuote = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    return await ctx.db
      .query("orders")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .first();
  },
});

export const create = mutation({
  args: {
    quoteId: v.id("quotes"),
    quoteVersionId: v.optional(v.id("quoteVersions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const user = await ctx.db.get(userId);

    // Sprawdź czy już istnieje zlecenie dla tej wyceny
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_quote", (q) => q.eq("quoteId", args.quoteId))
      .first();
    if (existing) {
      throw new Error("Zlecenie dla tej wyceny już istnieje.");
    }

    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new Error("Wycena nie istnieje.");

    let version;
    if (args.quoteVersionId) {
      version = await ctx.db.get(args.quoteVersionId);
      if (!version) throw new Error("Wersja wyceny nie istnieje.");
    }

    const orderNumber = quote.code;

    const orderId = await ctx.db.insert("orders", {
      quoteId: args.quoteId,
      quoteVersionId: args.quoteVersionId,
      orderNumber,
      status: "nowe",
      clientId: quote.clientId,
      valueNetto: version ? version.valueNetto : (quote.value || 0),
      valueVat: version ? version.valueVat : 0,
      valueBrutto: version ? version.valueBrutto : (quote.value || 0),
      vatRate: version ? version.vatRate : 23,
      items: version ? version.items : [],
      clientName: quote.contact.name,
      clientEmail: quote.contact.email,
      clientPhone: quote.contact.phone,
      deadline: quote.deadline,
      ownerId: quote.ownerId || undefined,
      createdAt: Date.now(),
    });

    // Aktualizacja statusu wyceny na "Zrobione"
    await ctx.db.patch(args.quoteId, { status: "Zrobione" });

    // Zapisz aktywność w historii wyceny
    await ctx.db.insert("quoteActivity", {
      quoteId: args.quoteId,
      type: "order_created",
      title: "Utworzono zlecenie",
      detail: `Utworzono zlecenie o numerze ${orderNumber}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });

    return orderId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("nowe"),
      v.literal("produkcja"),
      v.literal("montaz"),
      v.literal("gotowe"),
      v.literal("wstrzymane")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    await ctx.db.patch(args.id, { status: args.status });

    // Dodanie aktywności do powiązanej wyceny
    const user = await ctx.db.get(userId);
    const statusLabels: Record<string, string> = {
      nowe: "Nowe",
      produkcja: "W produkcji",
      montaz: "Do montażu",
      gotowe: "Zrealizowane",
      wstrzymane: "Wstrzymane",
    };

    await ctx.db.insert("quoteActivity", {
      quoteId: order.quoteId,
      type: "order_status_updated",
      title: "Zmiana statusu zlecenia",
      detail: `Zmieniono status zlecenia ${order.orderNumber} na: ${statusLabels[args.status]}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });

    return args.id;
  },
});

export const updateNotes = mutation({
  args: {
    id: v.id("orders"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    await ctx.db.patch(args.id, { notes: args.notes });
    return args.id;
  },
});

export const setOwner = mutation({
  args: {
    id: v.id("orders"),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, ownerId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(id);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    await ctx.db.patch(id, { ownerId: ownerId ?? undefined });

    const user = await ctx.db.get(userId);
    const newOwner = ownerId ? await ctx.db.get(ownerId) : null;
    await ctx.db.insert("quoteActivity", {
      quoteId: order.quoteId,
      type: "order_owner_updated",
      title: "Zmiana opiekuna zlecenia",
      detail: `Opiekun zlecenia ${order.orderNumber}: ${newOwner?.name ?? "brak"}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateValueNetto = mutation({
  args: {
    id: v.id("orders"),
    valueNetto: v.number(),
  },
  handler: async (ctx, { id, valueNetto }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(id);
    if (!order) throw new Error("Zlecenie nie istnieje.");
    if (valueNetto < 0) throw new Error("Wartość nie może być ujemna.");

    const netto = Math.round(valueNetto * 100) / 100;
    const vat = Math.round(netto * (order.vatRate / 100) * 100) / 100;
    const brutto = Math.round((netto + vat) * 100) / 100;
    if (netto === order.valueNetto) return id;

    await ctx.db.patch(id, { valueNetto: netto, valueVat: vat, valueBrutto: brutto });

    const fmt = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`;
    const user = await ctx.db.get(userId);
    await ctx.db.insert("quoteActivity", {
      quoteId: order.quoteId,
      type: "order_value_updated",
      title: "Wartość zlecenia zaktualizowana",
      detail: `Wartość netto zlecenia ${order.orderNumber}: ${fmt(order.valueNetto)} → ${fmt(netto)}`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
    return id;
  },
});

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { generateCode } from "./quotes";

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
    if (args.quoteId) {
      await ctx.db.insert("quoteActivity", {
        quoteId: args.quoteId,
        type: "order_created",
        title: "Utworzono zlecenie",
        detail: `Utworzono zlecenie o numerze ${orderNumber}`,
        authorId: userId,
        authorName: user?.name || "System",
        createdAt: Date.now(),
      });
    }

    return orderId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("nowe"),
      v.literal("akceptacja"),
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

    const patch: any = { status: args.status };
    if (args.status === "akceptacja" && !order.acceptanceDate) {
      const d = new Date();
      patch.acceptanceDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    }
    
    await ctx.db.patch(args.id, patch);

    // Dodanie aktywności do powiązanej wyceny
    const user = await ctx.db.get(userId);
    const statusLabels: Record<string, string> = {
      nowe: "Nowe",
      akceptacja: "Akceptacja",
      produkcja: "W produkcji",
      montaz: "Do montażu",
      gotowe: "Zrealizowane",
      wstrzymane: "Wstrzymane",
    };

    if (order.quoteId) {
      await ctx.db.insert("quoteActivity", {
        quoteId: order.quoteId,
        type: "order_status_updated",
        title: "Zmiana statusu zlecenia",
        detail: `Zmieniono status zlecenia ${order.orderNumber} na: ${statusLabels[args.status]}`,
        authorId: userId,
        authorName: user?.name || "System",
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("orderActivity", {
      orderId: args.id,
      type: "order_status_updated",
      title: "Zmiana statusu zlecenia",
      detail: `Zmieniono status na: ${statusLabels[args.status]}`,
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
    if (order.quoteId) {
      await ctx.db.insert("quoteActivity", {
        quoteId: order.quoteId,
        type: "order_owner_updated",
        title: "Zmiana opiekuna zlecenia",
        detail: `Opiekun zlecenia ${order.orderNumber}: ${newOwner?.name ?? "brak"}`,
        authorId: userId,
        authorName: user?.name || "System",
        createdAt: Date.now(),
      });
    }
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
    if (order.quoteId) {
      await ctx.db.insert("quoteActivity", {
        quoteId: order.quoteId,
        type: "order_value_updated",
        title: "Wartość zlecenia zaktualizowana",
        detail: `Wartość netto zlecenia ${order.orderNumber}: ${fmt(order.valueNetto)} → ${fmt(netto)}`,
        authorId: userId,
        authorName: user?.name || "System",
        createdAt: Date.now(),
      });
    }
    return id;
  },
});

export const createStandalone = mutation({
  args: {
    contact: CONTACT_VALUE,
    projectType: v.array(v.string()),
    investment: v.optional(
      v.object({
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
    deadline: v.optional(v.string()),
    deliveryDate: v.optional(v.string()),
    acceptanceDate: v.optional(v.string()),
    items: v.array(
      v.object({
        lp: v.number(),
        description: v.string(),
        quantity: v.union(v.number(), v.null()),
        unit: v.optional(v.string()),
        priceNetto: v.union(v.number(), v.null()),
        valueNetto: v.union(v.number(), v.null()),
      })
    ),
    valueNetto: v.number(),
    valueVat: v.number(),
    valueBrutto: v.number(),
    vatRate: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"orders">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, args.projectType, createdAt);
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, {
      contact: args.contact,
    });

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId,
      projectType: args.projectType,
      investment: args.investment,
      valueNetto: args.valueNetto,
      valueVat: args.valueVat,
      valueBrutto: args.valueBrutto,
      vatRate: args.vatRate,
      items: args.items,
      clientName: args.contact.name,
      clientEmail: args.contact.email,
      clientPhone: args.contact.phone,
      deadline: args.deadline,
      deliveryDate: args.deliveryDate,
      acceptanceDate: args.acceptanceDate,
      ownerId: userId,
      createdAt,
      sharepoint: {
        status: "pending",
        attempts: 0,
        lastTriedAt: 0,
      }
    });

    // Uruchomienie schedulera do tworzenia folderu SharePoint dla zlecenia
    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForOrder, { orderId });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("orderActivity", {
      orderId,
      type: "order_created",
      title: "Zlecenie utworzone pomyślnie",
      detail: `Wartość zlecenia: ${args.valueNetto.toLocaleString("pl-PL")} PLN (netto)`,
      authorId: userId,
      authorName: user?.name || "Nieznany użytkownik",
      createdAt,
    });

    return orderId;
  },
});

export const _getInternal = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

export const _attachSharepoint = internalMutation({
  args: {
    orderId: v.id("orders"),
    parentFolderItemId: v.string(),
    subfolderItemId: v.string(),
    driveId: v.string(),
    webUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      sharepoint: {
        parentFolderItemId: args.parentFolderItemId,
        subfolderItemId: args.subfolderItemId,
        driveId: args.driveId,
        webUrl: args.webUrl,
        status: "created",
        attempts: 1,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _markSharepointFailed = internalMutation({
  args: {
    orderId: v.id("orders"),
    error: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      sharepoint: {
        status: "failed",
        error: args.error,
        attempts: args.attempts,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const updateDates = mutation({
  args: {
    id: v.id("orders"),
    deadline: v.optional(v.union(v.string(), v.null())),
    deliveryDate: v.optional(v.union(v.string(), v.null())),
    acceptanceDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    if (args.deadline !== undefined) {
      if (args.deadline === null) delete order.deadline;
      else order.deadline = args.deadline;
    }
    if (args.deliveryDate !== undefined) {
      if (args.deliveryDate === null) delete order.deliveryDate;
      else order.deliveryDate = args.deliveryDate;
    }
    if (args.acceptanceDate !== undefined) {
      if (args.acceptanceDate === null) delete order.acceptanceDate;
      else order.acceptanceDate = args.acceptanceDate;
    }

    await ctx.db.replace(args.id, order);

    const user = await ctx.db.get(userId);
    await ctx.db.insert("orderActivity", {
      orderId: args.id,
      type: "order_dates_updated",
      title: "Terminy zlecenia zaktualizowane",
      authorId: userId,
      authorName: user?.name || "Nieznany użytkownik",
      createdAt: Date.now(),
    });
  },
});

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
    
    const docs = await ctx.db.query("orders").collect();
    return docs.filter((d) => d.archived !== true);
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
      productionEndDate: quote.deadline,
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
      v.literal("kompletacja"),
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

    // Wyślij webhook do partnera o zmianie statusu
    if (order.partnerId && order.status !== args.status) {
      const partner = await ctx.db.get(order.partnerId);
      if (partner?.webhookUrl && partner.isActive) {
        await ctx.scheduler.runAfter(0, internal.webhooks.triggerPartnerWebhook, {
          partnerId: partner._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          oldStatus: order.status || "nowe",
          newStatus: args.status,
        });
      }
    }

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
    productionStartDate: v.optional(v.union(v.string(), v.null())),
    productionEndDate: v.optional(v.union(v.string(), v.null())),
    deliveryDate: v.optional(v.union(v.string(), v.null())),
    acceptanceDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    const changes: string[] = [];
    const labels: Record<string, string> = {
      deadline: "Termin realizacji",
      productionStartDate: "Początek produkcji",
      productionEndDate: "Koniec produkcji",
      deliveryDate: "Data odbioru",
      acceptanceDate: "Data akceptacji",
    };

    const processChange = (
      field: "deadline" | "productionStartDate" | "productionEndDate" | "deliveryDate" | "acceptanceDate",
      newValue: string | null | undefined
    ) => {
      if (newValue === undefined) return;
      const prevValue = order[field];
      const label = labels[field];

      if (newValue === null) {
        if (prevValue) {
          changes.push(`Usunięto ${label.toLowerCase()} (poprzednio: ${prevValue})`);
        }
      } else {
        if (prevValue) {
          if (prevValue !== newValue) {
            changes.push(`Zmieniono ${label.toLowerCase()} z ${prevValue} na ${newValue}`);
          }
        } else {
          changes.push(`Ustawiono ${label.toLowerCase()} na ${newValue}`);
        }
      }
    };

    processChange("deadline", args.deadline);
    processChange("productionStartDate", args.productionStartDate);
    processChange("productionEndDate", args.productionEndDate);
    processChange("deliveryDate", args.deliveryDate);
    processChange("acceptanceDate", args.acceptanceDate);

    if (args.deadline !== undefined) {
      if (args.deadline === null) delete order.deadline;
      else order.deadline = args.deadline;
    }
    if (args.productionStartDate !== undefined) {
      if (args.productionStartDate === null) delete order.productionStartDate;
      else order.productionStartDate = args.productionStartDate;
    }
    if (args.productionEndDate !== undefined) {
      if (args.productionEndDate === null) delete order.productionEndDate;
      else order.productionEndDate = args.productionEndDate;
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

    if (changes.length > 0) {
      const user = await ctx.db.get(userId);
      await ctx.db.insert("orderActivity", {
        orderId: args.id,
        type: "order_dates_updated",
        title: "Aktualizacja terminów zlecenia",
        detail: changes.join(", "),
        authorId: userId,
        authorName: user?.name || "Nieznany użytkownik",
        createdAt: Date.now(),
      });
    }
  },
});

export const archive = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    await ctx.db.patch(id, { archived: true });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("orderActivity", {
      orderId: id,
      type: "order_status_updated", // Or we can use order_archived if we want, status_updated is fine
      title: "Zlecenie zarchiwizowane",
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    await ctx.db.patch(id, { archived: false });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("orderActivity", {
      orderId: id,
      type: "order_status_updated",
      title: "Zlecenie przywrócone",
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    // Usuwanie powiązanych orderActivity
    const activities = await ctx.db
      .query("orderActivity")
      .withIndex("by_order", (q) => q.eq("orderId", id))
      .collect();
    await Promise.all(activities.map((a) => ctx.db.delete(a._id)));

    // Usuwanie powiązanych calendarEvents
    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_order", (q) => q.eq("orderId", id))
      .collect();
    await Promise.all(events.map((e) => ctx.db.delete(e._id)));

    // Usuwanie samego zlecenia
    await ctx.db.delete(id);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const docs = await ctx.db
      .query("orders")
      .order("desc")
      .collect();
    return docs.filter((d) => d.archived === true);
  },
});

export const testArchiveAndDelete = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Tworzenie testowego zlecenia
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "TEST-ORDER-123",
      clientName: "Testowy Klient",
      valueNetto: 100,
      valueVat: 23,
      valueBrutto: 123,
      vatRate: 23,
      items: [],
      status: "nowe",
      createdAt: Date.now(),
    });

    let order = await ctx.db.get(orderId);
    if (!order) throw new Error("Test failed: order not created");

    // 2. Archiwizacja i weryfikacja
    await ctx.db.patch(orderId, { archived: true });
    order = await ctx.db.get(orderId);
    if (order?.archived !== true) throw new Error("Test failed: order not archived");

    // 3. Przywrócenie i weryfikacja
    await ctx.db.patch(orderId, { archived: false });
    order = await ctx.db.get(orderId);
    if (order?.archived !== false) throw new Error("Test failed: order not restored");

    // 4. Usunięcie i weryfikacja
    await ctx.db.delete(orderId);
    order = await ctx.db.get(orderId);
    if (order) throw new Error("Test failed: order not deleted");

    return "SUCCESS";
  },
});

// ─── Tworzenie zlecenia przez API Partnera (internal) ──────────────────────────
export const createFromPartnerApi = internalMutation({
  args: {
    partnerId: v.id("partners"),
    clientId: v.id("clients"),
    clientName: v.string(),
    clientEmail: v.optional(v.string()),
    clientPhone: v.optional(v.string()),
    projectType: v.array(v.string()),
    valueNetto: v.number(),
    margin: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ orderId: Id<"orders">; orderNumber: string }> => {
    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, args.projectType, createdAt);

    // Oblicz wartość netto uwzględniając marżę partnera
    const finalValueNetto = Math.round(args.valueNetto * (1 + args.margin / 100) * 100) / 100;
    
    // Zlecenia z API mają standardową stawkę VAT 23%
    const vatRate = 23;
    const valueVat = Math.round(finalValueNetto * (vatRate / 100) * 100) / 100;
    const valueBrutto = Math.round((finalValueNetto + valueVat) * 100) / 100;

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId: args.clientId,
      projectType: args.projectType,
      valueNetto: finalValueNetto,
      valueVat,
      valueBrutto,
      vatRate,
      items: [
        {
          lp: 1,
          description: "Konstrukcje aluminiowe",
          quantity: 1,
          unit: "kpl",
          priceNetto: finalValueNetto,
          valueNetto: finalValueNetto,
        },
      ],
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      clientPhone: args.clientPhone,
      partnerId: args.partnerId,
      notes: args.notes,
      createdAt,
      sharepoint: {
        status: "pending",
        attempts: 0,
        lastTriedAt: 0,
      },
    });

    // Uruchomienie schedulera SharePoint
    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForOrder, { orderId });

    // Zapis aktywności
    await ctx.db.insert("orderActivity", {
      orderId,
      type: "order_created",
      title: "Zlecenie utworzone przez API Partnera",
      detail: `Partner ID: ${args.partnerId} | Marża: ${args.margin}% | Wartość końcowa: ${finalValueNetto.toLocaleString("pl-PL")} PLN netto`,
      authorId: null,
      authorName: "API Partner",
      createdAt,
    });

    return { orderId, orderNumber };
  },
});

export const getByOrderNumberInternal = internalQuery({
  args: { orderNumber: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderNumber))
      .first();
  },
});

export const logFileActivity = internalMutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("orderActivity", {
      orderId: args.orderId,
      type: "comment",
      title: args.title,
      detail: args.detail,
      authorId: null,
      authorName: "API Partner",
      createdAt: Date.now(),
    });
  },
});

export const appendNotesFromPartnerApi = internalMutation({
  args: {
    orderIdOrNumber: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args): Promise<{ orderId: Id<"orders">; notes: string }> => {
    // 1. Znajdź zlecenie po ID lub numerze zlecenia
    let order: any = null;
    if (args.orderIdOrNumber.length === 32) {
      order = await ctx.db.get(args.orderIdOrNumber as any);
    }
    if (!order) {
      order = await ctx.db
        .query("orders")
        .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderIdOrNumber))
        .first();
    }
    if (!order) throw new Error("Nie znaleziono zlecenia.");

    // 2. Sklej notatki z zachowaniem struktury textarea
    const oldNotes = order.notes ? order.notes.trim() : "";
    const newNotes = oldNotes ? `${oldNotes}\n\n${args.notes.trim()}` : args.notes.trim();

    await ctx.db.patch(order._id, { notes: newNotes });

    // 3. Dodaj wpis do aktywności
    await ctx.db.insert("orderActivity", {
      orderId: order._id,
      type: "comment",
      title: "Dodano notatkę przez API",
      detail: args.notes.trim(),
      authorId: null,
      authorName: "API Partner",
      createdAt: Date.now(),
    });

    return { orderId: order._id, notes: newNotes };
  },
});

export const updateItems = mutation({
  args: {
    id: v.id("orders"),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Zlecenie nie istnieje.");
    const user = await ctx.db.get(userId);

    // Oblicz nowe sumy wartości netto, vat, brutto
    let valueNetto = 0;
    for (const item of args.items) {
      valueNetto += item.valueNetto || 0;
    }
    const vatRate = order.vatRate ?? 23;
    const valueVat = Number((valueNetto * (vatRate / 100)).toFixed(2));
    const valueBrutto = Number((valueNetto + valueVat).toFixed(2));

    await ctx.db.patch(args.id, {
      items: args.items,
      valueNetto,
      valueVat,
      valueBrutto,
    });

    await ctx.db.insert("orderActivity", {
      orderId: args.id,
      type: "items_updated",
      title: "Zaktualizowano pozycje zlecenia",
      detail: `Zmieniono listę pozycji zlecenia. Nowa wartość netto: ${valueNetto} PLN.`,
      authorId: userId,
      authorName: user?.name || "System",
      createdAt: Date.now(),
    });

    return { valueNetto, valueVat, valueBrutto };
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Pobiera listę zapisanych szablonów checklist */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("checklistTemplates").collect();
  },
});

/** Zapisuje bieżący zestaw list jako szablon */
export const saveTemplate = mutation({
  args: {
    name: v.string(),
    lists: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        color: v.string(),
        items: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            checked: v.boolean(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { name, lists }) => {
    const id = await ctx.db.insert("checklistTemplates", {
      name,
      lists,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Aktualizuje nazwy, listy i punkty istniejącego szablonu */
export const updateTemplate = mutation({
  args: {
    id: v.id("checklistTemplates"),
    name: v.string(),
    lists: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        color: v.string(),
        items: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            checked: v.boolean(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { id, name, lists }) => {
    await ctx.db.patch(id, {
      name,
      lists,
      updatedAt: Date.now(),
    });
  },
});

/** Ustawia wybrany szablon jako domyślny dla Wycen lub Zleceń */
export const setDefaultTemplate = mutation({
  args: {
    id: v.id("checklistTemplates"),
    type: v.union(v.literal("quote"), v.literal("order")),
    isDefault: v.boolean(),
  },
  handler: async (ctx, { id, type, isDefault }) => {
    const field = type === "quote" ? "isDefaultQuote" : "isDefaultOrder";

    // Unset current defaults if setting to true
    if (isDefault) {
      const all = await ctx.db.query("checklistTemplates").collect();
      for (const t of all) {
        if (t._id !== id && t[field]) {
          await ctx.db.patch(t._id, { [field]: false });
        }
      }
    }

    await ctx.db.patch(id, { [field]: isDefault });
  },
});

/** Pobiera domyślny szablon dla Wycen lub Zleceń */
export const getDefaultTemplate = query({
  args: { type: v.union(v.literal("quote"), v.literal("order")) },
  handler: async (ctx, { type }) => {
    const field = type === "quote" ? "isDefaultQuote" : "isDefaultOrder";
    const templates = await ctx.db.query("checklistTemplates").collect();
    return templates.find((t) => Boolean(t[field])) ?? null;
  },
});

/** Usuwa szablon o podanym ID */
export const removeTemplate = mutation({
  args: { id: v.id("checklistTemplates") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/** Test weryfikacyjny operacji na własnych checklistach i szablonach */
export const testCustomChecklists = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Stwórz testowy szablon
    const templateId = await ctx.db.insert("checklistTemplates", {
      name: "Testowy Szablon Wyceny",
      lists: [
        {
          id: "list_test_1",
          title: "Analiza Techniczna",
          color: "#3b82f6",
          items: [{ id: "item_1", label: "Sprawdzono profil", checked: true }],
        },
      ],
      createdAt: Date.now(),
    });

    // 2. Pobierz i zweryfikuj szablon
    const fetched = await ctx.db.get(templateId);
    if (!fetched || fetched.name !== "Testowy Szablon Wyceny") {
      throw new Error("Błąd weryfikacji szablonu: nie znaleziono lub błędna nazwa");
    }

    // 3. Posprzątaj po teście
    await ctx.db.delete(templateId);

    return "SUCCESS: Custom checklists schema & template read/write test passed!";
  },
});

/** Test weryfikacyjny konfiguracji szablonów (edycja i oznaczanie jako domyślne) */
export const testKonfiguracjeFlow = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Utwórz szablon testowy
    const id = await ctx.db.insert("checklistTemplates", {
      name: "Szablon Konfiguratora Test",
      lists: [
        {
          id: "l1",
          title: "Lista Testowa",
          color: "#3b82f6",
          items: [{ id: "i1", label: "Punkt 1", checked: false }],
        },
      ],
      createdAt: Date.now(),
    });

    // 2. Oznacz jako domyślny dla Wycen
    const allBefore = await ctx.db.query("checklistTemplates").collect();
    for (const t of allBefore) {
      if (t._id !== id && t.isDefaultQuote) {
        await ctx.db.patch(t._id, { isDefaultQuote: false });
      }
    }
    await ctx.db.patch(id, { isDefaultQuote: true });

    // 3. Sprawdź czy jest domyślny
    const updated = await ctx.db.get(id);
    if (!updated || !updated.isDefaultQuote) {
      throw new Error("Błąd weryfikacji domyślnego szablonu dla Wycen!");
    }

    // 4. Edytuj nazwę
    await ctx.db.patch(id, { name: "Zaktualizowana Nazwa Szablonu" });
    const reFetched = await ctx.db.get(id);
    if (!reFetched || reFetched.name !== "Zaktualizowana Nazwa Szablonu") {
      throw new Error("Błąd weryfikacji edycji szablonu!");
    }

    // 5. Usuń szablon testowy
    await ctx.db.delete(id);

    return "SUCCESS: Konfiguracje templates CRUD and default assignment test passed!";
  },
});

/** Czyszczenie wszystkich checklist we wszystkich wycenach i zleceniach */
export const clearAllChecklists = mutation({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    let qCount = 0;
    for (const q of quotes) {
      if (q.checklists && (Array.isArray(q.checklists) ? q.checklists.length > 0 : Object.keys(q.checklists).length > 0)) {
        await ctx.db.patch(q._id, { checklists: [] });
        qCount++;
      }
    }
    const orders = await ctx.db.query("orders").collect();
    let oCount = 0;
    for (const o of orders) {
      if (o.checklists && (Array.isArray(o.checklists) ? o.checklists.length > 0 : Object.keys(o.checklists).length > 0)) {
        await ctx.db.patch(o._id, { checklists: [] });
        oCount++;
      }
    }
    return `SUCCESS: Cleared checklists for ${qCount} quotes and ${oCount} orders.`;
  },
});

/** Inicjalizuje domyślne szablony, jeśli baza jest pusta */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("checklistTemplates").collect();
    if (existing.length > 0) return "Templates already exist";

    await ctx.db.insert("checklistTemplates", {
      name: "Standardowa Wycena",
      lists: [
        {
          id: "p1_1",
          title: "Analiza & Wymagania",
          color: "#3b82f6",
          items: [
            { id: "i1", label: "Analiza zapytań / Wymagań", checked: false },
            { id: "i2", label: "Dane kontaktowe i adres", checked: false },
            { id: "i3", label: "Weryfikacja techniczna", checked: false },
            { id: "i4", label: "Konfiguracja wybrana", checked: false },
          ],
        },
        {
          id: "p1_2",
          title: "Kalkulacja & Wycena",
          color: "#8b5cf6",
          items: [
            { id: "i5", label: "Kalkulacja materiałowa", checked: false },
            { id: "i6", label: "Wycena dostawców / Szyb", checked: false },
            { id: "i7", label: "Rabat / Marża ustalona", checked: false },
            { id: "i8", label: "Generowanie oferty PDF", checked: false },
          ],
        },
        {
          id: "p1_3",
          title: "Oferta & Akceptacja",
          color: "#10b981",
          items: [
            { id: "i9", label: "Wysłanie oferty do klienta", checked: false },
            { id: "i10", label: "Potwierdzenie warunków", checked: false },
            { id: "i11", label: "Zgoda klienta / Umowa", checked: false },
          ],
        },
      ],
      createdAt: Date.now(),
    });

    await ctx.db.insert("checklistTemplates", {
      name: "Zlecenie i Montaż",
      lists: [
        {
          id: "p2_1",
          title: "Przygotowanie",
          color: "#3b82f6",
          items: [
            { id: "i12", label: "Pomiar końcowy na budowie", checked: false },
            { id: "i13", label: "Weryfikacja zamawianej stolarki", checked: false },
            { id: "i14", label: "Zaliczka zaksięgowana", checked: false },
          ],
        },
        {
          id: "p2_2",
          title: "Zamówienie & Produkcja",
          color: "#f59e0b",
          items: [
            { id: "i15", label: "Zamówienie profili i szyb", checked: false },
            { id: "i16", label: "Potwierdzenie terminu fabryki", checked: false },
            { id: "i17", label: "Kontrola jakości dostawy", checked: false },
          ],
        },
        {
          id: "p2_3",
          title: "Logistyka & Montaż",
          color: "#10b981",
          items: [
            { id: "i18", label: "Pakowanie / Magazyn", checked: false },
            { id: "i19", label: "Transport na budowę", checked: false },
            { id: "i20", label: "Montaż i odbiór końcowy", checked: false },
          ],
        },
      ],
      createdAt: Date.now(),
    });

    return "SUCCESS: Seeded default checklist templates!";
  },
});

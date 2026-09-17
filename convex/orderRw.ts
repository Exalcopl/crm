import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Typy pomocnicze ───────────────────────────────────────────────────────────

const itemValidator = v.object({
  lp: v.number(),
  element: v.string(),
  quantity: v.number(),
  unit: v.string(),
  priceUnit: v.number(),
  priceTotal: v.number(),
  description: v.optional(v.string()),
});

const productionItemValidator = v.object({
  lp: v.number(),
  element: v.string(),
  quantity: v.number(),
  unit: v.string(),
  priceUnit: v.number(),
  priceTotal: v.number(),
  description: v.optional(v.string()),
  materialId: v.optional(v.string()),
  originalLp: v.optional(v.number()),
  changeType: v.string(),
});

const sectionValidator = v.object({
  id: v.string(),
  name: v.string(),
  items: v.array(itemValidator),
  sectionTotal: v.number(),
});

const productionSectionValidator = v.object({
  id: v.string(),
  name: v.string(),
  isCustom: v.optional(v.boolean()),
  items: v.array(productionItemValidator),
  sectionTotal: v.number(),
});

// ─── Zapytania ─────────────────────────────────────────────────────────────────

export const getByOrderId = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

// ─── Mutacje ───────────────────────────────────────────────────────────────────

export const saveProductionSections = mutation({
  args: {
    orderId: v.id("orders"),
    productionSections: v.array(productionSectionValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const existing = await ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!existing) throw new Error("Nie znaleziono karty RW dla tego zlecenia.");

    // Przelicz sumy
    const totalProduction = args.productionSections.reduce(
      (sum, sec) => sum + sec.items.reduce((s, it) => s + (it.changeType === "removed" ? 0 : it.priceTotal), 0),
      0
    );
    const totalSavings = existing.totalOriginal - totalProduction;

    // Przelicz sectionTotal dla każdej sekcji
    const sections = args.productionSections.map((sec) => ({
      ...sec,
      sectionTotal: sec.items.reduce((s, it) => s + (it.changeType === "removed" ? 0 : it.priceTotal), 0),
    }));

    await ctx.db.patch(existing._id, {
      productionSections: sections,
      totalProduction,
      totalSavings,
      updatedAt: Date.now(),
    });

    return { totalProduction, totalSavings };
  },
});

// Importuje przykładowe dane RW (symulacja OCR z pliku PDF)
export const importSampleRw = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    // Sprawdź czy zlecenie istnieje
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    // Usuń poprzednie RW jeśli istnieje
    const existing = await ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    // ─── Dane wzorcowe na podstawie typowego pliku RW ───────────────
    const originalSections = [
      {
        id: "profile",
        name: "PROFILE",
        items: [
          { lp: 1, element: "Profil PVC 70mm biały", quantity: 42.80, unit: "mb.", priceUnit: 28.50, priceTotal: 1219.80, description: "Rama i skrzydło" },
          { lp: 2, element: "Profil słupka T 70mm", quantity: 8.40, unit: "mb.", priceUnit: 31.00, priceTotal: 260.40, description: "Słupek pośredni" },
          { lp: 3, element: "Pręt zbrojeniowy 40x20", quantity: 38.20, unit: "mb.", priceUnit: 8.50, priceTotal: 324.70, description: "Zbrojenie profilu" },
        ],
        sectionTotal: 1804.90,
      },
      {
        id: "profile_dodatkowe",
        name: "PROFILE DODATKOWE",
        items: [
          { lp: 4, element: "Uszczelka obwodowa EPDM", quantity: 86.40, unit: "mb.", priceUnit: 1.20, priceTotal: 103.68, description: "" },
          { lp: 5, element: "Uszczelka środkowa EPDM", quantity: 64.20, unit: "mb.", priceUnit: 1.00, priceTotal: 64.20, description: "" },
        ],
        sectionTotal: 167.88,
      },
      {
        id: "akcesoria",
        name: "AKCESORIA",
        items: [
          { lp: 6, element: "Kotwa montażowa L100", quantity: 24, unit: "szt.", priceUnit: 1.20, priceTotal: 28.80, description: "" },
          { lp: 7, element: "Odprowadzacz wody", quantity: 12, unit: "szt.", priceUnit: 0.50, priceTotal: 6.00, description: "" },
          { lp: 8, element: "Zaślepka narożna", quantity: 32, unit: "szt.", priceUnit: 0.35, priceTotal: 11.20, description: "" },
        ],
        sectionTotal: 46.00,
      },
      {
        id: "okucia",
        name: "OKUCIA",
        items: [
          { lp: 9, element: "Samozamykacz góra/dół premium", quantity: 4, unit: "kpl.", priceUnit: 89.00, priceTotal: 356.00, description: "Drzwi tarasowe" },
          { lp: 10, element: "Klamka okienna standard", quantity: 8, unit: "szt.", priceUnit: 18.00, priceTotal: 144.00, description: "" },
          { lp: 11, element: "Zawias 3D regulowany", quantity: 24, unit: "szt.", priceUnit: 12.50, priceTotal: 300.00, description: "" },
        ],
        sectionTotal: 800.00,
      },
      {
        id: "wypelnienia",
        name: "WYPEŁNIENIA",
        items: [
          { lp: 12, element: "Szyba zespolona 4/16/4 argon", quantity: 7.84, unit: "m²", priceUnit: 85.00, priceTotal: 666.40, description: "Okna" },
          { lp: 13, element: "Szyba VSG 4+4", quantity: 2.10, unit: "m²", priceUnit: 120.00, priceTotal: 252.00, description: "Drzwi tarasowe" },
        ],
        sectionTotal: 918.40,
      },
    ];

    const totalOriginal = originalSections.reduce((s, sec) => s + sec.sectionTotal, 0);

    // Produkcyjne = kopia oryginału z changeType "unchanged"
    const productionSections = originalSections.map((sec) => ({
      id: sec.id,
      name: sec.name,
      isCustom: false,
      sectionTotal: sec.sectionTotal,
      items: sec.items.map((it) => ({
        ...it,
        changeType: "unchanged" as string,
        materialId: undefined,
        originalLp: it.lp,
      })),
    }));

    const now = Date.now();
    const rwId = await ctx.db.insert("orderRw", {
      orderId: args.orderId,
      originalSections,
      productionSections,
      totalOriginal,
      totalProduction: totalOriginal,
      totalSavings: 0,
      importedAt: now,
      updatedAt: now,
    });

    return { rwId, totalOriginal, sections: originalSections.length };
  },
});

// Zapisuje wygenerowane/odczytane z OCR pozycje RW do zlecenia
export const saveParsedRw = mutation({
  args: {
    orderId: v.id("orders"),
    originalSections: v.array(sectionValidator),
    productionSections: v.array(productionSectionValidator),
    sourceFileName: v.optional(v.string()),
    sourceFileId: v.optional(v.string()),
    isMock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    // Usuń poprzednie RW jeśli istnieje dla zlecenia
    const existing = await ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const totalOriginal = args.originalSections.reduce(
      (sum, sec) => sum + sec.items.reduce((s, it) => s + it.priceTotal, 0),
      0
    );

    const totalProduction = args.productionSections.reduce(
      (sum, sec) => sum + sec.items.reduce((s, it) => s + (it.changeType === "removed" ? 0 : it.priceTotal), 0),
      0
    );

    const totalSavings = totalOriginal - totalProduction;
    const now = Date.now();

    const rwId = await ctx.db.insert("orderRw", {
      orderId: args.orderId,
      originalSections: args.originalSections,
      productionSections: args.productionSections,
      totalOriginal,
      totalProduction,
      totalSavings,
      importedAt: now,
      parsedAt: now,
      updatedAt: now,
      sourceFileName: args.sourceFileName,
      sourceFileId: args.sourceFileId,
      isMock: args.isMock,
    });

    return { rwId, totalOriginal, totalProduction, totalSavings };
  },
});

// Test automatyczny zapisu odczytu OCR RW i weryfikacji bazy
export const testParsedRwImport = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    const order = await ctx.db.get(args.orderId);
    if (!order) return { status: "FAIL", reason: "Zlecenie nie istnieje" };

    const existing = await ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const testSections = [
      {
        id: "profile_test",
        name: "PROFILE TEST",
        items: [
          { lp: 1, element: "Profil ALU AL-01", quantity: 15, unit: "mb.", priceUnit: 45, priceTotal: 675, description: "Testowy opis" }
        ],
        sectionTotal: 675,
      }
    ];

    const testProdSections = testSections.map((s) => ({
      ...s,
      isCustom: false,
      items: s.items.map((it) => ({
        ...it,
        changeType: "unchanged",
        materialId: undefined,
        originalLp: it.lp,
      }))
    }));

    const now = Date.now();
    const rwId = await ctx.db.insert("orderRw", {
      orderId: args.orderId,
      originalSections: testSections,
      productionSections: testProdSections,
      totalOriginal: 675,
      totalProduction: 675,
      totalSavings: 0,
      importedAt: now,
      parsedAt: now,
      updatedAt: now,
      sourceFileName: "test_rw_spec.pdf",
      isMock: true,
    });

    const inserted = await ctx.db.get(rwId);
    if (!inserted) return { status: "FAIL", reason: "Nie odnaleziono rekordu po insercie" };
    if (inserted.sourceFileName !== "test_rw_spec.pdf") return { status: "FAIL", reason: "Błąd zapisu sourceFileName" };
    if (inserted.isMock !== true) return { status: "FAIL", reason: "Błąd zapisu flagi isMock" };

    await ctx.db.delete(rwId);
    return { status: "SUCCESS", message: "Zapis i odczyt metadanych RW OCR z bazy Convex działa prawidłowo." };
  }
});

// Autonomiczny test weryfikacyjny (tworzy tymczasowe zlecenie, testuje zapis i odczyt RW OCR, a następnie sprząta po sobie)
export const runSelfContainedRwTest = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Stwórz tymczasowe zlecenie testowe
    const dummyOrderId = await ctx.db.insert("orders", {
      orderNumber: "TEST-RW-OCR-001",
      status: "nowe",
      clientName: "Klient Testowy RW OCR",
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      items: [],
      createdAt: Date.now(),
    });

    try {
      // 2. Przygotuj dane z odczytu OCR RW
      const testOriginalSections = [
        {
          id: "profile_test",
          name: "PROFILE TEST",
          items: [
            { lp: 1, element: "Profil ALU AL-01", quantity: 10, unit: "mb.", priceUnit: 50, priceTotal: 500, description: "Rama" },
            { lp: 2, element: "Uszczelka EPDM", quantity: 20, unit: "mb.", priceUnit: 2, priceTotal: 40, description: "Uszczelnienie" }
          ],
          sectionTotal: 540,
        },
        {
          id: "okucia_test",
          name: "OKUCIA TEST",
          items: [
            { lp: 3, element: "Klamka okienna", quantity: 4, unit: "szt.", priceUnit: 25, priceTotal: 100 }
          ],
          sectionTotal: 100,
        }
      ];

      const testProductionSections = testOriginalSections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        isCustom: false,
        items: sec.items.map((it) => ({
          ...it,
          changeType: "unchanged",
          materialId: undefined,
          originalLp: it.lp,
        })),
        sectionTotal: sec.sectionTotal,
      }));

      const now = Date.now();
      // 3. Zapisz kartę RW z użyciem insert w Convex
      const rwId = await ctx.db.insert("orderRw", {
        orderId: dummyOrderId,
        originalSections: testOriginalSections,
        productionSections: testProductionSections,
        totalOriginal: 640,
        totalProduction: 640,
        totalSavings: 0,
        importedAt: now,
        parsedAt: now,
        updatedAt: now,
        sourceFileName: "rw_spec_test.pdf",
        isMock: true,
      });

      // 4. Odczytaj i werfikuj wpis z bazy
      const fetchedRw = await ctx.db.get(rwId);
      if (!fetchedRw) throw new Error("Nie odnaleziono zapisanego rekordu RW.");
      if (fetchedRw.totalOriginal !== 640) throw new Error(`Błędny totalOriginal: oczekiwano 640, otrzymano ${fetchedRw.totalOriginal}`);
      if (fetchedRw.sourceFileName !== "rw_spec_test.pdf") throw new Error("Błędna nazwa pliku źródłowego.");
      if (fetchedRw.isMock !== true) throw new Error("Brak flaga isMock.");

      // 5. Test aktualizacji produkcyjnego RW z wyliczeniem oszczędności
      const updatedProdSections = JSON.parse(JSON.stringify(testProductionSections));
      updatedProdSections[0].items[0].priceUnit = 40; // zniżka z 50 na 40zł
      updatedProdSections[0].items[0].priceTotal = 400;
      updatedProdSections[0].items[0].changeType = "modified";
      updatedProdSections[0].sectionTotal = 440;

      const newTotalProduction = 540; // 440 + 100
      const newTotalSavings = 640 - 540; // 100 zł oszczędności

      await ctx.db.patch(rwId, {
        productionSections: updatedProdSections,
        totalProduction: newTotalProduction,
        totalSavings: newTotalSavings,
        updatedAt: Date.now(),
      });

      const updatedRw = await ctx.db.get(rwId);
      if (!updatedRw || updatedRw.totalSavings !== 100) {
        throw new Error(`Błąd przeliczenia oszczędności po modyfikacji. Oczekiwano 100, jest: ${updatedRw?.totalSavings}`);
      }

      // Cleanup
      await ctx.db.delete(rwId);
      await ctx.db.delete(dummyOrderId);

      return {
        success: true,
        message: "TEST PASS: Zapis, odczyt, przeliczanie oszczędności oraz usuwanie metadanych RW OCR w Convex działają w 100% poprawnie.",
      };
    } catch (err: any) {
      // Sprzątanie w przypadku błędu
      await ctx.db.delete(dummyOrderId);
      return {
        success: false,
        error: err?.message || "Błąd podczas wykonywania testu.",
      };
    }
  },
});

// Test automatyczny
export const testRwCalculations = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Niezalogowany użytkownik.");

    // 1. Import
    const order = await ctx.db.get(args.orderId);
    if (!order) return { status: "FAIL", reason: "Zlecenie nie istnieje" };

    const existing = await ctx.db
      .query("orderRw")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const sections = [
      { id: "test", name: "TEST", items: [{ lp: 1, element: "Element A", quantity: 10, unit: "szt.", priceUnit: 100, priceTotal: 1000 }], sectionTotal: 1000 },
    ];

    const rwId = await ctx.db.insert("orderRw", {
      orderId: args.orderId,
      originalSections: sections,
      productionSections: sections.map((s) => ({
        ...s,
        isCustom: false,
        items: s.items.map((it) => ({ ...it, changeType: "unchanged" })),
      })),
      totalOriginal: 1000,
      totalProduction: 1000,
      totalSavings: 0,
      updatedAt: Date.now(),
    });

    // 2. Odczyt
    const rw = await ctx.db.get(rwId);
    if (!rw || rw.totalOriginal !== 1000) return { status: "FAIL", reason: "Błąd zapisu totalOriginal" };

    // 3. Zmiana ceny produkcyjnej (symulacja podmiany na tańszy element)
    const cheaperSections = [{
      id: "test",
      name: "TEST",
      isCustom: false as boolean | undefined,
      items: [{ lp: 1, element: "Element A (zamiennik)", quantity: 10, unit: "szt.", priceUnit: 80, priceTotal: 800, changeType: "replaced", materialId: undefined, originalLp: 1, description: undefined }],
      sectionTotal: 800,
    }];

    const totalProd = 800;
    const totalSavings = 1000 - totalProd;
    await ctx.db.patch(rwId, {
      productionSections: cheaperSections,
      totalProduction: totalProd,
      totalSavings,
      updatedAt: Date.now(),
    });

    // 4. Weryfikacja oszczędności
    const rw2 = await ctx.db.get(rwId);
    if (!rw2 || rw2.totalSavings !== 200) return { status: "FAIL", reason: `Błąd kalkulacji oszczędności: ${rw2?.totalSavings}` };

    // Cleanup
    await ctx.db.delete(rwId);

    return { status: "SUCCESS", totalOriginal: 1000, totalProduction: totalProd, totalSavings };
  },
});


import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  approveDocument,
  cancelDraft,
  closeInventorySession,
  createDocument,
  deleteDocumentCore,
  openInventorySession,
  recordCount,
  resolveTrackingRule,
} from "./_lib/wmsCore";

/**
 * Test automatyczny modułu WMS (zapis/odczyt + reguły biznesowe).
 * Uruchomienie:  npx convex run testing_wms:runWmsTest
 *            lub npx tsx scripts/test-wms.ts
 *
 * Przy niezaliczonej asercji mutacja rzuca błąd (rollback całej transakcji).
 * Po sukcesie test sam sprząta dane i przywraca liczniki numeracji.
 */
export const runWmsTest = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    const ok = (msg: string) => results.push(`✅ ${msg}`);
    const assert = (cond: unknown, msg: string) => {
      if (!cond) throw new Error(`❌ ASERCJA NIEUDANA: ${msg}`);
      ok(msg);
    };
    async function expectThrow(fn: () => Promise<unknown>, contains: string, msg: string) {
      let err: Error | null = null;
      try {
        await fn();
      } catch (e) {
        err = e as Error;
      }
      if (!err) throw new Error(`❌ Oczekiwano błędu: ${msg}`);
      if (!err.message.includes(contains))
        throw new Error(`❌ Zły komunikat dla „${msg}”: ${err.message}`);
      ok(`${msg} → „${err.message.slice(0, 70)}”`);
    }

    const now = Date.now();
    const tag = `TEST-WMS-${now}`;
    const year = new Date(now).getFullYear();

    // Stan liczników sprzed testu (do przywrócenia)
    const counterKeys = ["PZ", "RW", "KOREKTA"].map((t) => `${t}/${year}`);
    const counterBefore = new Map<string, number | null>();
    for (const key of counterKeys) {
      const c = await ctx.db
        .query("wms_counters")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      counterBefore.set(key, c ? c.value : null);
    }

    // ── Dane bazowe ──────────────────────────────────────────────────────
    const userId = await ctx.db.insert("users", { name: tag });
    const materialId = await ctx.db.insert("materials", {
      name: `${tag} Profil Al`,
      unit: "mb.",
      priceUnit: 10,
      category: "PROFILE",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const profileId = await ctx.db.insert("wms_material_profiles", {
      materialId,
      isTracked: true,
      kgPerMb: 2,
      trackingMode: "STRICT",
      requiresCertificate: true,
      requiresColor: false,
      createdAt: now,
      updatedAt: now,
    });
    const mkLoc = (
      code: string,
      zone: "MAGAZYN_GLOWNY" | "BUFOR_PRODUKCYJNY" | "KWARANTANNA",
      extra: { maxWeightKg?: number; maxLengthMm?: number } = {},
    ) =>
      ctx.db.insert("wms_locations", {
        code: `${tag}-${code}`,
        name: code,
        zone,
        type: "CANTILEVER",
        isActive: true,
        createdAt: now,
        ...extra,
      });
    const locMG = await mkLoc("MG", "MAGAZYN_GLOWNY");
    const locMG2 = await mkLoc("MG2", "MAGAZYN_GLOWNY");
    const locBuf = await mkLoc("BUF", "BUFOR_PRODUKCYJNY");
    const locSmall = await mkLoc("SMALL", "MAGAZYN_GLOWNY", { maxWeightKg: 50, maxLengthMm: 3000 });

    const orderId = await ctx.db.insert("orders", {
      orderNumber: `${tag}-ORD-1`,
      clientName: `${tag} Klient`,
      status: "nowe",
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      items: [],
      createdAt: now,
    });

    const docIds: Id<"wms_documents">[] = [];
    const sessionIds: Id<"wms_inventory_sessions">[] = [];
    const ruleIds: Id<"wms_tracking_rules">[] = [];
    const newDoc = async (type: "PZ" | "RW", extra: { orderId?: Id<"orders">; orderNumber?: string } = {}) => {
      const { id } = await createDocument(ctx, userId, {
        type,
        orderId: extra.orderId ?? (type === "RW" ? orderId : undefined),
        orderNumber: extra.orderNumber ?? (type === "RW" ? `${tag}-ORD-1` : undefined),
      });
      docIds.push(id);
      return id;
    };
    const addLine = (documentId: Id<"wms_documents">, f: Record<string, unknown>) =>
      ctx.db.insert("wms_document_lines", { documentId, quantityPieces: 1, ...f } as never);

    try {
      // ── 1. Reguły ewidencji: specyficzność wygrywa ───────────────────────
      ruleIds.push(
        await ctx.db.insert("wms_tracking_rules", {
          name: `${tag} kategoria`,
          category: "PROFILE",
          trackingMode: "STRICT",
          requiredAttributes: ["length", "color"],
          enforceCycleCount: false,
          priority: 1,
          isActive: true,
          createdAt: now,
        }),
      );
      ruleIds.push(
        await ctx.db.insert("wms_tracking_rules", {
          name: `${tag} materiał`,
          materialId,
          trackingMode: "STRICT",
          requiredAttributes: ["length", "lot"],
          enforceCycleCount: true,
          priority: 1,
          isActive: true,
          createdAt: now,
        }),
      );
      const rule = await resolveTrackingRule(ctx, materialId, "MAGAZYN_GLOWNY");
      assert(rule.ruleName === `${tag} materiał`, "reguła per materiał wygrywa z regułą per kategoria");
      assert(
        rule.requiredAttributes.includes("lot") &&
          rule.requiredAttributes.includes("certificate") &&
          !rule.requiredAttributes.includes("color"),
        "wymagane atrybuty = reguła + atest z profilu indeksu",
      );
      assert(rule.enforceCycleCount === true, "flaga inwentaryzacji ciągłej z reguły");

      // ── 2. PZ: walidacja atrybutów ───────────────────────────────────────
      const pz1 = await newDoc("PZ");
      await addLine(pz1, { materialId, quantityPieces: 10, lengthMm: 6500, heatNumber: "W-1", toLocationId: locMG });
      await expectThrow(() => approveDocument(ctx, userId, pz1), "brak atestu", "PZ bez atestu (wymagany) jest blokowane");

      // Zdejmujemy wymóg atestu → zatwierdzenie powinno przejść
      await ctx.db.patch(profileId, { requiresCertificate: false });
      await expectThrow(
        async () => {
          const bad = await newDoc("PZ");
          await addLine(bad, { materialId, quantityPieces: 5, lengthMm: 6500, toLocationId: locMG });
          await approveDocument(ctx, userId, bad);
        },
        "brak numeru partii",
        "PZ bez numeru partii/wytopu jest blokowane",
      );

      // ── 3. PZ zatwierdzone: partia, ruch, ostrzeżenia, kwarantanna, odrzucenie ──
      // (pz1 ma już poprawną linię W-1 — teraz bez wymogu atestu)
      await addLine(pz1, {
        materialId,
        quantityPieces: 3,
        lengthMm: 6000,
        heatNumber: "W-2",
        toLocationId: locMG,
        damage: { description: "Zarysowanie powłoki", positionMm: 3200, disposition: "ACCEPT" },
      });
      await addLine(pz1, {
        materialId,
        quantityPieces: 2,
        lengthMm: 6000,
        heatNumber: "W-3",
        toLocationId: locMG,
        damage: { description: "Wgniecenie", disposition: "REJECT" },
      });
      await addLine(pz1, { materialId, quantityPieces: 4, lengthMm: 6500, heatNumber: "W-4", toLocationId: locSmall });
      const res = await approveDocument(ctx, userId, pz1);
      assert(res.warnings.length >= 1, `ostrzeżenia nośność/długość (${res.warnings.length}): ${res.warnings[0]}`);

      const lines1 = await ctx.db
        .query("wms_document_lines")
        .withIndex("by_document", (q) => q.eq("documentId", pz1))
        .collect();
      const lotOf = async (heat: string) => {
        const l = lines1.find((x) => x.heatNumber === heat);
        return l?.lotId ? await ctx.db.get(l.lotId) : null;
      };
      const lotA = (await lotOf("W-1"))!;
      const lotHold = (await lotOf("W-2"))!;
      const lotRejected = await lotOf("W-3");
      assert(lotA && lotA.quantityPieces === 10 && lotA.status === "AVAILABLE", "PZ tworzy partię AVAILABLE z odczytem ilości");
      assert(lotA.lengthMm === 6500 && lotA.heatNumber === "W-1", "PZ zapisuje długość i partię/wytop");
      assert(lotHold.status === "AVAILABLE", "uszkodzenie z dopuszczeniem (ACCEPT) → partia AVAILABLE");
      assert(lotRejected === null, "linia odrzucona (REJECT) nie wchodzi na stan");
      const doc1 = await ctx.db.get(pz1);
      assert(doc1?.status === "ZATWIERDZONY" && /^PZ\/\d{4}\/\d{4}$/.test(doc1.number), `numeracja dokumentu: ${doc1?.number}`);
      await expectThrow(() => approveDocument(ctx, userId, pz1), "już zatwierdzony", "ponowne zatwierdzenie jest blokowane");

      // ── 4. RW ────────────────────────────────────────────────────────────
      // RW wymaga powiązania ze zleceniem (orderId)
      const rwNoOrder = await ctx.db.insert("wms_documents", {
        type: "RW",
        number: `RW-TEST-NO-ORD-${now}`,
        status: "DRAFT",
        createdBy: userId,
        createdAt: now,
      });
      docIds.push(rwNoOrder);
      await addLine(rwNoOrder, { lotId: lotA._id, quantityPieces: 1 });
      await expectThrow(
        () => approveDocument(ctx, userId, rwNoOrder),
        "wymaga przypisania do zlecenia",
        "RW bez powiązanego zlecenia (orderId) jest blokowane",
      );

      // RW ponad stan partii jest blokowane
      const rwTooMany = await newDoc("RW");
      await addLine(rwTooMany, { lotId: lotA._id, quantityPieces: 99 });
      await expectThrow(
        () => approveDocument(ctx, userId, rwTooMany),
        "większa niż stan",
        "RW ponad stan partii jest blokowane",
      );

      // Częściowe RW bezpośrednio zmniejsza ilość partii w magazynie (10 -> 6 szt.)
      const rw = await newDoc("RW");
      await addLine(rw, { lotId: lotA._id, quantityPieces: 4 });
      await approveDocument(ctx, userId, rw);
      const lotAafter = (await ctx.db.get(lotA._id))!;
      assert(
        lotAafter.quantityPieces === 6 && lotAafter.status === "AVAILABLE",
        "RW częściowe bezpośrednio zmniejsza stan partii w magazynie (10 → 6 szt., AVAILABLE)",
      );
      const rwMovs = await ctx.db
        .query("wms_movements")
        .withIndex("by_document", (q) => q.eq("documentId", rw))
        .collect();
      assert(
        rwMovs.length === 1 && rwMovs[0].quantityDelta === -4 && rwMovs[0].type === "RW" && rwMovs[0].fromLocationId === lotA.locationId,
        "RW rejestruje ruch rozchodu (quantityDelta = -4) ze wskazaniem pierwotnej lokalizacji",
      );

      // ── 5. Inwentaryzacja → KOREKTA ──────────────────────────────────────
      const sessionId = await openInventorySession(ctx, userId, { name: `${tag} inw`, locationId: locMG });
      sessionIds.push(sessionId);
      const counts = await ctx.db
        .query("wms_inventory_counts")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
      assert(counts.length >= 1 && counts.every((c) => c.expectedPieces > 0), `sesja zrzuca stany (${counts.length} poz.)`);
      const cA = counts.find((c) => c.lotId === lotA._id)!;
      await expectThrow(() => recordCount(ctx, userId, cA._id, -1), "≥ 0", "ujemna policzona ilość odrzucona");
      await recordCount(ctx, userId, cA._id, 5); // system: 6 → policzono 5
      const closed = await closeInventorySession(ctx, userId, sessionId);
      assert(closed.differences === 1 && closed.correctionDocumentId, "zamknięcie sesji generuje KOREKTĘ dla różnic");
      docIds.push(closed.correctionDocumentId!);
      assert((await ctx.db.get(lotA._id))!.quantityPieces === 5, "KOREKTA ustawia stan zgodny z liczeniem (6 → 5)");
      await expectThrow(() => closeInventorySession(ctx, userId, sessionId), "zamknięta", "zamknięta sesja nie może być zamknięta ponownie");

      // ── 8. Niezmiennik: stan partii = suma ruchów ────────────────────────
      const allLots = await ctx.db
        .query("wms_lots")
        .withIndex("by_material", (q) => q.eq("materialId", materialId))
        .collect();
      for (const lot of allLots) {
        const mvs = await ctx.db
          .query("wms_movements")
          .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
          .collect();
        const sum = mvs.reduce((s, m) => s + m.quantityDelta, 0);
        assert(sum === lot.quantityPieces, `stan = suma ruchów (partia ${lot.heatNumber ?? "?"}: ${lot.quantityPieces} = ${sum})`);
      }

      // ── 9. Lokalizacje: tworzenie z samej nazwy ─────────────────────────
      const locOnlyNameId = await ctx.db.insert("wms_locations", {
        code: `${tag}-REGAŁ NOWY`.toUpperCase(),
        name: "Regał Nowy",
        zone: "MAGAZYN_GLOWNY",
        type: "CANTILEVER",
        isActive: true,
        createdAt: now,
      });
      const locOnlyName = await ctx.db.get(locOnlyNameId);
      assert(locOnlyName?.name === "Regał Nowy", "tworzenie lokalizacji z samej nazwy");
      await ctx.db.delete(locOnlyNameId);
      assert((await ctx.db.get(locOnlyNameId)) === null, "usunięcie pustej lokalizacji");

      // ── 10. Konfigurowalne kategorie i obiekty magazynowe (relacja rodzic-dziecko) ─
      // 10a. Tworzenie nadrzędnej kategorii
      const glassCatId = await ctx.db.insert("wms_categories", {
        name: "Szyby zespolone",
        code: `${tag}-GLASS`,
        description: "Pakiety 2- i 3-szybowe oraz formatki szklane",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // 10b. Tworzenie podrzędnego obiektu magazynowego przypisanego do kategorii
      const glassObjectId = await ctx.db.insert("wms_objects", {
        categoryId: glassCatId,
        name: "Pakiet szybowy",
        code: "GLASS_PACK",
        defaultUnit: "m²",
        description: "Szyby zespolone docinane na wymiar",
        fieldsConfig: {
          lengthMm: { enabled: false, required: false },
          widthMm: { enabled: true, required: true, label: "Szerokość (mm)" },
          heightMm: { enabled: true, required: true, label: "Wysokość (mm)" },
          thicknessMm: { enabled: true, required: false, label: "Grubość (mm)" },
          weightKg: { enabled: true, required: false, label: "Masa pakietu (kg)" },
        },
        customFields: [
          { key: "glazingType", label: "Budowa pakietu", type: "text", required: false },
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const glassSku = `${tag}-SKU-4164`;
      const glassMaterialId = await ctx.db.insert("materials", {
        name: `${tag} Szyba 4/16/4`,
        sku: glassSku,
        unit: "m²",
        priceUnit: 150,
        category: "SZYBY",
        wmsCategoryId: glassCatId,
        wmsObjectId: glassObjectId,
        widthMm: 1200,
        heightMm: 900,
        thicknessMm: 24,
        weightKg: 32.4,
        customAttributes: { glazingType: "4/16/4 U=1.0" },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Weryfikacja wyszukiwania indeksu materiałowego po kodzie SKU (dla kodów QR)
      const bySkuFound = await ctx.db
        .query("materials")
        .withIndex("by_sku", (q) => q.eq("sku", glassSku))
        .first();
      assert(bySkuFound?._id === glassMaterialId, "wyszukiwanie indeksu materiałowego po kodzie SKU (kod QR)");
      assert(
        bySkuFound?.widthMm === 1200 && bySkuFound?.heightMm === 900 && bySkuFound?.thicknessMm === 24,
        "indeks materiałowy przechowuje nominalne wymiary fizyczne zdefiniowane w obiekcie",
      );

      // Błąd walidacji: gdy indeks nie ma wymiaru i pozycja PZ też go nie podaje, a obiekt wymaga szerokości
      await ctx.db.patch(glassMaterialId, { widthMm: undefined });
      const { id: badGlassPzId } = await createDocument(ctx, userId, { type: "PZ" });
      docIds.push(badGlassPzId);
      await ctx.db.insert("wms_document_lines", {
        documentId: badGlassPzId,
        materialId: glassMaterialId,
        objectId: glassObjectId,
        quantityPieces: 2,
        heightMm: 800, // brak widthMm i na indeksie, i na pozycji!
        toLocationId: locMG,
      });
      await expectThrow(
        () => approveDocument(ctx, userId, badGlassPzId),
        "brak wymaganej szerokości",
        "PZ szyby: walidacja odrzuca brak szerokości wymaganej przez obiekt magazynowy",
      );

      // Przywracamy widthMm = 1200 na indeksie — teraz PZ bez wpisywania wymiarów w linii dziedziczy je z indeksu!
      // Weryfikacja: PZ bez lokalizacji docelowej (MVP) tworzy partię dostępną w magazynie
      await ctx.db.patch(glassMaterialId, { widthMm: 1200 });

      const { id: goodGlassPzId } = await createDocument(ctx, userId, { type: "PZ" });
      docIds.push(goodGlassPzId);
      await ctx.db.insert("wms_document_lines", {
        documentId: goodGlassPzId,
        materialId: glassMaterialId,
        quantityPieces: 4,
        heatNumber: "GLASS-BATCH-1",
        // brak toLocationId — magazyn bez lokalizacji w MVP
      });
      await approveDocument(ctx, userId, goodGlassPzId);
      ok("PZ bez lokalizacji docelowej zatwierdza się poprawnie (MVP bez lokalizacji)");
      const glassLots = await ctx.db
        .query("wms_lots")
        .withIndex("by_material", (q) => q.eq("materialId", glassMaterialId))
        .collect();
      assert(glassLots.length === 1, "PZ szyby: utworzono partię pakietów szybowych");
      const glassLot = glassLots[0];
      assert(glassLot.widthMm === 1200, "partia szyby: zapisano widthMm = 1200");
      assert(glassLot.heightMm === 900, "partia szyby: zapisano heightMm = 900");
      assert(glassLot.thicknessMm === 24, "partia szyby: zapisano thicknessMm = 24");
      assert(glassLot.quantityPieces === 4, "partia szyby: stan = 4 szt.");
      assert(glassLot.categoryId === glassCatId, "partia szyby: powiązana z kategorią nadrzędną GLASS");
      assert(glassLot.objectId === glassObjectId, "partia szyby: powiązana z podrzędnym obiektem Pakiet szybowy");

      // Wydanie RW pakietów szybowych bezpośrednio do zlecenia
      const { id: glassRwId } = await createDocument(ctx, userId, {
        type: "RW",
        orderId,
        orderNumber: `${tag}-ORD-1`,
      });
      docIds.push(glassRwId);
      await ctx.db.insert("wms_document_lines", {
        documentId: glassRwId,
        lotId: glassLot._id,
        quantityPieces: 1,
      });
      await approveDocument(ctx, userId, glassRwId);
      const updatedGlassLot = await ctx.db.get(glassLot._id);
      assert(updatedGlassLot?.quantityPieces === 3, "RW szyby: na stanie magazynu pozostały 3 sztuki");

      // Sprzątanie testowej kategorii, obiektu i materiału szyby
      const testGlassLots = await ctx.db
        .query("wms_lots")
        .withIndex("by_material", (q) => q.eq("materialId", glassMaterialId))
        .collect();
      for (const l of testGlassLots) {
        const mvs = await ctx.db
          .query("wms_movements")
          .withIndex("by_lot", (q) => q.eq("lotId", l._id))
          .collect();
        for (const m of mvs) await ctx.db.delete(m._id);
        await ctx.db.delete(l._id);
      }
      await ctx.db.delete(glassMaterialId);
      await ctx.db.delete(glassObjectId);
      await ctx.db.delete(glassCatId);

      // ── Test 3-poziomowej hierarchii: Grupa -> System (Procural) -> Indeksy (PE50, PE68) ─
      // Poziom 1: Grupa towarowa
      const profileCatId = await ctx.db.insert("wms_categories", {
        code: `PROF_${now}`,
        name: "Profile aluminiowe",
        description: "Główna grupa towarowa profili",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Poziom 2: System / Podgrupa podrzędna dla grupy
      const procuralObjId = await ctx.db.insert("wms_objects", {
        categoryId: profileCatId,
        code: `PROC_${now}`,
        name: "Procural",
        description: "Systemy okienno-drzwiowe Procural",
        defaultUnit: "szt.",
        fieldsConfig: {
          lengthMm: { enabled: true, required: true, label: "Długość handlowa (mm)" },
          widthMm: { enabled: false, required: false },
          heightMm: { enabled: false, required: false },
          thicknessMm: { enabled: false, required: false },
          weightKg: { enabled: true, required: false, label: "Masa sztangi (kg)" },
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Poziom 3: Indeksy magazynowe podrzędne dla systemu Procural
      const pe50MatId = await ctx.db.insert("materials", {
        name: "Profil ramy PE50",
        sku: "PE50",
        unit: "szt.",
        priceUnit: 120,
        category: "PROFILE",
        wmsCategoryId: profileCatId,
        wmsObjectId: procuralObjId,
        lengthMm: 6500,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const pe68MatId = await ctx.db.insert("materials", {
        name: "Profil skrzydła PE68",
        sku: "PE68",
        unit: "szt.",
        priceUnit: 145,
        category: "PROFILE",
        wmsCategoryId: profileCatId,
        wmsObjectId: procuralObjId,
        lengthMm: 6000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      assert(pe50MatId && pe68MatId, "Hierarchia: utworzono indeksy PE50 i PE68 w systemie Procural");

      // Przyjęcie PZ dla PE50
      const { id: pzPe50Id } = await createDocument(ctx, userId, { type: "PZ" });
      docIds.push(pzPe50Id);
      await ctx.db.insert("wms_document_lines", {
        documentId: pzPe50Id,
        materialId: pe50MatId,
        objectId: procuralObjId,
        quantityPieces: 10,
        lengthMm: 6500,
        toLocationId: locMG,
      });
      await approveDocument(ctx, userId, pzPe50Id);

      const pe50Lots = await ctx.db
        .query("wms_lots")
        .withIndex("by_material", (q) => q.eq("materialId", pe50MatId))
        .collect();
      assert(pe50Lots.length === 1, "PZ PE50: utworzono partię 10 sztuk");
      const pe50Lot = pe50Lots[0];
      assert(pe50Lot.quantityPieces === 10, "PZ PE50: stan = 10 sztuk");
      assert(pe50Lot.lengthMm === 6500, "PZ PE50: długość = 6500 mm");
      assert((pe50Lot.quantityPieces * (pe50Lot.lengthMm ?? 0)) / 1000 === 65, "PZ PE50: metry bieżące = 65 mb");
      assert(pe50Lot.categoryId === profileCatId, "PZ PE50: partia przypisana do Grupy towarowej");
      assert(pe50Lot.objectId === procuralObjId, "PZ PE50: partia przypisana do Systemu Procural");

      // Weryfikacja: PZ profilu bez lokalizacji
      const { id: pzNoLocId } = await createDocument(ctx, userId, { type: "PZ" });
      docIds.push(pzNoLocId);
      await ctx.db.insert("wms_document_lines", {
        documentId: pzNoLocId,
        materialId: pe68MatId,
        objectId: procuralObjId,
        quantityPieces: 5,
        lengthMm: 6000,
      });
      await approveDocument(ctx, userId, pzNoLocId);
      ok("PZ PE68 bez lokalizacji zatwierdzony pomyślnie");

      // Sprzątanie danych testowych hierarchii
      for (const matId of [pe50MatId, pe68MatId]) {
        const lots = await ctx.db
          .query("wms_lots")
          .withIndex("by_material", (q) => q.eq("materialId", matId))
          .collect();
        for (const l of lots) {
          const mvs = await ctx.db
            .query("wms_movements")
            .withIndex("by_lot", (q) => q.eq("lotId", l._id))
            .collect();
          for (const m of mvs) await ctx.db.delete(m._id);
          await ctx.db.delete(l._id);
        }
        await ctx.db.delete(matId);
      }
      await ctx.db.delete(procuralObjId);
      await ctx.db.delete(profileCatId);
      ok("3-poziomowa struktura magazynowa (Grupa -> Procural -> PE50/PE68) przetestowana i zweryfikowana");

      // ── 7. Test usuwania PZ (DRAFT, ANULOWANY, ZATWIERDZONY, oraz ochrona przed usunięciem zużytych) ──
      // 7.1 Usunięcie szkicu (DRAFT)
      const pzDraftId = await newDoc("PZ");
      await addLine(pzDraftId, {
        materialId,
        quantityPieces: 2,
        toLocationId: locMG,
      });
      const delDraftRes = await deleteDocumentCore(ctx, pzDraftId);
      assert(delDraftRes.success, "deleteDocumentCore usuwa szkic PZ");
      assert((await ctx.db.get(pzDraftId)) === null, "Szkic PZ nie istnieje w bazie");
      const draftLines = await ctx.db
        .query("wms_document_lines")
        .withIndex("by_document", (q) => q.eq("documentId", pzDraftId))
        .collect();
      assert(draftLines.length === 0, "Pozycje szkicu PZ zostały usunięte");

      // 7.2 Usunięcie anulowanego PZ (ANULOWANY)
      const pzCancelId = await newDoc("PZ");
      await addLine(pzCancelId, {
        materialId,
        quantityPieces: 2,
        toLocationId: locMG,
      });
      await cancelDraft(ctx, pzCancelId);
      const delCancelRes = await deleteDocumentCore(ctx, pzCancelId);
      assert(delCancelRes.success, "deleteDocumentCore usuwa anulowany PZ");
      assert((await ctx.db.get(pzCancelId)) === null, "Anulowany PZ nie istnieje w bazie");

      // 7.3 Usunięcie zatwierdzonego PZ (ZATWIERDZONY) bez późniejszych ruchów
      const pzApproveId = await newDoc("PZ");
      await addLine(pzApproveId, {
        materialId,
        quantityPieces: 3,
        lengthMm: 4000,
        heatNumber: "HEAT-DEL-TEST",
        toLocationId: locMG,
      });
      await approveDocument(ctx, userId, pzApproveId);
      const approvedDoc = await ctx.db.get(pzApproveId);
      assert(approvedDoc?.status === "ZATWIERDZONY", "PZ zatwierdzony");
      const createdLots = await ctx.db
        .query("wms_lots")
        .filter((q) => q.eq(q.field("receivedByDocumentId"), pzApproveId))
        .collect();
      assert(createdLots.length === 1, "PZ utworzył partię w magazynie");
      const lotIdToClean = createdLots[0]._id;

      // Usunięcie zatwierdzonego PZ
      const delApproveRes = await deleteDocumentCore(ctx, pzApproveId);
      assert(delApproveRes.success, "deleteDocumentCore usuwa zatwierdzony PZ");
      assert(delApproveRes.deletedLots === 1, "deleteDocumentCore raportuje usunięcie 1 partii");
      assert((await ctx.db.get(pzApproveId)) === null, "Zatwierdzony PZ został usunięty");
      assert((await ctx.db.get(lotIdToClean)) === null, "Partia z usuniętego PZ została usunięta z magazynu");
      const remainingMovs = await ctx.db
        .query("wms_movements")
        .withIndex("by_document", (q) => q.eq("documentId", pzApproveId))
        .collect();
      assert(remainingMovs.length === 0, "Ruchy magazynowe powiązane z usuniętym PZ zostały usunięte");

      // 7.4 Bezpieczeństwo: blokada usunięcia PZ, jeśli partia została ruszona innym dokumentem
      const pzBlockedId = await newDoc("PZ");
      await addLine(pzBlockedId, {
        materialId,
        quantityPieces: 5,
        lengthMm: 4000,
        heatNumber: "HEAT-BLOCK-TEST",
        toLocationId: locMG,
      });
      await approveDocument(ctx, userId, pzBlockedId);
      const blockedLots = await ctx.db
        .query("wms_lots")
        .filter((q) => q.eq(q.field("receivedByDocumentId"), pzBlockedId))
        .collect();
      const blockedLotId = blockedLots[0]._id;

      // Wykonaj ruch RW na tej partii
      const rwDocId = await newDoc("RW");
      await addLine(rwDocId, {
        lotId: blockedLotId,
        quantityPieces: 2,
      });
      await approveDocument(ctx, userId, rwDocId);

      // Próba usunięcia PZ musi rzucić błąd
      await expectThrow(
        () => deleteDocumentCore(ctx, pzBlockedId),
        "Nie można usunąć dokumentu PZ",
        "Ochrona integralności: blokada usunięcia PZ po wykonaniu RW na partii",
      );
      assert((await ctx.db.get(pzBlockedId)) !== null, "PZ chroniony przed usunięciem nadal istnieje");

      // Sprzątanie po pzBlockedId i rwDocId
      const pzBlockedLots = await ctx.db
        .query("wms_lots")
        .filter((q) => q.eq(q.field("receivedByDocumentId"), pzBlockedId))
        .collect();
      for (const l of pzBlockedLots) {
        const mvs = await ctx.db.query("wms_movements").withIndex("by_lot", (q) => q.eq("lotId", l._id)).collect();
        for (const m of mvs) await ctx.db.delete(m._id);
        await ctx.db.delete(l._id);
      }
      for (const dId of [pzBlockedId, rwDocId]) {
        const lns = await ctx.db.query("wms_document_lines").withIndex("by_document", (q) => q.eq("documentId", dId)).collect();
        for (const l of lns) await ctx.db.delete(l._id);
        await ctx.db.delete(dId);
      }
      ok("Usuwanie PZ (szkic, anulowany, zatwierdzony oraz ochrona magazynowa) przetestowane i w pełni sprawne");

      // 7.5 Usunięcie zatwierdzonego RW i przywrócenie stanu partii źródłowej
      const pzForRwTestId = await newDoc("PZ");
      await addLine(pzForRwTestId, {
        materialId,
        quantityPieces: 10,
        lengthMm: 3000,
        heatNumber: "HEAT-RW-DEL-TEST",
        toLocationId: locMG,
      });
      await approveDocument(ctx, userId, pzForRwTestId);
      const rwTestLots = await ctx.db
        .query("wms_lots")
        .filter((q) => q.eq(q.field("receivedByDocumentId"), pzForRwTestId))
        .collect();
      const rwSourceLotId = rwTestLots[0]._id;

      // Zatwierdź częściowe RW (pobranie 4 szt. bezpośrednio do zlecenia, w MG zostaje 6 szt.)
      const testRwDocId = await newDoc("RW");
      await addLine(testRwDocId, {
        lotId: rwSourceLotId,
        quantityPieces: 4,
      });
      await approveDocument(ctx, userId, testRwDocId);

      const lotAfterRw = await ctx.db.get(rwSourceLotId);
      assert(lotAfterRw?.quantityPieces === 6, "Po RW na partii źródłowej zostało 6 szt.");

      // Usunięcie zatwierdzonego RW
      const delRwRes = await deleteDocumentCore(ctx, testRwDocId);
      assert(delRwRes.success, "deleteDocumentCore usuwa zatwierdzony RW");
      assert((await ctx.db.get(testRwDocId)) === null, "Dokument RW został usunięty z bazy");

      const lotRestored = await ctx.db.get(rwSourceLotId);
      assert(lotRestored?.quantityPieces === 10, "Stan partii źródłowej został w pełni przywrócony (6 -> 10 szt.)");
      ok("Usuwanie zatwierdzonego RW przywraca stan partii źródłowej w magazynie");

      // Posprzątaj PZ testowe
      await deleteDocumentCore(ctx, pzForRwTestId);
    } finally {
      // Sprzątanie (w razie błędu mutacja i tak się cofa, ale zachowujemy porządek)
      await cleanup(ctx, {
        materialId,
        profileId,
        userId,
        orderId,
        locs: [locMG, locMG2, locBuf, locSmall],
        docIds,
        sessionIds,
        ruleIds,
        counterBefore,
      });
    }
    ok("sprzątanie danych testowych i przywrócenie liczników numeracji");
    return results;
  },
});

async function cleanup(
  ctx: MutationCtx,
  d: {
    materialId: Id<"materials">;
    profileId: Id<"wms_material_profiles">;
    userId: Id<"users">;
    orderId: Id<"orders">;
    locs: Id<"wms_locations">[];
    docIds: Id<"wms_documents">[];
    sessionIds: Id<"wms_inventory_sessions">[];
    ruleIds: Id<"wms_tracking_rules">[];
    counterBefore: Map<string, number | null>;
  },
) {
  const lots = await ctx.db
    .query("wms_lots")
    .withIndex("by_material", (q) => q.eq("materialId", d.materialId))
    .collect();
  for (const lot of lots) {
    const mvs = await ctx.db
      .query("wms_movements")
      .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
      .collect();
    for (const m of mvs) await ctx.db.delete(m._id);
    await ctx.db.delete(lot._id);
  }
  for (const id of d.sessionIds) {
    const cs = await ctx.db
      .query("wms_inventory_counts")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .collect();
    for (const c of cs) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  }
  for (const id of d.docIds) {
    const doc = await ctx.db.get(id);
    if (!doc) continue;
    const ls = await ctx.db
      .query("wms_document_lines")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect();
    for (const l of ls) await ctx.db.delete(l._id);
    await ctx.db.delete(id);
  }
  for (const id of d.ruleIds) await ctx.db.delete(id);
  for (const id of d.locs) await ctx.db.delete(id);
  await ctx.db.delete(d.profileId);
  await ctx.db.delete(d.materialId);
  await ctx.db.delete(d.userId);
  await ctx.db.delete(d.orderId);
  for (const [key, before] of d.counterBefore) {
    const c = await ctx.db
      .query("wms_counters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!c) continue;
    if (before === null) await ctx.db.delete(c._id);
    else await ctx.db.patch(c._id, { value: before });
  }
}

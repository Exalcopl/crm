import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Rdzeń logiki WMS (MVP). Funkcje przyjmują `ctx` i `userId`, dzięki czemu
 * są współdzielone przez publiczne mutacje (convex/wms.ts) oraz test
 * automatyczny (convex/testing_wms.ts), który działa bez sesji użytkownika.
 */

export type LotStatus = Doc<"wms_lots">["status"];
export type DocType = Doc<"wms_documents">["type"];
export type ZoneType = Doc<"wms_locations">["zone"];
export type TrackingMode = "STRICT" | "QUANTITY" | "NONE";

export const REQUIRED_ATTRIBUTES = ["length", "color", "lot", "certificate"] as const;

export type ResolvedRule = {
  trackingMode: TrackingMode;
  requiredAttributes: string[];
  enforceCycleCount: boolean;
  ruleName: string | null;
};

// ─── Reguły ewidencji ───────────────────────────────────────────────────────

/**
 * Wyznacza obowiązującą ziarnistość ewidencji dla indeksu w danej strefie.
 * Reguła bardziej szczegółowa (materiał > kategoria > strefa) wygrywa,
 * przy remisie decyduje `priority`. Atrybuty wymagane przez profil indeksu
 * (atest/kolor) są zawsze dodawane.
 */
export async function resolveTrackingRule(
  ctx: QueryCtx,
  materialId: Id<"materials">,
  zone?: string,
): Promise<ResolvedRule> {
  const material = await ctx.db.get(materialId);
  if (!material) throw new Error("Materiał nie istnieje.");
  const profile = await ctx.db
    .query("wms_material_profiles")
    .withIndex("by_material", (q) => q.eq("materialId", materialId))
    .unique();
  if (profile && !profile.isTracked) {
    return {
      trackingMode: "NONE",
      requiredAttributes: [],
      enforceCycleCount: false,
      ruleName: "Profil indeksu: nieśledzony",
    };
  }

  const rules = await ctx.db
    .query("wms_tracking_rules")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  const matching = rules
    .filter(
      (r) =>
        (r.materialId === undefined || r.materialId === materialId) &&
        (r.category === undefined || r.category === material.category) &&
        (r.zone === undefined || r.zone === zone),
    )
    .map((r) => ({
      rule: r,
      specificity:
        (r.materialId ? 4 : 0) + (r.category ? 2 : 0) + (r.zone ? 1 : 0),
    }))
    .sort((a, b) => b.specificity - a.specificity || b.rule.priority - a.rule.priority);

  const best = matching[0]?.rule;
  const attrs = new Set<string>(best?.requiredAttributes ?? ["length"]);
  if (profile?.requiresCertificate) attrs.add("certificate");
  if (profile?.requiresColor) attrs.add("color");
  attrs.add("length");

  return {
    trackingMode: best?.trackingMode ?? profile?.trackingMode ?? "STRICT",
    requiredAttributes: [...attrs],
    enforceCycleCount: best?.enforceCycleCount ?? false,
    ruleName: best?.name ?? null,
  };
}

type LotAttrs = {
  lengthMm?: number;
  colorCode?: string;
  heatNumber?: string;
  certificateStorageId?: Id<"_storage">;
};

/** Zwraca listę błędów walidacji atrybutów wg reguły. */
export function validateAttributes(rule: ResolvedRule, a: LotAttrs): string[] {
  const errors: string[] = [];
  for (const attr of rule.requiredAttributes) {
    if (attr === "length" && !(a.lengthMm && a.lengthMm > 0))
      errors.push("brak długości (mm)");
    if (attr === "color" && !a.colorCode?.trim()) errors.push("brak koloru");
    if (attr === "lot" && !a.heatNumber?.trim())
      errors.push("brak numeru partii/wytopu");
    if (attr === "certificate" && !a.certificateStorageId)
      errors.push("brak atestu (plik)");
  }
  return errors;
}

// ─── Pomocnicze ─────────────────────────────────────────────────────────────

export function isPositiveInt(n: number) {
  return Number.isInteger(n) && n > 0;
}

export function lotTotalMb(lengthMm: number | undefined, pieces: number) {
  if (!lengthMm) return 0;
  return (lengthMm * pieces) / 1000;
}

async function kgPerMbFor(ctx: QueryCtx, materialId: Id<"materials">) {
  const p = await ctx.db
    .query("wms_material_profiles")
    .withIndex("by_material", (q) => q.eq("materialId", materialId))
    .unique();
  return p?.kgPerMb;
}

function statusForZone(zone: ZoneType): LotStatus {
  if (zone === "BUFOR_PRODUKCYJNY") return "IN_PROGRESS";
  return "AVAILABLE";
}

async function nextNumber(ctx: MutationCtx, type: DocType, now: number) {
  const year = new Date(now).getFullYear();
  const key = `${type}/${year}`;
  const counter = await ctx.db
    .query("wms_counters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  let value = 1;
  if (counter) {
    value = counter.value + 1;
    await ctx.db.patch(counter._id, { value });
  } else {
    await ctx.db.insert("wms_counters", { key, value });
  }
  return `${key}/${String(value).padStart(4, "0")}`;
}

type MovementInput = {
  documentId?: Id<"wms_documents">;
  lineId?: Id<"wms_document_lines">;
  lotId: Id<"wms_lots">;
  categoryId?: Id<"wms_categories">;
  objectId?: Id<"wms_objects">;
  type: Doc<"wms_movements">["type"];
  quantityDelta: number;
  quantityPieces: number;
  lengthMm?: number;
  fromLocationId?: Id<"wms_locations">;
  toLocationId?: Id<"wms_locations">;
  note?: string;
  operatorId: Id<"users">;
  idempotencyKey: string;
};

async function insertMovement(ctx: MutationCtx, m: MovementInput) {
  const dup = await ctx.db
    .query("wms_movements")
    .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", m.idempotencyKey))
    .first();
  if (dup) throw new Error("Ruch został już zarejestrowany (idempotencja).");
  return ctx.db.insert("wms_movements", { ...m, createdAt: Date.now() });
}

/** Ostrzeżenia (nie błędy) o przekroczeniu nośności / długości lokalizacji. */
async function locationWarnings(
  ctx: QueryCtx,
  loc: Doc<"wms_locations">,
  materialId: Id<"materials">,
  lengthMm: number | undefined,
  pieces: number,
  weightKg?: number,
): Promise<string[]> {
  const warnings: string[] = [];
  if (lengthMm && loc.maxLengthMm && lengthMm > loc.maxLengthMm) {
    warnings.push(
      `${loc.code}: długość ${lengthMm} mm przekracza maks. ${loc.maxLengthMm} mm.`,
    );
  }
  if (loc.maxWeightKg) {
    const inLoc = await ctx.db
      .query("wms_lots")
      .withIndex("by_location", (q) => q.eq("locationId", loc._id))
      .collect();
    let current = 0;
    for (const l of inLoc) {
      if (l.status === "DEPLETED") continue;
      if (l.weightKg) {
        current += l.weightKg;
      } else {
        const k = await kgPerMbFor(ctx, l.materialId);
        if (k && l.lengthMm) current += lotTotalMb(l.lengthMm, l.quantityPieces) * k;
      }
    }
    let incoming = weightKg ?? 0;
    if (!incoming) {
      const k = await kgPerMbFor(ctx, materialId);
      if (k && lengthMm) incoming = lotTotalMb(lengthMm, pieces) * k;
    }
    if (current + incoming > loc.maxWeightKg) {
      warnings.push(
        `${loc.code}: obciążenie ${(current + incoming).toFixed(0)} kg przekroczy maks. ${loc.maxWeightKg} kg.`,
      );
    }
  }
  return warnings;
}

async function activeLocation(ctx: QueryCtx, id: Id<"wms_locations"> | undefined) {
  if (!id) throw new Error("Nie wskazano lokalizacji.");
  const loc = await ctx.db.get(id);
  if (!loc) throw new Error("Lokalizacja nie istnieje.");
  if (!loc.isActive) throw new Error(`Lokalizacja ${loc.code} jest nieaktywna.`);
  return loc;
}

// ─── Dokumenty ──────────────────────────────────────────────────────────────

export async function createDocument(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    type: DocType;
    supplier?: string;
    externalDocNumber?: string;
    expectedBundles?: number;
    targetNote?: string;
    notes?: string;
  },
) {
  const now = Date.now();
  const number = await nextNumber(ctx, args.type, now);
  const id = await ctx.db.insert("wms_documents", {
    ...args,
    number,
    status: "DRAFT",
    createdBy: userId,
    createdAt: now,
  });
  return { id, number };
}

export async function cancelDraft(ctx: MutationCtx, documentId: Id<"wms_documents">) {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Dokument nie istnieje.");
  if (doc.status !== "DRAFT")
    throw new Error("Anulować można tylko dokument w statusie DRAFT.");
  await ctx.db.patch(documentId, { status: "ANULOWANY" });
}

type MoveOpts = {
  ctx: MutationCtx;
  userId: Id<"users">;
  doc: Doc<"wms_documents">;
  line: Doc<"wms_document_lines">;
  lot: Doc<"wms_lots">;
  qty: number;
  toLoc: Doc<"wms_locations">;
  newStatus: LotStatus;
};

/** Przesuwa całość partii albo wydziela jej część do nowej partii. */
async function moveLot(o: MoveOpts) {
  const { ctx, userId, doc, line, lot, qty, toLoc, newStatus } = o;
  const now = Date.now();
  const base = {
    documentId: doc._id,
    lineId: line._id,
    type: doc.type as "RW",
    quantityPieces: qty,
    lengthMm: lot.lengthMm,
    fromLocationId: lot.locationId,
    toLocationId: toLoc._id,
    operatorId: userId,
  };

  if (qty === lot.quantityPieces) {
    await ctx.db.patch(lot._id, {
      locationId: toLoc._id,
      status: newStatus,
      updatedAt: now,
    });
    await insertMovement(ctx, {
      ...base,
      lotId: lot._id,
      quantityDelta: 0,
      idempotencyKey: `${doc._id}:${line._id}:move`,
    });
    return lot._id;
  }

  await ctx.db.patch(lot._id, {
    quantityPieces: lot.quantityPieces - qty,
    updatedAt: now,
  });
  await insertMovement(ctx, {
    ...base,
    lotId: lot._id,
    quantityDelta: -qty,
    idempotencyKey: `${doc._id}:${line._id}:out`,
  });
  const newLotId = await ctx.db.insert("wms_lots", {
    materialId: lot.materialId,
    categoryId: lot.categoryId,
    objectId: lot.objectId,
    kind: lot.kind,
    lengthMm: lot.lengthMm,
    widthMm: lot.widthMm,
    heightMm: lot.heightMm,
    thicknessMm: lot.thicknessMm,
    weightKg: lot.weightKg ? (lot.weightKg / lot.quantityPieces) * qty : undefined,
    colorCode: lot.colorCode,
    surfaceType: lot.surfaceType,
    heatNumber: lot.heatNumber,
    certificateStorageId: lot.certificateStorageId,
    certificateName: lot.certificateName,
    ssccCode: undefined,
    customAttributes: lot.customAttributes,
    quantityPieces: qty,
    locationId: toLoc._id,
    status: newStatus,
    parentLotId: lot._id,
    receivedByDocumentId: lot.receivedByDocumentId,
    createdAt: now,
    updatedAt: now,
  });
  await insertMovement(ctx, {
    ...base,
    lotId: newLotId,
    quantityDelta: qty,
    idempotencyKey: `${doc._id}:${line._id}:in`,
  });
  return newLotId;
}

/**
 * Zatwierdza dokument w jednej transakcji Convex: walidacja → ruchy → stany partii.
 * Zwraca ostrzeżenia (np. przekroczenie nośności), które nie blokują zatwierdzenia.
 */
export async function approveDocument(
  ctx: MutationCtx,
  userId: Id<"users">,
  documentId: Id<"wms_documents">,
): Promise<{ warnings: string[] }> {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Dokument nie istnieje.");
  if (doc.status !== "DRAFT")
    throw new Error("Dokument został już zatwierdzony lub anulowany.");
  const lines = await ctx.db
    .query("wms_document_lines")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  if (lines.length === 0) throw new Error("Dokument nie ma żadnych pozycji.");

  const warnings: string[] = [];
  const now = Date.now();

  for (const [idx, line] of lines.entries()) {
    const tag = `Poz. ${idx + 1}`;

    if (doc.type === "PZ") {
      if (!line.materialId) throw new Error(`${tag}: wybierz materiał.`);
      if (!isPositiveInt(line.quantityPieces))
        throw new Error(`${tag}: ilość sztuk musi być dodatnią liczbą całkowitą.`);
      const disposition = line.damage?.disposition;
      if (disposition === "REJECT") continue; // odrzucone — bez wejścia na stan
      const toLoc = await activeLocation(ctx, line.toLocationId);

      const material = await ctx.db.get(line.materialId);
      if (!material) throw new Error(`${tag}: materiał nie istnieje.`);

      // Pobierz obiekt i kategorię magazynową
      let obj: Doc<"wms_objects"> | null = null;
      if (line.objectId) {
        obj = await ctx.db.get(line.objectId);
      } else if (material.wmsObjectId) {
        obj = await ctx.db.get(material.wmsObjectId);
      }

      let category: Doc<"wms_categories"> | null = null;
      if (obj) {
        category = await ctx.db.get(obj.categoryId);
      } else if (material.wmsCategoryId) {
        category = await ctx.db.get(material.wmsCategoryId);
      } else if (material.category) {
        category = await ctx.db
          .query("wms_categories")
          .withIndex("by_code", (q) => q.eq("code", material.category.toUpperCase()))
          .first();
      }

      const fc = obj?.fieldsConfig ?? category?.fieldsConfig;
      const customDefs = obj?.customFields ?? category?.customFields;

      if (fc) {
        // Dynamiczna walidacja pól na podstawie konfiguracji obiektu/kategorii
        const errs: string[] = [];
        if (fc.lengthMm?.enabled && fc.lengthMm?.required && !(line.lengthMm && line.lengthMm > 0)) {
          errs.push(`brak wymaganej długości (${fc.lengthMm.label || "Długość"})`);
        }
        if (fc.widthMm?.enabled && fc.widthMm?.required && !(line.widthMm && line.widthMm > 0)) {
          errs.push(`brak wymaganej szerokości (${fc.widthMm.label || "Szerokość"})`);
        }
        if (fc.heightMm?.enabled && fc.heightMm?.required && !(line.heightMm && line.heightMm > 0)) {
          errs.push(`brak wymaganej wysokości (${fc.heightMm.label || "Wysokość"})`);
        }
        if (fc.thicknessMm?.enabled && fc.thicknessMm?.required && !(line.thicknessMm && line.thicknessMm > 0)) {
          errs.push(`brak wymaganej grubości (${fc.thicknessMm.label || "Grubość"})`);
        }
        if (fc.weightKg?.enabled && fc.weightKg?.required && !(line.weightKg && line.weightKg > 0)) {
          errs.push(`brak wymaganej masy (${fc.weightKg.label || "Masa kg"})`);
        }
        if (fc.color?.enabled && fc.color?.required && !line.colorCode?.trim()) {
          errs.push(`brak wymaganego koloru (${fc.color.label || "Kolor"})`);
        }
        if (fc.surfaceType?.enabled && fc.surfaceType?.required && !line.surfaceType) {
          errs.push(`brak wymaganego typu powłoki (${fc.surfaceType.label || "Powłoka"})`);
        }
        if (fc.heatNumber?.enabled && fc.heatNumber?.required && !line.heatNumber?.trim()) {
          errs.push(`brak wymaganego numeru partii/wytopu (${fc.heatNumber.label || "Partia / Wytop"})`);
        }
        if (fc.certificate?.enabled && fc.certificate?.required && !line.certificateStorageId) {
          errs.push(`brak wymaganego atestu (${fc.certificate.label || "Atest 3.1"})`);
        }
        if (fc.sscc?.enabled && fc.sscc?.required && !line.ssccCode?.trim()) {
          errs.push(`brak wymaganego kodu SSCC (${fc.sscc.label || "Kod SSCC"})`);
        }
        if (customDefs && customDefs.length > 0) {
          for (const cf of customDefs) {
            if (cf.required) {
              const val = (line.customAttributes as Record<string, unknown> | undefined)?.[cf.key];
              if (val === undefined || val === null || String(val).trim() === "") {
                errs.push(`brak wymaganego pola: ${cf.label}`);
              }
            }
          }
        }
        if (errs.length) throw new Error(`${tag}: ${errs.join(", ")}.`);
      } else {
        const rule = await resolveTrackingRule(ctx, line.materialId, toLoc.zone);
        if (rule.trackingMode === "NONE")
          throw new Error(`${tag}: indeks nie podlega ewidencji w WMS.`);
        const errs = validateAttributes(rule, line);
        if (errs.length) throw new Error(`${tag}: ${errs.join(", ")}.`);
      }

      warnings.push(
        ...(await locationWarnings(ctx, toLoc, line.materialId, line.lengthMm, line.quantityPieces, line.weightKg)),
      );

      const status: LotStatus = statusForZone(toLoc.zone);
      const lotId = await ctx.db.insert("wms_lots", {
        materialId: line.materialId,
        categoryId: category?._id,
        objectId: obj?._id,
        kind: line.kind,
        lengthMm: line.lengthMm,
        widthMm: line.widthMm,
        heightMm: line.heightMm,
        thicknessMm: line.thicknessMm,
        weightKg: line.weightKg,
        colorCode: line.colorCode,
        surfaceType: line.surfaceType,
        heatNumber: line.heatNumber,
        certificateStorageId: line.certificateStorageId,
        certificateName: line.certificateName,
        ssccCode: line.ssccCode,
        customAttributes: line.customAttributes,
        quantityPieces: line.quantityPieces,
        locationId: toLoc._id,
        status,
        receivedByDocumentId: doc._id,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(line._id, { lotId });
      await insertMovement(ctx, {
        documentId: doc._id,
        lineId: line._id,
        lotId,
        objectId: obj?._id,
        type: "PZ",
        quantityDelta: line.quantityPieces,
        quantityPieces: line.quantityPieces,
        lengthMm: line.lengthMm,
        toLocationId: toLoc._id,
        operatorId: userId,
        idempotencyKey: `${doc._id}:${line._id}:pz`,
      });
    } else if (doc.type === "RW") {
      if (!line.lotId) throw new Error(`${tag}: wybierz partię.`);
      if (!isPositiveInt(line.quantityPieces))
        throw new Error(`${tag}: ilość sztuk musi być dodatnią liczbą całkowitą.`);
      const lot = await ctx.db.get(line.lotId);
      if (!lot) throw new Error(`${tag}: partia nie istnieje.`);
      if (lot.status === "DEPLETED")
        throw new Error(`${tag}: partia jest wyczerpana.`);
      if (line.quantityPieces > lot.quantityPieces)
        throw new Error(
          `${tag}: ilość (${line.quantityPieces}) większa niż stan partii (${lot.quantityPieces}).`,
        );
      const toLoc = await activeLocation(ctx, line.toLocationId);

      if (lot.status === "IN_PROGRESS")
        throw new Error(`${tag}: partia jest już w buforze produkcyjnym.`);
      const hasBufferZone =
        (await ctx.db
          .query("wms_locations")
          .withIndex("by_zone", (q) => q.eq("zone", "BUFOR_PRODUKCYJNY"))
          .first()) !== null;
      if (hasBufferZone && toLoc.zone !== "BUFOR_PRODUKCYJNY")
        throw new Error(`${tag}: RW wymaga lokalizacji w strefie bufora produkcyjnego.`);
      warnings.push(
        ...(await locationWarnings(ctx, toLoc, lot.materialId, lot.lengthMm, line.quantityPieces, lot.weightKg)),
      );
      await moveLot({ ctx, userId, doc, line, lot, qty: line.quantityPieces, toLoc, newStatus: "IN_PROGRESS" });
      await ctx.db.patch(line._id, { fromLocationId: lot.locationId });
    } else {
      // KOREKTA: quantityPieces = różnica ze znakiem
      if (!line.lotId) throw new Error(`${tag}: wybierz partię.`);
      if (!Number.isInteger(line.quantityPieces) || line.quantityPieces === 0)
        throw new Error(`${tag}: różnica musi być niezerową liczbą całkowitą.`);
      const lot = await ctx.db.get(line.lotId);
      if (!lot) throw new Error(`${tag}: partia nie istnieje.`);
      const newQty = lot.quantityPieces + line.quantityPieces;
      if (newQty < 0)
        throw new Error(`${tag}: korekta zszedłaby poniżej zera (stan ${lot.quantityPieces}).`);
      const loc = await ctx.db.get(lot.locationId);
      let status: LotStatus = lot.status;
      if (newQty === 0) status = "DEPLETED";
      else if (lot.status === "DEPLETED") status = loc ? statusForZone(loc.zone) : "AVAILABLE";
      await ctx.db.patch(lot._id, { quantityPieces: newQty, status, updatedAt: now });
      await insertMovement(ctx, {
        documentId: doc._id,
        lineId: line._id,
        lotId: lot._id,
        type: "KOREKTA",
        quantityDelta: line.quantityPieces,
        quantityPieces: Math.abs(line.quantityPieces),
        lengthMm: lot.lengthMm,
        fromLocationId: lot.locationId,
        toLocationId: lot.locationId,
        note: line.note,
        operatorId: userId,
        idempotencyKey: `${doc._id}:${line._id}:korekta`,
      });
    }
  }

  await ctx.db.patch(documentId, {
    status: "ZATWIERDZONY",
    approvedBy: userId,
    approvedAt: now,
  });
  return { warnings };
}

// ─── Inwentaryzacja ─────────────────────────────────────────────────────────

export async function openInventorySession(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { name: string; locationId?: Id<"wms_locations"> },
) {
  if (!args.name.trim()) throw new Error("Podaj nazwę inwentaryzacji.");
  const now = Date.now();
  const lots = args.locationId
    ? await ctx.db
        .query("wms_lots")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId!))
        .collect()
    : await ctx.db.query("wms_lots").collect();
  const countable = lots.filter((l) => l.status !== "DEPLETED");
  const sessionId = await ctx.db.insert("wms_inventory_sessions", {
    name: args.name.trim(),
    locationId: args.locationId,
    status: "OPEN",
    createdBy: userId,
    createdAt: now,
  });
  for (const l of countable) {
    await ctx.db.insert("wms_inventory_counts", {
      sessionId,
      lotId: l._id,
      expectedPieces: l.quantityPieces,
    });
  }
  return sessionId;
}

export async function recordCount(
  ctx: MutationCtx,
  userId: Id<"users">,
  countId: Id<"wms_inventory_counts">,
  countedPieces: number | null,
) {
  const c = await ctx.db.get(countId);
  if (!c) throw new Error("Pozycja nie istnieje.");
  const session = await ctx.db.get(c.sessionId);
  if (!session || session.status !== "OPEN")
    throw new Error("Sesja inwentaryzacji jest zamknięta.");
  if (countedPieces !== null && (!Number.isInteger(countedPieces) || countedPieces < 0))
    throw new Error("Policzona ilość musi być liczbą całkowitą ≥ 0.");
  await ctx.db.patch(countId, {
    countedPieces: countedPieces ?? undefined,
    countedBy: countedPieces === null ? undefined : userId,
    countedAt: countedPieces === null ? undefined : Date.now(),
  });
}

/** Zamyka sesję; różnice (policzono ≠ stan systemowy) tworzą i zatwierdzają KOREKTĘ. */
export async function closeInventorySession(
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId: Id<"wms_inventory_sessions">,
) {
  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Sesja nie istnieje.");
  if (session.status !== "OPEN") throw new Error("Sesja jest już zamknięta.");
  const counts = await ctx.db
    .query("wms_inventory_counts")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  const diffs: { lotId: Id<"wms_lots">; delta: number }[] = [];
  for (const c of counts) {
    if (c.countedPieces === undefined) continue;
    const lot = await ctx.db.get(c.lotId);
    if (!lot) continue;
    const delta = c.countedPieces - lot.quantityPieces;
    if (delta !== 0) diffs.push({ lotId: c.lotId, delta });
  }

  let correctionDocumentId: Id<"wms_documents"> | undefined;
  if (diffs.length > 0) {
    const { id } = await createDocument(ctx, userId, {
      type: "KOREKTA",
      notes: `Inwentaryzacja: ${session.name}`,
    });
    for (const d of diffs) {
      await ctx.db.insert("wms_document_lines", {
        documentId: id,
        lotId: d.lotId,
        quantityPieces: d.delta,
        note: `Inwentaryzacja: ${session.name}`,
      });
    }
    await approveDocument(ctx, userId, id);
    correctionDocumentId = id;
  }
  await ctx.db.patch(sessionId, {
    status: "CLOSED",
    closedAt: Date.now(),
    correctionDocumentId,
  });
  return { correctionDocumentId, differences: diffs.length };
}

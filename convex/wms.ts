import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  approveDocument,
  cancelDraft,
  closeInventorySession,
  createDocument,
  deleteDocumentCore,
  lotTotalMb,
  openInventorySession,
  recordCount,
  resolveTrackingRule,
} from "./_lib/wmsCore";

// ─── Wspólne walidatory ─────────────────────────────────────────────────────

const trackingMode = v.union(
  v.literal("STRICT"),
  v.literal("QUANTITY"),
  v.literal("NONE"),
);
const zone = v.union(
  v.literal("MAGAZYN_GLOWNY"),
  v.literal("BUFOR_PRODUKCYJNY"),
  v.literal("KWARANTANNA"),
  v.literal("STREFA_SPADOW"),
);
const locationType = v.union(
  v.literal("CANTILEVER"),
  v.literal("SHELF"),
  v.literal("FLOOR"),
);
const lotKind = v.union(
  v.literal("BAR_BUNDLE"),
  v.literal("BAR"),
  v.literal("REMNANT"),
);
const surfaceType = v.union(
  v.literal("MILL"),
  v.literal("RAL"),
  v.literal("ANODA"),
  v.literal("BICOLOR"),
);
const docType = v.union(
  v.literal("PZ"),
  v.literal("RW"),
  v.literal("MM"),
  v.literal("KOREKTA"),
);
const damage = v.object({
  description: v.string(),
  positionMm: v.optional(v.number()),
  disposition: v.union(
    v.literal("ACCEPT"),
    v.literal("QUALITY_HOLD"),
    v.literal("REJECT"),
  ),
});

async function requireUser(ctx: { auth: QueryCtx["auth"] }) {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("Niezalogowany użytkownik.");
  return userId as Id<"users">;
}

export const DEFAULT_WMS_CATEGORIES = [
  {
    code: "PROFILE",
    name: "Profile aluminiowe",
    description: "Profile surowe, lakierowane i anodowane w sztangach lub wiązkach",
  },
  {
    code: "GLASS",
    name: "Szyby zespolone",
    description: "Szyby zespolone, pakiety 2- i 3-szybowe docinane na wymiar",
  },
  {
    code: "HARDWARE",
    name: "Okucia i zamki",
    description: "Zasuwnice, zawiasy, klamki, samozamykacze i automatyka",
  },
  {
    code: "SEALS",
    name: "Uszczelki",
    description: "Uszczelki przyszybowe, przymykowe, centralne w rolkach",
  },
  {
    code: "SHEETS",
    name: "Blachy i panele",
    description: "Arkusze blach aluminiowych, stalowych i paneli kompozytowych",
  },
  {
    code: "ACCESSORIES",
    name: "Drobne akcesoria / wkręty",
    description: "Wkręty, kołki, łączniki, piany, kleje",
  },
];

export const DEFAULT_WMS_OBJECTS = [
  {
    categoryCode: "PROFILE",
    code: "PROCURAL",
    name: "Procural",
    defaultUnit: "mb.",
    description: "Systemy profili aluminiowych Procural (dawniej Ponzio), np. PE50, PE68",
    fieldsConfig: {
      lengthMm: { enabled: true, required: false, label: "Długość handlowa (mm)" },
      widthMm: { enabled: false, required: false },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: false, required: false },
      weightKg: { enabled: true, required: false, label: "Masa sztangi / wiązki (kg)" },
    },
    customFields: [],
  },
  {
    categoryCode: "PROFILE",
    code: "ALUPROF",
    name: "Aluprof",
    defaultUnit: "mb.",
    description: "Systemy profili aluminiowych Aluprof, np. MB-86N, MB-79N",
    fieldsConfig: {
      lengthMm: { enabled: true, required: false, label: "Długość handlowa (mm)" },
      widthMm: { enabled: false, required: false },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: false, required: false },
      weightKg: { enabled: true, required: false, label: "Masa sztangi / wiązki (kg)" },
    },
    customFields: [],
  },
  {
    categoryCode: "HARDWARE",
    code: "ROTO",
    name: "Roto",
    defaultUnit: "kpl.",
    description: "Okucia i zasuwnice Roto (np. Roto NX)",
    fieldsConfig: {
      lengthMm: { enabled: false, required: false },
      widthMm: { enabled: false, required: false },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: false, required: false },
      weightKg: { enabled: false, required: false },
    },
    customFields: [
      { key: "side", label: "Strona (L/P)", type: "select" as const, options: ["Uniwersalna", "Lewa (L)", "Prawa (P)"], required: false },
    ],
  },
  {
    categoryCode: "GLASS",
    code: "PILKINGTON",
    name: "Pilkington",
    defaultUnit: "m²",
    description: "Szyby zespolone i formatki szklane",
    fieldsConfig: {
      lengthMm: { enabled: false, required: false },
      widthMm: { enabled: true, required: false, label: "Szerokość (mm)" },
      heightMm: { enabled: true, required: false, label: "Wysokość (mm)" },
      thicknessMm: { enabled: true, required: false, label: "Grubość pakietu (mm)" },
      weightKg: { enabled: true, required: false, label: "Masa pakietu (kg)" },
    },
    customFields: [
      { key: "glazingType", label: "Budowa pakietu (np. 4/16/4)", type: "text" as const, required: false },
    ],
  },
  {
    categoryCode: "SEALS",
    code: "SEAL_ROLL",
    name: "Rolka uszczelek",
    defaultUnit: "mb.",
    description: "Uszczelki przyszybowe, przymykowe, centralne w rolkach",
    fieldsConfig: {
      lengthMm: { enabled: true, required: true, label: "Długość w rolce (mb. lub mm)" },
      widthMm: { enabled: false, required: false },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: false, required: false },
      weightKg: { enabled: false, required: false },
    },
    customFields: [],
  },
  {
    categoryCode: "SHEETS",
    code: "SHEET_PANEL",
    name: "Arkusz blachy",
    defaultUnit: "m²",
    description: "Arkusze blach aluminiowych, stalowych i paneli kompozytowych",
    fieldsConfig: {
      lengthMm: { enabled: true, required: true, label: "Długość arkusza (mm)" },
      widthMm: { enabled: true, required: true, label: "Szerokość arkusza (mm)" },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: true, required: true, label: "Grubość blachy (mm)" },
      weightKg: { enabled: true, required: false, label: "Masa arkusza (kg)" },
    },
    customFields: [],
  },
  {
    categoryCode: "ACCESSORIES",
    code: "ACCESSORY_PACK",
    name: "Opakowanie / Paczka",
    defaultUnit: "op.",
    description: "Wkręty, kołki, łączniki, piany, kleje",
    fieldsConfig: {
      lengthMm: { enabled: false, required: false },
      widthMm: { enabled: false, required: false },
      heightMm: { enabled: false, required: false },
      thicknessMm: { enabled: false, required: false },
      weightKg: { enabled: false, required: false },
    },
    customFields: [
      { key: "packageQty", label: "Ilość w opakowaniu (np. 100, 500 szt.)", type: "text" as const, required: false },
    ],
  },
];

async function materialMap(ctx: QueryCtx) {
  const mats = await ctx.db.query("materials").collect();
  return new Map(mats.map((m) => [m._id, m]));
}
async function locationMap(ctx: QueryCtx) {
  const locs = await ctx.db.query("wms_locations").collect();
  return new Map(locs.map((l) => [l._id, l]));
}
async function profileMap(ctx: QueryCtx) {
  const ps = await ctx.db.query("wms_material_profiles").collect();
  return new Map(ps.map((p) => [p.materialId, p]));
}
async function categoryMap(ctx: QueryCtx) {
  const cats = await ctx.db.query("wms_categories").collect();
  return new Map(cats.map((c) => [c._id, c]));
}
async function objectMap(ctx: QueryCtx) {
  const objs = await ctx.db.query("wms_objects").collect();
  return new Map(objs.map((o) => [o._id, o]));
}

async function enrichLots(ctx: QueryCtx, lots: Doc<"wms_lots">[]) {
  const [mats, locs, profiles, cats, objs] = await Promise.all([
    materialMap(ctx),
    locationMap(ctx),
    profileMap(ctx),
    categoryMap(ctx),
    objectMap(ctx),
  ]);
  const catsByCode = new Map(Array.from(cats.values()).map((c) => [c.code, c]));

  return Promise.all(
    lots.map(async (l) => {
      const m = mats.get(l.materialId);
      const loc = l.locationId ? locs.get(l.locationId) : undefined;
      const cat = l.categoryId
        ? cats.get(l.categoryId)
        : (m?.wmsCategoryId ? cats.get(m.wmsCategoryId) : (m?.category ? catsByCode.get(m.category.toUpperCase()) : null));
      const obj = l.objectId
        ? objs.get(l.objectId)
        : (m?.wmsObjectId ? objs.get(m.wmsObjectId) : null);

      const kg = profiles.get(l.materialId)?.kgPerMb;
      const totalMb = lotTotalMb(l.lengthMm, l.quantityPieces);
      const calcWeightKg = l.weightKg ?? (kg && l.lengthMm ? totalMb * kg : undefined);

      let dimensionsSummary = "—";
      if (l.widthMm && l.heightMm) {
        dimensionsSummary = `${l.widthMm} × ${l.heightMm}${l.thicknessMm ? ` × ${l.thicknessMm}` : ""} mm`;
      } else if (l.lengthMm && l.widthMm) {
        dimensionsSummary = `${l.lengthMm} × ${l.widthMm}${l.thicknessMm ? ` × ${l.thicknessMm}` : ""} mm`;
      } else if (l.lengthMm) {
        dimensionsSummary = `${l.lengthMm} mm`;
      }

      return {
        ...l,
        materialName: m?.name ?? "—",
        materialSku: m?.sku,
        categoryName: cat?.name ?? m?.category ?? "Inne",
        objectName: obj?.name ?? cat?.objectName ?? "Sztuka",
        categoryCode: cat?.code,
        unit: obj?.defaultUnit ?? cat?.defaultUnit ?? m?.unit ?? "szt.",
        dimensionsSummary,
        locationCode: loc?.name ?? loc?.code ?? "—",
        locationName: loc?.name ?? loc?.code ?? "—",
        zone: loc?.zone,
        totalMb,
        weightKg: calcWeightKg,
        certificateUrl: l.certificateStorageId
          ? await ctx.storage.getUrl(l.certificateStorageId)
          : null,
      };
    }),
  );
}

// ─── Kategorie i obiekty magazynowe ─────────────────────────────────────────

const categoryFieldsConfig = v.object({
  lengthMm: v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) }),
  widthMm: v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) }),
  heightMm: v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) }),
  thicknessMm: v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) }),
  weightKg: v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) }),
  color: v.optional(v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) })),
  surfaceType: v.optional(v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) })),
  heatNumber: v.optional(v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) })),
  certificate: v.optional(v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) })),
  sscc: v.optional(v.object({ enabled: v.boolean(), required: v.boolean(), label: v.optional(v.string()) })),
});

const customFieldDef = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(v.literal("text"), v.literal("number"), v.literal("select")),
  options: v.optional(v.array(v.string())),
  required: v.boolean(),
});

export const listCategories = query({
  args: { onlyActive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [categories, objects] = await Promise.all([
      ctx.db.query("wms_categories").collect(),
      ctx.db.query("wms_objects").collect(),
    ]);

    const objCountByCat = new Map<string, number>();
    for (const obj of objects) {
      if (!args.onlyActive || obj.isActive) {
        objCountByCat.set(obj.categoryId, (objCountByCat.get(obj.categoryId) ?? 0) + 1);
      }
    }

    return categories
      .filter((c) => !args.onlyActive || c.isActive)
      .map((c) => ({
        ...c,
        objectCount: objCountByCat.get(c._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  },
});

export const getCategory = query({
  args: { id: v.id("wms_categories") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return null;
    return ctx.db.get(id);
  },
});

export const upsertCategory = mutation({
  args: {
    id: v.optional(v.id("wms_categories")),
    name: v.string(),
    code: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    // Opcjonalne pola zachowane dla kompatybilności wstecznej:
    objectName: v.optional(v.string()),
    defaultUnit: v.optional(v.string()),
    fieldsConfig: v.optional(categoryFieldsConfig),
    customFields: v.optional(v.array(customFieldDef)),
  },
  handler: async (ctx, { id, code, ...rest }) => {
    await requireUser(ctx);
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) throw new Error("Kod kategorii jest wymagany.");
    if (!rest.name.trim()) throw new Error("Nazwa kategorii jest wymagana.");

    const existingByCode = await ctx.db
      .query("wms_categories")
      .withIndex("by_code", (q) => q.eq("code", cleanCode))
      .first();
    if (existingByCode && (!id || existingByCode._id !== id)) {
      throw new Error(`Kategoria z kodem "${cleanCode}" już istnieje.`);
    }

    const now = Date.now();
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing) throw new Error("Kategoria nie istnieje.");
      await ctx.db.patch(id, {
        code: cleanCode,
        ...rest,
        updatedAt: now,
      });
      return id;
    }

    return ctx.db.insert("wms_categories", {
      code: cleanCode,
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("wms_categories") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Grupa towarowa nie istnieje.");

    // Sprawdź czy kategoria lub jej podrzędne systemy mają jakiekolwiek partie na stanie
    const lot = await ctx.db
      .query("wms_lots")
      .withIndex("by_category", (q) => q.eq("categoryId", id))
      .first();

    const objs = await ctx.db
      .query("wms_objects")
      .withIndex("by_category", (q) => q.eq("categoryId", id))
      .collect();

    let hasLotsInObjects = false;
    for (const obj of objs) {
      const objLot = await ctx.db
        .query("wms_lots")
        .withIndex("by_object", (q) => q.eq("objectId", obj._id))
        .first();
      if (objLot) {
        hasLotsInObjects = true;
        break;
      }
    }

    if (lot || hasLotsInObjects) {
      await ctx.db.patch(id, { isActive: false, updatedAt: Date.now() });
      return { deactivated: true, hasLots: true };
    }

    // Brak partii w magazynie — usuń podrzędne puste systemy / obiekty
    for (const obj of objs) {
      await ctx.db.delete(obj._id);
    }

    // Odłącz materiały powiązane z tą grupą
    const mats = await ctx.db.query("materials").collect();
    for (const m of mats) {
      if (m.wmsCategoryId === id) {
        await ctx.db.patch(m._id, {
          wmsCategoryId: undefined,
          wmsObjectId: undefined,
        });
      }
    }

    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const listObjects = query({
  args: {
    categoryId: v.optional(v.id("wms_categories")),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [objs, cats] = await Promise.all([
      ctx.db.query("wms_objects").collect(),
      categoryMap(ctx),
    ]);

    return objs
      .filter((o) => {
        if (args.categoryId && o.categoryId !== args.categoryId) return false;
        if (args.onlyActive && !o.isActive) return false;
        return true;
      })
      .map((o) => {
        const cat = cats.get(o.categoryId);
        return {
          ...o,
          categoryName: cat?.name ?? "—",
          categoryCode: cat?.code ?? "—",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  },
});

export const getObject = query({
  args: { id: v.id("wms_objects") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return null;
    return ctx.db.get(id);
  },
});

export const upsertObject = mutation({
  args: {
    id: v.optional(v.id("wms_objects")),
    categoryId: v.id("wms_categories"),
    name: v.string(),
    code: v.optional(v.string()),
    defaultUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    fieldsConfig: categoryFieldsConfig,
    customFields: v.optional(v.array(customFieldDef)),
    isActive: v.boolean(),
  },
  handler: async (ctx, { id, categoryId, name, defaultUnit, ...rest }) => {
    await requireUser(ctx);
    const cat = await ctx.db.get(categoryId);
    if (!cat) throw new Error("Kategoria nadrzędna nie istnieje.");
    if (!name.trim()) throw new Error("Nazwa obiektu magazynowego jest wymagana.");
    const cleanUnit = (defaultUnit || "szt.").trim() || "szt.";

    const now = Date.now();
    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing) throw new Error("Obiekt magazynowy nie istnieje.");
      await ctx.db.patch(id, {
        categoryId,
        name: name.trim(),
        defaultUnit: cleanUnit,
        ...rest,
        updatedAt: now,
      });
      return id;
    }

    return ctx.db.insert("wms_objects", {
      categoryId,
      name: name.trim(),
      defaultUnit: cleanUnit,
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteObject = mutation({
  args: { id: v.id("wms_objects") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const obj = await ctx.db.get(id);
    if (!obj) throw new Error("System / podgrupa nie istnieje.");
    const lot = await ctx.db
      .query("wms_lots")
      .withIndex("by_object", (q) => q.eq("objectId", id))
      .first();
    if (lot) {
      await ctx.db.patch(id, { isActive: false, updatedAt: Date.now() });
      return { deactivated: true, hasLots: true };
    }

    // Odłącz materiały powiązane z tym systemem
    const mats = await ctx.db.query("materials").collect();
    for (const m of mats) {
      if (m.wmsObjectId === id) {
        await ctx.db.patch(m._id, { wmsObjectId: undefined });
      }
    }

    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const seedDefaultCategories = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    let catsInserted = 0;
    let objsInserted = 0;
    const now = Date.now();

    // 1. Dodaj brakujące kategorie nadrzędne
    const catIdByCode = new Map<string, Id<"wms_categories">>();
    for (const cat of DEFAULT_WMS_CATEGORIES) {
      const existing = await ctx.db
        .query("wms_categories")
        .withIndex("by_code", (q) => q.eq("code", cat.code))
        .first();
      if (!existing) {
        const id = await ctx.db.insert("wms_categories", {
          ...cat,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        catIdByCode.set(cat.code, id);
        catsInserted++;
      } else {
        catIdByCode.set(cat.code, existing._id);
      }
    }

    // 2. Dodaj domyślne obiekty magazynowe pod kategoriami
    for (const defObj of DEFAULT_WMS_OBJECTS) {
      const categoryId = catIdByCode.get(defObj.categoryCode);
      if (!categoryId) continue;

      const existingObjs = await ctx.db
        .query("wms_objects")
        .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
        .collect();
      const alreadyHas = existingObjs.some(
        (o) => o.name === defObj.name || (defObj.code && o.code === defObj.code),
      );
      if (!alreadyHas) {
        await ctx.db.insert("wms_objects", {
          name: defObj.name,
          code: defObj.code,
          defaultUnit: defObj.defaultUnit,
          description: defObj.description,
          fieldsConfig: defObj.fieldsConfig,
          customFields: defObj.customFields,
          categoryId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        objsInserted++;
      }
    }

    return { catsInserted, objsInserted };
  },
});

export const setMaterialCategory = mutation({
  args: {
    materialId: v.id("materials"),
    wmsCategoryId: v.optional(v.id("wms_categories")),
    wmsObjectId: v.optional(v.id("wms_objects")),
  },
  handler: async (ctx, { materialId, wmsCategoryId, wmsObjectId }) => {
    await requireUser(ctx);
    const m = await ctx.db.get(materialId);
    if (!m) throw new Error("Materiał nie istnieje.");
    await ctx.db.patch(materialId, {
      wmsCategoryId,
      wmsObjectId,
      updatedAt: Date.now(),
    });
  },
});

// ─── Indeksy materiałowe (powiązane z obiektami + wydruk QR) ────────────────

export const listIndexes = query({
  args: {
    categoryId: v.optional(v.id("wms_categories")),
    objectId: v.optional(v.id("wms_objects")),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [allMats, lots, cats, objs] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("wms_lots").collect(),
      categoryMap(ctx),
      objectMap(ctx),
    ]);
    const catsByCode = new Map(Array.from(cats.values()).map((c) => [c.code, c]));

    const pieces = new Map<string, number>();
    for (const l of lots) {
      if (l.status === "DEPLETED") continue;
      pieces.set(l.materialId, (pieces.get(l.materialId) ?? 0) + l.quantityPieces);
    }

    return allMats
      .filter((m) => {
        if (m.isActive === false) return false;
        if (args.categoryId && m.wmsCategoryId !== args.categoryId) return false;
        if (args.objectId && m.wmsObjectId !== args.objectId) return false;
        return true;
      })
      .map((m) => {
        const obj = m.wmsObjectId ? objs.get(m.wmsObjectId) : null;
        const cat = m.wmsCategoryId
          ? cats.get(m.wmsCategoryId)
          : obj
          ? cats.get(obj.categoryId)
          : m.category
          ? catsByCode.get(m.category.toUpperCase())
          : null;

        let dimensionsSummary = "—";
        if (m.widthMm && m.heightMm) {
          dimensionsSummary = `${m.widthMm} × ${m.heightMm}${m.thicknessMm ? ` × ${m.thicknessMm}` : ""} mm`;
        } else if (m.lengthMm && m.widthMm) {
          dimensionsSummary = `${m.lengthMm} × ${m.widthMm}${m.thicknessMm ? ` × ${m.thicknessMm}` : ""} mm`;
        } else if (m.lengthMm) {
          dimensionsSummary = `${m.lengthMm} mm`;
        } else if (m.thicknessMm) {
          dimensionsSummary = `gr. ${m.thicknessMm} mm`;
        }

        return {
          material: m,
          category: cat ?? null,
          object: obj ?? null,
          dimensionsSummary,
          stockPieces: pieces.get(m._id) ?? 0,
        };
      })
      .sort((a, b) => a.material.name.localeCompare(b.material.name, "pl"));
  },
});

export const upsertIndex = mutation({
  args: {
    id: v.optional(v.id("materials")),
    name: v.string(),
    sku: v.string(),
    wmsObjectId: v.id("wms_objects"),
    wmsCategoryId: v.optional(v.id("wms_categories")),
    description: v.optional(v.string()),
    supplier: v.optional(v.string()),
    lengthMm: v.optional(v.number()),
    widthMm: v.optional(v.number()),
    heightMm: v.optional(v.number()),
    thicknessMm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    customAttributes: v.optional(v.any()),
  },
  handler: async (ctx, { id, name, sku, wmsObjectId, wmsCategoryId, ...rest }) => {
    await requireUser(ctx);
    const cleanName = name.trim();
    const cleanSku = sku.trim().toUpperCase();
    if (!cleanName) throw new Error("Nazwa indeksu jest wymagana.");
    if (!cleanSku) throw new Error("Kod indeksu jest wymagany (np. PE50, PE68).");

    const obj = await ctx.db.get(wmsObjectId);
    if (!obj) throw new Error("Wybrany system / podgrupa magazynowa nie istnieje.");

    const categoryId = wmsCategoryId ?? obj.categoryId;
    const cat = await ctx.db.get(categoryId);

    // Sprawdź unikalność SKU
    const existingBySku = await ctx.db
      .query("materials")
      .withIndex("by_sku", (q) => q.eq("sku", cleanSku))
      .collect();
    const activeDup = existingBySku.find((m) => m.isActive !== false && (!id || m._id !== id));
    if (activeDup) {
      throw new Error(`Indeks o kodzie "${cleanSku}" już istnieje (${activeDup.name}).`);
    }

    const now = Date.now();
    const unit = obj.defaultUnit || "szt.";
    const legacyCategory = cat?.code || "INNE";

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing) throw new Error("Indeks nie istnieje.");
      await ctx.db.patch(id, {
        name: cleanName,
        sku: cleanSku,
        wmsObjectId,
        wmsCategoryId: categoryId,
        unit: existing.unit || unit,
        category: legacyCategory,
        ...rest,
        updatedAt: now,
      });
      return id;
    }

    return ctx.db.insert("materials", {
      name: cleanName,
      sku: cleanSku,
      wmsObjectId,
      wmsCategoryId: categoryId,
      unit,
      priceUnit: 0,
      category: legacyCategory,
      ...rest,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteIndex = mutation({
  args: { id: v.id("materials") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const m = await ctx.db.get(id);
    if (!m) throw new Error("Indeks nie istnieje.");
    const lot = await ctx.db
      .query("wms_lots")
      .withIndex("by_material", (q) => q.eq("materialId", id))
      .first();
    if (lot) {
      await ctx.db.patch(id, { isActive: false, updatedAt: Date.now() });
      return { deactivated: true };
    }
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

// ─── Profile (cechy magazynowe indeksów z `materials`) ──────────────────────

export const listProfiles = query({
  args: { allCategories: v.optional(v.boolean()), categoryId: v.optional(v.id("wms_categories")) },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [allMats, profiles, lots, cats, objs] = await Promise.all([
      ctx.db.query("materials").collect(),
      profileMap(ctx),
      ctx.db.query("wms_lots").collect(),
      categoryMap(ctx),
      objectMap(ctx),
    ]);
    const catsByCode = new Map(Array.from(cats.values()).map((c) => [c.code, c]));

    const mats = allMats.filter(
      (m) =>
        m.isActive !== false &&
        (args.allCategories ||
          (args.categoryId && m.wmsCategoryId === args.categoryId) ||
          (!args.categoryId && (m.category === "PROFILE" || !m.category))),
    );

    const pieces = new Map<string, number>();
    for (const l of lots) {
      if (l.status === "DEPLETED") continue;
      pieces.set(l.materialId, (pieces.get(l.materialId) ?? 0) + l.quantityPieces);
    }
    return mats
      .map((m) => {
        let obj = m.wmsObjectId ? objs.get(m.wmsObjectId) : null;
        const cat = m.wmsCategoryId
          ? cats.get(m.wmsCategoryId)
          : obj
          ? cats.get(obj.categoryId)
          : m.category
          ? catsByCode.get(m.category.toUpperCase())
          : null;
        if (!obj && cat) {
          obj = Array.from(objs.values()).find((o) => o.categoryId === cat._id) ?? null;
        }
        return {
          material: m,
          category: cat ?? null,
          object: obj ?? null,
          profile: profiles.get(m._id) ?? null,
          stockPieces: pieces.get(m._id) ?? 0,
        };
      })
      .sort((a, b) => a.material.name.localeCompare(b.material.name, "pl"));
  },
});

export const upsertProfile = mutation({
  args: {
    materialId: v.id("materials"),
    isTracked: v.boolean(),
    systemSeries: v.optional(v.string()),
    kgPerMb: v.optional(v.number()),
    standardLengthMm: v.optional(v.number()),
    trackingMode,
    requiresCertificate: v.boolean(),
    requiresColor: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (!(await ctx.db.get(args.materialId))) throw new Error("Materiał nie istnieje.");
    if (args.kgPerMb !== undefined && args.kgPerMb < 0)
      throw new Error("Masa jednostkowa nie może być ujemna.");
    const now = Date.now();
    const existing = await ctx.db
      .query("wms_material_profiles")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("wms_material_profiles", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Reguły ewidencji ───────────────────────────────────────────────────────

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [rules, mats] = await Promise.all([
      ctx.db.query("wms_tracking_rules").collect(),
      materialMap(ctx),
    ]);
    return rules
      .map((r) => ({
        ...r,
        materialName: r.materialId ? (mats.get(r.materialId)?.name ?? "—") : null,
      }))
      .sort((a, b) => b.priority - a.priority);
  },
});

const ruleFields = {
  name: v.string(),
  category: v.optional(v.string()),
  materialId: v.optional(v.id("materials")),
  zone: v.optional(v.string()),
  trackingMode,
  requiredAttributes: v.array(v.string()),
  enforceCycleCount: v.boolean(),
  priority: v.number(),
  isActive: v.boolean(),
};

export const createRule = mutation({
  args: ruleFields,
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (!args.name.trim()) throw new Error("Podaj nazwę reguły.");
    return ctx.db.insert("wms_tracking_rules", { ...args, createdAt: Date.now() });
  },
});

export const updateRule = mutation({
  args: { id: v.id("wms_tracking_rules"), ...ruleFields },
  handler: async (ctx, { id, ...rest }) => {
    await requireUser(ctx);
    if (!(await ctx.db.get(id))) throw new Error("Reguła nie istnieje.");
    await ctx.db.patch(id, rest);
  },
});

export const removeRule = mutation({
  args: { id: v.id("wms_tracking_rules") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    await ctx.db.delete(id);
  },
});

/** Podgląd: jak system rozstrzygnie regułę dla indeksu w strefie. */
export const previewRule = query({
  args: { materialId: v.id("materials"), zone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return null;
    return resolveTrackingRule(ctx, args.materialId, args.zone);
  },
});

// ─── Lokalizacje ────────────────────────────────────────────────────────────

export const listLocations = query({
  args: { onlyActive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [locs, lots, profiles] = await Promise.all([
      ctx.db.query("wms_locations").collect(),
      ctx.db.query("wms_lots").collect(),
      profileMap(ctx),
    ]);
    const stat = new Map<string, { lots: number; kg: number }>();
    for (const l of lots) {
      if (l.status === "DEPLETED" || !l.locationId) continue;
      const s = stat.get(l.locationId) ?? { lots: 0, kg: 0 };
      s.lots += 1;
      const kg = profiles.get(l.materialId)?.kgPerMb;
      if (kg) s.kg += lotTotalMb(l.lengthMm, l.quantityPieces) * kg;
      stat.set(l.locationId, s);
    }
    return locs
      .filter((l) => !args.onlyActive || l.isActive)
      .map((l) => ({
        ...l,
        lotCount: stat.get(l._id)?.lots ?? 0,
        loadKg: stat.get(l._id)?.kg ?? 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code, "pl"));
  },
});

const locationFields = {
  name: v.string(),
  code: v.optional(v.string()),
  zone: v.optional(zone),
  type: v.optional(locationType),
  maxWeightKg: v.optional(v.number()),
  maxLengthMm: v.optional(v.number()),
  isActive: v.optional(v.boolean()),
};

async function assertUniqueCode(
  ctx: QueryCtx,
  code: string,
  exceptId?: Id<"wms_locations">,
) {
  const dup = await ctx.db
    .query("wms_locations")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
  if (dup && dup._id !== exceptId) throw new Error(`Lokalizacja „${code}” już istnieje.`);
}

export const createLocation = mutation({
  args: locationFields,
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Podaj nazwę lokalizacji.");
    const code = (args.code?.trim() || name).toUpperCase();
    await assertUniqueCode(ctx, code);

    let z = args.zone;
    if (!z) {
      const lower = name.toLowerCase();
      if (
        lower.includes("bufor") ||
        lower.includes("prod") ||
        lower.includes("pił") ||
        lower.includes("pila") ||
        lower.includes("hala") ||
        lower.includes("montaż") ||
        lower.includes("montaz")
      ) {
        z = "BUFOR_PRODUKCYJNY";
      } else if (lower.includes("spad")) {
        z = "STREFA_SPADOW";
      } else {
        z = "MAGAZYN_GLOWNY";
      }
    }

    return ctx.db.insert("wms_locations", {
      name,
      code,
      zone: z,
      type: args.type ?? "CANTILEVER",
      maxWeightKg: args.maxWeightKg,
      maxLengthMm: args.maxLengthMm,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
    });
  },
});

export const updateLocation = mutation({
  args: { id: v.id("wms_locations"), ...locationFields },
  handler: async (ctx, { id, ...rest }) => {
    await requireUser(ctx);
    const name = rest.name.trim();
    if (!name) throw new Error("Podaj nazwę lokalizacji.");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Lokalizacja nie istnieje.");

    const code = (rest.code?.trim() || name).toUpperCase();
    await assertUniqueCode(ctx, code, id);

    const isActive = rest.isActive ?? existing.isActive;
    if (!isActive) {
      const lots = await ctx.db
        .query("wms_lots")
        .withIndex("by_location", (q) => q.eq("locationId", id))
        .collect();
      if (lots.some((l) => l.status !== "DEPLETED"))
        throw new Error("Nie można dezaktywować lokalizacji, na której są partie.");
    }
    await ctx.db.patch(id, {
      name,
      code,
      isActive,
      ...(rest.zone ? { zone: rest.zone } : {}),
      ...(rest.type ? { type: rest.type } : {}),
      maxWeightKg: rest.maxWeightKg !== undefined ? rest.maxWeightKg : existing.maxWeightKg,
      maxLengthMm: rest.maxLengthMm !== undefined ? rest.maxLengthMm : existing.maxLengthMm,
    });
  },
});

export const deleteLocation = mutation({
  args: { id: v.id("wms_locations") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Lokalizacja nie istnieje.");
    const lot = await ctx.db
      .query("wms_lots")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .first();
    if (lot && lot.status !== "DEPLETED") {
      throw new Error("Nie można usunąć lokalizacji, na której znajdują się aktywne partie materiału.");
    }
    if (lot) {
      await ctx.db.patch(id, { isActive: false });
      return { deactivated: true };
    }
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

// ─── Stany i partie ─────────────────────────────────────────────────────────

export const listLots = query({
  args: {
    materialId: v.optional(v.id("materials")),
    locationId: v.optional(v.id("wms_locations")),
    status: v.optional(v.string()),
    includeDepleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    let lots: Doc<"wms_lots">[];
    if (args.locationId) {
      lots = await ctx.db
        .query("wms_lots")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId!))
        .collect();
    } else if (args.materialId) {
      lots = await ctx.db
        .query("wms_lots")
        .withIndex("by_material", (q) => q.eq("materialId", args.materialId!))
        .collect();
    } else {
      lots = await ctx.db.query("wms_lots").collect();
    }
    lots = lots.filter(
      (l) =>
        (!args.materialId || l.materialId === args.materialId) &&
        (!args.status || l.status === args.status) &&
        (args.includeDepleted || l.status !== "DEPLETED"),
    );
    const enriched = await enrichLots(ctx, lots);
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const lotHistory = query({
  args: {
    lotId: v.optional(v.id("wms_lots")),
    materialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return null;

    let targetMaterialId = args.materialId;
    const targetLot = args.lotId ? await ctx.db.get(args.lotId) : null;
    if (targetLot && !targetMaterialId) {
      targetMaterialId = targetLot.materialId;
    }

    if (!targetMaterialId && !targetLot) return null;

    // Pobierz wszystkie partie magazynowe tego indeksu materiałowego
    const allLots = targetMaterialId
      ? await ctx.db
          .query("wms_lots")
          .withIndex("by_material", (q) => q.eq("materialId", targetMaterialId!))
          .collect()
      : targetLot
      ? [targetLot]
      : [];

    const enrichedLots = await enrichLots(ctx, allLots);

    // Pobierz ruchy dla wszystkich partii tego indeksu
    const [allMovements, locs] = await Promise.all([
      Promise.all(
        allLots.map((l) =>
          ctx.db
            .query("wms_movements")
            .withIndex("by_lot", (q) => q.eq("lotId", l._id))
            .collect(),
        ),
      ).then((res) => res.flat()),
      locationMap(ctx),
    ]);

    const rows = await Promise.all(
      allMovements.map(async (m) => {
        const d = m.documentId ? await ctx.db.get(m.documentId) : null;
        const u = await ctx.db.get(m.operatorId);

        let orderId = d?.orderId ?? null;
        let orderNumber = d?.orderNumber ?? null;

        // Jeśli orderId nie ma na dokumencie, sprawdź czy jest w notatce "Zlecenie: ..."
        if (!orderId && m.note) {
          const match = m.note.match(/Zlecenie:\s*([^\s,]+)/);
          if (match) {
            const rawNum = match[1];
            const cleanNum = rawNum.replace(/^#/, "");
            const ord =
              (await ctx.db
                .query("orders")
                .filter((q) => q.eq(q.field("orderNumber"), rawNum))
                .first()) ??
              (await ctx.db
                .query("orders")
                .filter((q) => q.eq(q.field("orderNumber"), `#${cleanNum}`))
                .first()) ??
              (await ctx.db
                .query("orders")
                .filter((q) => q.eq(q.field("orderNumber"), cleanNum))
                .first());

            if (ord) {
              orderId = ord._id;
              orderNumber = ord.orderNumber;
            } else {
              orderNumber = rawNum;
            }
          }
        }

        const order = orderId ? await ctx.db.get(orderId) : null;

        return {
          ...m,
          documentId: m.documentId ?? null,
          documentNumber: d?.number ?? null,
          documentType: d?.type ?? m.type,
          orderId: orderId ?? null,
          orderNumber: orderNumber ?? order?.orderNumber ?? null,
          clientName: order?.clientName ?? null,
          fromCode: m.fromLocationId ? (locs.get(m.fromLocationId)?.code ?? "—") : null,
          toCode: m.toLocationId ? (locs.get(m.toLocationId)?.code ?? "—") : null,
          operatorName: u?.name ?? u?.email ?? "—",
        };
      }),
    );

    // Suma ilości na stanie
    const totalAvailable = allLots
      .filter((l) => l.status === "AVAILABLE")
      .reduce((s, l) => s + l.quantityPieces, 0);
    const totalAll = allLots
      .filter((l) => l.status !== "DEPLETED")
      .reduce((s, l) => s + l.quantityPieces, 0);

    const primaryLot =
      (args.lotId ? enrichedLots.find((l) => l._id === args.lotId) : null) ??
      enrichedLots[0] ??
      null;

    return {
      lot: primaryLot,
      lots: enrichedLots,
      totalAvailablePieces: totalAvailable,
      totalPieces: totalAll,
      movements: rows.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return null;
    const [lotsAll, drafts, openSessions, locsAll, catsAll, objsAll, matsAll, profiles] = await Promise.all([
      ctx.db.query("wms_lots").collect(),
      ctx.db.query("wms_documents").withIndex("by_status", (q) => q.eq("status", "DRAFT")).collect(),
      ctx.db.query("wms_inventory_sessions").withIndex("by_status", (q) => q.eq("status", "OPEN")).collect(),
      ctx.db.query("wms_locations").collect(),
      ctx.db.query("wms_categories").collect(),
      ctx.db.query("wms_objects").collect(),
      materialMap(ctx),
      profileMap(ctx),
    ]);

    const activeLots = lotsAll.filter((l) => l.status !== "DEPLETED");
    const catsMap = new Map(catsAll.map((c) => [c._id, c]));
    const catsByCode = new Map(catsAll.map((c) => [c.code, c]));
    const objsMap = new Map(objsAll.map((o) => [o._id, o]));
    const locsMap = new Map(locsAll.map((l) => [l._id, l]));

    // Podsumowanie wg kategorii
    const categoryStats = new Map<string, {
      categoryId?: Id<"wms_categories">;
      categoryCode?: string;
      categoryName: string;
      objectName: string;
      unit: string;
      lotCount: number;
      totalPieces: number;
      totalMb: number;
      totalKg: number;
    }>();

    let totalWeightKg = 0;
    for (const l of activeLots) {
      const m = matsAll.get(l.materialId);
      const cat = l.categoryId
        ? catsMap.get(l.categoryId)
        : (m?.wmsCategoryId ? catsMap.get(m.wmsCategoryId) : (m?.category ? catsByCode.get(m.category.toUpperCase()) : null));
      const obj = l.objectId
        ? objsMap.get(l.objectId)
        : (m?.wmsObjectId ? objsMap.get(m.wmsObjectId) : null);

      const catKey = cat?._id ?? (m?.category ?? "INNE");
      const stat = categoryStats.get(catKey) ?? {
        categoryId: cat?._id,
        categoryCode: cat?.code,
        categoryName: cat?.name ?? m?.category ?? "Inne",
        objectName: obj?.name ?? cat?.objectName ?? "Sztuka",
        unit: obj?.defaultUnit ?? cat?.defaultUnit ?? m?.unit ?? "szt.",
        lotCount: 0,
        totalPieces: 0,
        totalMb: 0,
        totalKg: 0,
      };

      stat.lotCount += 1;
      stat.totalPieces += l.quantityPieces;

      const kg = profiles.get(l.materialId)?.kgPerMb;
      const mb = lotTotalMb(l.lengthMm, l.quantityPieces);
      stat.totalMb += mb;
      const lotKg = l.weightKg ?? (kg && l.lengthMm ? mb * kg : 0);
      stat.totalKg += lotKg;
      totalWeightKg += lotKg;

      categoryStats.set(catKey, stat);
    }

    const recent = await ctx.db
      .query("wms_movements")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);

    const lotMap = new Map(lotsAll.map((l) => [l._id, l]));
    const recentRows = await Promise.all(
      recent.map(async (m) => {
        const lot = lotMap.get(m.lotId) ?? (await ctx.db.get(m.lotId));
        const d = m.documentId ? await ctx.db.get(m.documentId) : null;
        const mat = lot ? matsAll.get(lot.materialId) : null;
        const cat = lot?.categoryId
          ? catsMap.get(lot.categoryId)
          : (mat?.wmsCategoryId ? catsMap.get(mat.wmsCategoryId) : (mat?.category ? catsByCode.get(mat.category.toUpperCase()) : null));
        const obj = lot?.objectId
          ? objsMap.get(lot.objectId)
          : (mat?.wmsObjectId ? objsMap.get(mat.wmsObjectId) : null);

        let dimensionsSummary = "—";
        const width = lot?.widthMm;
        const height = lot?.heightMm;
        const length = m.lengthMm ?? lot?.lengthMm;
        const thickness = lot?.thicknessMm;

        if (width && height) {
          dimensionsSummary = `${width} × ${height}${thickness ? ` × ${thickness}` : ""} mm`;
        } else if (length && width) {
          dimensionsSummary = `${length} × ${width}${thickness ? ` × ${thickness}` : ""} mm`;
        } else if (length) {
          dimensionsSummary = `${length} mm`;
        }

        return {
          _id: m._id,
          type: m.type,
          createdAt: m.createdAt,
          quantityPieces: m.quantityPieces,
          lengthMm: m.lengthMm,
          dimensionsSummary,
          documentNumber: d?.number ?? null,
          materialName: mat?.name ?? "—",
          objectName: obj?.name ?? cat?.objectName ?? "Sztuka",
          categoryName: cat?.name ?? "Inne",
          unit: obj?.defaultUnit ?? cat?.defaultUnit ?? mat?.unit ?? "szt.",
          toCode: m.toLocationId ? (locsMap.get(m.toLocationId)?.name ?? locsMap.get(m.toLocationId)?.code ?? "—") : null,
        };
      }),
    );

    return {
      lotCount: activeLots.length,
      totalPieces: activeLots.reduce((s, l) => s + l.quantityPieces, 0),
      totalKg: totalWeightKg,
      categoryCount: catsAll.filter((c) => c.isActive).length,
      inProgressCount: activeLots.filter((l) => l.status === "IN_PROGRESS").length,
      draftCount: drafts.length,
      openInventoryCount: openSessions.length,
      locationCount: locsAll.filter((l) => l.isActive).length,
      categoriesBreakdown: Array.from(categoryStats.values()).sort((a, b) => b.lotCount - a.lotCount),
      recent: recentRows,
    };
  },
});

// ─── Dokumenty ──────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const listDocuments = query({
  args: { type: docType },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return [];
    const [docs, orders] = await Promise.all([
      ctx.db
        .query("wms_documents")
        .withIndex("by_type", (q) => q.eq("type", args.type))
        .collect(),
      args.type === "RW" ? ctx.db.query("orders").collect() : Promise.resolve([]),
    ]);
    const orderMap = new Map(orders.map((o) => [o._id, o]));

    return Promise.all(
      docs
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (d) => {
          const lines = await ctx.db
            .query("wms_document_lines")
            .withIndex("by_document", (q) => q.eq("documentId", d._id))
            .collect();
          const u = await ctx.db.get(d.createdBy);
          const order = d.orderId ? orderMap.get(d.orderId) : null;
          return {
            ...d,
            orderNumber: d.orderNumber || order?.orderNumber,
            clientName: order?.clientName,
            orderStatus: order?.status,
            lineCount: lines.length,
            totalPieces: lines.reduce((s, l) => s + l.quantityPieces, 0),
            createdByName: u?.name ?? u?.email ?? "—",
          };
        }),
    );
  },
});

export const getDocument = query({
  args: { id: v.id("wms_documents") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    const [lines, mats, locs, cats, objs] = await Promise.all([
      ctx.db
        .query("wms_document_lines")
        .withIndex("by_document", (q) => q.eq("documentId", id))
        .collect(),
      materialMap(ctx),
      locationMap(ctx),
      categoryMap(ctx),
      objectMap(ctx),
    ]);
    const catsByCode = new Map(Array.from(cats.values()).map((c) => [c.code, c]));

    const rows = await Promise.all(
      lines.map(async (l) => {
        const lot = l.lotId ? await ctx.db.get(l.lotId) : null;
        const materialId = l.materialId ?? lot?.materialId;
        const mat = materialId ? mats.get(materialId) : null;
        const cat = lot?.categoryId
          ? cats.get(lot.categoryId)
          : (mat?.wmsCategoryId ? cats.get(mat.wmsCategoryId) : (mat?.category ? catsByCode.get(mat.category.toUpperCase()) : null));
        const obj = l.objectId
          ? objs.get(l.objectId)
          : (lot?.objectId ? objs.get(lot.objectId) : (mat?.wmsObjectId ? objs.get(mat.wmsObjectId) : null));

        const width = l.widthMm ?? lot?.widthMm;
        const height = l.heightMm ?? lot?.heightMm;
        const length = l.lengthMm ?? lot?.lengthMm;
        const thickness = l.thicknessMm ?? lot?.thicknessMm;

        let dimensionsSummary = "—";
        if (width && height) {
          dimensionsSummary = `${width} × ${height}${thickness ? ` × ${thickness}` : ""} mm`;
        } else if (length && width) {
          dimensionsSummary = `${length} × ${width}${thickness ? ` × ${thickness}` : ""} mm`;
        } else if (length) {
          dimensionsSummary = `${length} mm`;
        }

        const lotLabel = lot
          ? `${mats.get(lot.materialId)?.name ?? "—"} · ${obj?.name ?? cat?.objectName ?? "Obiekt"}: ${dimensionsSummary} · ${lot.colorCode ?? "bez koloru"} · stan ${lot.quantityPieces} szt.`
          : null;

        return {
          ...l,
          materialName: mat?.name ?? "—",
          materialSku: mat?.sku,
          categoryName: cat?.name ?? mat?.category ?? "Inne",
          objectName: obj?.name ?? cat?.objectName ?? "Sztuka",
          objectId: obj?._id,
          unit: obj?.defaultUnit ?? cat?.defaultUnit ?? mat?.unit ?? "szt.",
          dimensionsSummary,
          lotLabel,
          fromCode: l.fromLocationId ? (locs.get(l.fromLocationId)?.code ?? "—") : null,
          toCode: l.toLocationId ? (locs.get(l.toLocationId)?.code ?? "—") : null,
          certificateUrl: l.certificateStorageId
            ? await ctx.storage.getUrl(l.certificateStorageId)
            : null,
        };
      }),
    );
    const creator = await ctx.db.get(doc.createdBy);
    const approver = doc.approvedBy ? await ctx.db.get(doc.approvedBy) : null;
    const order = doc.orderId ? await ctx.db.get(doc.orderId) : null;
    return {
      doc: {
        ...doc,
        orderNumber: doc.orderNumber || order?.orderNumber,
        clientName: order?.clientName,
        orderStatus: order?.status,
      },
      order: order
        ? {
            _id: order._id,
            orderNumber: order.orderNumber,
            clientName: order.clientName,
            status: order.status,
          }
        : null,
      lines: rows,
      createdByName: creator?.name ?? creator?.email ?? "—",
      approvedByName: approver?.name ?? approver?.email ?? null,
    };
  },
});

export const createDraft = mutation({
  args: {
    type: v.union(v.literal("PZ"), v.literal("RW")),
    supplier: v.optional(v.string()),
    externalDocNumber: v.optional(v.string()),
    expectedBundles: v.optional(v.number()),
    orderId: v.optional(v.id("orders")),
    orderNumber: v.optional(v.string()),
    targetNote: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    let finalOrderNumber = args.orderNumber;
    if (args.orderId && !finalOrderNumber) {
      const ord = await ctx.db.get(args.orderId);
      if (ord) finalOrderNumber = ord.orderNumber;
    }
    return createDocument(ctx, userId, { ...args, orderNumber: finalOrderNumber });
  },
});

async function draftOrThrow(ctx: QueryCtx, id: Id<"wms_documents">) {
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Dokument nie istnieje.");
  if (doc.status !== "DRAFT") throw new Error("Dokument jest już zamknięty — edycja niemożliwa.");
  return doc;
}

export const updateHeader = mutation({
  args: {
    id: v.id("wms_documents"),
    supplier: v.optional(v.string()),
    externalDocNumber: v.optional(v.string()),
    expectedBundles: v.optional(v.number()),
    orderId: v.optional(v.id("orders")),
    orderNumber: v.optional(v.string()),
    targetNote: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await requireUser(ctx);
    await draftOrThrow(ctx, id);
    let finalOrderNumber = rest.orderNumber;
    if (rest.orderId && !finalOrderNumber) {
      const ord = await ctx.db.get(rest.orderId);
      if (ord) finalOrderNumber = ord.orderNumber;
    }
    await ctx.db.patch(id, { ...rest, orderNumber: finalOrderNumber });
  },
});

const lineFields = {
  lotId: v.optional(v.id("wms_lots")),
  materialId: v.optional(v.id("materials")),
  objectId: v.optional(v.id("wms_objects")),
  kind: v.optional(lotKind),
  quantityPieces: v.number(),
  lengthMm: v.optional(v.number()),
  widthMm: v.optional(v.number()),
  heightMm: v.optional(v.number()),
  thicknessMm: v.optional(v.number()),
  weightKg: v.optional(v.number()),
  colorCode: v.optional(v.string()),
  surfaceType: v.optional(surfaceType),
  heatNumber: v.optional(v.string()),
  ssccCode: v.optional(v.string()),
  certificateStorageId: v.optional(v.id("_storage")),
  certificateName: v.optional(v.string()),
  customAttributes: v.optional(v.any()),
  toLocationId: v.optional(v.id("wms_locations")),
  damage: v.optional(damage),
  note: v.optional(v.string()),
};

export const addLine = mutation({
  args: { documentId: v.id("wms_documents"), ...lineFields },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const doc = await draftOrThrow(ctx, args.documentId);
    if (doc.type === "PZ") {
      if (!args.materialId) throw new Error("Wybierz indeks materiałowy.");
    } else if (doc.type === "RW") {
      if (!args.lotId) throw new Error("Wybierz partię ze stanu magazynowego.");
    }
    return ctx.db.insert("wms_document_lines", args);
  },
});

export const updateLine = mutation({
  args: { id: v.id("wms_document_lines"), ...lineFields },
  handler: async (ctx, { id, ...rest }) => {
    await requireUser(ctx);
    const line = await ctx.db.get(id);
    if (!line) throw new Error("Pozycja nie istnieje.");
    const doc = await draftOrThrow(ctx, line.documentId);
    if (doc.type === "PZ") {
      if (!rest.materialId) throw new Error("Wybierz indeks materiałowy.");
    } else if (doc.type === "RW") {
      if (!rest.lotId) throw new Error("Wybierz partię ze stanu magazynowego.");
    }
    await ctx.db.replace(id, { documentId: line.documentId, ...rest });
  },
});

export const removeLine = mutation({
  args: { id: v.id("wms_document_lines") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    const line = await ctx.db.get(id);
    if (!line) return;
    await draftOrThrow(ctx, line.documentId);
    await ctx.db.delete(id);
  },
});

export const approve = mutation({
  args: { id: v.id("wms_documents") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    return approveDocument(ctx, userId, id);
  },
});

export const cancel = mutation({
  args: { id: v.id("wms_documents") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    await cancelDraft(ctx, id);
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("wms_documents") },
  handler: async (ctx, { id }) => {
    await requireUser(ctx);
    return deleteDocumentCore(ctx, id);
  },
});

export const listOrderWmsRw = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    if (!(await getAuthUserId(ctx))) return { documents: [], totalPiecesIssued: 0 };
    const docs = await ctx.db
      .query("wms_documents")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();

    const [mats, locs, objs] = await Promise.all([
      materialMap(ctx),
      locationMap(ctx),
      objectMap(ctx),
    ]);

    const documents = await Promise.all(
      docs
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (doc) => {
          const lines = await ctx.db
            .query("wms_document_lines")
            .withIndex("by_document", (q) => q.eq("documentId", doc._id))
            .collect();
          const creator = await ctx.db.get(doc.createdBy);

          const linesMapped = lines.map((l) => {
            const mat = l.materialId ? mats.get(l.materialId) : null;
            const obj = l.objectId ? objs.get(l.objectId) : mat?.wmsObjectId ? objs.get(mat.wmsObjectId) : null;
            let dims = "";
            if (l.widthMm && l.heightMm) dims = `${l.widthMm} × ${l.heightMm} mm`;
            else if (l.lengthMm) dims = `${l.lengthMm} mm`;
            else if (mat?.lengthMm) dims = `${mat.lengthMm} mm`;
            else if (l.thicknessMm) dims = `gr. ${l.thicknessMm} mm`;

            return {
              _id: l._id,
              materialName: mat?.name ?? (l.lotId ? "Partia magazynowa" : "—"),
              materialSku: mat?.sku ?? null,
              objectName: obj?.name ?? null,
              dimensionsSummary: dims || "—",
              quantityPieces: l.quantityPieces,
              unit: obj?.defaultUnit ?? mat?.unit ?? "szt.",
              colorCode: l.colorCode,
              surfaceType: l.surfaceType,
              heatNumber: l.heatNumber,
              fromLocationCode: l.fromLocationId ? (locs.get(l.fromLocationId)?.code ?? "—") : "—",
              note: l.note,
            };
          });

          return {
            _id: doc._id,
            number: doc.number,
            status: doc.status,
            createdAt: doc.createdAt,
            approvedAt: doc.approvedAt,
            targetNote: doc.targetNote,
            notes: doc.notes,
            createdByName: creator?.name ?? creator?.email ?? "—",
            lines: linesMapped,
            totalPieces: linesMapped.reduce((s, it) => s + it.quantityPieces, 0),
          };
        }),
    );

    const totalPiecesIssued = documents
      .filter((d) => d.status === "ZATWIERDZONY")
      .reduce((s, d) => s + d.totalPieces, 0);

    return {
      documents,
      totalPiecesIssued,
    };
  },
});

// ─── Inwentaryzacja ─────────────────────────────────────────────────────────

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return [];
    const sessions = await ctx.db.query("wms_inventory_sessions").collect();
    const locs = await locationMap(ctx);
    return Promise.all(
      sessions
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (s) => {
          const counts = await ctx.db
            .query("wms_inventory_counts")
            .withIndex("by_session", (q) => q.eq("sessionId", s._id))
            .collect();
          const doc = s.correctionDocumentId ? await ctx.db.get(s.correctionDocumentId) : null;
          return {
            ...s,
            locationCode: s.locationId ? (locs.get(s.locationId)?.code ?? "—") : "Cały magazyn",
            total: counts.length,
            counted: counts.filter((c) => c.countedPieces !== undefined).length,
            correctionNumber: doc?.number ?? null,
          };
        }),
    );
  },
});

export const getSession = query({
  args: { id: v.id("wms_inventory_sessions") },
  handler: async (ctx, { id }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const session = await ctx.db.get(id);
    if (!session) return null;
    const counts = await ctx.db
      .query("wms_inventory_counts")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .collect();
    const [mats, locs] = await Promise.all([materialMap(ctx), locationMap(ctx)]);
    const rows = await Promise.all(
      counts.map(async (c) => {
        const lot = await ctx.db.get(c.lotId);
        return {
          ...c,
          currentPieces: lot?.quantityPieces ?? 0,
          materialName: lot ? (mats.get(lot.materialId)?.name ?? "—") : "—",
          lengthMm: lot?.lengthMm ?? 0,
          colorCode: lot?.colorCode,
          heatNumber: lot?.heatNumber,
          locationCode: lot && lot.locationId ? (locs.get(lot.locationId)?.code ?? "—") : "—",
        };
      }),
    );
    return {
      session,
      rows: rows.sort(
        (a, b) =>
          a.locationCode.localeCompare(b.locationCode, "pl") ||
          a.materialName.localeCompare(b.materialName, "pl"),
      ),
    };
  },
});

export const openSession = mutation({
  args: { name: v.string(), locationId: v.optional(v.id("wms_locations")) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return openInventorySession(ctx, userId, args);
  },
});

export const setCount = mutation({
  args: { countId: v.id("wms_inventory_counts"), countedPieces: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await recordCount(ctx, userId, args.countId, args.countedPieces);
  },
});

export const closeSession = mutation({
  args: { id: v.id("wms_inventory_sessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    return closeInventorySession(ctx, userId, id);
  },
});

/**
 * Całkowite wyczyszczenie danych WMS (stany, partie, ruchy, dokumenty, inwentaryzacje, grupy i systemy).
 */
export const wipeWmsData = mutation({
  args: {
    includeLocations: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. Partie i stany magazynowe
    const lots = await ctx.db.query("wms_lots").collect();
    for (const l of lots) await ctx.db.delete(l._id);

    // 2. Dziennik ruchów
    const movs = await ctx.db.query("wms_movements").collect();
    for (const m of movs) await ctx.db.delete(m._id);

    // 3. Pozycje dokumentów oraz dokumenty (PZ, RW, MM, KOREKTA)
    const lines = await ctx.db.query("wms_document_lines").collect();
    for (const dl of lines) await ctx.db.delete(dl._id);

    const docs = await ctx.db.query("wms_documents").collect();
    for (const d of docs) await ctx.db.delete(d._id);

    // 4. Inwentaryzacje i zliczenia
    const counts = await ctx.db.query("wms_inventory_counts").collect();
    for (const c of counts) await ctx.db.delete(c._id);

    const sessions = await ctx.db.query("wms_inventory_sessions").collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    // 5. Liczniki numeracji dokumentów
    const counters = await ctx.db.query("wms_counters").collect();
    for (const c of counters) await ctx.db.delete(c._id);

    // 6. Systemy / podgrupy (wms_objects)
    const objs = await ctx.db.query("wms_objects").collect();
    for (const o of objs) await ctx.db.delete(o._id);

    // 7. Grupy towarowe (wms_categories)
    const cats = await ctx.db.query("wms_categories").collect();
    for (const c of cats) await ctx.db.delete(c._id);

    // 8. Opcjonalnie lokalizacje
    let deletedLocs = 0;
    if (args.includeLocations) {
      const locs = await ctx.db.query("wms_locations").collect();
      for (const loc of locs) await ctx.db.delete(loc._id);
      deletedLocs = locs.length;
    }

    // 9. Odpięcie powiązań w indeksach materiałowych
    const mats = await ctx.db.query("materials").collect();
    for (const m of mats) {
      if (m.wmsCategoryId || m.wmsObjectId) {
        await ctx.db.patch(m._id, {
          wmsCategoryId: undefined,
          wmsObjectId: undefined,
        });
      }
    }

    return {
      deletedLots: lots.length,
      deletedMovements: movs.length,
      deletedDocuments: docs.length,
      deletedDocumentLines: lines.length,
      deletedCategories: cats.length,
      deletedObjects: objs.length,
      deletedSessions: sessions.length,
      deletedInventoryCounts: counts.length,
      deletedCounters: counters.length,
      deletedLocations: deletedLocs,
    };
  },
});

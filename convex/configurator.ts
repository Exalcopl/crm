import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ─── Seed data (jedno źródło prawdy — przeniesione z configurator-data.ts) ───────

type OptDef = {
  key: string;
  label: string;
  price?: number;
  swatch?: string;
  group?: string;
  children?: OptDef[];
};
type FieldDef = {
  key: string;
  label: string;
  type: "select" | "multiselect" | "number" | "dimensions" | "color";
  section: string;
  required?: boolean;
  config?: unknown;
  options?: OptDef[];
};
type ProductDef = { slug: string; name: string; order: number; fields: FieldDef[] };

const COLORS: OptDef[] = [
  { key: "antracyt", label: "Antracyt RAL 7016", group: "standard", swatch: "oklch(0.32 0.008 255)" },
  { key: "czarny", label: "Czarny mat RAL 9005", group: "standard", swatch: "oklch(0.2 0 0)" },
  { key: "bialy", label: "Biały RAL 9016", group: "standard", swatch: "oklch(0.97 0 0)" },
  { key: "srebrny", label: "Srebrny RAL 9006", group: "standard", swatch: "oklch(0.78 0.006 255)" },
  { key: "braz", label: "Brąz RAL 8017", group: "nonstandard", swatch: "oklch(0.35 0.04 55)" },
  { key: "zielony", label: "Zielony RAL 6005", group: "nonstandard", swatch: "oklch(0.35 0.05 145)" },
  { key: "grafit", label: "Grafit RAL 7024", group: "nonstandard", swatch: "oklch(0.3 0.005 255)" },
  { key: "zloty-dab", label: "Złoty dąb", group: "decor", swatch: "oklch(0.6 0.08 70)" },
  { key: "orzech", label: "Orzech", group: "decor", swatch: "oklch(0.45 0.06 60)" },
  { key: "bialy-polysk", label: "Biały połysk", group: "decor", swatch: "oklch(0.9 0.01 90)" },
];

const LIGHT_FULL: OptDef[] = [
  { key: "biale-zimny", label: "Białe – zimny" },
  { key: "biale-neutralny", label: "Białe – neutralny" },
  { key: "biale-cieply", label: "Białe – ciepły" },
  { key: "rgb", label: "RGB" },
];
const LIGHT_POINT: OptDef[] = [
  { key: "biale-zimny", label: "Białe – zimny" },
  { key: "biale-neutralny", label: "Białe – neutralny" },
  { key: "biale-cieply", label: "Białe – ciepły" },
];

const ENCLOSURES: OptDef[] = [
  { key: "stale", label: "Stałe", children: [
    { key: "wzor-1", label: "Wzór 1" },
    { key: "wzor-2", label: "Wzór 2" },
    { key: "wzor-3", label: "Wzór 3" },
  ] },
  { key: "przesuwne", label: "Przesuwne", children: [
    { key: "caloszklane", label: "Całoszklane" },
    { key: "aluminiowe", label: "Aluminiowe" },
  ] },
  { key: "shuttersy", label: "Shuttersy", children: [
    { key: "pionowe", label: "Pionowe" },
    { key: "poziome", label: "Poziome" },
  ] },
  { key: "zippy", label: "Zippy", children: [
    { key: "wzor-1", label: "Wzór 1" },
    { key: "wzor-2", label: "Wzór 2" },
  ] },
];

const SEED: ProductDef[] = [
  {
    slug: "pergola",
    name: "Pergola",
    order: 0,
    fields: [
      { key: "rodzajPergoli", label: "Rodzaj pergoli", type: "select", section: "Podstawowe", required: true, options: [
        { key: "przyscienna", label: "Przyścienna" },
        { key: "wolnostojaca", label: "Wolnostojąca" },
        { key: "opaska-betonowa", label: "Opaska betonowa" },
      ] },
      { key: "orientacja", label: "Orientacja", type: "select", section: "Podstawowe", options: [
        { key: "lewa", label: "Lewa" },
        { key: "prawa", label: "Prawa" },
      ] },
      { key: "wymiary", label: "Wymiary", type: "dimensions", section: "Podstawowe", config: {
        unit: "mm",
        subFields: [
          { key: "szerokosc", label: "Szer." },
          { key: "wysieg", label: "Wysięg" },
          { key: "wysokosc", label: "Wys." },
        ],
      } },
      { key: "kolorKonstrukcji", label: "Kolor konstrukcji", type: "color", section: "Podstawowe", options: COLORS },
      { key: "kolorDachu", label: "Kolor dachu", type: "color", section: "Podstawowe", options: COLORS },

      { key: "liniowe-obwod", label: "Liniowe po obwodzie", type: "select", section: "Oświetlenie", config: { group: "oswietlenie" }, options: LIGHT_FULL },
      { key: "liniowe-lamelach", label: "Liniowe w lamelach", type: "select", section: "Oświetlenie", config: { group: "oswietlenie" }, options: LIGHT_FULL },
      { key: "punktowe-lamelach", label: "Punktowe w lamelach", type: "select", section: "Oświetlenie", config: { group: "oswietlenie" }, options: LIGHT_POINT },

      { key: "zabudowyBoczne", label: "Zabudowy boczne", type: "select", section: "Zabudowy boczne", options: ENCLOSURES },

      { key: "dodatki", label: "Dodatki", type: "multiselect", section: "Dodatki", options: [
        { key: "rain-sensor", label: "Czujnik deszczu", price: 980 },
        { key: "wind-sensor", label: "Czujnik wiatru", price: 980 },
        { key: "heater", label: "Promiennik ciepła", price: 1290 },
      ] },
    ],
  },
  {
    slug: "zadaszenia",
    name: "Zadaszenia",
    order: 1,
    fields: [
      { key: "rodzajZadaszenia", label: "Rodzaj zadaszenia", type: "select", section: "Podstawowe", required: true, options: [
        { key: "przyscienne", label: "Przyścienne" },
        { key: "wolnostojace", label: "Wolnostojące" },
      ] },
      { key: "wymiary", label: "Wymiary", type: "dimensions", section: "Podstawowe", config: {
        unit: "mm",
        subFields: [
          { key: "szerokosc", label: "Szer." },
          { key: "wysieg", label: "Wysięg" },
          { key: "wysokoscWyzsza", label: "Wys. wyż." },
          { key: "wysokoscNizsza", label: "Wys. niż." },
        ],
      } },
      { key: "dach", label: "Dach", type: "select", section: "Podstawowe", options: [
        { key: "szklo", label: "Szkło" },
        { key: "poliweglan", label: "Poliwęglan" },
        { key: "panel-nieprzezierny", label: "Panel nieprzezierny" },
        { key: "inne", label: "Inne" },
      ] },
      { key: "kolorKonstrukcji", label: "Kolor konstrukcji", type: "color", section: "Podstawowe", options: COLORS },

      { key: "liniowe-krokwie", label: "Liniowe w krokwiach", type: "select", section: "Oświetlenie", config: { group: "oswietlenie" }, options: LIGHT_FULL },
      { key: "punktowe-krokwie", label: "Punktowe w krokwiach", type: "select", section: "Oświetlenie", config: { group: "oswietlenie" }, options: LIGHT_POINT },

      { key: "zabudowyBoczne", label: "Zabudowy boczne", type: "multiselect", section: "Zabudowy boczne", options: ENCLOSURES },

      { key: "dodatki", label: "Dodatki", type: "multiselect", section: "Dodatki", options: [
        { key: "promiennik-ciepla", label: "Promiennik ciepła", price: 0 },
      ] },
    ],
  },
];

// ─── Seed mutation (idempotentna) ───────────────────────────────────────────────

export const seed = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const existing = await ctx.db.query("configuratorProducts").collect();
    if (existing.length > 0 && !force) {
      return { seeded: false, reason: "already-seeded", products: existing.length };
    }

    // force: wyczyść wszystko przed ponownym seedem
    if (force) {
      const opts = await ctx.db.query("configuratorOptions").collect();
      for (const o of opts) await ctx.db.delete(o._id);
      const fields = await ctx.db.query("configuratorFields").collect();
      for (const f of fields) await ctx.db.delete(f._id);
      for (const p of existing) await ctx.db.delete(p._id);
    }

    let productsCreated = 0;
    for (const p of SEED) {
      const productId = await ctx.db.insert("configuratorProducts", {
        slug: p.slug,
        name: p.name,
        order: p.order,
        isActive: true,
      });
      productsCreated++;

      let fieldOrder = 0;
      for (const f of p.fields) {
        const fieldId = await ctx.db.insert("configuratorFields", {
          productId,
          key: f.key,
          label: f.label,
          type: f.type,
          section: f.section,
          order: fieldOrder++,
          isRequired: f.required ?? false,
          isActive: true,
          config: f.config ?? undefined,
        });

        let optOrder = 0;
        for (const opt of f.options ?? []) {
          const optId: Id<"configuratorOptions"> = await ctx.db.insert("configuratorOptions", {
            fieldId,
            key: opt.key,
            label: opt.label,
            order: optOrder++,
            isActive: true,
            price: opt.price,
            swatch: opt.swatch,
            group: opt.group,
          });
          let childOrder = 0;
          for (const child of opt.children ?? []) {
            await ctx.db.insert("configuratorOptions", {
              fieldId,
              parentOptionId: optId,
              key: child.key,
              label: child.label,
              order: childOrder++,
              isActive: true,
              price: child.price,
            });
          }
        }
      }
    }

    return { seeded: true, products: productsCreated };
  },
});

// ─── Odczyt struktury ───────────────────────────────────────────────────────────

type OptionOut = {
  _id: Id<"configuratorOptions">;
  key: string;
  label: string;
  order: number;
  isActive: boolean;
  price?: number;
  swatch?: string;
  group?: string;
  children: OptionOut[];
};
type FieldOut = {
  _id: Id<"configuratorFields">;
  key: string;
  label: string;
  type: string;
  section: string;
  order: number;
  isRequired: boolean;
  isActive: boolean;
  config?: unknown;
  visibleWhen?: { fieldKey: string; equals: string };
  options: OptionOut[];
};
type StructureOut = {
  product: { _id: Id<"configuratorProducts">; slug: string; name: string };
  fields: FieldOut[];
} | null;

async function buildStructure(
  ctx: { db: { query: (t: "configuratorProducts" | "configuratorFields" | "configuratorOptions") => any } },
  slug: string,
  includeInactive = false,
): Promise<StructureOut> {
  const product = await ctx.db
    .query("configuratorProducts")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (!product) return null;

  const fields = await ctx.db
    .query("configuratorFields")
    .withIndex("by_product_order", (q: any) => q.eq("productId", product._id))
    .collect();

  const fieldsOut: FieldOut[] = [];
  for (const f of fields.sort((a: any, b: any) => a.order - b.order)) {
    if (!includeInactive && f.isActive === false) continue;
    const allOpts = await ctx.db
      .query("configuratorOptions")
      .withIndex("by_field_order", (q: any) => q.eq("fieldId", f._id))
      .collect();
    const visible = includeInactive ? allOpts : allOpts.filter((o: any) => o.isActive !== false);
    const roots = visible.filter((o: any) => !o.parentOptionId);
    const childrenByParent = new Map<string, any[]>();
    for (const o of visible) {
      if (o.parentOptionId) {
        const k = o.parentOptionId as unknown as string;
        if (!childrenByParent.has(k)) childrenByParent.set(k, []);
        childrenByParent.get(k)!.push(o);
      }
    }
    const mapOpt = (o: any): OptionOut => ({
      _id: o._id,
      key: o.key,
      label: o.label,
      order: o.order,
      isActive: o.isActive !== false,
      price: o.price,
      swatch: o.swatch,
      group: o.group,
      children: (childrenByParent.get(o._id as unknown as string) ?? [])
        .sort((a, b) => a.order - b.order)
        .map(mapOpt),
    });
    fieldsOut.push({
      _id: f._id,
      key: f.key,
      label: f.label,
      type: f.type,
      section: f.section,
      order: f.order,
      isRequired: f.isRequired,
      isActive: f.isActive !== false,
      config: f.config,
      visibleWhen: f.visibleWhen,
      options: roots.sort((a: any, b: any) => a.order - b.order).map(mapOpt),
    });
  }

  return {
    product: { _id: product._id, slug: product.slug, name: product.name },
    fields: fieldsOut,
  };
}

export const getStructure = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<StructureOut> => {
    return await buildStructure(ctx, slug);
  },
});

export const getStructureInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<StructureOut> => {
    return await buildStructure(ctx, slug);
  },
});

export const getStructureForAdmin = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<StructureOut> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    return await buildStructure(ctx, slug, true);
  },
});

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    return await ctx.db.query("configuratorProducts").order("asc").collect();
  },
});

// ─── CRUD (panel admina) ────────────────────────────────────────────────────────

async function requireAuth(ctx: { auth: unknown }) {
  const callerId = await getAuthUserId(ctx as any);
  if (!callerId) throw new Error("Brak autoryzacji");
  return callerId;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const fieldTypeValidator = v.union(
  v.literal("select"),
  v.literal("multiselect"),
  v.literal("number"),
  v.literal("dimensions"),
  v.literal("color"),
);

async function uniqueFieldKey(
  ctx: any,
  productId: Id<"configuratorProducts">,
  base: string,
): Promise<string> {
  const existing = await ctx.db
    .query("configuratorFields")
    .withIndex("by_product", (q: any) => q.eq("productId", productId))
    .collect();
  const used = new Set(existing.map((f: any) => f.key));
  let key = base || "pole";
  let n = 2;
  while (used.has(key)) key = `${base}-${n++}`;
  return key;
}

export const createField = mutation({
  args: {
    productId: v.id("configuratorProducts"),
    label: v.string(),
    type: fieldTypeValidator,
    section: v.string(),
    isRequired: v.optional(v.boolean()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const label = args.label.trim();
    if (!label) throw new Error("Nazwa pola nie może być pusta");
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Produkt nie istnieje");

    const siblings = await ctx.db
      .query("configuratorFields")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    const maxOrder = siblings.reduce((m, f) => Math.max(m, f.order), -1);
    const key = await uniqueFieldKey(ctx, args.productId, slugify(label));

    return await ctx.db.insert("configuratorFields", {
      productId: args.productId,
      key,
      label,
      type: args.type,
      section: args.section.trim() || "Podstawowe",
      order: maxOrder + 1,
      isRequired: args.isRequired ?? false,
      isActive: true,
      config: args.config ?? undefined,
    });
  },
});

export const updateField = mutation({
  args: {
    id: v.id("configuratorFields"),
    label: v.optional(v.string()),
    type: v.optional(fieldTypeValidator),
    section: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    config: v.optional(v.any()),
    visibleWhen: v.optional(
      v.union(v.object({ fieldKey: v.string(), equals: v.string() }), v.null()),
    ),
  },
  handler: async (ctx, { id, ...patch }) => {
    await requireAuth(ctx);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Pole nie istnieje");

    const upd: Record<string, unknown> = {};
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) throw new Error("Nazwa pola nie może być pusta");
      upd.label = label;
    }
    if (patch.type !== undefined) upd.type = patch.type;
    if (patch.section !== undefined) upd.section = patch.section.trim() || "Podstawowe";
    if (patch.isRequired !== undefined) upd.isRequired = patch.isRequired;
    if (patch.config !== undefined) upd.config = patch.config ?? undefined;
    if (patch.visibleWhen !== undefined) upd.visibleWhen = patch.visibleWhen ?? undefined;

    await ctx.db.patch(id, upd);
  },
});

export const toggleFieldActive = mutation({
  args: { id: v.id("configuratorFields") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    const f = await ctx.db.get(id);
    if (!f) throw new Error("Pole nie istnieje");
    await ctx.db.patch(id, { isActive: !f.isActive });
  },
});

// Przenosi pole w górę/dół w obrębie tej samej sekcji.
export const moveField = mutation({
  args: {
    id: v.id("configuratorFields"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { id, direction }) => {
    await requireAuth(ctx);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Pole nie istnieje");

    const siblings = (
      await ctx.db
        .query("configuratorFields")
        .withIndex("by_product", (q) => q.eq("productId", current.productId))
        .collect()
    )
      .filter((f) => f.section === current.section)
      .sort((a, b) => a.order - b.order);

    const idx = siblings.findIndex((s) => s._id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await ctx.db.patch(current._id, { order: other.order });
    await ctx.db.patch(other._id, { order: current.order });
  },
});

export const removeField = mutation({
  args: { id: v.id("configuratorFields") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    const f = await ctx.db.get(id);
    if (!f) throw new Error("Pole nie istnieje");
    const opts = await ctx.db
      .query("configuratorOptions")
      .withIndex("by_field", (q) => q.eq("fieldId", id))
      .collect();
    for (const o of opts) await ctx.db.delete(o._id);
    await ctx.db.delete(id);
  },
});

// ── Opcje ──

export const createOption = mutation({
  args: {
    fieldId: v.id("configuratorFields"),
    parentOptionId: v.optional(v.id("configuratorOptions")),
    label: v.string(),
    price: v.optional(v.number()),
    swatch: v.optional(v.string()),
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const label = args.label.trim();
    if (!label) throw new Error("Nazwa opcji nie może być pusta");
    const field = await ctx.db.get(args.fieldId);
    if (!field) throw new Error("Pole nie istnieje");

    const siblings = (
      await ctx.db
        .query("configuratorOptions")
        .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
        .collect()
    ).filter((o) =>
      args.parentOptionId
        ? o.parentOptionId === args.parentOptionId
        : !o.parentOptionId,
    );
    const maxOrder = siblings.reduce((m, o) => Math.max(m, o.order), -1);

    return await ctx.db.insert("configuratorOptions", {
      fieldId: args.fieldId,
      parentOptionId: args.parentOptionId,
      key: slugify(label) || `opcja-${maxOrder + 2}`,
      label,
      order: maxOrder + 1,
      isActive: true,
      price: args.price,
      swatch: args.swatch?.trim() || undefined,
      group: args.group?.trim() || undefined,
    });
  },
});

export const updateOption = mutation({
  args: {
    id: v.id("configuratorOptions"),
    label: v.optional(v.string()),
    price: v.optional(v.union(v.number(), v.null())),
    swatch: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...patch }) => {
    await requireAuth(ctx);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Opcja nie istnieje");

    const upd: Record<string, unknown> = {};
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) throw new Error("Nazwa opcji nie może być pusta");
      upd.label = label;
    }
    if (patch.price !== undefined) upd.price = patch.price ?? undefined;
    if (patch.swatch !== undefined) upd.swatch = patch.swatch?.trim() || undefined;
    if (patch.group !== undefined) upd.group = patch.group?.trim() || undefined;

    await ctx.db.patch(id, upd);
  },
});

export const toggleOptionActive = mutation({
  args: { id: v.id("configuratorOptions") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Opcja nie istnieje");
    await ctx.db.patch(id, { isActive: !o.isActive });
  },
});

export const moveOption = mutation({
  args: {
    id: v.id("configuratorOptions"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { id, direction }) => {
    await requireAuth(ctx);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Opcja nie istnieje");

    const siblings = (
      await ctx.db
        .query("configuratorOptions")
        .withIndex("by_field", (q) => q.eq("fieldId", current.fieldId))
        .collect()
    )
      .filter((o) => (o.parentOptionId ?? null) === (current.parentOptionId ?? null))
      .sort((a, b) => a.order - b.order);

    const idx = siblings.findIndex((s) => s._id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await ctx.db.patch(current._id, { order: other.order });
    await ctx.db.patch(other._id, { order: current.order });
  },
});

// Migracja: ustaw jednostkę wymiarów na mm we wszystkich polach typu dimensions
export const setDimensionsUnitMm = mutation({
  args: {},
  handler: async (ctx) => {
    const fields = await ctx.db.query("configuratorFields").collect();
    let updated = 0;
    for (const f of fields) {
      if (f.type === "dimensions") {
        const cfg = (f.config ?? {}) as Record<string, unknown>;
        if (cfg.unit !== "mm") {
          await ctx.db.patch(f._id, { config: { ...cfg, unit: "mm" } });
          updated++;
        }
      }
    }
    return { updated };
  },
});

export const removeOption = mutation({
  args: { id: v.id("configuratorOptions") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Opcja nie istnieje");
    // usuń pod-opcje / warianty
    const children = await ctx.db
      .query("configuratorOptions")
      .withIndex("by_parent", (q) => q.eq("parentOptionId", id))
      .collect();
    for (const c of children) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

// ─── Typy struktury (z api.configurator.getStructure) ───────────────────────────

type CfgOption = {
  key: string;
  label: string;
  price?: number;
  swatch?: string;
  group?: string;
  children: CfgOption[];
};
type CfgField = {
  key: string;
  label: string;
  type: "select" | "multiselect" | "number" | "dimensions" | "color";
  section: string;
  isRequired: boolean;
  config?: { group?: string; unit?: string; subFields?: { key: string; label: string }[] } | null;
  visibleWhen?: { fieldKey: string; equals: string } | null;
  options: CfgOption[];
};
type CfgStructure = {
  product: { slug: string; name: string };
  fields: CfgField[];
} | null | undefined;

// Wewnętrzna reprezentacja wartości pola
type VariantVal = { typ: string | null; wariant: string | null };
type ValueMap = Record<string, unknown>;

function isLighting(f: CfgField): boolean {
  return f.section === "Oświetlenie" && f.config?.group === "oswietlenie";
}
function hasVariants(f: CfgField): boolean {
  return f.options.some((o) => o.children.length > 0);
}

// ─── Parsowanie zapisanej konfiguracji → stan UI ────────────────────────────────

function initState(fields: CfgField[], cfg: Record<string, any> | null | undefined): ValueMap {
  const state: ValueMap = {};
  const oswietlenie = (cfg?.oswietlenie ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    if (isLighting(f)) {
      const v = oswietlenie[f.key];
      state[f.key] = typeof v === "string" ? v : null;
    } else if (f.type === "dimensions") {
      const obj = (cfg?.[f.key] ?? {}) as Record<string, unknown>;
      const dims: Record<string, number> = {};
      for (const sub of f.config?.subFields ?? []) {
        const n = Number(obj[sub.key]);
        dims[sub.key] = Number.isFinite(n) ? n : 0;
      }
      state[f.key] = dims;
    } else if (f.type === "multiselect") {
      if (hasVariants(f)) {
        const arr = Array.isArray(cfg?.[f.key]) ? (cfg![f.key] as any[]) : [];
        state[f.key] = arr
          .filter(Boolean)
          .map((x) => ({ typ: String(x.typ ?? ""), wariant: x.wariant ? String(x.wariant) : null }));
      } else {
        state[f.key] = Array.isArray(cfg?.[f.key]) ? (cfg![f.key] as string[]).filter(Boolean) : [];
      }
    } else if (f.type === "select" || f.type === "color") {
      if (hasVariants(f)) {
        const raw = cfg?.[f.key];
        if (raw && typeof raw === "object") {
          state[f.key] = { typ: raw.typ ?? null, wariant: raw.wariant ?? null } as VariantVal;
        } else {
          state[f.key] = { typ: null, wariant: null } as VariantVal;
        }
      } else {
        const raw = cfg?.[f.key];
        state[f.key] = typeof raw === "string" && raw ? raw : null;
      }
    }
  }
  return state;
}

// ─── Serializacja stanu → JSON w dotychczasowym kształcie ───────────────────────

function serialize(slug: string, fields: CfgField[], state: ValueMap, visible: (f: CfgField) => boolean): Record<string, unknown> {
  const out: Record<string, unknown> = { type: slug };
  const oswietlenie: Record<string, unknown> = {};
  let hasLighting = false;

  for (const f of fields) {
    if (!visible(f)) continue;
    const val = state[f.key];
    if (isLighting(f)) {
      hasLighting = true;
      oswietlenie[f.key] = (val as string | null) ?? null;
    } else if (f.type === "dimensions") {
      out[f.key] = (val as Record<string, number>) ?? {};
    } else if (f.type === "multiselect") {
      if (hasVariants(f)) {
        out[f.key] = ((val as VariantVal[]) ?? []).map((x) => ({ typ: x.typ, wariant: x.wariant ?? null }));
      } else {
        out[f.key] = (val as string[]) ?? [];
      }
    } else {
      // select / color
      if (hasVariants(f)) {
        const vv = (val as VariantVal) ?? { typ: null, wariant: null };
        out[f.key] = { typ: vv.typ ?? null, wariant: vv.wariant ?? null };
      } else {
        out[f.key] = (val as string | null) ?? "";
      }
    }
  }
  if (hasLighting) out.oswietlenie = oswietlenie;
  return out;
}

// ─── Wyliczanie ceny (suma cen wybranych opcji) ─────────────────────────────────

function structureHasPrices(fields: CfgField[]): boolean {
  const walk = (opts: CfgOption[]): boolean =>
    opts.some((o) => (o.price != null && o.price !== 0) || walk(o.children));
  return fields.some((f) => walk(f.options));
}

function computePrice(fields: CfgField[], state: ValueMap, visible: (f: CfgField) => boolean): number {
  let sum = 0;
  const priceOf = (opts: CfgOption[], label: string | null): CfgOption | undefined =>
    label ? opts.find((o) => o.label === label) : undefined;

  for (const f of fields) {
    if (!visible(f)) continue;
    const val = state[f.key];
    if (isLighting(f)) {
      const o = priceOf(f.options, val as string | null);
      sum += o?.price ?? 0;
    } else if (f.type === "select" || f.type === "color") {
      if (hasVariants(f)) {
        const vv = (val as VariantVal) ?? { typ: null, wariant: null };
        const root = priceOf(f.options, vv.typ);
        sum += root?.price ?? 0;
        if (root) sum += priceOf(root.children, vv.wariant)?.price ?? 0;
      } else {
        sum += priceOf(f.options, val as string | null)?.price ?? 0;
      }
    } else if (f.type === "multiselect") {
      if (hasVariants(f)) {
        for (const item of (val as VariantVal[]) ?? []) {
          const root = priceOf(f.options, item.typ);
          sum += root?.price ?? 0;
          if (root) sum += priceOf(root.children, item.wariant)?.price ?? 0;
        }
      } else {
        for (const label of (val as string[]) ?? []) sum += priceOf(f.options, label)?.price ?? 0;
      }
    }
  }
  return Math.round(sum * 100) / 100;
}

// ─── Widoczność (visibleWhen) i wymagalność ─────────────────────────────────────

function selectedLabels(f: CfgField, val: unknown): string[] {
  if (isLighting(f)) return val ? [val as string] : [];
  if (f.type === "select" || f.type === "color") {
    if (hasVariants(f)) { const v = val as VariantVal; return v?.typ ? [v.typ] : []; }
    return val ? [val as string] : [];
  }
  if (f.type === "multiselect") {
    if (hasVariants(f)) return ((val as VariantVal[]) ?? []).map((x) => x.typ).filter(Boolean) as string[];
    return (val as string[]) ?? [];
  }
  return [];
}

function isEmpty(f: CfgField, val: unknown): boolean {
  if (f.type === "dimensions") {
    const d = (val as Record<string, number>) ?? {};
    return (f.config?.subFields ?? []).some((s) => !d[s.key] || d[s.key] <= 0);
  }
  return selectedLabels(f, val).length === 0;
}

// Czy pole ma choć jakąś wartość (dla wymiarów: choć jedno pole > 0, nie wszystkie)
function fieldHasValue(f: CfgField, val: unknown): boolean {
  if (f.type === "dimensions") {
    const d = (val as Record<string, number>) ?? {};
    return (f.config?.subFields ?? []).some((s) => (d[s.key] ?? 0) > 0);
  }
  return selectedLabels(f, val).length > 0;
}

// ─── Kalkulator (tylko odczyt — pozycje liczone automatycznie z konfiguracji) ───

type CalcState = { vatRate: number };

function normalizeCalc(raw: unknown): CalcState {
  const c = (raw ?? {}) as Partial<CalcState>;
  return { vatRate: c.vatRate === 8 || c.vatRate === 23 ? c.vatRate : 23 };
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function fmtPLN(n: number): string { return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ─── Główny komponent ───────────────────────────────────────────────────────────

export function QuoteConfigurator({
  quoteId,
  slug,
  typeName,
  configuration,
  calculator,
  archived,
}: {
  quoteId: Id<"quotes">;
  slug: "pergola" | "zadaszenia";
  typeName: string;
  configuration: unknown;
  calculator?: unknown;
  archived: boolean;
}) {
  const structure = useQuery(api.configurator.getStructure, { slug }) as CfgStructure;
  const saveState = useMutation(api.quotes.saveConfiguratorState);
  const acceptVersion = useMutation(api.quoteVersions.acceptVersion);
  const versions = (useQuery(api.quoteVersions.listByQuote, { quoteId }) ?? []) as Array<{ _id: Id<"quoteVersions">; isConfigurator?: boolean; status: "draft" | "accepted" | "rejected" }>;
  const cfgVersion = versions.find((v) => v.isConfigurator === true);
  const [accepting, setAccepting] = useState(false);

  const fields = useMemo(() => structure?.fields ?? [], [structure]);
  const [state, setState] = useState<ValueMap | null>(null);
  const [calc, setCalc] = useState<CalcState>(() => normalizeCalc(calculator));
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<ValueMap | null>(null);
  const calcRef = useRef<CalcState>(calc);
  stateRef.current = state;
  calcRef.current = calc;

  // Inicjalizacja stanu (raz)
  useEffect(() => {
    if (structure === undefined || state !== null) return;
    const cfg = (configuration as { type?: string } | null | undefined)?.type === slug
      ? (configuration as Record<string, any>)
      : null;
    setState(initState(fields, cfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  const isVisible = useMemo(() => {
    return (f: CfgField): boolean => {
      if (!f.visibleWhen || !state) return true;
      const dep = fields.find((x) => x.key === f.visibleWhen!.fieldKey);
      if (!dep) return true;
      return selectedLabels(dep, state[dep.key]).includes(f.visibleWhen.equals);
    };
  }, [fields, state]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Grupowanie po sekcjach (widoczne pola)
  const sections = useMemo(() => {
    const out: { name: string; fields: CfgField[] }[] = [];
    for (const f of fields) {
      if (!isVisible(f)) continue;
      let s = out.find((x) => x.name === f.section);
      if (!s) { s = { name: f.section, fields: [] }; out.push(s); }
      s.fields.push(f);
    }
    return out;
  }, [fields, isVisible]);

  // Wyliczenia kalkulatora (tylko automatyczne, bez ręcznej edycji pozycji)
  function sectionAutoPrice(sec: { fields: CfgField[] }, st: ValueMap): number {
    return computePrice(sec.fields, st, isVisible);
  }

  function buildItems(st: ValueMap, c: CalcState) {
    const items: { lp: number; description: string; quantity: number | null; unit?: string; priceNetto: number | null; valueNetto: number | null }[] = [];
    let lp = 1;
    for (const sec of sections) {
      // Pozycja pojawia się, gdy w sekcji wybrano coś — niezależnie od tego, czy ma cenę
      const hasSelection = sec.fields.some((f) => fieldHasValue(f, st[f.key]));
      if (!hasSelection) continue;
      const price = round2(sectionAutoPrice(sec, st));
      items.push({ lp: lp++, description: sec.name, quantity: 1, unit: "kpl", priceNetto: price, valueNetto: price });
    }
    const netto = round2(items.reduce((s, it) => s + (it.valueNetto ?? 0), 0));
    const vat = round2(netto * (c.vatRate / 100));
    const brutto = round2(netto + vat);
    return { items, netto, vat, brutto };
  }

  function scheduleSave() {
    if (archived) return;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void doSave(), 800);
  }

  async function doSave() {
    const st = stateRef.current;
    const c = calcRef.current;
    if (!st) return;
    const json = serialize(slug, fields, st, isVisible);
    const { items, netto, vat, brutto } = buildItems(st, c);
    try {
      await saveState({
        id: quoteId,
        configuration: json,
        calculator: c,
        vatRate: c.vatRate,
        valueNetto: netto,
        valueVat: vat,
        valueBrutto: brutto,
        items,
      });
      setSaved(true);
    } catch { /* noop */ }
  }

  function updateField(key: string, value: unknown) {
    setState((prev) => { const next = { ...(prev ?? {}), [key]: value }; stateRef.current = next; scheduleSave(); return next; });
  }
  function patchCalc(updater: (c: CalcState) => CalcState) {
    setCalc((prev) => { const next = updater(prev); calcRef.current = next; scheduleSave(); return next; });
  }

  async function handleAcceptVersion() {
    if (!cfgVersion) return;
    setAccepting(true);
    try {
      await acceptVersion({ id: cfgVersion._id });
      toast.success("Wycena zatwierdzona — możesz teraz stworzyć zlecenie");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zatwierdzić");
    } finally {
      setAccepting(false);
    }
  }

  if (structure === undefined || state === null) {
    return <div className="qcfg-loading">Ładowanie konfiguratora…</div>;
  }
  if (structure === null) {
    return <div className="qcfg-empty">Brak zdefiniowanego konfiguratora dla „{typeName}".</div>;
  }

  const stepIdx = Math.min(step, Math.max(0, sections.length - 1));
  const current = sections[stepIdx];

  function sectionComplete(sec: { fields: CfgField[] }): boolean {
    const hasAny = sec.fields.some((f) => !isEmpty(f, state![f.key]));
    const reqOk = sec.fields.filter((f) => f.isRequired).every((f) => !isEmpty(f, state![f.key]));
    return hasAny && reqOk;
  }

  const { items, netto, vat, brutto } = buildItems(state, calc);

  return (
    <div className="qcfg2">
      {/* Lewa: kreator krokowy */}
      <div className="qcfg2-main">
        <div className="qcfg2-head">
          <span className="qcfg-title">Konfiguracja — {typeName}</span>
          <span className="qcfg-savehint">
            {archived ? "Tryb archiwum (podgląd)" : saved ? <><I.check s={12} /> zapisano</> : "zapisywanie…"}
          </span>
        </div>

        {/* Stepper */}
        <div className="qcfg2-steps">
          {sections.map((sec, i) => {
            const done = sectionComplete(sec);
            const active = i === stepIdx;
            return (
              <button
                key={sec.name}
                type="button"
                className={`qcfg2-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                onClick={() => setStep(i)}
              >
                <span className="qcfg2-step-circle">{done && !active ? <I.check s={13} sw={2.6} /> : i + 1}</span>
                <span className="qcfg2-step-label">{sec.name}</span>
              </button>
            );
          })}
        </div>

        {/* Pola bieżącego kroku */}
        {current && (
          <div className="qcfg2-step-body">
            <div className="qcfg2-step-title">{current.name}</div>
            <div className="qcfg-section-body">
              {current.fields.map((f) => (
                <FieldRenderer
                  key={f.key}
                  field={f}
                  value={state[f.key]}
                  disabled={archived}
                  onChange={(v) => updateField(f.key, v)}
                  empty={f.isRequired && isEmpty(f, state[f.key])}
                />
              ))}
            </div>
          </div>
        )}

        {/* Nawigacja */}
        <div className="qcfg2-nav">
          <button type="button" className="fluent-btn fluent-btn-ghost" disabled={stepIdx === 0} onClick={() => setStep(stepIdx - 1)}>
            ← Wstecz
          </button>
          <span className="qcfg2-nav-count">Krok {stepIdx + 1} z {sections.length}</span>
          <button type="button" className="fluent-btn fluent-btn-primary" disabled={stepIdx >= sections.length - 1} onClick={() => setStep(stepIdx + 1)}>
            Dalej →
          </button>
        </div>
      </div>

      {/* Prawa: kalkulator */}
      <aside className="qcfg2-calc">
        <div className="qcfg2-calc-head"><I.pln s={14} /> Kalkulator</div>

        <div className="qcfg2-calc-rows">
          {items.length === 0 && (
            <div className="qcfg2-calc-empty">Wybierz opcje w konfiguratorze, aby zobaczyć pozycje.</div>
          )}
          {items.map((it) => (
            <div key={it.lp} className="qcfg2-calc-row">
              <span className="qcfg2-calc-row-label">{it.description}</span>
              <span
                className={`qcfg2-calc-row-price${!it.valueNetto ? " is-zero" : ""}`}
                title={!it.valueNetto ? "Brak ceny ustawionej dla wybranych opcji (Administracja → Konfigurator)" : undefined}
              >
                {fmtPLN(it.valueNetto ?? 0)} zł
              </span>
            </div>
          ))}
        </div>

        <div className="qcfg2-calc-vat">
          <span>Stawka VAT</span>
          <div className="qcfg2-vat-toggle">
            {[8, 23].map((r) => (
              <button
                key={r}
                type="button"
                className={`qcfg2-vat-btn${calc.vatRate === r ? " is-active" : ""}`}
                disabled={archived}
                onClick={() => patchCalc((c) => ({ ...c, vatRate: r }))}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        <div className="qcfg2-calc-summary">
          <div className="qcfg2-sum-row"><span>Netto</span><strong>{fmtPLN(netto)} zł</strong></div>
          <div className="qcfg2-sum-row qcfg2-sum-row--muted"><span>VAT {calc.vatRate}%</span><span>{fmtPLN(vat)} zł</span></div>
          <div className="qcfg2-sum-row qcfg2-sum-row--total"><span>Brutto</span><strong>{fmtPLN(brutto)} zł</strong></div>
        </div>
        <div className="qcfg2-calc-note">Suma netto nadpisuje „Wartość netto" wyceny. Zapisuje się automatycznie ({items.length} poz.).</div>

        {!archived && (
          <div className="qcfg2-calc-accept">
            {cfgVersion?.status === "accepted" ? (
              <div className="qcfg2-accept-status is-ok">
                <I.check s={13} sw={2.6} /> Wycena zatwierdzona — możesz stworzyć zlecenie
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="fluent-btn fluent-btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={!cfgVersion || items.length === 0 || accepting || !saved}
                  onClick={() => void handleAcceptVersion()}
                >
                  {accepting ? "Zatwierdzanie…" : "Zatwierdź wycenę"}
                </button>
                <div className="qcfg2-calc-note">
                  {items.length === 0
                    ? "Wybierz przynajmniej jedną opcję w konfiguratorze, aby móc zatwierdzić."
                    : "Zatwierdzenie umożliwi utworzenie zlecenia (przycisk w górnym pasku)."}
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

// ─── Renderowanie pojedynczego pola ─────────────────────────────────────────────

function FieldRenderer({
  field, value, disabled, onChange, empty,
}: {
  field: CfgField;
  value: unknown;
  disabled: boolean;
  onChange: (v: unknown) => void;
  empty: boolean;
}) {
  const label = (
    <div className="qcfg-field-label">
      {field.label}
      {field.isRequired && <span className="qcfg-req">*</span>}
      {empty && <span className="qcfg-warn">wymagane</span>}
    </div>
  );

  // Oświetlenie (select z config.group=oswietlenie) → toggle + pod-opcje
  if (isLighting(field)) {
    const active = value != null;
    return (
      <div className="qcfg-field">
        {label}
        <div className={`cfg-lighting-item${active ? " is-active" : ""}`}>
          <button type="button" className={`cfg-lighting-toggle${active ? " is-active" : ""}`} disabled={disabled}
            onClick={() => onChange(active ? null : field.options[0]?.label ?? null)}>
            <span className="cfg-lighting-check">{active ? <I.check s={12} /> : <I.plus s={12} />}</span>
            <span>{field.label}</span>
          </button>
          {active && (
            <div className="cfg-lighting-subopts">
              {field.options.map((o) => (
                <button key={o.key} type="button" disabled={disabled}
                  className={`cfg-lighting-subopt${value === o.label ? " is-active" : ""}`}
                  onClick={() => onChange(o.label)}>{o.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "dimensions") {
    const dims = (value as Record<string, number>) ?? {};
    return (
      <div className="qcfg-field">
        {label}
        <div className="cfg-dims">
          {(field.config?.subFields ?? []).map((sub) => (
            <label key={sub.key} className="cfg-dim">
              <span className="cfg-dim-label">{sub.label}</span>
              <div className="cfg-dim-row">
                <input className="fluent-input cfg-dim-input" type="number" min={0} step={1} disabled={disabled}
                  value={dims[sub.key] ?? 0}
                  onChange={(e) => onChange({ ...dims, [sub.key]: Math.max(0, Number(e.target.value) || 0) })} />
                <span className="cfg-dim-unit">{field.config?.unit ?? "mm"}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "color") {
    const groups = [
      { key: "standard", label: "Standardowe RAL" },
      { key: "nonstandard", label: "Niestandardowe" },
      { key: "decor", label: "Dekory" },
    ];
    const ungrouped = field.options.filter((o) => !o.group);
    return (
      <div className="qcfg-field">
        {label}
        <div className="cfg-colors">
          {groups.map((g) => {
            const cols = field.options.filter((c) => c.group === g.key);
            if (!cols.length) return null;
            return (
              <div key={g.key} className="cfg-color-group">
                <div className="cfg-color-group-label">{g.label}</div>
                <div className="cfg-swatches">
                  {cols.map((c) => (
                    <button key={c.key} type="button" disabled={disabled} title={c.label}
                      className={`cfg-swatch${value === c.label ? " is-active" : ""}`}
                      onClick={() => onChange(value === c.label ? null : c.label)}>
                      <span className="cfg-swatch-circle" style={{ background: c.swatch }} />
                      <span className="cfg-swatch-name">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {ungrouped.length > 0 && (
            <div className="cfg-swatches">
              {ungrouped.map((c) => (
                <button key={c.key} type="button" disabled={disabled} title={c.label}
                  className={`cfg-swatch${value === c.label ? " is-active" : ""}`}
                  onClick={() => onChange(value === c.label ? null : c.label)}>
                  <span className="cfg-swatch-circle" style={{ background: c.swatch }} />
                  <span className="cfg-swatch-name">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // select
  if (field.type === "select") {
    if (hasVariants(field)) {
      const vv = (value as VariantVal) ?? { typ: null, wariant: null };
      const root = field.options.find((o) => o.label === vv.typ);
      return (
        <div className="qcfg-field">
          {label}
          <div className="cfg-enclosures">
            <div className="cfg-chips">
              {field.options.map((o) => (
                <button key={o.key} type="button" disabled={disabled}
                  className={`cfg-chip${vv.typ === o.label ? " is-active" : ""}`}
                  onClick={() => onChange(vv.typ === o.label ? { typ: null, wariant: null } : { typ: o.label, wariant: null })}>
                  {o.label}{o.price ? ` (+${o.price} zł)` : ""}
                </button>
              ))}
            </div>
            {root && root.children.length > 0 && (
              <div className="cfg-enclosure-variants">
                <div className="cfg-subsection-label">Wariant</div>
                <div className="cfg-chips">
                  {root.children.map((c) => (
                    <button key={c.key} type="button" disabled={disabled}
                      className={`cfg-chip${vv.wariant === c.label ? " is-active" : ""}`}
                      onClick={() => onChange({ typ: vv.typ, wariant: vv.wariant === c.label ? null : c.label })}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="qcfg-field">
        {label}
        <div className="cfg-chips">
          {field.options.map((o) => (
            <button key={o.key} type="button" disabled={disabled}
              className={`cfg-chip${value === o.label ? " is-active" : ""}`}
              onClick={() => onChange(value === o.label ? null : o.label)}>
              {o.label}{o.price ? ` (+${o.price} zł)` : ""}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // multiselect
  if (field.type === "multiselect") {
    if (hasVariants(field)) {
      const items = (value as VariantVal[]) ?? [];
      return (
        <div className="qcfg-field">
          {label}
          <div className="cfg-enclosures">
            <div className="cfg-chips">
              {field.options.map((o) => {
                const sel = items.some((s) => s.typ === o.label);
                return (
                  <button key={o.key} type="button" disabled={disabled}
                    className={`cfg-chip${sel ? " is-active" : ""}`}
                    onClick={() => onChange(sel ? items.filter((s) => s.typ !== o.label) : [...items, { typ: o.label, wariant: null }])}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {items.map((item) => {
              const root = field.options.find((o) => o.label === item.typ);
              if (!root || root.children.length === 0) return null;
              return (
                <div key={item.typ} className="cfg-enclosure-variants" style={{ marginTop: 12 }}>
                  <div className="cfg-subsection-label">Wariant – {item.typ}</div>
                  <div className="cfg-chips">
                    {root.children.map((c) => (
                      <button key={c.key} type="button" disabled={disabled}
                        className={`cfg-chip${item.wariant === c.label ? " is-active" : ""}`}
                        onClick={() => onChange(items.map((s) => s.typ === item.typ ? { ...s, wariant: s.wariant === c.label ? null : c.label } : s))}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    const selected = (value as string[]) ?? [];
    return (
      <div className="qcfg-field">
        {label}
        <div className="cfg-addons">
          {field.options.map((o) => {
            const active = selected.includes(o.label);
            return (
              <button key={o.key} type="button" disabled={disabled}
                className={`cfg-addon${active ? " is-active" : ""}`}
                onClick={() => onChange(active ? selected.filter((x) => x !== o.label) : [...selected, o.label])}>
                <span className="cfg-addon-check">{active ? <I.check s={12} /> : null}</span>
                <span className="cfg-addon-body">
                  <span className="cfg-addon-name">{o.label}</span>
                  {o.price ? <span className="cfg-addon-desc">{o.price} zł</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

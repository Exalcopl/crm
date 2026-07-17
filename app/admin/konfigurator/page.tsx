"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import "../users/users.css";

// ─── Typy (zgodne z api.configurator.getStructureForAdmin) ──────────────────────

type FieldType = "select" | "multiselect" | "number" | "dimensions" | "color";

type OptionNode = {
  _id: Id<"configuratorOptions">;
  key: string;
  label: string;
  order: number;
  isActive: boolean;
  price?: number;
  swatch?: string;
  group?: string;
  children: OptionNode[];
};
type FieldNode = {
  _id: Id<"configuratorFields">;
  key: string;
  label: string;
  type: FieldType;
  section: string;
  order: number;
  isRequired: boolean;
  isActive: boolean;
  config?: unknown;
  visibleWhen?: { fieldKey: string; equals: string };
  options: OptionNode[];
};
type Structure = {
  product: { _id: Id<"configuratorProducts">; slug: string; name: string };
  fields: FieldNode[];
} | null | undefined;

type Product = { _id: Id<"configuratorProducts">; slug: string; name: string; order: number };

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  select: "Lista wyboru",
  multiselect: "Wielokrotny wybór",
  number: "Liczba",
  dimensions: "Wymiary",
  color: "Kolor",
};

const HAS_OPTIONS: FieldType[] = ["select", "multiselect", "color"];

// ─── Modal: pole ────────────────────────────────────────────────────────────────

type FieldForm = {
  label: string;
  type: FieldType;
  section: string;
  isRequired: boolean;
  visibleWhenField: string; // "" = zawsze widoczne
  visibleWhenValue: string;
};

function FieldModal({
  initial,
  sections,
  otherFields,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: FieldNode;
  sections: string[];
  otherFields: FieldNode[];
  onSave: (data: FieldForm) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FieldForm>(
    initial
      ? {
          label: initial.label,
          type: initial.type,
          section: initial.section,
          isRequired: initial.isRequired,
          visibleWhenField: initial.visibleWhen?.fieldKey ?? "",
          visibleWhenValue: initial.visibleWhen?.equals ?? "",
        }
      : { label: "", type: "select", section: sections[0] ?? "Podstawowe", isRequired: false, visibleWhenField: "", visibleWhenValue: "" },
  );
  const [newSection, setNewSection] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onCancel(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onCancel, saving]);

  const depField = otherFields.find((f) => f.key === form.visibleWhenField);
  const depValues = depField ? depField.options.map((o) => o.label) : [];
  const valid = form.label.trim().length > 0 && form.section.trim().length > 0;

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>{initial ? "Edytuj pole" : "Nowe pole"}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} disabled={saving} aria-label="Zamknij"><I.x s={14} /></button>
        </div>
        <div className="users-modal-body">
          {error && <div className="users-error">{error}</div>}

          <label className="users-field">
            <span>Nazwa pola <span style={{ color: "#f85149" }}>*</span></span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="np. Rodzaj pergoli"
              disabled={saving}
              autoFocus
              style={inputStyle}
            />
          </label>

          <div className="users-field">
            <span>Typ pola</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className="users-btn users-btn-ghost"
                  style={{
                    padding: "6px 12px",
                    borderColor: form.type === t ? "var(--accent-primary)" : "var(--border-subtle)",
                    background: form.type === t ? "rgba(88,166,255,0.12)" : "transparent",
                    color: form.type === t ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                  disabled={saving}
                >
                  {FIELD_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="users-field">
            <span>Sekcja</span>
            {newSection ? (
              <input
                value={form.section}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                placeholder="Nazwa nowej sekcji"
                disabled={saving}
                style={inputStyle}
              />
            ) : (
              <select
                value={form.section}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setNewSection(true); setForm((f) => ({ ...f, section: "" })); }
                  else setForm((f) => ({ ...f, section: e.target.value }));
                }}
                disabled={saving}
                style={inputStyle}
              >
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Nowa sekcja…</option>
              </select>
            )}
          </div>

          <div className="users-field">
            <span>Widoczne gdy (zależność)</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={form.visibleWhenField}
                onChange={(e) => setForm((f) => ({ ...f, visibleWhenField: e.target.value, visibleWhenValue: "" }))}
                disabled={saving}
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              >
                <option value="">Zawsze widoczne</option>
                {otherFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              {form.visibleWhenField && (
                depValues.length > 0 ? (
                  <select
                    value={form.visibleWhenValue}
                    onChange={(e) => setForm((f) => ({ ...f, visibleWhenValue: e.target.value }))}
                    disabled={saving}
                    style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                  >
                    <option value="">= wybierz wartość</option>
                    {depValues.map((val) => <option key={val} value={val}>{val}</option>)}
                  </select>
                ) : (
                  <input
                    value={form.visibleWhenValue}
                    onChange={(e) => setForm((f) => ({ ...f, visibleWhenValue: e.target.value }))}
                    placeholder="= wartość"
                    disabled={saving}
                    style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                  />
                )
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Pole pokaże się w konfiguratorze tylko gdy wybrane pole ma podaną wartość.
            </span>
          </div>

          <label style={checkboxRow}>
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} disabled={saving} />
            Wymagane
          </label>
        </div>
        <div className="users-modal-foot">
          <button type="button" className="users-btn users-btn-ghost" onClick={onCancel} disabled={saving}>Anuluj</button>
          <button type="button" className="users-btn users-btn-primary" onClick={() => onSave(form)} disabled={saving || !valid}>
            {saving ? "Zapisywanie…" : initial ? "Zapisz" : "Dodaj pole"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: opcja ────────────────────────────────────────────────────────────────

type OptionForm = { label: string; price: string; swatch: string };

function OptionModal({
  initial,
  isColor,
  isVariant,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: OptionNode;
  isColor: boolean;
  isVariant: boolean;
  onSave: (data: OptionForm) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<OptionForm>({
    label: initial?.label ?? "",
    price: initial?.price != null ? String(initial.price) : "",
    swatch: initial?.swatch ?? "",
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  const valid = form.label.trim().length > 0;
  const title = initial ? "Edytuj opcję" : isVariant ? "Nowy wariant" : "Nowa opcja";

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} disabled={saving} aria-label="Zamknij"><I.x s={14} /></button>
        </div>
        <div className="users-modal-body">
          {error && <div className="users-error">{error}</div>}
          <label className="users-field">
            <span>Nazwa <span style={{ color: "#f85149" }}>*</span></span>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} disabled={saving} autoFocus style={inputStyle} />
          </label>

          {!isVariant && (
            <label className="users-field">
              <span>Cena (zł, opcjonalnie)</span>
              <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="np. 980" disabled={saving} style={inputStyle} />
            </label>
          )}

          {isColor && (
            <label className="users-field">
              <span>Próbka koloru (CSS, opcjonalnie)</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={form.swatch} onChange={(e) => setForm((f) => ({ ...f, swatch: e.target.value }))} placeholder="np. #1a1a1a lub oklch(0.2 0 0)" disabled={saving} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-subtle)", background: form.swatch || "transparent", flexShrink: 0 }} />
              </div>
            </label>
          )}
        </div>
        <div className="users-modal-foot">
          <button type="button" className="users-btn users-btn-ghost" onClick={onCancel} disabled={saving}>Anuluj</button>
          <button type="button" className="users-btn users-btn-primary" onClick={() => onSave(form)} disabled={saving || !valid}>
            {saving ? "Zapisywanie…" : initial ? "Zapisz" : "Dodaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Zamknij"><I.x s={14} /></button>
        </div>
        <div className="users-modal-body"><p style={{ margin: 0, fontSize: 13 }}>{message}</p></div>
        <div className="users-modal-foot">
          <button type="button" className="users-btn users-btn-ghost" onClick={onCancel} autoFocus>Nie</button>
          <button type="button" className="users-btn users-btn-ghost" onClick={onConfirm} style={{ color: "#ffb4af" }}><I.trash s={14} /> Tak, usuń</button>
        </div>
      </div>
    </div>
  );
}

// ─── Wiersz opcji ────────────────────────────────────────────────────────────────

function OptionRow({
  opt, idx, count, isColor, depth,
  onEdit, onToggle, onMove, onDelete, onAddVariant,
}: {
  opt: OptionNode; idx: number; count: number; isColor: boolean; depth: number;
  onEdit: () => void; onToggle: () => void; onMove: (d: "up" | "down") => void; onDelete: () => void; onAddVariant?: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px " + (depth * 22 + 8) + "px", opacity: opt.isActive ? 1 : 0.5, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", gap: 2 }}>
          <button type="button" className="icon-btn" title="W górę" onClick={() => onMove("up")} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}><I.up s={12} /></button>
          <button type="button" className="icon-btn" title="W dół" onClick={() => onMove("down")} disabled={idx === count - 1} style={{ opacity: idx === count - 1 ? 0.3 : 1, transform: "rotate(180deg)" }}><I.up s={12} /></button>
        </div>
        {isColor && depth === 0 && (
          <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border-subtle)", background: opt.swatch || "transparent", flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{opt.label}</span>
        {opt.price != null && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{opt.price} zł</span>
        )}
        <button type="button" onClick={onToggle} title="Aktywna / nieaktywna" style={statusPill(opt.isActive)}>{opt.isActive ? "Akt." : "Nieakt."}</button>
        {onAddVariant && (
          <button type="button" className="users-btn users-btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={onAddVariant}><I.plus s={11} /> wariant</button>
        )}
        <button type="button" className="icon-btn" title="Edytuj" onClick={onEdit}><I.edit s={13} /></button>
        <button type="button" className="icon-btn" title="Usuń" onClick={onDelete} style={{ color: "#ffb4af" }}><I.trash s={13} /></button>
      </div>
    </>
  );
}

// ─── Strona ──────────────────────────────────────────────────────────────────────

export default function KonfiguratorPage() {
  const products = (useQuery(api.configurator.listProducts, {}) as Product[] | undefined) ?? [];
  const [slug, setSlug] = useState<string | null>(null);
  const activeSlug = slug ?? products[0]?.slug ?? null;

  const structure = useQuery(
    api.configurator.getStructureForAdmin,
    activeSlug ? { slug: activeSlug } : "skip",
  ) as Structure;

  // Mutacje
  const createField = useMutation(api.configurator.createField);
  const updateField = useMutation(api.configurator.updateField);
  const toggleFieldActive = useMutation(api.configurator.toggleFieldActive);
  const moveField = useMutation(api.configurator.moveField);
  const removeField = useMutation(api.configurator.removeField);
  const createOption = useMutation(api.configurator.createOption);
  const updateOption = useMutation(api.configurator.updateOption);
  const toggleOptionActive = useMutation(api.configurator.toggleOptionActive);
  const moveOption = useMutation(api.configurator.moveOption);
  const removeOption = useMutation(api.configurator.removeOption);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modale
  const [fieldModal, setFieldModal] = useState<{ mode: "create" | "edit"; field?: FieldNode; section?: string } | null>(null);
  const [optionModal, setOptionModal] = useState<{ fieldId: Id<"configuratorFields">; isColor: boolean; parentId?: Id<"configuratorOptions">; option?: OptionNode } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);

  const sections = useMemo(() => {
    const list: string[] = [];
    for (const f of structure?.fields ?? []) if (!list.includes(f.section)) list.push(f.section);
    if (!list.includes("Podstawowe")) list.push("Podstawowe");
    return list;
  }, [structure]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function guard(fn: () => Promise<unknown>) {
    setSaving(true); setError("");
    try { await fn(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Błąd"); return false; }
    finally { setSaving(false); }
  }

  async function handleFieldSave(data: FieldForm) {
    if (!structure) return;
    const visibleWhen = data.visibleWhenField && data.visibleWhenValue
      ? { fieldKey: data.visibleWhenField, equals: data.visibleWhenValue }
      : null;
    const ok = await guard(async () => {
      if (fieldModal?.mode === "edit" && fieldModal.field) {
        await updateField({ id: fieldModal.field._id, label: data.label, type: data.type, section: data.section, isRequired: data.isRequired, visibleWhen });
      } else {
        await createField({ productId: structure.product._id, label: data.label, type: data.type, section: data.section, isRequired: data.isRequired });
      }
    });
    if (ok) setFieldModal(null);
  }

  async function handleOptionSave(data: OptionForm) {
    if (!optionModal) return;
    const price = data.price.trim() === "" ? null : Number(data.price.replace(",", "."));
    const ok = await guard(async () => {
      if (optionModal.option) {
        await updateOption({ id: optionModal.option._id, label: data.label, price, swatch: optionModal.isColor ? (data.swatch || null) : undefined });
      } else {
        await createOption({
          fieldId: optionModal.fieldId,
          parentOptionId: optionModal.parentId,
          label: data.label,
          price: price ?? undefined,
          swatch: optionModal.isColor ? (data.swatch || undefined) : undefined,
        });
      }
    });
    if (ok) setOptionModal(null);
  }

  // grupowanie pól po sekcjach (z zachowaniem kolejności)
  const grouped = useMemo(() => {
    const map = new Map<string, FieldNode[]>();
    for (const f of structure?.fields ?? []) {
      if (!map.has(f.section)) map.set(f.section, []);
      map.get(f.section)!.push(f);
    }
    return Array.from(map.entries());
  }, [structure]);

  const otherFieldsForDep = (current?: FieldNode) =>
    (structure?.fields ?? []).filter((f) => f.key !== current?.key && HAS_OPTIONS.includes(f.type));

  return (
    <main className="users-content">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Konfigurator</h1>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Struktura produktów zasilająca CRM i konfigurator na stronie www.
        </span>
      </div>

      {/* Zakładki produktów */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {products.map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => setSlug(p.slug)}
            className="users-btn users-btn-ghost"
            style={{
              padding: "6px 16px",
              borderColor: p.slug === activeSlug ? "var(--accent-primary)" : "var(--border-subtle)",
              background: p.slug === activeSlug ? "rgba(88,166,255,0.12)" : "transparent",
              color: p.slug === activeSlug ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: p.slug === activeSlug ? 600 : 400,
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {error && <div className="users-error" style={{ marginTop: 10 }}>{error}</div>}

      {products === undefined || (activeSlug && structure === undefined) ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 16 }}>Ładowanie…</div>
      ) : (products.length === 0 || structure === null) ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 16 }}>
          Brak danych. Uruchom seed: <code>npx convex run configurator:seed</code>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 20 }}>
          {grouped.map(([section, fields]) => (
            <div key={section}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                {section}
              </div>
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
                {fields.map((f, idx) => {
                  const canOptions = HAS_OPTIONS.includes(f.type);
                  const isOpen = expanded.has(f._id);
                  const isColor = f.type === "color";
                  return (
                    <div key={f._id} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)", opacity: f.isActive ? 1 : 0.55 }}>
                      {/* wiersz pola */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-surface)" }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button type="button" className="icon-btn" title="W górę" onClick={() => void moveField({ id: f._id, direction: "up" })} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}><I.up s={13} /></button>
                          <button type="button" className="icon-btn" title="W dół" onClick={() => void moveField({ id: f._id, direction: "down" })} disabled={idx === fields.length - 1} style={{ opacity: idx === fields.length - 1 ? 0.3 : 1, transform: "rotate(180deg)" }}><I.up s={13} /></button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.label}</span>
                            {f.isRequired && <span style={{ fontSize: 10, color: "#fbbf24" }}>wymagane</span>}
                            {f.visibleWhen && <span style={{ fontSize: 10, color: "var(--text-muted)" }} title={`widoczne gdy ${f.visibleWhen.fieldKey} = ${f.visibleWhen.equals}`}>⛓ zależne</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{f.key}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", padding: "2px 8px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>{FIELD_TYPE_LABELS[f.type]}</span>
                        {canOptions && (
                          <button type="button" className="users-btn users-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => toggleExpand(f._id)}>
                            {f.options.length} opcji <span style={{ display: "inline-flex", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}><I.up s={11} /></span>
                          </button>
                        )}
                        <button type="button" onClick={() => void toggleFieldActive({ id: f._id })} style={statusPill(f.isActive)}>{f.isActive ? "Aktywne" : "Nieaktywne"}</button>
                        <button type="button" className="icon-btn" title="Edytuj pole" onClick={() => setFieldModal({ mode: "edit", field: f })}><I.edit s={14} /></button>
                        <button type="button" className="icon-btn" title="Usuń pole" style={{ color: "#ffb4af" }} onClick={() => setConfirm({ title: "Usuń pole", message: `Usunąć pole „${f.label}" wraz z opcjami?`, run: async () => { await removeField({ id: f._id }); } })}><I.trash s={14} /></button>
                      </div>

                      {/* opcje */}
                      {canOptions && isOpen && (
                        <div style={{ padding: "4px 12px 12px", background: "var(--bg-base)" }}>
                          {f.options.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>Brak opcji.</div>}
                          {f.options.map((o, oi) => (
                            <div key={o._id}>
                              <OptionRow
                                opt={o} idx={oi} count={f.options.length} isColor={isColor} depth={0}
                                onEdit={() => setOptionModal({ fieldId: f._id, isColor, option: o })}
                                onToggle={() => void toggleOptionActive({ id: o._id })}
                                onMove={(d) => void moveOption({ id: o._id, direction: d })}
                                onDelete={() => setConfirm({ title: "Usuń opcję", message: `Usunąć opcję „${o.label}"${o.children.length ? " wraz z wariantami" : ""}?`, run: async () => { await removeOption({ id: o._id }); } })}
                                onAddVariant={() => setOptionModal({ fieldId: f._id, isColor: false, parentId: o._id })}
                              />
                              {o.children.map((c, ci) => (
                                <OptionRow
                                  key={c._id}
                                  opt={c} idx={ci} count={o.children.length} isColor={false} depth={1}
                                  onEdit={() => setOptionModal({ fieldId: f._id, isColor: false, option: c, parentId: o._id })}
                                  onToggle={() => void toggleOptionActive({ id: c._id })}
                                  onMove={(d) => void moveOption({ id: c._id, direction: d })}
                                  onDelete={() => setConfirm({ title: "Usuń wariant", message: `Usunąć wariant „${c.label}"?`, run: async () => { await removeOption({ id: c._id }); } })}
                                />
                              ))}
                            </div>
                          ))}
                          <button type="button" className="users-btn users-btn-ghost" style={{ marginTop: 10, padding: "5px 12px", fontSize: 12 }} onClick={() => setOptionModal({ fieldId: f._id, isColor })}>
                            <I.plus s={12} /> Dodaj opcję
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ padding: 10, borderTop: "1px solid var(--border-subtle)" }}>
                  <button type="button" className="users-btn users-btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setFieldModal({ mode: "create", section })}>
                    <I.plus s={12} /> Dodaj pole do „{section}"
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div>
            <button type="button" className="users-btn users-btn-primary" onClick={() => setFieldModal({ mode: "create" })}>
              <I.plus s={14} /> Dodaj pole (nowa sekcja)
            </button>
          </div>
        </div>
      )}

      {fieldModal && (
        <FieldModal
          initial={fieldModal.field}
          sections={fieldModal.section ? [fieldModal.section, ...sections.filter((s) => s !== fieldModal.section)] : sections}
          otherFields={otherFieldsForDep(fieldModal.field)}
          onSave={handleFieldSave}
          onCancel={() => setFieldModal(null)}
          saving={saving}
          error={error}
        />
      )}

      {optionModal && (
        <OptionModal
          initial={optionModal.option}
          isColor={optionModal.isColor}
          isVariant={!!optionModal.parentId && !optionModal.option}
          onSave={handleOptionSave}
          onCancel={() => setOptionModal(null)}
          saving={saving}
          error={error}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={async () => { await guard(confirm.run); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </main>
  );
}

// ─── Style pomocnicze ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "var(--text-secondary)",
  cursor: "pointer",
};

function statusPill(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 10px",
    borderRadius: 10,
    border: active ? "1px solid rgba(63,185,80,0.5)" : "1px solid rgba(139,148,158,0.4)",
    background: active ? "rgba(63,185,80,0.15)" : "rgba(139,148,158,0.1)",
    color: active ? "#56d364" : "#8b949e",
    cursor: "pointer",
    fontWeight: 500,
    whiteSpace: "nowrap",
  };
}

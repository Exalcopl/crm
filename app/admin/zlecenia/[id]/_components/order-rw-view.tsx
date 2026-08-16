"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { I } from "../../../_lib/icons";

// ─── Typy ──────────────────────────────────────────────────────────────────────

type RwItem = {
  lp: number;
  element: string;
  quantity: number;
  unit: string;
  priceUnit: number;
  priceTotal: number;
  description?: string;
};

type ProdItem = RwItem & {
  changeType: string;
  materialId?: string;
  originalLp?: number;
};

type RwSection = {
  id: string;
  name: string;
  items: RwItem[];
  sectionTotal: number;
};

type ProdSection = {
  id: string;
  name: string;
  isCustom?: boolean;
  items: ProdItem[];
  sectionTotal: number;
};

// ─── Kolory wierszy wg changeType ──────────────────────────────────────────────
const CHANGE_COLORS: Record<string, string> = {
  unchanged: "transparent",
  modified: "rgba(210, 153, 34, 0.08)",
  replaced: "rgba(88, 166, 255, 0.08)",
  added: "rgba(63, 185, 80, 0.08)",
  removed: "rgba(212, 29, 60, 0.08)",
};

const CHANGE_BADGE: Record<string, { label: string; color: string }> = {
  unchanged: { label: "", color: "" },
  modified: { label: "ZMIENIONO", color: "#d29922" },
  replaced: { label: "ZAMIENNIK", color: "#58a6ff" },
  added: { label: "DODANO", color: "#3fb950" },
  removed: { label: "USUNIĘTO", color: "#f85149" },
};

// ─── Helper ─────────────────────────────────────────────────────────────────────
function formatPLN(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

// ─── Modal wyboru materiału z bazy ─────────────────────────────────────────────
function MaterialPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (mat: { name: string; unit: string; priceUnit: number; id: string }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const materials = useQuery(api.materials.list, { search: search || undefined, category: category || undefined }) ?? [];

  const CATEGORIES = [
    { id: "", label: "Wszystkie" },
    { id: "PROFILE", label: "Profile" },
    { id: "PROFILE_DODATKOWE", label: "Profile dodatkowe" },
    { id: "AKCESORIA", label: "Akcesoria" },
    { id: "OKUCIA", label: "Okucia" },
    { id: "WYPELNIENIA", label: "Wypełnienia" },
    { id: "INNE", label: "Inne" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#161b22", border: "1px solid #30363d", borderRadius: 10,
        width: 580, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc" }}>Wybierz materiał z bazy</div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #21262d", display: "flex", gap: 8 }}>
          <input
            autoFocus
            type="text"
            placeholder="Szukaj materiału…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
          >
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {materials.length === 0 ? (
            <div style={{ padding: 20, color: "#8b949e", fontSize: 13, textAlign: "center" }}>
              Brak materiałów. <br />
              <span style={{ fontSize: 12 }}>Dodaj materiały w module Materiały/Cennik lub zaseed-uj przykładowe dane.</span>
            </div>
          ) : (
            materials.map((mat) => (
              <button
                key={mat._id}
                type="button"
                onClick={() => onSelect({ name: mat.name, unit: mat.unit, priceUnit: mat.priceUnit, id: mat._id })}
                style={{
                  display: "flex", alignItems: "center", width: "100%", background: "transparent",
                  border: "none", borderBottom: "1px solid #21262d", padding: "10px 16px",
                  cursor: "pointer", textAlign: "left", color: "#f0f6fc",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#21262d"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{mat.name}</div>
                  <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                    {mat.sku && <span style={{ marginRight: 8 }}>SKU: {mat.sku}</span>}
                    {mat.category} · {mat.unit}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#3fb950", marginLeft: 12, flexShrink: 0 }}>
                  {formatPLN(mat.priceUnit)}/{mat.unit}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal edycji wiersza produkcyjnego ────────────────────────────────────────
function EditItemModal({
  item,
  onSave,
  onClose,
}: {
  item: ProdItem;
  onSave: (updated: ProdItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...item });
  const [showPicker, setShowPicker] = useState(false);

  function recalcTotal() {
    setForm((f) => ({ ...f, priceTotal: parseFloat((f.quantity * f.priceUnit).toFixed(2)) }));
  }

  return (
    <>
      {showPicker && (
        <MaterialPickerModal
          onSelect={(mat) => {
            setForm((f) => ({
              ...f,
              element: mat.name,
              unit: mat.unit,
              priceUnit: mat.priceUnit,
              priceTotal: parseFloat((f.quantity * mat.priceUnit).toFixed(2)),
              materialId: mat.id,
              changeType: "replaced",
            }));
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
      <div style={{
        position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10, width: 460, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc" }}>Edycja pozycji produkcyjnej</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" style={{ flex: 1 }} onClick={() => setShowPicker(true)}>
              <I.link s={13} /> Wybierz z bazy materiałów
            </button>
          </div>

          <label style={{ fontSize: 12, color: "#8b949e" }}>
            Nazwa elementu
            <input
              type="text"
              value={form.element}
              onChange={(e) => setForm({ ...form, element: e.target.value, changeType: form.changeType === "unchanged" ? "modified" : form.changeType })}
              style={{ display: "block", width: "100%", marginTop: 4, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ fontSize: 12, color: "#8b949e", flex: 1 }}>
              Ilość
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0, changeType: form.changeType === "unchanged" ? "modified" : form.changeType })}
                onBlur={recalcTotal}
                style={{ display: "block", width: "100%", marginTop: 4, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12, color: "#8b949e", flex: 1 }}>
              Jednostka
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                style={{ display: "block", width: "100%", marginTop: 4, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
              />
            </label>
          </div>

          <label style={{ fontSize: 12, color: "#8b949e" }}>
            Cena jednostkowa (netto)
            <input
              type="number"
              value={form.priceUnit}
              onChange={(e) => setForm({ ...form, priceUnit: parseFloat(e.target.value) || 0, changeType: form.changeType === "unchanged" ? "modified" : form.changeType })}
              onBlur={recalcTotal}
              style={{ display: "block", width: "100%", marginTop: 4, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            />
          </label>

          <div style={{ background: "#0d1117", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#f0f6fc", display: "flex", justifyContent: "space-between" }}>
            <span>Wartość łączna:</span>
            <strong style={{ color: "#3fb950" }}>{formatPLN(form.quantity * form.priceUnit)}</strong>
          </div>

          <label style={{ fontSize: 12, color: "#8b949e" }}>
            Opis (opcjonalnie)
            <input
              type="text"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ display: "block", width: "100%", marginTop: 4, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={onClose}>Anuluj</button>
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              onClick={() => onSave({ ...form, priceTotal: parseFloat((form.quantity * form.priceUnit).toFixed(2)) })}
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tabela sekcji oryginalne (read-only) ─────────────────────────────────────
function OriginalRwTable({ sections }: { sections: RwSection[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sections.map((s) => s.id)));

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sections.map((sec) => (
        <div key={sec.id} style={{ border: "1px solid #30363d", borderRadius: 6, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => toggle(sec.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#21262d", border: "none", color: "#f0f6fc", padding: "8px 12px", cursor: "pointer",
              fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#8b949e" }}>{expanded.has(sec.id) ? "▾" : "▸"}</span>
              {sec.name}
              <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>({sec.items.length} poz.)</span>
            </span>
            <span style={{ color: "#3fb950", fontWeight: 700 }}>{formatPLN(sec.sectionTotal)}</span>
          </button>
          {expanded.has(sec.id) && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1117" }}>
                  {["Lp.", "Element", "Ilość", "Jm.", "Cena jdn.", "Wartość"].map((h) => (
                    <th key={h} style={{ padding: "5px 8px", fontSize: 11, color: "#8b949e", textAlign: "left", borderBottom: "1px solid #21262d", whiteSpace: "nowrap" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.items.map((it) => (
                  <tr key={it.lp} style={{ borderBottom: "1px solid #21262d" }}>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" as const }}>{it.lp}</td>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc" }}>{it.element}</td>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc", whiteSpace: "nowrap" as const }}>{it.quantity}</td>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" as const }}>{it.unit}</td>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc", whiteSpace: "nowrap" as const }}>{formatPLN(it.priceUnit)}</td>
                    <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc", fontWeight: 500, whiteSpace: "nowrap" as const }}>{formatPLN(it.priceTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tabela sekcji produkcyjnych (edytowalna) ─────────────────────────────────
function ProductionRwTable({
  sections,
  onChange,
}: {
  sections: ProdSection[];
  onChange: (sections: ProdSection[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sections.map((s) => s.id)));
  const [editItem, setEditItem] = useState<{ sectionId: string; lp: number } | null>(null);
  const [addSectionName, setAddSectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  function updateItem(sectionId: string, updated: ProdItem) {
    onChange(sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      const items = sec.items.map((it) => it.lp === updated.lp ? updated : it);
      return { ...sec, items, sectionTotal: items.filter((i) => i.changeType !== "removed").reduce((s, i) => s + i.priceTotal, 0) };
    }));
    setEditItem(null);
  }

  function removeItem(sectionId: string, lp: number) {
    onChange(sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      const items = sec.items.map((it) => it.lp === lp ? { ...it, changeType: "removed", priceTotal: 0 } : it);
      return { ...sec, items, sectionTotal: items.filter((i) => i.changeType !== "removed").reduce((s, i) => s + i.priceTotal, 0) };
    }));
  }

  function restoreItem(sectionId: string, lp: number) {
    onChange(sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      const items = sec.items.map((it) => it.lp === lp ? { ...it, changeType: it.materialId ? "replaced" : it.element !== (it as any).originalElement ? "modified" : "unchanged", priceTotal: it.quantity * it.priceUnit } : it);
      return { ...sec, items, sectionTotal: items.filter((i) => i.changeType !== "removed").reduce((s, i) => s + i.priceTotal, 0) };
    }));
  }

  function addItem(sectionId: string) {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const maxLp = sec.items.reduce((m, i) => Math.max(m, i.lp), 0);
    const newItem: ProdItem = { lp: maxLp + 1, element: "Nowa pozycja", quantity: 1, unit: "szt.", priceUnit: 0, priceTotal: 0, changeType: "added" };
    const items = [...sec.items, newItem];
    onChange(sections.map((s) => s.id === sectionId ? { ...s, items, sectionTotal: items.filter((i) => i.changeType !== "removed").reduce((sum, i) => sum + i.priceTotal, 0) } : s));
    setEditItem({ sectionId, lp: newItem.lp });
  }

  function addSection() {
    if (!addSectionName.trim()) return;
    const newSec: ProdSection = {
      id: `custom_${Date.now()}`,
      name: addSectionName.trim().toUpperCase(),
      isCustom: true,
      items: [],
      sectionTotal: 0,
    };
    onChange([...sections, newSec]);
    setExpanded((prev) => new Set([...prev, newSec.id]));
    setAddSectionName("");
    setShowAddSection(false);
  }

  function removeSection(sectionId: string) {
    onChange(sections.filter((s) => s.id !== sectionId));
  }

  const editingItem = editItem
    ? sections.find((s) => s.id === editItem.sectionId)?.items.find((i) => i.lp === editItem.lp)
    : null;

  return (
    <>
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={(updated) => updateItem(editItem!.sectionId, updated)}
          onClose={() => setEditItem(null)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sections.map((sec) => (
          <div key={sec.id} style={{ border: `1px solid ${sec.isCustom ? "#3fb950" : "#30363d"}`, borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: sec.isCustom ? "rgba(63, 185, 80, 0.08)" : "#21262d",
                borderBottom: expanded.has(sec.id) ? `1px solid ${sec.isCustom ? "#3fb950" : "#30363d"}` : "none",
                padding: "8px 12px",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(sec.id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 6,
                  background: "transparent", border: "none", color: "#f0f6fc",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  textTransform: "uppercase" as const, letterSpacing: "0.04em", textAlign: "left" as const,
                }}
              >
                <span style={{ color: "#8b949e" }}>{expanded.has(sec.id) ? "▾" : "▸"}</span>
                {sec.name}
                {sec.isCustom && <span style={{ fontSize: 10, color: "#3fb950", border: "1px solid #3fb950", borderRadius: 3, padding: "1px 5px", fontWeight: 400 }}>WŁASNA</span>}
                <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 400 }}>({sec.items.filter((i) => i.changeType !== "removed").length} poz.)</span>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#3fb950", fontWeight: 700, fontSize: 12 }}>
                  {formatPLN(sec.sectionTotal)}
                </span>
                {sec.isCustom && (
                  <button type="button" title="Usuń sekcję" onClick={() => removeSection(sec.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#f85149", fontSize: 14, padding: "0 2px" }}>×</button>
                )}
              </div>
            </div>
            {expanded.has(sec.id) && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0d1117" }}>
                      {["Lp.", "Element", "Ilość", "Jm.", "Cena jdn.", "Wartość", ""].map((h, i) => (
                        <th key={i} style={{ padding: "5px 8px", fontSize: 11, color: "#8b949e", textAlign: "left", borderBottom: "1px solid #21262d", whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((it) => {
                      const isRemoved = it.changeType === "removed";
                      const badge = CHANGE_BADGE[it.changeType];
                      return (
                        <tr
                          key={it.lp}
                          style={{
                            borderBottom: "1px solid #21262d",
                            background: CHANGE_COLORS[it.changeType] ?? "transparent",
                            opacity: isRemoved ? 0.45 : 1,
                          }}
                        >
                          <td style={{ padding: "5px 8px", fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" as const }}>{it.lp}</td>
                          <td style={{ padding: "5px 8px", fontSize: 12, color: isRemoved ? "#8b949e" : "#f0f6fc" }}>
                            <span style={{ textDecoration: isRemoved ? "line-through" : "none" }}>{it.element}</span>
                            {badge.label && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: badge.color, border: `1px solid ${badge.color}`, borderRadius: 3, padding: "1px 4px", verticalAlign: "middle" }}>
                                {badge.label}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc", whiteSpace: "nowrap" as const }}>{it.quantity}</td>
                          <td style={{ padding: "5px 8px", fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" as const }}>{it.unit}</td>
                          <td style={{ padding: "5px 8px", fontSize: 12, color: "#f0f6fc", whiteSpace: "nowrap" as const }}>{isRemoved ? "—" : formatPLN(it.priceUnit)}</td>
                          <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" as const, color: isRemoved ? "#f85149" : "#f0f6fc" }}>
                            {isRemoved ? "0,00 zł" : formatPLN(it.priceTotal)}
                          </td>
                          <td style={{ padding: "4px 8px", whiteSpace: "nowrap" as const }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              {!isRemoved && (
                                <button
                                  type="button"
                                  title="Edytuj"
                                  onClick={() => setEditItem({ sectionId: sec.id, lp: it.lp })}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", padding: "2px 4px", borderRadius: 3, fontSize: 12 }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = "#f0f6fc"}
                                  onMouseLeave={(e) => e.currentTarget.style.color = "#8b949e"}
                                >
                                  ✎
                                </button>
                              )}
                              {isRemoved ? (
                                <button
                                  type="button"
                                  title="Przywróć"
                                  onClick={() => restoreItem(sec.id, it.lp)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#3fb950", padding: "2px 4px", borderRadius: 3, fontSize: 12 }}
                                >
                                  ↺
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Usuń z produkcji"
                                  onClick={() => removeItem(sec.id, it.lp)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", padding: "2px 4px", borderRadius: 3, fontSize: 12 }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = "#f85149"}
                                  onMouseLeave={(e) => e.currentTarget.style.color = "#8b949e"}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: "6px 10px", background: "#0d1117", borderTop: "1px solid #21262d" }}>
                  <button
                    type="button"
                    onClick={() => addItem(sec.id)}
                    style={{ background: "transparent", border: "1px dashed #30363d", color: "#8b949e", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer", width: "100%" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3fb950"; e.currentTarget.style.color = "#3fb950"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                  >
                    + Dodaj pozycję
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Dodaj nową sekcję */}
        {showAddSection ? (
          <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
            <input
              autoFocus
              type="text"
              placeholder="Nazwa sekcji (np. USŁUGI)"
              value={addSectionName}
              onChange={(e) => setAddSectionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSection()}
              style={{ flex: 1, background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            />
            <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={addSection}>Dodaj</button>
            <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={() => { setShowAddSection(false); setAddSectionName(""); }}>Anuluj</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddSection(true)}
            style={{ background: "transparent", border: "1px dashed #30363d", color: "#8b949e", borderRadius: 6, padding: "8px", fontSize: 12, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#58a6ff"; e.currentTarget.style.color = "#58a6ff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
          >
            + Dodaj własną sekcję
          </button>
        )}
      </div>
    </>
  );
}

// ─── Panel Oszczędności ────────────────────────────────────────────────────────
function SavingsDashboard({
  totalOriginal,
  totalProduction,
  totalSavings,
  sections,
}: {
  totalOriginal: number;
  totalProduction: number;
  totalSavings: number;
  sections: ProdSection[];
}) {
  const savingsPercent = totalOriginal > 0 ? ((totalSavings / totalOriginal) * 100).toFixed(1) : "0.0";
  const isPositive = totalSavings >= 0;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 16 }}>
      {/* Koszt oryginalny */}
      <div style={{ flex: "1 1 160px", background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Koszt oryginalny</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc" }}>{formatPLN(totalOriginal)}</div>
        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>z pliku RW</div>
      </div>

      {/* Koszt produkcyjny */}
      <div style={{ flex: "1 1 160px", background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Koszt produkcyjny</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc" }}>{formatPLN(totalProduction)}</div>
        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>po optymalizacji</div>
      </div>

      {/* Oszczędności */}
      <div style={{
        flex: "1 1 160px",
        background: isPositive ? "rgba(63, 185, 80, 0.06)" : "rgba(212, 29, 60, 0.06)",
        border: `1px solid ${isPositive ? "#3fb950" : "#f85149"}`,
        borderRadius: 8,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>
          {isPositive ? "Oszczędności" : "Dopłata"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: isPositive ? "#3fb950" : "#f85149" }}>
          {isPositive ? "+" : ""}{formatPLN(totalSavings)}
        </div>
        <div style={{ fontSize: 11, color: isPositive ? "#3fb950" : "#f85149", marginTop: 2 }}>
          {isPositive ? "−" : "+"}{Math.abs(parseFloat(savingsPercent))}% vs oryginał
        </div>
      </div>

      {/* Podział na sekcje */}
      <div style={{ flex: "2 1 240px", background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8 }}>Oszczędności wg sekcji</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
          {sections.map((sec) => {
            const savings = 0; // będzie liczone przez porównanie z oryginałem w komponencie nadrzędnym
            return (
              <div key={sec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#8b949e" }}>{sec.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f6fc" }}>{formatPLN(sec.sectionTotal)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Główny komponent widoku RW ────────────────────────────────────────────────
export function OrderRwView({ orderId }: { orderId: Id<"orders"> }) {
  const rw = useQuery(api.orderRw.getByOrderId, { orderId });
  const importSampleRw = useMutation(api.orderRw.importSampleRw);
  const saveProductionSections = useMutation(api.orderRw.saveProductionSections);

  const [localSections, setLocalSections] = useState<ProdSection[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Synchronizuj lokalny stan gdy dane z bazy się zmienią
  const prodSections = localSections ?? (rw?.productionSections as ProdSection[] | undefined) ?? null;

  function handleChange(sections: ProdSection[]) {
    setLocalSections(sections);
    setDirty(true);
  }

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importSampleRw({ orderId });
      toast.success(`Zaimportowano RW: ${result.sections} sekcji, łącznie ${formatPLN(result.totalOriginal)}`);
      setLocalSections(null);
      setDirty(false);
    } catch (e: any) {
      toast.error(e.message || "Błąd importu RW");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    if (!prodSections) return;
    setSaving(true);
    try {
      await saveProductionSections({ orderId, productionSections: prodSections });
      toast.success("Zapisano RW produkcyjne");
      setDirty(false);
    } catch (e: any) {
      toast.error(e.message || "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!rw) return;
    setLocalSections(rw.productionSections as ProdSection[]);
    setDirty(false);
  }

  // Przelicz totale na bieżąco
  const totalProduction = prodSections
    ? prodSections.reduce((sum, sec) => sum + sec.sectionTotal, 0)
    : (rw?.totalProduction ?? 0);
  const totalOriginal = rw?.totalOriginal ?? 0;
  const totalSavings = totalOriginal - totalProduction;

  if (rw === undefined) {
    return (
      <div style={{ padding: 40, color: "#8b949e", textAlign: "center", fontSize: 14 }}>
        Ładowanie danych RW…
      </div>
    );
  }

  if (rw === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: 60, gap: 16 }}>
        <div style={{ fontSize: 40 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f6fc" }}>Brak karty RW</div>
        <div style={{ fontSize: 13, color: "#8b949e", textAlign: "center" as const, maxWidth: 360 }}>
          Dla tego zlecenia nie zaimportowano jeszcze Rozchodu Wewnętrznego.<br />
          Kliknij poniżej, aby załadować przykładowe dane (symulacja OCR z pliku PDF).
        </div>
        <button
          type="button"
          className="fluent-btn fluent-btn-primary"
          onClick={handleImport}
          disabled={importing}
          style={{ gap: 8 }}
        >
          {importing ? "Importowanie…" : "📥 Importuj RW (Symulacja)"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
      {/* Pasek akcji */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 16px" }}>
        <div style={{ fontSize: 13, color: "#8b949e" }}>
          {rw.importedAt && (
            <span>Importowano: <strong style={{ color: "#f0f6fc" }}>{new Date(rw.importedAt).toLocaleDateString("pl-PL")}</strong></span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost fluent-btn-sm"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? "…" : "📥 Reimportuj RW"}
          </button>
          {dirty && (
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost fluent-btn-sm"
              onClick={handleReset}
            >
              ↺ Resetuj do oryginału
            </button>
          )}
          <button
            type="button"
            className="fluent-btn fluent-btn-primary fluent-btn-sm"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? "Zapisywanie…" : dirty ? "💾 Zapisz zmiany" : "✓ Zapisano"}
          </button>
        </div>
      </div>

      {/* Panel oszczędności */}
      {prodSections && (
        <SavingsDashboard
          totalOriginal={totalOriginal}
          totalProduction={totalProduction}
          totalSavings={totalSavings}
          sections={prodSections}
        />
      )}

      {/* 2-grid: Oryginalne RW | Produkcyjne RW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Lewy grid: Oryginalne RW */}
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#21262d", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              📄 Oryginalne RW
            </span>
            <span style={{ fontSize: 11, color: "#8b949e" }}>— z zamówienia (tylko odczyt)</span>
          </div>
          <div style={{ padding: 12 }}>
            <OriginalRwTable sections={rw.originalSections as RwSection[]} />
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#0d1117", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8b949e" }}>Łącznie (netto):</span>
              <strong style={{ color: "#f0f6fc" }}>{formatPLN(totalOriginal)}</strong>
            </div>
          </div>
        </div>

        {/* Prawy grid: Produkcyjne RW */}
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#21262d", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              🔧 RW Produkcyjne
            </span>
            <span style={{ fontSize: 11, color: "#8b949e" }}>— edytowalne przez pracownika</span>
          </div>
          <div style={{ padding: 12 }}>
            {prodSections && (
              <ProductionRwTable
                sections={prodSections}
                onChange={handleChange}
              />
            )}
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#0d1117", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "#8b949e" }}>Łącznie (netto):</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <strong style={{ color: "#f0f6fc" }}>{formatPLN(totalProduction)}</strong>
                {totalSavings !== 0 && (
                  <span style={{ fontSize: 12, color: totalSavings > 0 ? "#3fb950" : "#f85149", fontWeight: 600 }}>
                    {totalSavings > 0 ? "−" : "+"}{formatPLN(Math.abs(totalSavings))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" as const }}>
        {Object.entries(CHANGE_BADGE).filter(([, v]) => v.label).map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b949e" }}>
            <span style={{ fontSize: 10, color: val.color, border: `1px solid ${val.color}`, borderRadius: 3, padding: "1px 4px" }}>{val.label}</span>
            <span>
              {key === "modified" && "Zmieniona ilość/cena"}
              {key === "replaced" && "Zamiennik z bazy materiałów"}
              {key === "added" && "Nowa pozycja"}
              {key === "removed" && "Wyłączona z produkcji"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

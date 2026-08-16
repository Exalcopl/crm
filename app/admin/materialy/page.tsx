"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";

// ─── Stałe ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "PROFILE", label: "Profile" },
  { id: "PROFILE_DODATKOWE", label: "Profile dodatkowe" },
  { id: "AKCESORIA", label: "Akcesoria" },
  { id: "OKUCIA", label: "Okucia" },
  { id: "WYPELNIENIA", label: "Wypełnienia" },
  { id: "INNE", label: "Inne" },
];

const UNITS = ["mb.", "szt.", "kpl.", "m²", "kg", "m³", "l", "op."];

function formatPLN(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

// ─── Formularz dodawania / edycji ──────────────────────────────────────────────
function MaterialForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: {
    _id?: Id<"materials">;
    name: string;
    description?: string;
    unit: string;
    priceUnit: number;
    category: string;
    sku?: string;
    supplier?: string;
  };
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    unit: initial?.unit ?? "szt.",
    priceUnit: initial?.priceUnit ?? 0,
    category: initial?.category ?? "INNE",
    sku: initial?.sku ?? "",
    supplier: initial?.supplier ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Podaj nazwę materiału"); return; }
    if (form.priceUnit < 0) { toast.error("Cena nie może być ujemna"); return; }
    setBusy(true);
    try {
      await onSave({
        ...form,
        description: form.description || undefined,
        sku: form.sku || undefined,
        supplier: form.supplier || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0d1117",
    border: "1px solid #30363d",
    color: "#f0f6fc",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Nazwa materiału *
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} disabled={busy} placeholder="np. Profil PVC 70mm biały" />
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Kategoria *
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} disabled={busy}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Cena jednostkowa netto (zł) *
          <input type="number" value={form.priceUnit} onChange={(e) => setForm({ ...form, priceUnit: parseFloat(e.target.value) || 0 })} style={inputStyle} disabled={busy} step="0.01" min="0" />
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Jednostka miary *
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={inputStyle} disabled={busy}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Symbol / Indeks (SKU)
          <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={inputStyle} disabled={busy} placeholder="np. PRF-70-BIA" />
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Dostawca
          <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={inputStyle} disabled={busy} placeholder="np. Firma Veka" />
        </label>
      </div>
      <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
        Opis (opcjonalnie)
        <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} disabled={busy} placeholder="Dodatkowe informacje…" />
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={onCancel} disabled={busy}>Anuluj</button>
        <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={handleSave} disabled={busy}>
          {busy ? "Zapisywanie…" : (initial?._id ? "Zapisz zmiany" : "Dodaj materiał")}
        </button>
      </div>
    </div>
  );
}

// ─── Strona główna ─────────────────────────────────────────────────────────────
export default function MaterialyPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"materials"> | null>(null);
  const [seeding, setSeeding] = useState(false);

  const materials = useQuery(api.materials.list, {
    search: search || undefined,
    category: filterCategory || undefined,
  }) ?? [];

  const createMaterial = useMutation(api.materials.create);
  const updateMaterial = useMutation(api.materials.update);
  const removeMaterial = useMutation(api.materials.remove);
  const seedMaterials = useMutation(api.materials.seedSampleMaterials);

  const editingMat = editId ? materials.find((m) => m._id === editId) : null;

  async function handleCreate(data: any) {
    try {
      await createMaterial(data);
      toast.success("Materiał dodany");
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || "Błąd dodawania");
    }
  }

  async function handleUpdate(data: any) {
    if (!editId) return;
    try {
      await updateMaterial({ id: editId, ...data });
      toast.success("Zapisano zmiany");
      setEditId(null);
    } catch (e: any) {
      toast.error(e.message || "Błąd zapisu");
    }
  }

  async function handleRemove(id: Id<"materials">) {
    if (!confirm("Na pewno usunąć ten materiał z cennika?")) return;
    try {
      await removeMaterial({ id });
      toast.success("Materiał usunięty");
    } catch (e: any) {
      toast.error(e.message || "Błąd usuwania");
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await seedMaterials({});
      toast.success(`Zaimportowano ${result.inserted} przykładowych materiałów`);
    } catch (e: any) {
      toast.error(e.message || "Błąd seedowania");
    } finally {
      setSeeding(false);
    }
  }

  // Grupowanie wg kategorii
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: materials.filter((m) => m.category === cat.id),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Ribbon */}
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn
            icon={<I.arrowLeft s={22} />}
            label="Wróć"
            onClick={() => router.back()}
          />
        </RibbonGroup>
        <RibbonGroup label="Materiały">
          <RibbonBtn
            icon={<I.plus s={22} />}
            label="Dodaj materiał"
            onClick={() => { setShowForm(true); setEditId(null); }}
          />
          <RibbonBtn
            icon={<I.doc s={22} />}
            label="Importuj przykłady"
            onClick={handleSeed}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content" style={{ padding: "20px 24px" }}>
        {/* Nagłówek */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc", margin: 0 }}>Materiały / Cennik</h1>
          <p style={{ fontSize: 13, color: "#8b949e", margin: "4px 0 0" }}>
            Baza materiałów używana przy tworzeniu produkcyjnych RW. {materials.length} pozycji.
          </p>
        </div>

        {/* Formularz dodawania */}
        {(showForm || editId) && (
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc", marginBottom: 14 }}>
              {editId ? "Edytuj materiał" : "Nowy materiał"}
            </div>
            <MaterialForm
              initial={editingMat ? { _id: editingMat._id, name: editingMat.name, description: editingMat.description, unit: editingMat.unit, priceUnit: editingMat.priceUnit, category: editingMat.category, sku: editingMat.sku, supplier: editingMat.supplier } : undefined}
              onSave={editId ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditId(null); }}
            />
          </div>
        )}

        {/* Wyszukiwarka i filtry */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Szukaj po nazwie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: "#161b22", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "8px 12px", fontSize: 13, fontFamily: "inherit" }}
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}
          >
            <option value="">Wszystkie kategorie</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Brak materiałów */}
        {materials.length === 0 && (
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc", marginBottom: 6 }}>Brak materiałów w bazie</div>
            <div style={{ fontSize: 13, color: "#8b949e", marginBottom: 16 }}>
              Dodaj materiały ręcznie lub zaimportuj przykładowy cennik (19 pozycji).
            </div>
            <button type="button" className="fluent-btn fluent-btn-primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? "Importowanie…" : "📥 Importuj przykładowe materiały"}
            </button>
          </div>
        )}

        {/* Tabela materiałów */}
        {materials.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {grouped.map((grp) => (
              <div key={grp.id} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
                {/* Nagłówek kategorii */}
                <div style={{ padding: "10px 16px", background: "#21262d", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", textTransform: "uppercase", letterSpacing: "0.05em" }}>{grp.label}</span>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>{grp.items.length} poz.</span>
                </div>

                {/* Tabela */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0d1117" }}>
                      {["Nazwa", "SKU", "Cena jedn.", "Jm.", "Dostawca", ""].map((h, i) => (
                        <th key={i} style={{ padding: "6px 12px", fontSize: 11, color: "#8b949e", textAlign: "left", borderBottom: "1px solid #21262d", fontWeight: 600, letterSpacing: "0.03em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grp.items.map((mat) => (
                      <tr
                        key={mat._id}
                        style={{ borderBottom: "1px solid #21262d", cursor: "pointer" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#1c2128"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "8px 12px", fontSize: 13, color: "#f0f6fc" }}>
                          {mat.name}
                          {mat.description && <div style={{ fontSize: 11, color: "#8b949e", marginTop: 1 }}>{mat.description}</div>}
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#8b949e", fontFamily: "monospace" }}>{mat.sku ?? "—"}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: "#3fb950", fontWeight: 600 }}>{formatPLN(mat.priceUnit)}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#8b949e" }}>{mat.unit}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#8b949e" }}>{mat.supplier ?? "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              title="Edytuj"
                              onClick={() => { setEditId(mat._id); setShowForm(false); }}
                              style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#58a6ff"; e.currentTarget.style.color = "#58a6ff"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                            >
                              Edytuj
                            </button>
                            <button
                              type="button"
                              title="Usuń"
                              onClick={() => handleRemove(mat._id)}
                              style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f85149"; e.currentTarget.style.color = "#f85149"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                            >
                              Usuń
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

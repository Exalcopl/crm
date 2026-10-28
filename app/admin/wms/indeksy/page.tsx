"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Btn,
  Card,
  Empty,
  errMsg,
  Field,
  fmtNum,
  Grid,
  inputStyle,
  Page,
  Table,
  Td,
  Tr,
  C,
} from "../_components/ui";

type IndexFormState = {
  id?: Id<"materials">;
  categoryId: string; // Grupa towarowa (nadrzędna)
  wmsObjectId: string; // System / Podgrupa (np. Procural)
  sku: string; // Kod indeksu (np. PE50, PE68)
  name: string; // Nazwa indeksu
  supplier: string;
  description: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  thicknessMm: string;
  weightKg: string;
  customAttributes: Record<string, string>;
};

const DEFAULT_INDEX_FORM: IndexFormState = {
  categoryId: "",
  wmsObjectId: "",
  sku: "",
  name: "",
  supplier: "",
  description: "",
  lengthMm: "",
  widthMm: "",
  heightMm: "",
  thicknessMm: "",
  weightKg: "",
  customAttributes: {},
};

export default function WmsIndeksyPage() {
  const categories = useQuery(api.wms.listCategories, {});
  const objects = useQuery(api.wms.listObjects, {});
  const indexes = useQuery(api.wms.listIndexes, {});

  const upsertIndex = useMutation(api.wms.upsertIndex);
  const deleteIndex = useMutation(api.wms.deleteIndex);

  // Stan formularza tworzenia/edycji indeksu
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<IndexFormState>(DEFAULT_INDEX_FORM);
  const [busy, setBusy] = useState(false);

  // Filtry listy
  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState("");
  const [filterObjId, setFilterObjId] = useState("");

  const selectedObj = (objects ?? []).find((o) => o._id === form.wmsObjectId);
  const fc = selectedObj?.fieldsConfig;
  type CustomFieldDef = {
    key: string;
    label: string;
    type: "text" | "number" | "select";
    options?: string[];
    required: boolean;
  };
  const customFields: CustomFieldDef[] = (selectedObj?.customFields ?? []) as CustomFieldDef[];

  // Dostępne systemy/podgrupy dla wybranej grupy w formularzu
  const availableObjects = (objects ?? []).filter(
    (o) => !form.categoryId || o.categoryId === form.categoryId,
  );

  function startNewIndex() {
    const firstCat = filterCatId || (categories && categories.length > 0 ? categories[0]._id : "");
    const matchingObjs = (objects ?? []).filter((o) => !firstCat || o.categoryId === firstCat);
    const firstObj = filterObjId || (matchingObjs.length > 0 ? matchingObjs[0]._id : "");

    setForm({
      ...DEFAULT_INDEX_FORM,
      categoryId: firstCat,
      wmsObjectId: firstObj,
    });
    setEditing(true);
  }

  function startEditIndex(row: NonNullable<typeof indexes>[number]) {
    const m = row.material;
    const catId = row.category?._id ?? (row.object ? row.object.categoryId : "");
    setForm({
      id: m._id,
      categoryId: catId,
      wmsObjectId: m.wmsObjectId ?? "",
      sku: m.sku ?? "",
      name: m.name,
      supplier: m.supplier ?? "",
      description: m.description ?? "",
      lengthMm: m.lengthMm !== undefined ? String(m.lengthMm) : "",
      widthMm: m.widthMm !== undefined ? String(m.widthMm) : "",
      heightMm: m.heightMm !== undefined ? String(m.heightMm) : "",
      thicknessMm: m.thicknessMm !== undefined ? String(m.thicknessMm) : "",
      weightKg: m.weightKg !== undefined ? String(m.weightKg) : "",
      customAttributes: (m.customAttributes as Record<string, string>) ?? {},
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!form.wmsObjectId) {
      toast.error("Wybierz system / podgrupę (np. Procural)");
      return;
    }
    if (!form.sku.trim()) {
      toast.error("Podaj kod indeksu (np. PE50, PE68)");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Podaj nazwę indeksu");
      return;
    }

    // Walidacja wymaganych wymiarów z obiektu
    if (fc) {
      if (fc.lengthMm?.enabled && fc.lengthMm?.required && !form.lengthMm) {
        toast.error(`Pole "${fc.lengthMm.label || "Długość (mm)"}" jest wymagane dla tego systemu`);
        return;
      }
      if (fc.widthMm?.enabled && fc.widthMm?.required && !form.widthMm) {
        toast.error(`Pole "${fc.widthMm.label || "Szerokość (mm)"}" jest wymagane dla tego systemu`);
        return;
      }
      if (fc.heightMm?.enabled && fc.heightMm?.required && !form.heightMm) {
        toast.error(`Pole "${fc.heightMm.label || "Wysokość (mm)"}" jest wymagane dla tego systemu`);
        return;
      }
      if (fc.thicknessMm?.enabled && fc.thicknessMm?.required && !form.thicknessMm) {
        toast.error(`Pole "${fc.thicknessMm.label || "Grubość (mm)"}" jest wymagane dla tego systemu`);
        return;
      }
      if (fc.weightKg?.enabled && fc.weightKg?.required && !form.weightKg) {
        toast.error(`Pole "${fc.weightKg.label || "Masa (kg)"}" jest wymagane dla tego systemu`);
        return;
      }
    }

    setBusy(true);
    try {
      await upsertIndex({
        id: form.id,
        wmsObjectId: form.wmsObjectId as Id<"wms_objects">,
        wmsCategoryId: (form.categoryId as Id<"wms_categories">) || selectedObj?.categoryId,
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        supplier: form.supplier.trim() || undefined,
        description: form.description.trim() || undefined,
        lengthMm: form.lengthMm ? Number(form.lengthMm) : undefined,
        widthMm: form.widthMm ? Number(form.widthMm) : undefined,
        heightMm: form.heightMm ? Number(form.heightMm) : undefined,
        thicknessMm: form.thicknessMm ? Number(form.thicknessMm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        customAttributes: Object.keys(form.customAttributes).length > 0 ? form.customAttributes : undefined,
      });
      toast.success(form.id ? "Zaktualizowano indeks magazynowy" : "Utworzono nowy indeks magazynowy");
      setEditing(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: Id<"materials">, name: string) {
    if (!confirm(`Czy na pewno chcesz usunąć indeks "${name}"?`)) return;
    try {
      const res = await deleteIndex({ id });
      if (res.deactivated) {
        toast.info(`Indeks "${name}" został dezaktywowany (posiada historię partii w magazynie)`);
      } else {
        toast.success(`Usunięto indeks "${name}"`);
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  // Filtrowanie listy indeksów
  const filtered = (indexes ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesQ =
      !q ||
      r.material.name.toLowerCase().includes(q) ||
      (r.material.sku ?? "").toLowerCase().includes(q) ||
      (r.object?.name ?? "").toLowerCase().includes(q) ||
      (r.category?.name ?? "").toLowerCase().includes(q);
    const matchesCat = !filterCatId || r.category?._id === filterCatId;
    const matchesObj = !filterObjId || r.object?._id === filterObjId;
    return matchesQ && matchesCat && matchesObj;
  });

  return (
    <Page
      title="Indeksy magazynowe"
      subtitle="Kartoteka indeksów (artykułów) przypisanych do grup towarowych i systemów (np. Grupa: Profile aluminiowe → System: Procural → Indeksy: PE50, PE68)."
      actions={
        <Btn primary onClick={startNewIndex}>
          + Nowy indeks
        </Btn>
      }
    >
      {/* ─── FORMULARZ TWORZENIA / EDYCJI INDEKSU ──────────────────────── */}
      {editing && (
        <div style={{ marginBottom: 20 }}>
          <Card title={form.id ? `Edycja indeksu: ${form.name}` : "Nowy indeks magazynowy"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Grid cols={3}>
                <Field label="1. Grupa towarowa (nadrzędna) *">
                  <select
                    style={inputStyle}
                    value={form.categoryId}
                    onChange={(e) => {
                      const newCatId = e.target.value;
                      const nextObjs = (objects ?? []).filter((o) => !newCatId || o.categoryId === newCatId);
                      setForm({
                        ...form,
                        categoryId: newCatId,
                        wmsObjectId: nextObjs.length > 0 ? nextObjs[0]._id : "",
                      });
                    }}
                  >
                    <option value="">Wybierz grupę towarową…</option>
                    {(categories ?? []).map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="2. System / Podgrupa *">
                  <select
                    style={inputStyle}
                    value={form.wmsObjectId}
                    onChange={(e) => {
                      const objId = e.target.value;
                      const obj = (objects ?? []).find((o) => o._id === objId);
                      setForm({
                        ...form,
                        wmsObjectId: objId,
                        categoryId: obj ? obj.categoryId : form.categoryId,
                      });
                    }}
                  >
                    <option value="">Wybierz system / podgrupę…</option>
                    {availableObjects.map((obj) => (
                      <option key={obj._id} value={obj._id}>
                        {obj.name} {obj.code ? `(${obj.code})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="3. Kod indeksu *">
                  <input
                    style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 700 }}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    placeholder="np. PE50, PE68, MB-86N-01"
                    autoFocus
                  />
                </Field>
              </Grid>

              <Grid cols={2}>
                <Field label="4. Nazwa indeksu *">
                  <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="np. Profil ościeżnicy PE50 / Profil skrzydła PE68"
                  />
                </Field>

                <Field label="Dostawca / Producent (opcjonalnie)">
                  <input
                    style={inputStyle}
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    placeholder="np. Procural, Aluprof, Aliplast…"
                  />
                </Field>
              </Grid>

              {/* Dynamiczne wymiary fizyczne wynikające z wybranego systemu */}
              {selectedObj && (
                <div
                  style={{
                    background: "rgba(59, 130, 246, 0.04)",
                    border: `1px solid ${C.borderFocus}`,
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                    Wymiary i parametry dla systemu: <span style={{ color: "#60a5fa" }}>{selectedObj.name}</span> ({selectedObj.categoryName})
                  </div>

                  <Grid cols={4}>
                    {fc?.lengthMm?.enabled && (
                      <Field label={`${fc.lengthMm.label || "Długość (mm)"} ${fc.lengthMm.required ? "*" : ""}`}>
                        <input
                          style={inputStyle}
                          type="number"
                          min="0"
                          value={form.lengthMm}
                          onChange={(e) => setForm({ ...form, lengthMm: e.target.value })}
                          placeholder="np. 6500"
                        />
                      </Field>
                    )}

                    {fc?.widthMm?.enabled && (
                      <Field label={`${fc.widthMm.label || "Szerokość (mm)"} ${fc.widthMm.required ? "*" : ""}`}>
                        <input
                          style={inputStyle}
                          type="number"
                          min="0"
                          value={form.widthMm}
                          onChange={(e) => setForm({ ...form, widthMm: e.target.value })}
                          placeholder="np. 1200"
                        />
                      </Field>
                    )}

                    {fc?.heightMm?.enabled && (
                      <Field label={`${fc.heightMm.label || "Wysokość (mm)"} ${fc.heightMm.required ? "*" : ""}`}>
                        <input
                          style={inputStyle}
                          type="number"
                          min="0"
                          value={form.heightMm}
                          onChange={(e) => setForm({ ...form, heightMm: e.target.value })}
                          placeholder="np. 900"
                        />
                      </Field>
                    )}

                    {fc?.thicknessMm?.enabled && (
                      <Field label={`${fc.thicknessMm.label || "Grubość (mm)"} ${fc.thicknessMm.required ? "*" : ""}`}>
                        <input
                          style={inputStyle}
                          type="number"
                          step="0.1"
                          min="0"
                          value={form.thicknessMm}
                          onChange={(e) => setForm({ ...form, thicknessMm: e.target.value })}
                          placeholder="np. 24 lub 2.0"
                        />
                      </Field>
                    )}

                    {fc?.weightKg?.enabled && (
                      <Field label={`${fc.weightKg.label || "Masa (kg)"} ${fc.weightKg.required ? "*" : ""}`}>
                        <input
                          style={inputStyle}
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.weightKg}
                          onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                          placeholder="np. 14.5"
                        />
                      </Field>
                    )}

                    {customFields.map((cf) => (
                      <Field key={cf.key} label={`${cf.label} ${cf.required ? "*" : ""}`}>
                        {cf.type === "select" ? (
                          <select
                            style={inputStyle}
                            value={form.customAttributes[cf.key] ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                customAttributes: { ...form.customAttributes, [cf.key]: e.target.value },
                              })
                            }
                          >
                            <option value="">Wybierz…</option>
                            {(cf.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            style={inputStyle}
                            type={cf.type === "number" ? "number" : "text"}
                            value={form.customAttributes[cf.key] ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                customAttributes: { ...form.customAttributes, [cf.key]: e.target.value },
                              })
                            }
                          />
                        )}
                      </Field>
                    ))}
                  </Grid>
                </div>
              )}

              <Field label="Opis / Notatka (opcjonalnie)">
                <input
                  style={inputStyle}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Dodatkowe informacje o indeksie…"
                />
              </Field>

              <div style={{ display: "flex", gap: 8 }}>
                <Btn primary onClick={handleSave} disabled={busy}>
                  {busy ? "Zapisywanie…" : form.id ? "Zapisz zmiany" : "Utwórz indeks"}
                </Btn>
                <Btn onClick={() => setEditing(false)}>Anuluj</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── LISTA INDEKSÓW ───────────────────────────────────────────── */}
      <Card title={`Kartoteka indeksów magazynowych (${filtered.length})`} pad={false}>
        <div
          style={{
            padding: 12,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            style={{ ...inputStyle, maxWidth: 280 }}
            placeholder="Szukaj: kod (np. PE50), nazwa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={{ ...inputStyle, width: 220 }}
            value={filterCatId}
            onChange={(e) => {
              setFilterCatId(e.target.value);
              setFilterObjId("");
            }}
          >
            <option value="">Wszystkie grupy towarowe</option>
            {(categories ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          <select
            style={{ ...inputStyle, width: 220 }}
            value={filterObjId}
            onChange={(e) => setFilterObjId(e.target.value)}
          >
            <option value="">Wszystkie systemy / podgrupy</option>
            {(objects ?? [])
              .filter((o) => !filterCatId || o.categoryId === filterCatId)
              .map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name} {o.categoryName ? `[${o.categoryName}]` : ""}
                </option>
              ))}
          </select>
        </div>

        {!indexes ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie indeksów…</div>
        ) : filtered.length === 0 ? (
          <Empty
            title="Brak indeksów magazynowych"
            text="Kliknij '+ Nowy indeks', aby utworzyć indeks (np. PE50 lub PE68) w wybranym systemie."
          />
        ) : (
          <Table
            headers={[
              "Kod indeksu",
              "Nazwa indeksu",
              "Grupa towarowa",
              "System / Podgrupa",
              "Wymiary / Parametry",
              "Stan magazynowy",
              "Akcje",
            ]}
          >
            {filtered.map((row) => {
              const m = row.material;
              const sku = m.sku || m._id;

              return (
                <Tr key={m._id}>
                  <Td mono bold style={{ fontSize: 14, color: C.text }}>
                    {sku}
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 600, color: C.text }}>{m.name}</div>
                    {m.supplier && <div style={{ fontSize: 11, color: C.muted }}>Dostawca: {m.supplier}</div>}
                  </Td>
                  <Td>
                    <span
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: C.text,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {row.category?.name ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span
                      style={{
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "#60a5fa",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {row.object?.name ?? "—"}
                    </span>
                  </Td>
                  <Td mono muted>
                    {row.dimensionsSummary}
                  </Td>
                  <Td nowrap style={{ fontWeight: 600 }}>
                    {fmtNum(row.stockPieces)} {row.object?.defaultUnit || m.unit || "szt."}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small onClick={() => startEditIndex(row)}>
                        Edytuj
                      </Btn>
                      <Btn small danger onClick={() => handleDelete(m._id, m.name)}>
                        Usuń
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>
    </Page>
  );
}

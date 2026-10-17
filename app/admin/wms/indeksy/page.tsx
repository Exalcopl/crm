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
import { QrCodeSvg, renderQrSvgString } from "../_components/qr-code";

type LabelFormat = "60x40" | "100x50" | "50x30";

const LABEL_FORMATS: Record<
  LabelFormat,
  { name: string; widthMm: number; heightMm: number; qrSizePx: number }
> = {
  "60x40": { name: "Etykieta 60 × 40 mm (Standard termiczna)", widthMm: 60, heightMm: 40, qrSizePx: 96 },
  "100x50": { name: "Etykieta 100 × 50 mm (Duża magazynowa)", widthMm: 100, heightMm: 50, qrSizePx: 124 },
  "50x30": { name: "Etykieta 50 × 30 mm (Mała indeksowa)", widthMm: 50, heightMm: 30, qrSizePx: 74 },
};

type IndexFormState = {
  id?: Id<"materials">;
  wmsObjectId: string;
  sku: string;
  name: string;
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

  // Zaznaczone indeksy do wydruku zbiorczego
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal drukowania QR
  const [printItems, setPrintItems] = useState<NonNullable<typeof indexes>>([]);
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("60x40");
  const [copiesCount, setCopiesCount] = useState(1);

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

  function startNewIndex() {
    const firstObj = objects && objects.length > 0 ? objects[0]._id : "";
    setForm({
      ...DEFAULT_INDEX_FORM,
      wmsObjectId: filterObjId || firstObj,
    });
    setEditing(true);
  }

  function startEditIndex(row: NonNullable<typeof indexes>[number]) {
    const m = row.material;
    setForm({
      id: m._id,
      wmsObjectId: m.wmsObjectId ?? (objects && objects[0]?._id) ?? "",
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

  function generateAutoSku() {
    const prefix =
      selectedObj?.code?.slice(0, 4) ||
      selectedObj?.name
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 4)
        .toUpperCase() ||
      "IDX";
    const randomNum = String(Math.floor(1000 + Math.random() * 9000));
    setForm({ ...form, sku: `${prefix}-${randomNum}` });
  }

  async function handleSave() {
    if (!form.wmsObjectId) {
      toast.error("Wybierz obiekt magazynowy, do którego należy ten indeks");
      return;
    }
    if (!form.sku.trim()) {
      toast.error("Podaj kod indeksu (SKU) potrzebny do wygenerowania kodu QR");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Podaj nazwę indeksu materiałowego");
      return;
    }

    // Walidacja wymaganych wymiarów z obiektu
    if (fc) {
      if (fc.lengthMm?.enabled && fc.lengthMm?.required && !form.lengthMm) {
        toast.error(`Pole "${fc.lengthMm.label || "Długość (mm)"}" jest wymagane dla tego obiektu`);
        return;
      }
      if (fc.widthMm?.enabled && fc.widthMm?.required && !form.widthMm) {
        toast.error(`Pole "${fc.widthMm.label || "Szerokość (mm)"}" jest wymagane dla tego obiektu`);
        return;
      }
      if (fc.heightMm?.enabled && fc.heightMm?.required && !form.heightMm) {
        toast.error(`Pole "${fc.heightMm.label || "Wysokość (mm)"}" jest wymagane dla tego obiektu`);
        return;
      }
      if (fc.thicknessMm?.enabled && fc.thicknessMm?.required && !form.thicknessMm) {
        toast.error(`Pole "${fc.thicknessMm.label || "Grubość (mm)"}" jest wymagane dla tego obiektu`);
        return;
      }
      if (fc.weightKg?.enabled && fc.weightKg?.required && !form.weightKg) {
        toast.error(`Pole "${fc.weightKg.label || "Masa (kg)"}" jest wymagane dla tego obiektu`);
        return;
      }
    }

    setBusy(true);
    try {
      await upsertIndex({
        id: form.id,
        wmsObjectId: form.wmsObjectId as Id<"wms_objects">,
        wmsCategoryId: selectedObj?.categoryId,
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
      toast.success(form.id ? "Zaktualizowano indeks materiałowy" : "Utworzono nowy indeks materiałowy");
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
        toast.info(`Indeks "${name}" został dezaktywowany (posiada historię partii na magazynie)`);
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
      (r.object?.name ?? "").toLowerCase().includes(q);
    const matchesCat = !filterCatId || r.category?._id === filterCatId;
    const matchesObj = !filterObjId || r.object?._id === filterObjId;
    return matchesQ && matchesCat && matchesObj;
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((r) => r.material._id));
    }
  }

  function openPrintModal(rows: NonNullable<typeof indexes>) {
    setPrintItems(rows);
    setCopiesCount(1);
  }

  function executePrint() {
    if (printItems.length === 0) return;
    const fmt = LABEL_FORMATS[labelFormat];
    const copies = Math.max(1, Math.min(100, copiesCount));

    const labelsHtml: string[] = [];
    for (const item of printItems) {
      const sku = item.material.sku || item.material._id;
      const qrSvg = renderQrSvgString(sku, fmt.qrSizePx, 1);
      const objLabel = item.object ? `${item.category?.name ?? ""} · ${item.object.name}` : item.category?.name ?? "Indeks WMS";
      const dims = item.dimensionsSummary !== "—" ? item.dimensionsSummary : "";

      for (let c = 0; c < copies; c++) {
        labelsHtml.push(`
          <div class="label-page">
            <div class="qr-box">${qrSvg}</div>
            <div class="meta-box">
              <div class="obj-tag">${objLabel}</div>
              <div class="sku-code">${sku}</div>
              <div class="mat-name">${item.material.name}</div>
              ${dims ? `<div class="dims">Wymiary: <strong>${dims}</strong></div>` : ""}
            </div>
          </div>
        `);
      }
    }

    const win = window.open("", "_blank", "width=720,height=540");
    if (!win) {
      toast.error("Zablokowano wyskakujące okno drukowania — zezwól na pop-upy w przeglądarce.");
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="utf-8" />
        <title>Wydruk etykiet QR — WMS</title>
        <style>
          @page {
            size: ${fmt.widthMm}mm ${fmt.heightMm}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            background: #fff;
            color: #000;
          }
          .label-page {
            width: ${fmt.widthMm}mm;
            height: ${fmt.heightMm}mm;
            padding: 2.5mm;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 3mm;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            border: 1px dashed #ccc;
          }
          @media print {
            .label-page {
              border: none;
            }
          }
          .qr-box {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-box svg {
            width: ${Math.min(fmt.heightMm - 5, fmt.widthMm * 0.42)}mm;
            height: ${Math.min(fmt.heightMm - 5, fmt.widthMm * 0.42)}mm;
            display: block;
          }
          .meta-box {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1mm;
          }
          .obj-tag {
            font-size: ${fmt.heightMm <= 30 ? "6pt" : "7pt"};
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .sku-code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: ${fmt.heightMm <= 30 ? "9pt" : fmt.heightMm >= 50 ? "13pt" : "10.5pt"};
            font-weight: 800;
            line-height: 1.1;
            word-break: break-all;
          }
          .mat-name {
            font-size: ${fmt.heightMm <= 30 ? "7pt" : fmt.heightMm >= 50 ? "9.5pt" : "8pt"};
            font-weight: 600;
            line-height: 1.15;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .dims {
            font-size: ${fmt.heightMm <= 30 ? "6.5pt" : "7.5pt"};
            color: #111;
            margin-top: 0.5mm;
          }
        </style>
      </head>
      <body>
        ${labelsHtml.join("\n")}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 150);
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <Page
      title="Indeksy materiałowe"
      subtitle="Konkretne indeksy powiązane z obiektami magazynowymi. Twórz indeksy, określaj ich wymiary i drukuj etykiety z kodem QR na drukarce."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {selectedIds.length > 0 && (
            <Btn
              onClick={() => {
                const chosen = (indexes ?? []).filter((r) => selectedIds.includes(r.material._id));
                openPrintModal(chosen);
              }}
            >
              🖨️ Drukuj wybrane QR ({selectedIds.length})
            </Btn>
          )}
          <Btn primary onClick={startNewIndex}>
            + Nowy indeks
          </Btn>
        </div>
      }
    >
      {/* ─── FORMULARZ TWORZENIA / EDYCJI INDEKSU ──────────────────────── */}
      {editing && (
        <div style={{ marginBottom: 20 }}>
          <Card title={form.id ? `Edycja indeksu: ${form.name}` : "Nowy indeks materiałowy"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Grid cols={3}>
                  <Field label="Obiekt magazynowy *">
                    <select
                      style={inputStyle}
                      value={form.wmsObjectId}
                      onChange={(e) => setForm({ ...form, wmsObjectId: e.target.value })}
                    >
                      <option value="">Wybierz obiekt magazynowy…</option>
                      {(objects ?? []).map((obj) => (
                        <option key={obj._id} value={obj._id}>
                          [{obj.categoryName}] → {obj.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Kod indeksu / SKU (kod QR) *">
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 700 }}
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                        placeholder="np. PRF-MB86-001"
                      />
                      <Btn small onClick={generateAutoSku}>
                        Generuj
                      </Btn>
                    </div>
                  </Field>

                  <Field label="Nazwa indeksu materiałowego *">
                    <input
                      style={inputStyle}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="np. Profil ościeżnicy MB-86N / Pakiet 4/16/4"
                    />
                  </Field>
                </Grid>

                {/* Dynamiczne wymiary fizyczne wynikające z wybranego obiektu */}
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
                      Wymiary fizyczne dla obiektu: <span style={{ color: "#60a5fa" }}>{selectedObj.name}</span> ({selectedObj.categoryName})
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
                            placeholder="np. 24"
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

                <Grid cols={2}>
                  <Field label="Dostawca / Producent (opcjonalnie)">
                    <input
                      style={inputStyle}
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      placeholder="np. Aluprof, Press Glass, Winkhaus…"
                    />
                  </Field>
                  <Field label="Opis / Notatka (opcjonalnie)">
                    <input
                      style={inputStyle}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Dodatkowe informacje o indeksie…"
                    />
                  </Field>
                </Grid>

                <div style={{ display: "flex", gap: 8 }}>
                  <Btn primary onClick={handleSave} disabled={busy}>
                    {busy ? "Zapisywanie…" : form.id ? "Zapisz zmiany" : "Utwórz indeks"}
                  </Btn>
                  <Btn onClick={() => setEditing(false)}>Anuluj</Btn>
                </div>
              </div>

              {/* Podgląd kodu QR na żywo */}
              <div
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 14,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Podgląd kodu QR
                </div>
                <QrCodeSvg value={form.sku.trim() || "BRAK-KODU"} size={136} />
                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: C.text }}>
                  {form.sku.trim() || "—"}
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.3 }}>
                  {form.name.trim() || "Wpisz nazwę i kod indeksu"}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── LISTA INDEKSÓW I WYDRUK KODÓW QR ─────────────────────────── */}
      <Card title={`Zdefiniowane indeksy materiałowe (${filtered.length})`} pad={false}>
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
            placeholder="Szukaj po kodzie SKU, nazwie lub obiekcie…"
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
            <option value="">Wszystkie kategorie</option>
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
            <option value="">Wszystkie obiekty magazynowe</option>
            {(objects ?? [])
              .filter((o) => !filterCatId || o.categoryId === filterCatId)
              .map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name} ({o.categoryName})
                </option>
              ))}
          </select>

          {filtered.length > 0 && (
            <Btn small onClick={toggleSelectAll}>
              {selectedIds.length === filtered.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
            </Btn>
          )}
        </div>

        {!indexes ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie indeksów…</div>
        ) : filtered.length === 0 ? (
          <Empty
            title="Brak indeksów materiałowych"
            text="Kliknij '+ Nowy indeks', aby przypisać materiał do obiektu magazynowego i wygenerować dla niego kod QR."
          />
        ) : (
          <Table
            headers={[
              "",
              "Kod QR / SKU",
              "Nazwa indeksu",
              "Kategoria → Obiekt",
              "Wymiary fizyczne",
              "Stan",
              "Akcje",
            ]}
          >
            {filtered.map((row) => {
              const m = row.material;
              const sku = m.sku || m._id;
              const isChecked = selectedIds.includes(m._id);

              return (
                <Tr key={m._id}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(m._id)}
                      style={{ cursor: "pointer" }}
                    />
                  </Td>
                  <Td>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                      onClick={() => openPrintModal([row])}
                      title="Kliknij, aby wydrukować etykietę QR"
                    >
                      <QrCodeSvg value={sku} size={42} margin={1} />
                      <div>
                        <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: C.text }}>
                          {m.sku || <span style={{ color: C.amber }}>Brak SKU</span>}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>Kliknij by drukować</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 600, color: C.text }}>{m.name}</div>
                    {(m.supplier || m.description) && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {[m.supplier, m.description].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {row.object ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            color: C.text,
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {row.category?.name ?? "—"}
                        </span>
                        <span style={{ color: C.muted, fontSize: 11 }}>→</span>
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
                          {row.object.name}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: C.muted, fontSize: 12 }}>
                        {row.category?.name ?? "Nieprzypisany obiekt"}
                      </span>
                    )}
                  </Td>
                  <Td mono>
                    <div>{row.dimensionsSummary}</div>
                    {m.weightKg !== undefined && (
                      <div style={{ fontSize: 11, color: C.muted }}>{m.weightKg} kg</div>
                    )}
                  </Td>
                  <Td mono nowrap>
                    {fmtNum(row.stockPieces)} szt.
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small primary onClick={() => openPrintModal([row])}>
                        🖨️ Drukuj QR
                      </Btn>
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

      {/* ─── MODAL DRUKOWANIA ETYKIETY QR ─────────────────────────────── */}
      {printItems.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setPrintItems([])}
        >
          <div
            style={{
              background: "#14161a",
              border: `1px solid ${C.borderFocus}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 560,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  Wydruk etykiety z kodem QR ({printItems.length}{" "}
                  {printItems.length === 1 ? "indeks" : "indeksy"})
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Wybierz rozmiar etykiety dopasowany do drukarki i liczbę kopii.
                </div>
              </div>
              <Btn small onClick={() => setPrintItems([])}>
                ✕
              </Btn>
            </div>

            <Grid cols={2}>
              <Field label="Format etykiety (rozmiar papieru)">
                <select
                  style={inputStyle}
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value as LabelFormat)}
                >
                  {Object.entries(LABEL_FORMATS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Liczba kopii każdego kodu">
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="100"
                  value={copiesCount}
                  onChange={(e) => setCopiesCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </Field>
            </Grid>

            {/* Wizualny podgląd pierwszej etykiety */}
            <div
              style={{
                background: "#20232a",
                borderRadius: 8,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>
                Podgląd wydruku etykiety ({LABEL_FORMATS[labelFormat].widthMm} ×{" "}
                {LABEL_FORMATS[labelFormat].heightMm} mm)
              </div>

              {(() => {
                const first = printItems[0];
                const sku = first.material.sku || first.material._id;
                const objLabel = first.object
                  ? `${first.category?.name ?? ""} · ${first.object.name}`
                  : first.category?.name ?? "Indeks WMS";
                return (
                  <div
                    style={{
                      background: "#ffffff",
                      color: "#000000",
                      borderRadius: 6,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                      maxWidth: 380,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    }}
                  >
                    <QrCodeSvg value={sku} size={96} margin={1} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          color: "#444",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {objLabel}
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#000",
                          marginTop: 2,
                        }}
                      >
                        {sku}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginTop: 2 }}>
                        {first.material.name}
                      </div>
                      {first.dimensionsSummary !== "—" && (
                        <div style={{ fontSize: 11, color: "#222", marginTop: 4 }}>
                          Wymiary: <strong>{first.dimensionsSummary}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn onClick={() => setPrintItems([])}>Anuluj</Btn>
              <Btn primary onClick={executePrint}>
                🖨️ Drukuj etykiety ({printItems.length * copiesCount} szt.)
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

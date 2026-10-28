"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Btn,
  Card,
  ConfirmModal,
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
import { buildScanUrl, downloadLabelPng, QrSvg } from "../_components/qr";

type IndexFormState = {
  id?: Id<"materials">;
  categoryId: string; // Grupa towarowa (nadrzędna)
  wmsObjectId: string; // System / Podgrupa (np. Procural)
  sku: string; // Kod indeksu (np. PE50, PE68)
  name: string; // Nazwa indeksu
  supplier: string;
  description: string;
  customAttributes: Record<string, string>;
};

const DEFAULT_INDEX_FORM: IndexFormState = {
  categoryId: "",
  wmsObjectId: "",
  sku: "",
  name: "",
  supplier: "",
  description: "",
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

  const router = useRouter();

  // Etykiety QR: zaznaczenie wielu indeksów + podgląd pojedynczego
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrPreview, setQrPreview] = useState<{ id: string; sku: string; name: string } | null>(null);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function printLabels(ids: string[]) {
    if (ids.length === 0) return;
    router.push(`/admin/wms/indeksy/etykiety?ids=${ids.join(",")}`);
  }

  // Filtry listy
  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState("");
  const [filterObjId, setFilterObjId] = useState("");

  const selectedObj = (objects ?? []).find((o) => o._id === form.wmsObjectId);
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

    for (const cf of customFields) {
      if (cf.required && !form.customAttributes[cf.key]?.trim()) {
        toast.error(`Parametr "${cf.label}" jest wymagany dla tego systemu`);
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

  // Natywny modal potwierdzenia usunięcia
  const [deleteModal, setDeleteModal] = useState<{ id: Id<"materials">; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteModal) return;
    setDeleteBusy(true);
    try {
      const res = await deleteIndex({ id: deleteModal.id });
      if (res.deactivated) {
        toast.info(`Indeks "${deleteModal.name}" został dezaktywowany (posiada historię partii w magazynie)`);
      } else {
        toast.success(`Usunięto indeks "${deleteModal.name}"`);
      }
      setDeleteModal(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setDeleteBusy(false);
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
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/admin/wms/ustawienia"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${C.border}`,
              color: C.text,
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ⚙️ Zarządzaj grupami i systemami
          </Link>
          <Btn onClick={() => printLabels(Array.from(selected))} disabled={selected.size === 0}>
            Drukuj etykiety QR{selected.size > 0 ? ` (${selected.size})` : ""}
          </Btn>
          <Btn primary onClick={startNewIndex}>
            + Nowy indeks
          </Btn>
        </div>
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
                  <span style={{ fontSize: 11, color: C.muted, marginTop: 4, display: "block" }}>
                    Nie ma Twojego systemu?{" "}
                    <Link href={`/admin/wms/ustawienia?tab=objects${form.categoryId ? `&cat=${form.categoryId}` : ""}`} target="_blank" style={{ color: C.accent, textDecoration: "none" }}>
                      + Dodaj w Ustawieniach ↗
                    </Link>
                  </span>
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

              {/* Dodatkowe parametry techniczne wynikające z wybranego systemu */}
              {selectedObj && customFields.length > 0 && (
                <div
                  style={{
                    background: "rgba(59, 130, 246, 0.04)",
                    border: `1px solid ${C.borderFocus}`,
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                    Parametry techniczne dla systemu: <span style={{ color: "#60a5fa" }}>{selectedObj.name}</span> ({selectedObj.categoryName})
                  </div>

                  <Grid cols={3}>
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

          {filtered.length > 0 && (
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer", marginLeft: "auto" }}
            >
              <input
                type="checkbox"
                checked={filtered.every((r) => selected.has(r.material._id))}
                onChange={(e) => {
                  const ids = filtered.filter((r) => !!r.material.sku).map((r) => r.material._id as string);
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const id of ids) {
                      if (e.target.checked) next.add(id);
                      else next.delete(id);
                    }
                    return next;
                  });
                }}
              />
              Zaznacz wszystkie do wydruku QR
            </label>
          )}
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
              "",
              "Kod indeksu",
              "Nazwa indeksu",
              "Grupa towarowa",
              "System / Podgrupa",
              "Parametry techniczne",
              "Stan magazynowy",
              "Akcje",
            ]}
          >
            {filtered.map((row) => {
              const m = row.material;
              const sku = m.sku || m._id;

              return (
                <Tr key={m._id}>
                  <Td style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      disabled={!m.sku}
                      title={m.sku ? "Zaznacz do wydruku etykiety QR" : "Indeks bez kodu SKU"}
                      checked={selected.has(m._id)}
                      onChange={() => toggleSelected(m._id)}
                    />
                  </Td>
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
                  <Td>
                    {(() => {
                      const attrs =
                        m.customAttributes && typeof m.customAttributes === "object"
                          ? Object.entries(m.customAttributes as Record<string, string>).filter(([, v]) => !!v)
                          : [];
                      if (attrs.length === 0) {
                        return <span style={{ color: C.muted }}>—</span>;
                      }
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {attrs.map(([k, v]) => {
                            const cfDef = (row.object?.customFields ?? []).find((c) => c.key === k);
                            const label = cfDef?.label || k;
                            return (
                              <span
                                key={k}
                                style={{
                                  fontSize: 11,
                                  background: "rgba(59, 130, 246, 0.12)",
                                  color: "#93c5fd",
                                  border: "1px solid rgba(59, 130, 246, 0.25)",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>{label}:</span> {v}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </Td>
                  <Td nowrap style={{ fontWeight: 600 }}>
                    {fmtNum(row.stockPieces)} {row.object?.defaultUnit || m.unit || "szt."}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {m.sku && (
                        <Btn small onClick={() => setQrPreview({ id: m._id, sku: m.sku!, name: m.name })}>
                          QR
                        </Btn>
                      )}
                      <Btn small onClick={() => startEditIndex(row)}>
                        Edytuj
                      </Btn>
                      <Btn small danger onClick={() => setDeleteModal({ id: m._id, name: m.name })}>
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

      {/* ─── PODGLĄD ETYKIETY QR ───────────────────────────────────────── */}
      {qrPreview && (
        <div
          onClick={() => setQrPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 24,
              width: 340,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ alignSelf: "stretch" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Etykieta QR</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{qrPreview.name}</div>
            </div>
            <div style={{ background: "#fff", padding: 16, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <QrSvg value={buildScanUrl(qrPreview.sku)} size={200} />
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 22, color: "#000" }}>{qrPreview.sku}</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", wordBreak: "break-all" }}>
              {buildScanUrl(qrPreview.sku)}
            </div>
            <div style={{ display: "flex", gap: 8, alignSelf: "stretch" }}>
              <Btn primary onClick={() => printLabels([qrPreview.id])}>Drukuj</Btn>
              <Btn onClick={() => downloadLabelPng(qrPreview.sku)}>Pobierz PNG</Btn>
              <div style={{ flex: 1 }} />
              <Btn onClick={() => setQrPreview(null)}>Zamknij</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATYWNY MODAL POTWIERDZENIA USUNIĘCIA INDEKSU ─────────── */}
      <ConfirmModal
        isOpen={!!deleteModal}
        title="Usunięcie indeksu magazynowego"
        message={
          <>
            Czy na pewno chcesz usunąć indeks <strong style={{ color: C.text }}>&quot;{deleteModal?.name}&quot;</strong>?
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Jeśli indeks posiada powiązane partie lub ruchy magazynowe, zostanie bezpiecznie dezaktywowany.
            </div>
          </>
        }
        confirmLabel="Tak, usuń"
        cancelLabel="Anuluj"
        danger={true}
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleteBusy && setDeleteModal(null)}
      />
    </Page>
  );
}

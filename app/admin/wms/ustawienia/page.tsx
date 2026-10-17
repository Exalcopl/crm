"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  fmtKg,
  fmtNum,
  Grid,
  inputStyle,
  Page,
  Table,
  Td,
  Tr,
  C,
} from "../_components/ui";

type FieldCfg = {
  enabled: boolean;
  required: boolean;
  label?: string;
};

type CustomField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  required: boolean;
};

type CategoryFormState = {
  id?: Id<"wms_categories">;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

const DEFAULT_CAT_FORM: CategoryFormState = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

type ObjectFormState = {
  id?: Id<"wms_objects">;
  categoryId: string;
  name: string;
  code: string;
  defaultUnit?: string;
  description: string;
  fieldsConfig: {
    lengthMm: FieldCfg;
    widthMm: FieldCfg;
    heightMm: FieldCfg;
    thicknessMm: FieldCfg;
    weightKg: FieldCfg;
  };
  customFields: CustomField[];
  isActive: boolean;
};

const DEFAULT_OBJ_FORM: ObjectFormState = {
  categoryId: "",
  name: "",
  code: "",
  defaultUnit: "szt.",
  description: "",
  fieldsConfig: {
    lengthMm: { enabled: true, required: false, label: "Długość (mm)" },
    widthMm: { enabled: false, required: false, label: "Szerokość (mm)" },
    heightMm: { enabled: false, required: false, label: "Wysokość (mm)" },
    thicknessMm: { enabled: false, required: false, label: "Grubość (mm)" },
    weightKg: { enabled: false, required: false, label: "Masa (kg)" },
  },
  customFields: [],
  isActive: true,
};

const STANDARD_FIELD_KEYS: { key: keyof ObjectFormState["fieldsConfig"]; defaultLabel: string }[] = [
  { key: "lengthMm", defaultLabel: "Długość handlowa (mm)" },
  { key: "widthMm", defaultLabel: "Szerokość (mm)" },
  { key: "heightMm", defaultLabel: "Wysokość (mm)" },
  { key: "thicknessMm", defaultLabel: "Grubość (mm)" },
  { key: "weightKg", defaultLabel: "Masa obiektu (kg)" },
];

function WmsSettingsContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [selectedTab, setSelectedTab] = useState<"categories" | "objects" | "locations" | "materials" | null>(null);

  const activeTab: "categories" | "objects" | "locations" | "materials" =
    selectedTab ??
    (urlTab === "objects"
      ? "objects"
      : urlTab === "locations"
      ? "locations"
      : urlTab === "materials"
      ? "materials"
      : "categories");

  // ─── Zapytania i mutacje: Kategorie ─────────────────────────
  const categories = useQuery(api.wms.listCategories, {});
  const objects = useQuery(api.wms.listObjects, {});
  const materials = useQuery(api.wms.listProfiles, { allCategories: true });

  const upsertCat = useMutation(api.wms.upsertCategory);
  const deleteCat = useMutation(api.wms.deleteCategory);
  const upsertObj = useMutation(api.wms.upsertObject);
  const deleteObj = useMutation(api.wms.deleteObject);
  const setMaterialCat = useMutation(api.wms.setMaterialCategory);

  // Stan formularza kategorii
  const [editingCat, setEditingCat] = useState(false);
  const [catForm, setCatForm] = useState<CategoryFormState>(DEFAULT_CAT_FORM);
  const [catBusy, setCatBusy] = useState(false);

  // Stan formularza obiektu
  const [editingObj, setEditingObj] = useState(false);
  const [objForm, setObjForm] = useState<ObjectFormState>(DEFAULT_OBJ_FORM);
  const [objBusy, setObjBusy] = useState(false);
  const [filterObjCatId, setFilterObjCatId] = useState<string>("");

  // ─── Zapytania i mutacje: Lokalizacje ───────────────────────
  const locations = useQuery(api.wms.listLocations, {});
  const createLoc = useMutation(api.wms.createLocation);
  const updateLoc = useMutation(api.wms.updateLocation);
  const removeLoc = useMutation(api.wms.deleteLocation);

  const [showLocForm, setShowLocForm] = useState(false);
  const [locEditId, setLocEditId] = useState<Id<"wms_locations"> | null>(null);
  const [locName, setLocName] = useState("");
  const [locBusy, setLocBusy] = useState(false);

  // ─── Filtrowanie materiałów ─────────────────────────────────
  const [matSearch, setMatSearch] = useState("");
  const [filterMatCatId, setFilterMatCatId] = useState<string>("");

  // ─── Handlery dla Kategorii (Nadrzędne) ──────────────────────
  function startNewCategory() {
    setCatForm(DEFAULT_CAT_FORM);
    setEditingCat(true);
  }

  function startEditCategory(cat: NonNullable<typeof categories>[number]) {
    setCatForm({
      id: cat._id,
      name: cat.name,
      code: cat.code,
      description: cat.description ?? "",
      isActive: cat.isActive,
    });
    setEditingCat(true);
  }

  async function handleSaveCategory() {
    if (!catForm.name.trim()) {
      toast.error("Wpisz nazwę kategorii");
      return;
    }
    if (!catForm.code.trim()) {
      toast.error("Wpisz kod kategorii");
      return;
    }

    setCatBusy(true);
    try {
      await upsertCat({
        id: catForm.id,
        name: catForm.name.trim(),
        code: catForm.code.trim().toUpperCase(),
        description: catForm.description.trim() || undefined,
        isActive: catForm.isActive,
      });
      toast.success(catForm.id ? "Zaktualizowano kategorię" : "Utworzono nową kategorię");
      setEditingCat(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCatBusy(false);
    }
  }

  async function handleDeleteCategory(id: Id<"wms_categories">, name: string) {
    if (!confirm(`Czy na pewno chcesz usunąć kategorię "${name}"?`)) return;
    try {
      const res = await deleteCat({ id });
      if (res.deactivated) {
        toast.info(`Kategoria "${name}" została dezaktywowana (posiada obiekty lub partie w magazynie)`);
      } else {
        toast.success(`Kategoria "${name}" została usunięta`);
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  // ─── Handlery dla Obiektów (Podrzędne) ───────────────────────
  function startNewObject(presetCatId?: string) {
    const firstCatId = presetCatId || (categories && categories.length > 0 ? categories[0]._id : "");
    setObjForm({
      ...DEFAULT_OBJ_FORM,
      categoryId: firstCatId,
    });
    setEditingObj(true);
  }

  function startEditObject(obj: NonNullable<typeof objects>[number]) {
    setObjForm({
      id: obj._id,
      categoryId: obj.categoryId,
      name: obj.name,
      code: obj.code ?? "",
      defaultUnit: obj.defaultUnit ?? "szt.",
      description: obj.description ?? "",
      fieldsConfig: {
        lengthMm: { ...(obj.fieldsConfig.lengthMm ?? { enabled: false, required: false, label: "Długość (mm)" }) },
        widthMm: { ...(obj.fieldsConfig.widthMm ?? { enabled: false, required: false, label: "Szerokość (mm)" }) },
        heightMm: { ...(obj.fieldsConfig.heightMm ?? { enabled: false, required: false, label: "Wysokość (mm)" }) },
        thicknessMm: { ...(obj.fieldsConfig.thicknessMm ?? { enabled: false, required: false, label: "Grubość (mm)" }) },
        weightKg: { ...(obj.fieldsConfig.weightKg ?? { enabled: false, required: false, label: "Masa (kg)" }) },
      },
      customFields: obj.customFields ? [...obj.customFields] : [],
      isActive: obj.isActive,
    });
    setEditingObj(true);
  }

  async function handleSaveObject() {
    if (!objForm.categoryId) {
      toast.error("Wybierz kategorię nadrzędną");
      return;
    }
    if (!objForm.name.trim()) {
      toast.error("Wpisz nazwę obiektu magazynowego");
      return;
    }

    setObjBusy(true);
    try {
      await upsertObj({
        id: objForm.id,
        categoryId: objForm.categoryId as Id<"wms_categories">,
        name: objForm.name.trim(),
        code: objForm.code.trim().toUpperCase() || undefined,
        description: objForm.description.trim() || undefined,
        fieldsConfig: objForm.fieldsConfig,
        customFields: objForm.customFields,
        isActive: objForm.isActive,
      });
      toast.success(objForm.id ? "Zaktualizowano obiekt magazynowy" : "Utworzono obiekt magazynowy");
      setEditingObj(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setObjBusy(false);
    }
  }

  async function handleDeleteObject(id: Id<"wms_objects">, name: string) {
    if (!confirm(`Czy na pewno chcesz usunąć obiekt magazynowy "${name}"?`)) return;
    try {
      const res = await deleteObj({ id });
      if (res.deactivated) {
        toast.info(`Obiekt "${name}" został dezaktywowany (posiada partie na magazynie)`);
      } else {
        toast.success(`Obiekt "${name}" został usunięty`);
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  function addCustomField() {
    const key = `field_${Date.now()}`;
    setObjForm({
      ...objForm,
      customFields: [
        ...objForm.customFields,
        { key, label: "Nowe pole", type: "text", required: false },
      ],
    });
  }

  function removeCustomField(idx: number) {
    const next = [...objForm.customFields];
    next.splice(idx, 1);
    setObjForm({ ...objForm, customFields: next });
  }

  // ─── Handlery dla Lokalizacji ────────────────────────────────
  function startNewLocation() {
    setLocEditId(null);
    setLocName("");
    setShowLocForm(true);
  }

  function startEditLocation(l: NonNullable<typeof locations>[number]) {
    setLocEditId(l._id);
    setLocName(l.name);
    setShowLocForm(true);
  }

  async function handleSaveLocation() {
    const trimmed = locName.trim();
    if (!trimmed) {
      toast.error("Wpisz nazwę lokalizacji.");
      return;
    }
    setLocBusy(true);
    try {
      if (locEditId) {
        await updateLoc({ id: locEditId, name: trimmed });
        toast.success("Zapisano zmiany w lokalizacji");
      } else {
        await createLoc({ name: trimmed });
        toast.success("Dodano lokalizację");
      }
      setShowLocForm(false);
      setLocEditId(null);
      setLocName("");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLocBusy(false);
    }
  }

  async function handleDeleteLocation(id: Id<"wms_locations">, name: string) {
    if (!confirm(`Czy na pewno chcesz usunąć lokalizację „${name}”?`)) return;
    try {
      const res = await removeLoc({ id });
      if (res?.deactivated) {
        toast.success("Lokalizacja została oznaczona jako nieaktywna (posiada historię ruchów).");
      } else {
        toast.success("Usunięto lokalizację");
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  // Filtrowanie obiektów
  const filteredObjects = (objects ?? []).filter((o) => {
    if (filterObjCatId && o.categoryId !== filterObjCatId) return false;
    return true;
  });

  // Filtrowanie materiałów
  const filteredMaterials = (materials ?? []).filter((m) => {
    const q = matSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      m.material.name.toLowerCase().includes(q) ||
      (m.material.sku ?? "").toLowerCase().includes(q);
    const matchesCat =
      !filterMatCatId ||
      (filterMatCatId === "NONE" && !m.material.wmsCategoryId) ||
      m.material.wmsCategoryId === filterMatCatId;
    return matchesQ && matchesCat;
  });

  return (
    <Page
      title="Ustawienia WMS"
      subtitle="Zarządzaj nadrzędnymi kategoriami, podrzędnymi obiektami magazynowymi, ich cechami wymiarowymi, lokalizacjami i powiązaniami z materiałami."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {activeTab === "categories" && (
            <Btn primary onClick={startNewCategory}>
              + Nowa kategoria
            </Btn>
          )}
          {activeTab === "objects" && (
            <Btn primary onClick={() => startNewObject(filterObjCatId)}>
              + Nowy obiekt magazynowy
            </Btn>
          )}
          {activeTab === "locations" && (
            <Btn primary onClick={startNewLocation}>
              + Nowa lokalizacja
            </Btn>
          )}
        </div>
      }
    >
      {/* Zakładki */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setSelectedTab("categories")}
          style={{
            background: activeTab === "categories" ? "rgba(255,255,255,0.1)" : "transparent",
            color: activeTab === "categories" ? C.text : C.muted,
            border: `1px solid ${activeTab === "categories" ? C.borderFocus : C.border}`,
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "categories" ? 600 : 400,
          }}
        >
          Kategorie ({(categories ?? []).length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab("objects")}
          style={{
            background: activeTab === "objects" ? "rgba(255,255,255,0.1)" : "transparent",
            color: activeTab === "objects" ? C.text : C.muted,
            border: `1px solid ${activeTab === "objects" ? C.borderFocus : C.border}`,
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "objects" ? 600 : 400,
          }}
        >
          Obiekty magazynowe ({(objects ?? []).length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab("locations")}
          style={{
            background: activeTab === "locations" ? "rgba(255,255,255,0.1)" : "transparent",
            color: activeTab === "locations" ? C.text : C.muted,
            border: `1px solid ${activeTab === "locations" ? C.borderFocus : C.border}`,
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "locations" ? 600 : 400,
          }}
        >
          Lokalizacje magazynowe ({(locations ?? []).length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab("materials")}
          style={{
            background: activeTab === "materials" ? "rgba(255,255,255,0.1)" : "transparent",
            color: activeTab === "materials" ? C.text : C.muted,
            border: `1px solid ${activeTab === "materials" ? C.borderFocus : C.border}`,
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "materials" ? 600 : 400,
          }}
        >
          Przypisanie indeksów ({(materials ?? []).length})
        </button>
      </div>

      {/* ─── ZAKŁADKA 1: KATEGORIE (Nadrzędne) ──────────────────────── */}
      {activeTab === "categories" && (
        <>
          {editingCat && (
            <div style={{ marginBottom: 20 }}>
              <Card title={catForm.id ? `Edycja kategorii: ${catForm.name}` : "Nowa kategoria nadrzędna"}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Grid cols={3}>
                    <Field label="Nazwa kategorii *">
                      <input
                        style={inputStyle}
                        value={catForm.name}
                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                        placeholder="np. Szyby zespolone, Profile aluminiowe, Okucia"
                        autoFocus
                      />
                    </Field>
                    <Field label="Kod kategorii (identyfikator) *">
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                        value={catForm.code}
                        onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                        placeholder="np. GLASS, PROFILE, HARDWARE"
                      />
                    </Field>
                    <Field label="Opis kategorii (opcjonalnie)">
                      <input
                        style={inputStyle}
                        value={catForm.description}
                        onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                        placeholder="Krótki opis przeznaczenia kategorii…"
                      />
                    </Field>
                  </Grid>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn primary onClick={handleSaveCategory} disabled={catBusy}>
                      {catBusy ? "Zapisywanie…" : catForm.id ? "Zapisz zmiany" : "Utwórz kategorię"}
                    </Btn>
                    <Btn onClick={() => setEditingCat(false)}>Anuluj</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title={`Kategorie nadrzędne (${(categories ?? []).length})`} pad={false}>
            {!categories ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie kategorii…</div>
            ) : categories.length === 0 ? (
              <Empty
                title="Brak zdefiniowanych kategorii"
                text="Kliknij '+ Nowa kategoria', aby utworzyć pierwszą kategorię."
              />
            ) : (
              <Table headers={["Kod", "Nazwa kategorii", "Opis", "Obiekty podrzędne", "Status", "Akcje"]}>
                {categories.map((c) => (
                  <Tr key={c._id}>
                    <Td mono bold>{c.code}</Td>
                    <Td>
                      <span style={{ fontWeight: 600, color: C.text }}>{c.name}</span>
                    </Td>
                    <Td muted>{c.description || "—"}</Td>
                    <Td>
                      <span
                        style={{
                          background: c.objectCount > 0 ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.06)",
                          color: c.objectCount > 0 ? "#60a5fa" : C.muted,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {c.objectCount === 1 ? "1 obiekt" : `${c.objectCount} obiektów`}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: c.isActive ? C.green : C.muted, fontSize: 12 }}>
                        {c.isActive ? "● Aktywna" : "○ Nieaktywna"}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn
                          small
                          onClick={() => {
                            setSelectedTab("objects");
                            setFilterObjCatId(c._id);
                            startNewObject(c._id);
                          }}
                        >
                          + Dodaj obiekt
                        </Btn>
                        <Btn small onClick={() => startEditCategory(c)}>Edytuj</Btn>
                        <Btn small danger onClick={() => handleDeleteCategory(c._id, c.name)}>Usuń</Btn>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── ZAKŁADKA 2: OBIEKTY MAGAZYNOWE (Podrzędne) ─────────────── */}
      {activeTab === "objects" && (
        <>
          {editingObj && (
            <div style={{ marginBottom: 20 }}>
              <Card title={objForm.id ? `Edycja obiektu: ${objForm.name}` : "Nowy obiekt magazynowy"}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    Obiekt definiuje fizyczną postać magazynowaną pod kategorią (np. pod kategorią &quot;Szyby zespolone&quot; obiektem jest &quot;Pakiet szybowy&quot; lub &quot;Formatka&quot;).
                  </div>

                  <Grid cols={3}>
                    <Field label="Kategoria nadrzędna *">
                      <select
                        style={inputStyle}
                        value={objForm.categoryId}
                        onChange={(e) => setObjForm({ ...objForm, categoryId: e.target.value })}
                      >
                        <option value="">Wybierz kategorię nadrzędną…</option>
                        {(categories ?? []).map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name} ({cat.code})
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Nazwa obiektu magazynowego *">
                      <input
                        style={inputStyle}
                        value={objForm.name}
                        onChange={(e) => setObjForm({ ...objForm, name: e.target.value })}
                        placeholder="np. Pakiet szybowy, Formatka, Sztanga, Rolka"
                        autoFocus
                      />
                    </Field>

                    <Field label="Kod obiektu (opcjonalnie)">
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                        value={objForm.code}
                        onChange={(e) => setObjForm({ ...objForm, code: e.target.value.toUpperCase() })}
                        placeholder="np. GLASS_PACK, BAR"
                      />
                    </Field>
                  </Grid>

                  <Field label="Opis obiektu (opcjonalnie)">
                    <input
                      style={inputStyle}
                      value={objForm.description}
                      onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
                      placeholder="Krótki opis tego obiektu…"
                    />
                  </Field>

                  {/* Konfiguracja pól wymiarów fizycznych obiektu */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                      Wymiary fizyczne obiektu
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                      Zaznacz, jakie parametry fizyczne posiada ten obiekt. Oznaczenie &quot;Wymagane&quot; wymusza ich uzupełnienie w formularzu przyjęcia (PZ).
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                      {STANDARD_FIELD_KEYS.map(({ key, defaultLabel }) => {
                        const cfg = objForm.fieldsConfig[key];
                        return (
                          <div
                            key={key}
                            style={{
                              border: `1px solid ${cfg.enabled ? C.borderFocus : C.border}`,
                              borderRadius: 6,
                              padding: "10px 12px",
                              background: cfg.enabled ? "rgba(59, 130, 246, 0.05)" : "transparent",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: cfg.enabled ? 600 : 400,
                                color: cfg.enabled ? C.text : C.muted,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={cfg.enabled}
                                onChange={(e) => {
                                  const en = e.target.checked;
                                  setObjForm({
                                    ...objForm,
                                    fieldsConfig: {
                                      ...objForm.fieldsConfig,
                                      [key]: {
                                        ...cfg,
                                        enabled: en,
                                        required: en ? cfg.required : false,
                                      },
                                    },
                                  });
                                }}
                              />
                              {defaultLabel}
                            </label>

                            {cfg.enabled && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 24 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={cfg.required}
                                    onChange={(e) => {
                                      setObjForm({
                                        ...objForm,
                                        fieldsConfig: {
                                          ...objForm.fieldsConfig,
                                          [key]: { ...cfg, required: e.target.checked },
                                        },
                                      });
                                    }}
                                  />
                                  <span style={{ color: cfg.required ? C.red : C.muted }}>Wymagane</span>
                                </label>
                                <input
                                  style={{ ...inputStyle, fontSize: 11, padding: "2px 6px", height: 24, flex: 1 }}
                                  value={cfg.label ?? ""}
                                  placeholder="Własna etykieta…"
                                  onChange={(e) => {
                                    setObjForm({
                                      ...objForm,
                                      fieldsConfig: {
                                        ...objForm.fieldsConfig,
                                        [key]: { ...cfg, label: e.target.value },
                                      },
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pola niestandardowe */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          Dodatkowe cechy niestandardowe obiektu
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          Np. Producent, Strona L/P, Budowa pakietu szybowego itp.
                        </div>
                      </div>
                      <Btn small onClick={addCustomField}>+ Dodaj pole</Btn>
                    </div>

                    {objForm.customFields.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", padding: "8px 0" }}>
                        Brak zdefiniowanych pól niestandardowych dla tego obiektu.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {objForm.customFields.map((cf, idx) => (
                          <div
                            key={cf.key || idx}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              background: "rgba(255,255,255,0.03)",
                              padding: 8,
                              borderRadius: 4,
                            }}
                          >
                            <input
                              style={{ ...inputStyle, flex: 2 }}
                              placeholder="Etykieta pola (np. Budowa pakietu)"
                              value={cf.label}
                              onChange={(e) => {
                                const next = [...objForm.customFields];
                                next[idx].label = e.target.value;
                                setObjForm({ ...objForm, customFields: next });
                              }}
                            />
                            <select
                              style={{ ...inputStyle, width: 140 }}
                              value={cf.type}
                              onChange={(e) => {
                                const next = [...objForm.customFields];
                                next[idx].type = e.target.value as "text" | "number" | "select";
                                setObjForm({ ...objForm, customFields: next });
                              }}
                            >
                              <option value="text">Tekst</option>
                              <option value="number">Liczba</option>
                              <option value="select">Lista wyboru</option>
                            </select>
                            {cf.type === "select" && (
                              <input
                                style={{ ...inputStyle, flex: 2 }}
                                placeholder="Opcje rozdzielone przecinkiem (np. Lewa, Prawa)"
                                value={(cf.options ?? []).join(", ")}
                                onChange={(e) => {
                                  const next = [...objForm.customFields];
                                  next[idx].options = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                  setObjForm({ ...objForm, customFields: next });
                                }}
                              />
                            )}
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
                              <input
                                type="checkbox"
                                checked={cf.required}
                                onChange={(e) => {
                                  const next = [...objForm.customFields];
                                  next[idx].required = e.target.checked;
                                  setObjForm({ ...objForm, customFields: next });
                                }}
                              />
                              Wymagane
                            </label>
                            <Btn small danger onClick={() => removeCustomField(idx)}>Usuń</Btn>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn primary onClick={handleSaveObject} disabled={objBusy}>
                      {objBusy ? "Zapisywanie…" : objForm.id ? "Zapisz zmiany" : "Utwórz obiekt"}
                    </Btn>
                    <Btn onClick={() => setEditingObj(false)}>Anuluj</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title={`Obiekty magazynowe (${(filteredObjects ?? []).length})`} pad={false}>
            {/* Filtr kategorii */}
            <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Filtruj wg kategorii nadrzędnej:</span>
              <select
                style={{ ...inputStyle, width: 260 }}
                value={filterObjCatId}
                onChange={(e) => setFilterObjCatId(e.target.value)}
              >
                <option value="">Wszystkie kategorie</option>
                {(categories ?? []).map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name} ({cat.code})
                  </option>
                ))}
              </select>
            </div>

            {!objects ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie obiektów magazynowych…</div>
            ) : filteredObjects.length === 0 ? (
              <Empty
                title="Brak obiektów magazynowych"
                text="Kliknij '+ Nowy obiekt magazynowy', aby utworzyć obiekt i przypisać go do kategorii."
              />
            ) : (
              <Table headers={["Nazwa obiektu", "Kategoria nadrzędna", "Kod", "Wymiary fizyczne obiektu", "Pola własne", "Akcje"]}>
                {filteredObjects.map((obj) => {
                  const activeFields = STANDARD_FIELD_KEYS.filter((k) => obj.fieldsConfig[k.key]?.enabled);
                  return (
                    <Tr key={obj._id}>
                      <Td>
                        <span style={{ fontWeight: 600, color: C.text }}>{obj.name}</span>
                        {obj.description && <div style={{ fontSize: 11, color: C.muted }}>{obj.description}</div>}
                      </Td>
                      <Td>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            color: C.text,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {obj.categoryName}
                        </span>
                      </Td>
                      <Td mono muted>{obj.code || "—"}</Td>
                      <Td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {activeFields.length === 0 ? (
                            <span style={{ color: C.muted, fontSize: 11, fontStyle: "italic" }}>
                              Brak (obiekt bezwymiarowy)
                            </span>
                          ) : (
                            activeFields.map((f) => {
                              const cfg = obj.fieldsConfig[f.key];
                              return (
                                <span
                                  key={f.key}
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 3,
                                    background: cfg?.required ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.06)",
                                    color: cfg?.required ? C.red : C.text,
                                    border: `1px solid ${cfg?.required ? "rgba(239, 68, 68, 0.3)" : C.border}`,
                                    fontWeight: cfg?.required ? 600 : 400,
                                  }}
                                >
                                  {cfg?.label || f.defaultLabel} {cfg?.required ? "*" : ""}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </Td>
                      <Td>
                        {obj.customFields && obj.customFields.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {obj.customFields.map((cf) => (
                              <span
                                key={cf.key}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 3,
                                  background: "rgba(168, 85, 247, 0.15)",
                                  color: "#c084fc",
                                  border: "1px solid rgba(168, 85, 247, 0.3)",
                                }}
                              >
                                {cf.label} {cf.required ? "*" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: C.muted, fontSize: 11 }}>brak</span>
                        )}
                      </Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn small onClick={() => startEditObject(obj)}>Edytuj</Btn>
                          <Btn small danger onClick={() => handleDeleteObject(obj._id, obj.name)}>Usuń</Btn>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── ZAKŁADKA 3: LOKALIZACJE MAGAZYNOWE ───────────────────── */}
      {activeTab === "locations" && (
        <>
          {showLocForm && (
            <div style={{ marginBottom: 20 }}>
              <Card title={locEditId ? "Edytuj lokalizację" : "Nowa lokalizacja"}>
                <div style={{ maxWidth: 460 }}>
                  <Field label="Nazwa lokalizacji *">
                    <input
                      style={inputStyle}
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      placeholder="np. Regał 1, Regał A, Półka B, Bufor produkcyjny..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveLocation();
                        }
                      }}
                    />
                  </Field>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <Btn primary onClick={handleSaveLocation} disabled={locBusy || !locName.trim()}>
                      {locBusy ? "Zapisywanie…" : locEditId ? "Zapisz zmiany" : "Dodaj lokalizację"}
                    </Btn>
                    <Btn
                      onClick={() => {
                        setShowLocForm(false);
                        setLocEditId(null);
                        setLocName("");
                      }}
                    >
                      Anuluj
                    </Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title={`Lokalizacje magazynowe (${(locations ?? []).length})`} pad={false}>
            {!locations ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie lokalizacji…</div>
            ) : locations.length === 0 ? (
              <Empty
                icon="🧭"
                title="Brak zdefiniowanych lokalizacji"
                text="Kliknij „+ Nowa lokalizacja”, aby wpisać nazwę pierwszego regału lub miejsca składowania."
              />
            ) : (
              <Table headers={["Nazwa lokalizacji", "Partie na stanie", "Łączna masa", "Akcje"]}>
                {locations.map((l) => (
                  <Tr key={l._id}>
                    <Td>
                      <span style={{ fontWeight: 600, color: C.text }}>{l.name}</span>
                    </Td>
                    <Td>{fmtNum(l.lotCount)} partii</Td>
                    <Td nowrap muted>{l.loadKg ? fmtKg(l.loadKg) : "—"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn small onClick={() => startEditLocation(l)}>
                          Edytuj
                        </Btn>
                        <Btn small danger onClick={() => handleDeleteLocation(l._id, l.name)}>
                          Usuń
                        </Btn>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── ZAKŁADKA 4: PRZYPISANIE INDEKSÓW ──────────────────────── */}
      {activeTab === "materials" && (
        <Card title="Przypisanie indeksów materiałowych do kategorii i obiektów WMS" pad={false}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              style={{ ...inputStyle, maxWidth: 300 }}
              placeholder="Szukaj indeksu lub SKU…"
              value={matSearch}
              onChange={(e) => setMatSearch(e.target.value)}
            />
            <select
              style={{ ...inputStyle, width: 240 }}
              value={filterMatCatId}
              onChange={(e) => setFilterMatCatId(e.target.value)}
            >
              <option value="">Wszystkie kategorie WMS</option>
              <option value="NONE">Bez przypisanej kategorii WMS</option>
              {(categories ?? []).map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
          </div>

          <Table headers={["Nazwa materiału", "SKU", "Kategoria cennikowa", "Kategoria WMS", "Obiekt magazynowy", "Stan szt."]}>
            {filteredMaterials.map((m) => {
              const currentCatId = m.material.wmsCategoryId;
              const availableObjects = (objects ?? []).filter((o) => !currentCatId || o.categoryId === currentCatId);

              return (
                <Tr key={m.material._id}>
                  <Td bold>{m.material.name}</Td>
                  <Td mono muted>{m.material.sku ?? "—"}</Td>
                  <Td muted>{m.material.category ?? "—"}</Td>
                  <Td>
                    <select
                      style={{ ...inputStyle, padding: "2px 6px", height: 28, fontSize: 12 }}
                      value={m.material.wmsCategoryId ?? ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        const newCatId = val ? (val as Id<"wms_categories">) : undefined;
                        // Jeśli zmieniono kategorię, znajdź domyślny obiekt tej kategorii
                        const firstObjForCat = newCatId
                          ? (objects ?? []).find((o) => o.categoryId === newCatId)?._id
                          : undefined;

                        try {
                          await setMaterialCat({
                            materialId: m.material._id,
                            wmsCategoryId: newCatId,
                            wmsObjectId: firstObjForCat,
                          });
                          toast.success(`Zaktualizowano kategorię dla ${m.material.name}`);
                        } catch (err) {
                          toast.error(errMsg(err));
                        }
                      }}
                    >
                      <option value="">Wybierz kategorię WMS…</option>
                      {(categories ?? []).map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <select
                      style={{ ...inputStyle, padding: "2px 6px", height: 28, fontSize: 12, minWidth: 140 }}
                      value={m.material.wmsObjectId ?? ""}
                      disabled={!currentCatId}
                      onChange={async (e) => {
                        const val = e.target.value;
                        try {
                          await setMaterialCat({
                            materialId: m.material._id,
                            wmsCategoryId: currentCatId,
                            wmsObjectId: val ? (val as Id<"wms_objects">) : undefined,
                          });
                          toast.success(`Przypisano obiekt dla ${m.material.name}`);
                        } catch (err) {
                          toast.error(errMsg(err));
                        }
                      }}
                    >
                      <option value="">{currentCatId ? "Wybierz obiekt…" : "Najpierw wybierz kategorię"}</option>
                      {availableObjects.map((obj) => (
                        <option key={obj._id} value={obj._id}>
                          {obj.name}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td mono nowrap>{m.stockPieces} {m.material.unit}</Td>
                </Tr>
              );
            })}
          </Table>
        </Card>
      )}
    </Page>
  );
}

export default function WmsUstawieniaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: C.muted }}>Wczytywanie ustawień WMS…</div>}>
      <WmsSettingsContent />
    </Suspense>
  );
}

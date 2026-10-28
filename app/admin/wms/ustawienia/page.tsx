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
  ConfirmModal,
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
    lengthMm: { enabled: false, required: false, label: "Długość (mm)" },
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

  // Natywny modal potwierdzenia usunięcia
  const [deleteModal, setDeleteModal] = useState<{
    type: "category" | "object" | "location";
    id: string;
    name: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
      toast.error("Wpisz nazwę grupy towarowej");
      return;
    }
    if (!catForm.code.trim()) {
      toast.error("Wpisz kod grupy towarowej");
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
      toast.success(catForm.id ? "Zaktualizowano grupę towarową" : "Utworzono nową grupę towarową");
      setEditingCat(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCatBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteModal) return;
    setDeleteBusy(true);
    try {
      if (deleteModal.type === "category") {
        const res = await deleteCat({ id: deleteModal.id as Id<"wms_categories"> });
        if (res.deactivated) {
          toast.warning(
            `Grupa towarowa "${deleteModal.name}" posiada zarejestrowane partie w magazynie, dlatego została oznaczona jako nieaktywna (nie można jej trwale usunąć ze względu na historię stanów).`,
            { duration: 7000 }
          );
        } else {
          toast.success(`Grupa towarowa "${deleteModal.name}" została trwale usunięta.`);
        }
      } else if (deleteModal.type === "object") {
        const res = await deleteObj({ id: deleteModal.id as Id<"wms_objects"> });
        if (res.deactivated) {
          toast.warning(
            `System "${deleteModal.name}" posiada zarejestrowane partie w magazynie, dlatego został oznaczony jako nieaktywny.`,
            { duration: 7000 }
          );
        } else {
          toast.success(`System "${deleteModal.name}" został trwale usunięty.`);
        }
      } else if (deleteModal.type === "location") {
        const res = await removeLoc({ id: deleteModal.id as Id<"wms_locations"> });
        if (res?.deactivated) {
          toast.warning(
            `Lokalizacja "${deleteModal.name}" posiada historię ruchów, dlatego została oznaczona jako nieaktywna.`,
            { duration: 7000 }
          );
        } else {
          toast.success(`Lokalizacja "${deleteModal.name}" została usunięta.`);
        }
      }
      setDeleteModal(null);
    } catch (e) {
      toast.error(errMsg(e), { duration: 6000 });
    } finally {
      setDeleteBusy(false);
    }
  }

  // ─── Handlery dla Systemów / Podgrup (np. Procural, Aluprof) ──
  function startNewObject(presetCatId?: string) {
    const firstCatId = presetCatId || (categories && categories.length > 0 ? categories[0]._id : "");
    setObjForm({
      ...DEFAULT_OBJ_FORM,
      categoryId: firstCatId,
      fieldsConfig: {
        lengthMm: { enabled: false, required: false, label: "Długość (mm)" },
        widthMm: { enabled: false, required: false, label: "Szerokość (mm)" },
        heightMm: { enabled: false, required: false, label: "Wysokość (mm)" },
        thicknessMm: { enabled: false, required: false, label: "Grubość (mm)" },
        weightKg: { enabled: false, required: false, label: "Masa (kg)" },
      },
      customFields: [],
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
      toast.error("Wybierz grupę towarową nadrzędną");
      return;
    }
    if (!objForm.name.trim()) {
      toast.error("Wpisz nazwę systemu / podgrupy (np. Procural)");
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
      toast.success(objForm.id ? "Zaktualizowano system / podgrupę" : "Utworzono system / podgrupę");
      setEditingObj(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setObjBusy(false);
    }
  }

  function addCustomField() {
    const key = `field_${Date.now()}`;
    setObjForm({
      ...objForm,
      customFields: [
        ...objForm.customFields,
        {
          key,
          label: "",
          type: "number",
          required: false,
          options: undefined,
        },
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
      subtitle="Zarządzanie grupami towarowymi, systemami i podgrupami (np. Procural, Aluprof), lokalizacjami magazynu oraz przypisaniem indeksów."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {activeTab === "categories" && (
            <Btn primary onClick={startNewCategory}>
              + Nowa grupa towarowa
            </Btn>
          )}
          {activeTab === "objects" && (
            <Btn primary onClick={() => startNewObject(filterObjCatId)}>
              + Nowy system / podgrupa
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
          Grupy towarowe ({(categories ?? []).length})
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
          Systemy i podgrupy ({(objects ?? []).length})
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

      {/* ─── ZAKŁADKA 1: GRUPY TOWAROWE (Nadrzędne) ────────────────── */}
      {activeTab === "categories" && (
        <>
          {editingCat && (
            <div style={{ marginBottom: 20 }}>
              <Card title={catForm.id ? `Edycja grupy towarowej: ${catForm.name}` : "Nowa grupa towarowa"}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Grid cols={3}>
                    <Field label="Nazwa grupy towarowej *">
                      <input
                        style={inputStyle}
                        value={catForm.name}
                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                        placeholder="np. Profile aluminiowe, Okucia i zamki, Szyby zespolone"
                        autoFocus
                      />
                    </Field>
                    <Field label="Kod grupy (identyfikator) *">
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                        value={catForm.code}
                        onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                        placeholder="np. PROFILE, HARDWARE, GLASS"
                      />
                    </Field>
                    <Field label="Opis grupy towarowej (opcjonalnie)">
                      <input
                        style={inputStyle}
                        value={catForm.description}
                        onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                        placeholder="Krótki opis przeznaczenia grupy…"
                      />
                    </Field>
                  </Grid>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn primary onClick={handleSaveCategory} disabled={catBusy}>
                      {catBusy ? "Zapisywanie…" : catForm.id ? "Zapisz zmiany" : "Utwórz grupę towarową"}
                    </Btn>
                    <Btn onClick={() => setEditingCat(false)}>Anuluj</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title={`Grupy towarowe (${(categories ?? []).length})`} pad={false}>
            {!categories ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie grup towarowych…</div>
            ) : categories.length === 0 ? (
              <Empty
                title="Brak zdefiniowanych grup towarowych"
                text="Kliknij '+ Nowa grupa towarowa', aby utworzyć pierwszą grupę (np. Profile aluminiowe)."
              />
            ) : (
              <Table headers={["Kod", "Grupa towarowa", "Opis", "Systemy / Podgrupy", "Status", "Akcje"]}>
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
                        {c.objectCount === 1 ? "1 system / podgrupa" : `${c.objectCount} systemów`}
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
                          + Dodaj system
                        </Btn>
                        <Btn small onClick={() => startEditCategory(c)}>Edytuj</Btn>
                        {!c.isActive && (
                          <Btn
                            small
                            onClick={async () => {
                              try {
                                await upsertCat({
                                  id: c._id,
                                  name: c.name,
                                  code: c.code,
                                  description: c.description,
                                  isActive: true,
                                });
                                toast.success(`Przywrócono aktywność grupy "${c.name}"`);
                              } catch (e) {
                                toast.error(errMsg(e));
                              }
                            }}
                          >
                            Aktywuj
                          </Btn>
                        )}
                        <Btn small danger onClick={() => setDeleteModal({ type: "category", id: c._id, name: c.name })}>Usuń</Btn>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ─── ZAKŁADKA 2: SYSTEMY I PODGRUPY (np. Procural, Aluprof) ── */}
      {activeTab === "objects" && (
        <>
          {editingObj && (
            <div style={{ marginBottom: 20 }}>
              <Card title={objForm.id ? `Edycja systemu / podgrupy: ${objForm.name}` : "Nowy system / podgrupa"}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    System lub podgrupa reprezentuje producenta lub serię w danej grupie towarowej (np. w grupie &quot;Profile aluminiowe&quot; systemem jest &quot;Procural&quot; lub &quot;Aluprof&quot;).
                  </div>

                  <Grid cols={3}>
                    <Field label="Grupa towarowa (nadrzędna) *">
                      <select
                        style={inputStyle}
                        value={objForm.categoryId}
                        onChange={(e) => setObjForm({ ...objForm, categoryId: e.target.value })}
                      >
                        <option value="">Wybierz grupę towarową…</option>
                        {(categories ?? []).map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name} ({cat.code})
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Nazwa systemu / podgrupy *">
                      <input
                        style={inputStyle}
                        value={objForm.name}
                        onChange={(e) => setObjForm({ ...objForm, name: e.target.value })}
                        placeholder="np. Procural, Aluprof, Aliplast, Roto"
                        autoFocus
                      />
                    </Field>

                    <Field label="Kod systemu (opcjonalnie)">
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                        value={objForm.code}
                        onChange={(e) => setObjForm({ ...objForm, code: e.target.value.toUpperCase() })}
                        placeholder="np. PROCURAL, ALUPROF"
                      />
                    </Field>
                  </Grid>

                  <Field label="Opis systemu / podgrupy (opcjonalnie)">
                    <input
                      style={inputStyle}
                      value={objForm.description}
                      onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
                      placeholder="Krótki opis przeznaczenia lub serii…"
                    />
                  </Field>

                  {/* Konfiguracja parametrów i cech systemu */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${C.borderFocus}`,
                      borderRadius: 8,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                          <span>⚙️</span> Własne parametry i cechy indeksów tego systemu
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                          Możesz zdefiniować dowolne parametry techniczne wymagane dla indeksów tej podgrupy.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {objForm.customFields.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setObjForm({ ...objForm, customFields: [] })}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: C.muted,
                              fontSize: 11,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Wyczyść listę własnych parametrów
                          </button>
                        )}
                        <Btn small primary onClick={() => addCustomField()}>
                          + Dodaj własny parametr
                        </Btn>
                      </div>
                    </div>

                    {/* Lista zdefiniowanych parametrów własnych */}
                    {objForm.customFields.length === 0 ? (
                      <div
                        style={{
                          padding: "16px",
                          background: "rgba(255,255,255,0.02)",
                          border: `1px dashed ${C.border}`,
                          borderRadius: 6,
                          textAlign: "center",
                          color: C.muted,
                          fontSize: 12,
                        }}
                      >
                        Brak zdefiniowanych dodatkowych parametrów. Kliknij <strong>„+ Dodaj własny parametr”</strong> powyżej, aby dodać parametr dla indeksów tego systemu.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {objForm.customFields.map((cf, idx) => (
                          <div
                            key={cf.key || idx}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              background: "rgba(255,255,255,0.03)",
                              border: `1px solid ${C.border}`,
                              padding: 10,
                              borderRadius: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: 2, minWidth: 200 }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Nazwa parametru *</div>
                              <input
                                style={inputStyle}
                                placeholder="np. Głębokość zabudowy (mm)"
                                value={cf.label}
                                onChange={(e) => {
                                  const next = [...objForm.customFields];
                                  next[idx].label = e.target.value;
                                  setObjForm({ ...objForm, customFields: next });
                                }}
                              />
                            </div>

                            <div style={{ width: 150 }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Typ wartości</div>
                              <select
                                style={inputStyle}
                                value={cf.type}
                                onChange={(e) => {
                                  const next = [...objForm.customFields];
                                  next[idx].type = e.target.value as "text" | "number" | "select";
                                  setObjForm({ ...objForm, customFields: next });
                                }}
                              >
                                <option value="number">Liczba / Wymiar</option>
                                <option value="text">Tekst</option>
                                <option value="select">Lista wyboru</option>
                              </select>
                            </div>

                            {cf.type === "select" && (
                              <div style={{ flex: 2, minWidth: 200 }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Opcje wyboru (po przecinku)</div>
                                <input
                                  style={inputStyle}
                                  placeholder="np. Wariant 1, Wariant 2"
                                  value={(cf.options ?? []).join(", ")}
                                  onChange={(e) => {
                                    const next = [...objForm.customFields];
                                    next[idx].options = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                    setObjForm({ ...objForm, customFields: next });
                                  }}
                                />
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
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
                                <span style={{ color: cf.required ? C.red : C.muted }}>Wymagane</span>
                              </label>

                              <Btn small danger onClick={() => removeCustomField(idx)}>Usuń</Btn>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn primary onClick={handleSaveObject} disabled={objBusy}>
                      {objBusy ? "Zapisywanie…" : objForm.id ? "Zapisz zmiany" : "Utwórz system / podgrupę"}
                    </Btn>
                    <Btn onClick={() => setEditingObj(false)}>Anuluj</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card title={`Systemy i podgrupy (${(filteredObjects ?? []).length})`} pad={false}>
            {/* Filtr kategorii */}
            <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Filtruj wg grupy towarowej:</span>
              <select
                style={{ ...inputStyle, width: 260 }}
                value={filterObjCatId}
                onChange={(e) => setFilterObjCatId(e.target.value)}
              >
                <option value="">Wszystkie grupy towarowe</option>
                {(categories ?? []).map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name} ({cat.code})
                  </option>
                ))}
              </select>
            </div>

            {!objects ? (
              <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Wczytywanie systemów / podgrup…</div>
            ) : filteredObjects.length === 0 ? (
              <Empty
                title="Brak zdefiniowanych systemów / podgrup"
                text="Kliknij '+ Nowy system / podgrupa', aby utworzyć pierwszy system (np. Procural) i przypisać go do grupy towarowej."
              />
            ) : (
              <Table headers={["Nazwa systemu / podgrupy", "Grupa towarowa", "Kod", "Własne parametry i cechy", "Akcje"]}>
                {filteredObjects.map((obj) => {
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
                        {(obj.customFields ?? []).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(obj.customFields ?? []).map((cf) => (
                              <span
                                key={cf.key}
                                style={{
                                  fontSize: 11,
                                  background: cf.required ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.06)",
                                  color: cf.required ? "#fca5a5" : C.text,
                                  border: `1px solid ${cf.required ? "rgba(239, 68, 68, 0.3)" : C.border}`,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                }}
                              >
                                {cf.label}
                                {cf.required ? " *" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: C.muted, fontSize: 11, fontStyle: "italic" }}>
                            Brak parametrów
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn small onClick={() => startEditObject(obj)}>Edytuj</Btn>
                          <Btn small danger onClick={() => setDeleteModal({ type: "object", id: obj._id, name: obj.name })}>Usuń</Btn>
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
                        <Btn small danger onClick={() => setDeleteModal({ type: "location", id: l._id, name: l.name })}>
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
        <Card title="Przypisanie indeksów materiałowych do grup towarowych i systemów" pad={false}>
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
              <option value="">Wszystkie grupy towarowe</option>
              <option value="NONE">Bez przypisanej grupy towarowej</option>
              {(categories ?? []).map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
          </div>

          <Table headers={["Indeks / Nazwa materiału", "SKU / Kod", "Kategoria cennikowa", "Grupa towarowa WMS", "System / Podgrupa", "Stan szt."]}>
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
                          toast.success(`Zaktualizowano grupę towarową dla ${m.material.name}`);
                        } catch (err) {
                          toast.error(errMsg(err));
                        }
                      }}
                    >
                      <option value="">Wybierz grupę towarową…</option>
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
                          toast.success(`Przypisano system / podgrupę dla ${m.material.name}`);
                        } catch (err) {
                          toast.error(errMsg(err));
                        }
                      }}
                    >
                      <option value="">{currentCatId ? "Wybierz system…" : "Najpierw wybierz grupę"}</option>
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

      {/* ─── NATYWNY MODAL POTWIERDZENIA USUNIĘCIA ─────────────────── */}
      <ConfirmModal
        isOpen={!!deleteModal}
        title={
          deleteModal?.type === "category"
            ? `Usunięcie grupy towarowej`
            : deleteModal?.type === "object"
            ? `Usunięcie systemu / podgrupy`
            : `Usunięcie lokalizacji`
        }
        message={
          deleteModal?.type === "category" ? (
            <>
              Czy na pewno chcesz trwale usunąć grupę towarową <strong style={{ color: C.text }}>&quot;{deleteModal.name}&quot;</strong>?
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Jeśli w magazynie nie ma zarejestrowanych partii towarowych dla tej grupy, zostanie ona trwale usunięta wraz z pustymi podgrupami.
              </div>
            </>
          ) : deleteModal?.type === "object" ? (
            <>
              Czy na pewno chcesz usunąć system / podgrupę <strong style={{ color: C.text }}>&quot;{deleteModal.name}&quot;</strong>?
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Jeśli podgrupa nie posiada partii towarowych w magazynie, zostanie całkowicie usunięta.
              </div>
            </>
          ) : (
            <>
              Czy na pewno chcesz usunąć lokalizację <strong style={{ color: C.text }}>&quot;{deleteModal?.name}&quot;</strong>?
            </>
          )
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

export default function WmsUstawieniaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: C.muted }}>Wczytywanie ustawień WMS…</div>}>
      <WmsSettingsContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Badge,
  Btn,
  Card,
  Empty,
  errMsg,
  Field,
  fmtDate,
  fmtNum,
  Grid,
  inputStyle,
  Page,
  SURFACE_LABEL,
  Table,
  Td,
  Tr,
  C,
} from "./ui";

type DocType = "PZ" | "RW";

function SupplierCombobox({
  value,
  onChange,
  suppliers,
  placeholder = "Wpisz nazwę lub NIP dostawcy…",
}: {
  value: string;
  onChange: (val: string) => void;
  suppliers: Array<{ _id: string; name: string; nip?: string; city?: string; category?: string }>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return suppliers;
    const cleanQ = query.replace(/\D/g, "");
    return suppliers.filter((s) => {
      const n = s.name.toLowerCase();
      const nip = (s.nip ?? "").replace(/\D/g, "");
      const city = (s.city ?? "").toLowerCase();
      const cat = (s.category ?? "").toLowerCase();
      return (
        n.includes(query) ||
        (cleanQ.length > 0 && nip.includes(cleanQ)) ||
        city.includes(query) ||
        cat.includes(query)
      );
    });
  }, [suppliers, query]);

  const hasExactMatch = suppliers.some(
    (s) => s.name.toLowerCase() === value.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          style={{
            ...inputStyle,
            paddingRight: value ? 52 : 30,
            borderColor: open ? C.borderFocus : C.border,
          }}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div
          style={{
            position: "absolute",
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: C.muted,
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: 12,
                borderRadius: 4,
              }}
              title="Wyczyść"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            style={{
              background: "transparent",
              border: "none",
              color: open ? C.accent : C.muted,
              cursor: "pointer",
              padding: "2px",
              fontSize: 11,
            }}
            title={open ? "Zwiń" : "Rozwiń listę"}
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: "auto",
            background: "#161b22",
            border: `1px solid ${C.borderFocus}`,
            borderRadius: 6,
            zIndex: 1100,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", color: C.muted, fontSize: 12 }}>
              Brak dopasowania w bazie dostawców.
              {value.trim() && (
                <div style={{ marginTop: 4, color: C.accent }}>
                  Zostanie zapisana wpisana nazwa: <strong>{value.trim()}</strong>
                </div>
              )}
            </div>
          ) : (
            filtered.map((s) => {
              const isSelected = s.name.toLowerCase() === value.trim().toLowerCase();
              return (
                <div
                  key={s._id}
                  onClick={() => {
                    onChange(s.name);
                    setOpen(false);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: isSelected ? "rgba(56, 139, 253, 0.18)" : "transparent",
                    border: isSelected ? "1px solid rgba(56, 139, 253, 0.4)" : "1px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {s.name}
                    </div>
                    {(s.nip || s.city || s.category) && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2, display: "flex", gap: 6 }}>
                        {s.nip && <span>NIP: {s.nip}</span>}
                        {s.city && <span>• {s.city}</span>}
                        {s.category && <span>• [{s.category}]</span>}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <span style={{ color: C.accent, fontSize: 13, fontWeight: 700 }}>✓</span>
                  )}
                </div>
              );
            })
          )}

          {value.trim() && !hasExactMatch && (
            <div
              onClick={() => setOpen(false)}
              style={{
                marginTop: 4,
                borderTop: `1px solid ${C.border}`,
                padding: "8px 10px",
                fontSize: 12,
                color: C.accent,
                cursor: "pointer",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✍️</span> Użyj wpisanej nazwy: <strong>„{value.trim()}”</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DocumentDetailView({
  id,
  type,
  backHref,
}: {
  id: Id<"wms_documents">;
  type: DocType;
  backHref: string;
}) {
  const router = useRouter();
  const data = useQuery(api.wms.getDocument, { id });
  const materials = useQuery(api.wms.listProfiles, { allCategories: true });
  const locations = useQuery(api.wms.listLocations, { onlyActive: true });
  const lots = useQuery(api.wms.listLots, { includeDepleted: false });
  const suppliers = useQuery(api.suppliers.list, {}) ?? [];

  const approve = useMutation(api.wms.approve);
  const cancel = useMutation(api.wms.cancel);
  const deleteDocument = useMutation(api.wms.deleteDocument);
  const updateHeader = useMutation(api.wms.updateHeader);
  const addLine = useMutation(api.wms.addLine);
  const removeLine = useMutation(api.wms.removeLine);
  const generateUploadUrl = useMutation(api.wms.generateUploadUrl);

  const [busy, setBusy] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);

  // Natywne modale potwierdzeń (zamiast window.confirm)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditHeaderModal, setShowEditHeaderModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState("");
  const [editExtNumber, setEditExtNumber] = useState("");
  const [editExpectedBundles, setEditExpectedBundles] = useState("");
  const [editTargetNote, setEditTargetNote] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [lineToDelete, setLineToDelete] = useState<{ id: Id<"wms_document_lines">; name: string } | null>(null);

  // Formularz nowej pozycji
  const [lineMatId, setLineMatId] = useState("");
  const [lineLotId, setLineLotId] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [lineLength, setLineLength] = useState("");
  const [lineWidth, setLineWidth] = useState("");
  const [lineHeight, setLineHeight] = useState("");
  const [lineThickness, setLineThickness] = useState("");
  const [lineWeight, setLineWeight] = useState("");
  const [lineCustomAttrs, setLineCustomAttrs] = useState<Record<string, string>>({});
  const [lineColor, setLineColor] = useState("");
  const [lineSurface, setLineSurface] = useState<"MILL" | "RAL" | "ANODA" | "BICOLOR">("RAL");
  const [lineHeat, setLineHeat] = useState("");
  const [lineSscc, setLineSscc] = useState("");
  const [lineToLoc, setLineToLoc] = useState("");
  const [lineNote, setLineNote] = useState("");

  // Uszkodzenie / kontrola jakości (dla PZ)
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDesc, setDamageDesc] = useState("");
  const [damagePos, setDamagePos] = useState("");
  const [damageDisp, setDamageDisp] = useState<"ACCEPT" | "QUALITY_HOLD" | "REJECT">("ACCEPT");

  // Atest plik
  const [certFile, setCertFile] = useState<File | null>(null);

  // Znajdź wybrany materiał, jego kategorię WMS oraz obiekt magazynowy
  const selectedMaterial = (materials ?? []).find((m) => m.material._id === lineMatId);
  const cat = selectedMaterial?.category;
  const obj = selectedMaterial?.object;
  const fc = obj?.fieldsConfig ?? cat?.fieldsConfig;
  const objectName = obj?.name ?? cat?.objectName ?? "Obiekt";
  type CustomFieldDef = {
    key: string;
    label: string;
    type: "text" | "number" | "select";
    options?: string[];
    required: boolean;
  };
  const customFields: CustomFieldDef[] = (obj?.customFields ?? cat?.customFields ?? []) as CustomFieldDef[];
  const defaultUnit = obj?.defaultUnit ?? cat?.defaultUnit ?? "szt.";

  if (data === null) {
    return (
      <Page title={`${type} — Dokument nie istnieje`} subtitle="Wskazany dokument został usunięty lub nie istnieje">
        <Card pad>
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Dokument nie istnieje lub został usunięty
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              Ten dokument magazynowy nie został odnaleziony w bazie danych.
            </div>
            <Link href={backHref} className="fluent-btn">
              ← Powrót do listy {type}
            </Link>
          </div>
        </Card>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page title={`${type} — Dokument`} subtitle="Ładowanie dokumentu…">
        <div style={{ color: C.muted, fontSize: 13 }}>Wczytywanie szczegółów…</div>
      </Page>
    );
  }

  const { doc, lines, createdByName, approvedByName } = data;
  const isDraft = doc.status === "DRAFT";

  async function handleApproveConfirm() {
    setBusy(true);
    try {
      const res = await approve({ id: doc._id });
      toast.success(`Dokument ${doc.number} został zatwierdzony`);
      setShowApproveModal(false);
      if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) toast.warning(w);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm() {
    setBusy(true);
    try {
      await cancel({ id: doc._id });
      toast.success("Dokument został anulowany");
      setShowCancelModal(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    setBusy(true);
    try {
      await deleteDocument({ id: doc._id });
      toast.success(`Dokument ${doc.number} został trwale usunięty`);
      setShowDeleteModal(false);
      router.push(backHref);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function openEditHeader() {
    setEditSupplier(doc.supplier ?? "");
    setEditExtNumber(doc.externalDocNumber ?? "");
    setEditExpectedBundles(doc.expectedBundles !== undefined ? String(doc.expectedBundles) : "");
    setEditTargetNote(doc.targetNote ?? "");
    setEditNotes(doc.notes ?? "");
    setShowEditHeaderModal(true);
  }

  async function handleSaveHeader() {
    const finalSupplier = editSupplier.trim();
    if (type === "PZ" && !finalSupplier) {
      toast.error("Wybierz lub wpisz dostawcę.");
      return;
    }
    setBusy(true);
    try {
      await updateHeader({
        id: doc._id,
        supplier: finalSupplier || undefined,
        externalDocNumber: editExtNumber.trim() || undefined,
        expectedBundles: editExpectedBundles ? parseInt(editExpectedBundles, 10) : undefined,
        targetNote: editTargetNote.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      toast.success("Dane nagłówka zostały zaktualizowane");
      setShowEditHeaderModal(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveLineConfirm() {
    if (!lineToDelete) return;
    setBusy(true);
    try {
      await removeLine({ id: lineToDelete.id });
      toast.success("Pozycja usunięta");
      setLineToDelete(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLine() {
    if (type === "PZ") {
      if (!lineMatId) {
        toast.error("Wybierz indeks materiałowy z listy.");
        return;
      }
      if ((!hasDamage || damageDisp !== "REJECT") && !lineToLoc) {
        toast.error("Wybierz lokalizację docelową (regał) przed dodaniem pozycji.");
        return;
      }
    } else if (type === "RW") {
      if (!lineLotId) {
        toast.error("Wybierz partię ze stanu magazynowego.");
        return;
      }
      if (!lineToLoc) {
        toast.error("Wybierz lokalizację docelową wydania.");
        return;
      }
    }

    const qtyNum = parseInt(lineQty, 10);
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Podaj poprawną liczbę sztuk (większą od 0).");
      return;
    }

    setBusy(true);
    try {
      let certificateStorageId: Id<"_storage"> | undefined;
      let certificateName: string | undefined;

      if (certFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": certFile.type || "application/octet-stream" },
          body: certFile,
        });
        const json = await res.json();
        certificateStorageId = json.storageId as Id<"_storage">;
        certificateName = certFile.name;
      }

      await addLine({
        documentId: doc._id,
        materialId: lineMatId ? (lineMatId as Id<"materials">) : undefined,
        objectId: obj?._id,
        lotId: lineLotId ? (lineLotId as Id<"wms_lots">) : undefined,
        quantityPieces: qtyNum,
        lengthMm: lineLength ? parseInt(lineLength, 10) : undefined,
        widthMm: lineWidth ? parseInt(lineWidth, 10) : undefined,
        heightMm: lineHeight ? parseInt(lineHeight, 10) : undefined,
        thicknessMm: lineThickness ? parseFloat(lineThickness) : undefined,
        weightKg: lineWeight ? parseFloat(lineWeight) : undefined,
        customAttributes: Object.keys(lineCustomAttrs).length > 0 ? lineCustomAttrs : undefined,
        kind: undefined,
        colorCode: lineColor.trim() || undefined,
        surfaceType: lineSurface,
        heatNumber: lineHeat.trim() || undefined,
        ssccCode: lineSscc.trim() || undefined,
        certificateStorageId,
        certificateName,
        toLocationId: lineToLoc ? (lineToLoc as Id<"wms_locations">) : undefined,
        damage: hasDamage && damageDesc.trim()
          ? {
              description: damageDesc.trim(),
              positionMm: damagePos ? parseInt(damagePos, 10) : undefined,
              disposition: damageDisp,
            }
          : undefined,
        note: lineNote.trim() || undefined,
      });

      toast.success("Dodano pozycję do dokumentu");
      setShowAddLine(false);
      // Reset form
      setLineQty("1");
      setLineWidth("");
      setLineHeight("");
      setLineThickness("");
      setLineWeight("");
      setLineCustomAttrs({});
      setLineColor("");
      setLineHeat("");
      setLineSscc("");
      setLineToLoc("");
      setLineNote("");
      setHasDamage(false);
      setDamageDesc("");
      setDamagePos("");
      setCertFile(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveLine(line: typeof lines[number]) {
    setLineToDelete({
      id: line._id,
      name: line.materialName ?? line.lotLabel ?? "Tę pozycję",
    });
  }

  return (
    <Page
      title={`${type}: ${doc.number}`}
      subtitle={`Status: ${doc.status} · Utworzył: ${createdByName} (${fmtDate(doc.createdAt)})`}
      actions={
        <>
          <Link href={backHref} className="fluent-btn">
            ← Powrót do listy
          </Link>
          <Btn danger onClick={() => setShowDeleteModal(true)} disabled={busy}>
            🗑 Usuń {type}
          </Btn>
          {isDraft && (
            <>
              <Btn danger onClick={() => setShowCancelModal(true)} disabled={busy}>
                Anuluj dokument
              </Btn>
              <Btn primary onClick={() => setShowApproveModal(true)} disabled={busy || lines.length === 0}>
                {busy ? "Zatwierdzanie…" : "✓ Zatwierdź dokument"}
              </Btn>
            </>
          )}
        </>
      }
    >
      {/* Nagłówek dokumentu */}
      <Card
        title="Informacje o dokumencie"
        right={
          isDraft ? (
            <Btn small onClick={openEditHeader}>
              ✏️ Edytuj dane
            </Btn>
          ) : undefined
        }
      >
        <Grid cols={4}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Numer</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{doc.number}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Status</div>
            <div style={{ marginTop: 2 }}><Badge status={doc.status} /></div>
          </div>
          {doc.supplier && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Dostawca</div>
              <div style={{ fontSize: 13, color: C.text }}>{doc.supplier}</div>
            </div>
          )}
          {doc.externalDocNumber && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Nr zewn. / WZ dostawcy</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: "monospace" }}>{doc.externalDocNumber}</div>
            </div>
          )}
          {doc.expectedBundles !== undefined && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Oczekiwane paczki</div>
              <div style={{ fontSize: 13, color: C.text }}>{doc.expectedBundles} paczek</div>
            </div>
          )}
          {doc.targetNote && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Cel / Odbiorca / Maszyna</div>
              <div style={{ fontSize: 13, color: C.text }}>{doc.targetNote}</div>
            </div>
          )}
          {approvedByName && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Zatwierdził</div>
              <div style={{ fontSize: 13, color: C.text }}>{approvedByName} {doc.approvedAt ? `(${fmtDate(doc.approvedAt)})` : ""}</div>
            </div>
          )}
          {doc.notes && (
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Uwagi</div>
              <div style={{ fontSize: 13, color: C.text }}>{doc.notes}</div>
            </div>
          )}
        </Grid>
      </Card>

      {/* Formularz dodawania pozycji (tylko w trybie DRAFT) */}
      {isDraft && (
        <div style={{ marginBottom: 16 }}>
          {!showAddLine ? (
            <Btn primary onClick={() => setShowAddLine(true)}>
              + Dodaj pozycję do dokumentu
            </Btn>
          ) : (
            <Card title="Nowa pozycja dokumentu">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {type === "PZ" ? (
                  <>
                    <Grid cols={3}>
                      <Field label="Indeks materiałowy *" span={cat ? 2 : 3}>
                        <select
                          style={inputStyle}
                          value={lineMatId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLineMatId(val);
                            const mat = (materials ?? []).find((m) => m.material._id === val);
                            const mDoc = mat?.material;
                            if (mDoc?.lengthMm !== undefined) {
                              setLineLength(mDoc.lengthMm.toString());
                            } else if (mat?.profile?.standardLengthMm) {
                              setLineLength(mat.profile.standardLengthMm.toString());
                            }
                            if (mDoc?.widthMm !== undefined) setLineWidth(mDoc.widthMm.toString());
                            if (mDoc?.heightMm !== undefined) setLineHeight(mDoc.heightMm.toString());
                            if (mDoc?.thicknessMm !== undefined) setLineThickness(mDoc.thicknessMm.toString());
                            if (mDoc?.weightKg !== undefined) setLineWeight(mDoc.weightKg.toString());
                            if (mDoc?.customAttributes && typeof mDoc.customAttributes === "object") {
                              setLineCustomAttrs(mDoc.customAttributes as Record<string, string>);
                            }
                          }}
                        >
                          <option value="">Wybierz indeks towarowy…</option>
                          {(materials ?? []).map((m) => (
                            <option key={m.material._id} value={m.material._id}>
                              {m.category && m.object ? `[${m.category.name} → ${m.object.name}] ` : ""}
                              {m.material.sku ? `${m.material.sku} — ` : ""}
                              {m.material.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {cat && (
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Grupa towarowa / System</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                            <span style={{ background: "rgba(255,255,255,0.08)", color: C.text, padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {cat.name}
                            </span>
                            <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {objectName}
                            </span>
                          </div>
                        </div>
                      )}

                      <Field label={`Liczba (${defaultUnit}) *`}>
                        <input style={inputStyle} type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                      </Field>

                      {/* Długość */}
                      {fc?.lengthMm?.enabled && (
                        <Field label={`${fc.lengthMm.label || "Długość (mm)"} ${fc.lengthMm.required ? "*" : ""}`}>
                          <input style={inputStyle} type="number" min="1" value={lineLength} onChange={(e) => setLineLength(e.target.value)} />
                        </Field>
                      )}

                      {/* Szerokość */}
                      {fc?.widthMm?.enabled && (
                        <Field label={`${fc.widthMm.label || "Szerokość (mm)"} ${fc.widthMm.required ? "*" : ""}`}>
                          <input style={inputStyle} type="number" min="1" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} placeholder="np. 1200" />
                        </Field>
                      )}

                      {/* Wysokość */}
                      {fc?.heightMm?.enabled && (
                        <Field label={`${fc.heightMm.label || "Wysokość (mm)"} ${fc.heightMm.required ? "*" : ""}`}>
                          <input style={inputStyle} type="number" min="1" value={lineHeight} onChange={(e) => setLineHeight(e.target.value)} placeholder="np. 800" />
                        </Field>
                      )}

                      {/* Grubość */}
                      {fc?.thicknessMm?.enabled && (
                        <Field label={`${fc.thicknessMm.label || "Grubość (mm)"} ${fc.thicknessMm.required ? "*" : ""}`}>
                          <input style={inputStyle} type="number" step="0.1" min="0" value={lineThickness} onChange={(e) => setLineThickness(e.target.value)} placeholder="np. 24 lub 2.0" />
                        </Field>
                      )}

                      {/* Masa obiektu */}
                      {fc?.weightKg?.enabled && (
                        <Field label={`${fc.weightKg.label || "Masa (kg)"} ${fc.weightKg.required ? "*" : ""}`}>
                          <input style={inputStyle} type="number" step="0.01" min="0" value={lineWeight} onChange={(e) => setLineWeight(e.target.value)} placeholder="np. 15.5" />
                        </Field>
                      )}

                      {/* Kolor */}
                      {fc?.color?.enabled && (
                        <Field label={`${fc.color.label || "Kolor / RAL"} ${fc.color.required ? "*" : ""}`}>
                          <input style={inputStyle} value={lineColor} onChange={(e) => setLineColor(e.target.value)} placeholder="np. RAL 7016 MAT" />
                        </Field>
                      )}

                      {/* Typ powłoki */}
                      {fc?.surfaceType?.enabled && (
                        <Field label={`${fc.surfaceType.label || "Typ powłoki"} ${fc.surfaceType.required ? "*" : ""}`}>
                          <select style={inputStyle} value={lineSurface} onChange={(e) => setLineSurface(e.target.value as "MILL" | "RAL" | "ANODA" | "BICOLOR")}>
                            <option value="RAL">Lakier RAL</option>
                            <option value="ANODA">Anoda</option>
                            <option value="MILL">Surowy</option>
                            <option value="BICOLOR">Bicolor</option>
                          </select>
                        </Field>
                      )}

                      {/* Nr partii / wytopu */}
                      {fc?.heatNumber?.enabled && (
                        <Field label={`${fc.heatNumber.label || "Partia / Nr wytopu"} ${fc.heatNumber.required ? "*" : ""}`}>
                          <input style={inputStyle} value={lineHeat} onChange={(e) => setLineHeat(e.target.value)} placeholder="np. W-2026/889" />
                        </Field>
                      )}

                      {/* Kod SSCC */}
                      {fc?.sscc?.enabled && (
                        <Field label={`${fc.sscc.label || "Kod SSCC / ID nośnika"} ${fc.sscc.required ? "*" : ""}`}>
                          <input style={inputStyle} value={lineSscc} onChange={(e) => setLineSscc(e.target.value)} placeholder="np. SSCC-001928" />
                        </Field>
                      )}

                      {/* Lokalizacja docelowa */}
                      <Field label="Lokalizacja docelowa *">
                        <select
                          style={{
                            ...inputStyle,
                            ...(!lineToLoc ? { borderColor: C.amber } : null),
                          }}
                          value={lineToLoc}
                          onChange={(e) => setLineToLoc(e.target.value)}
                        >
                          <option value="">Wybierz regał / lokalizację…</option>
                          {(locations ?? []).map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name} ({l.code})
                            </option>
                          ))}
                        </select>
                        {(locations ?? []).length === 0 && (
                          <span style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>
                            Brak aktywnych lokalizacji w magazynie. Dodaj je w Ustawieniach.
                          </span>
                        )}
                      </Field>

                      {/* Atest */}
                      {fc?.certificate?.enabled && (
                        <Field label={`${fc.certificate.label || "Atest 3.1 / Certyfikat"} ${fc.certificate.required ? "*" : ""}`}>
                          <input
                            style={{ ...inputStyle, padding: "3px 6px" }}
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                          />
                        </Field>
                      )}

                      {/* Pola niestandardowe dla danej kategorii */}
                      {customFields.map((cf) => (
                        <Field key={cf.key} label={`${cf.label} ${cf.required ? "*" : ""}`}>
                          {cf.type === "select" ? (
                            <select
                              style={inputStyle}
                              value={lineCustomAttrs[cf.key] ?? ""}
                              onChange={(e) =>
                                setLineCustomAttrs({ ...lineCustomAttrs, [cf.key]: e.target.value })
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
                              value={lineCustomAttrs[cf.key] ?? ""}
                              placeholder={`Wpisz ${cf.label.toLowerCase()}…`}
                              onChange={(e) =>
                                setLineCustomAttrs({ ...lineCustomAttrs, [cf.key]: e.target.value })
                              }
                            />
                          )}
                        </Field>
                      ))}

                      <Field label="Uwagi do pozycji" span={2}>
                        <input style={inputStyle} value={lineNote} onChange={(e) => setLineNote(e.target.value)} placeholder="Uwagi magazyniera…" />
                      </Field>
                    </Grid>
                  </>
                ) : (
                  /* RW — wybieramy istniejącą partię ze stanu */
                  <Grid cols={3}>
                    <Field label="Wybierz partię ze stanu *" span={2}>
                      <select
                        style={inputStyle}
                        value={lineLotId}
                        onChange={(e) => {
                          setLineLotId(e.target.value);
                          const selected = (lots ?? []).find((l) => l._id === e.target.value);
                          if (selected) setLineQty(selected.quantityPieces.toString());
                        }}
                      >
                        <option value="">Wybierz partię ze stanu magazynowego…</option>
                        {(lots ?? [])
                          .filter((l) => l.status !== "IN_PROGRESS")
                          .map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.materialName} · {l.objectName}: {l.dimensionsSummary} · {l.colorCode ?? "brak koloru"} · Lok: {l.locationCode} · Stan: {l.quantityPieces} {l.unit} ({l.status})
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Ilość do wydania *">
                      <input style={inputStyle} type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                    </Field>
                    <Field label="Lokalizacja docelowa *" span={2}>
                      <select style={inputStyle} value={lineToLoc} onChange={(e) => setLineToLoc(e.target.value)}>
                        <option value="">Wybierz lokalizację docelową…</option>
                        {(() => {
                          const rwLocs = (locations ?? []).filter((l) => l.zone === "BUFOR_PRODUKCYJNY");
                          const list = type === "RW" && rwLocs.length > 0 ? rwLocs : (locations ?? []);
                          return list.map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name}
                            </option>
                          ));
                        })()}
                      </select>
                    </Field>
                    <Field label="Uwagi">
                      <input style={inputStyle} value={lineNote} onChange={(e) => setLineNote(e.target.value)} placeholder="np. dla zlecenia / stanowiska…" />
                    </Field>
                  </Grid>
                )}

                {/* Kontrola jakości dla PZ (rejestracja wad) */}
                {type === "PZ" && (
                  <div style={{ marginTop: 8, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.text }}>
                      <input type="checkbox" checked={hasDamage} onChange={(e) => setHasDamage(e.target.checked)} />
                      Zgłoś uszkodzenie mechaniczne / wadę jakościową obiektu
                    </label>
                    {hasDamage && (
                      <Grid cols={3}>
                        <div style={{ marginTop: 8 }}>
                          <Field label="Opis wady *">
                            <input style={inputStyle} value={damageDesc} onChange={(e) => setDamageDesc(e.target.value)} placeholder="np. Zarysowanie powierzchni…" />
                          </Field>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Field label="Pozycja / strefa wady (opcjonalnie)">
                            <input style={inputStyle} type="number" min="0" value={damagePos} onChange={(e) => setDamagePos(e.target.value)} placeholder="np. 3200 mm" />
                          </Field>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Field label="Decyzja jakościowa">
                            <select style={inputStyle} value={damageDisp} onChange={(e) => setDamageDisp(e.target.value as "ACCEPT" | "QUALITY_HOLD" | "REJECT")}>
                              <option value="ACCEPT">Przyjmij mimo wady (zapisz uwagę)</option>
                              <option value="REJECT">Odrzuć pozycję (nie wchodzi na stan)</option>
                            </select>
                          </Field>
                        </div>
                      </Grid>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn primary onClick={handleAddLine} disabled={busy}>
                    {busy ? "Zapisywanie…" : "Dodaj pozycję"}
                  </Btn>
                  <Btn onClick={() => setShowAddLine(false)}>Anuluj</Btn>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tabela pozycji */}
      <Card title={`Pozycje dokumentu (${lines.length})`} pad={false}>
        {lines.length === 0 ? (
          <Empty title="Dokument nie zawiera pozycji" text={isDraft ? "Użyj przycisku powyżej, aby dodać pozycje." : ""} />
        ) : (
          <Table
            headers={[
              "Lp.",
              type === "PZ" ? "Indeks / System" : "Partia źródłowa",
              "Wymiary / Parametry",
              "Ilość",
              "Cechy (kolor/partia)",
              type === "PZ" ? "Do lokalizacji" : "Lokalizacja docelowa",
              "Atest",
              "Kontrola jakości",
              ...(isDraft ? [""] : []),
            ]}
          >
            {lines.map((line, idx) => (
              <Tr key={line._id}>
                <Td mono muted>{idx + 1}</Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: C.text }}>
                      {line.materialName ?? line.lotLabel ?? "—"}
                    </span>
                    {line.objectName && (
                      <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "1px 6px", borderRadius: 3 }}>
                        {line.objectName}
                      </span>
                    )}
                  </div>
                  {line.note && <div style={{ fontSize: 11, color: C.muted }}>{line.note}</div>}
                  {line.customAttributes && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {Object.entries(line.customAttributes as Record<string, unknown>).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: 2 }}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </Td>
                <Td nowrap style={{ fontFamily: "monospace" }}>
                  {line.dimensionsSummary ?? (line.lengthMm ? `${fmtNum(line.lengthMm)} mm` : "—")}
                </Td>
                <Td nowrap style={{ fontWeight: 600 }}>
                  {fmtNum(line.quantityPieces)} {line.unit ?? "szt."}
                </Td>
                <Td>
                  {line.colorCode ?? "—"}
                  {line.surfaceType && <div style={{ fontSize: 11, color: C.muted }}>{SURFACE_LABEL[line.surfaceType]}</div>}
                  {line.heatNumber && <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Partia: {line.heatNumber}</div>}
                </Td>
                <Td mono>
                  {line.fromCode ? `${line.fromCode} → ${line.toCode ?? "—"}` : (line.toCode ?? "—")}
                </Td>
                <Td>
                  {line.certificateUrl ? (
                    <a href={line.certificateUrl} target="_blank" rel="noreferrer" style={{ color: C.accent, fontSize: 12 }}>
                      📄 {line.certificateName ?? "Pobierz"}
                    </a>
                  ) : (
                    <span style={{ color: C.muted, fontSize: 12 }}>brak</span>
                  )}
                </Td>
                <Td>
                  {line.damage ? (
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: line.damage.disposition === "REJECT" ? C.red : C.amber, fontWeight: 700 }}>
                        {line.damage.disposition === "REJECT" ? "ODRZUCONE" : "WADA"}:
                      </span>{" "}
                      {line.damage.description}
                      {line.damage.positionMm ? ` (na ${line.damage.positionMm} mm)` : ""}
                    </div>
                  ) : (
                    <span style={{ color: C.green, fontSize: 12 }}>✓ OK</span>
                  )}
                </Td>
                {isDraft && (
                  <Td>
                    <Btn small danger onClick={() => handleRemoveLine(line)}>
                      Usuń
                    </Btn>
                  </Td>
                )}
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ─── NATYWNY MODAL ZATWIERDZENIA DOKUMENTU ────────────────────── */}
      {showApproveModal && (
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
          onClick={() => !busy && setShowApproveModal(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.borderFocus}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 520,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  Zatwierdzenie dokumentu {doc.number}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {type === "PZ" ? "Przyjęcie zewnętrzne na stan magazynowy" : "Rozchód wewnętrzny (wydanie do bufora)"}
                </div>
              </div>
              <Btn small onClick={() => !busy && setShowApproveModal(false)}>✕</Btn>
            </div>

            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Liczba pozycji</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{lines.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Łączna ilość sztuk</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                    {fmtNum(lines.reduce((s, l) => s + l.quantityPieces, 0))} szt.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Czy na pewno chcesz zatwierdzić dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{doc.number}</strong>? Operacja zaktualizuje stany magazynowe i jest nieodwracalna.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn onClick={() => setShowApproveModal(false)} disabled={busy}>
                Wróć
              </Btn>
              <Btn primary onClick={handleApproveConfirm} disabled={busy}>
                {busy ? "Zatwierdzanie…" : "✓ Tak, zatwierdź dokument"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATYWNY MODAL ANULOWANIA DOKUMENTU ────────────────────────── */}
      {showCancelModal && (
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
          onClick={() => !busy && setShowCancelModal(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 480,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>
                Anulowanie dokumentu {doc.number}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                Czy na pewno chcesz anulować dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{doc.number}</strong>? Dokument przejdzie w status <strong style={{ color: C.red }}>ANULOWANY</strong> i dalsza edycja nie będzie możliwa.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn onClick={() => setShowCancelModal(false)} disabled={busy}>
                Wróć
              </Btn>
              <Btn danger onClick={handleCancelConfirm} disabled={busy}>
                {busy ? "Anulowanie…" : "Tak, anuluj dokument"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATYWNY MODAL USUNIĘCIA DOKUMENTU ─────────────────────────── */}
      {showDeleteModal && (
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
          onClick={() => !busy && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 520,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>
                Usuwanie dokumentu {doc.number}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {doc.status === "ZATWIERDZONY" ? (
                  doc.type === "RW" ? (
                    <>
                      Dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{doc.number}</strong> jest zatwierdzony.
                      <br /><br />
                      Usunięcie tego dokumentu spowoduje <strong style={{ color: C.red }}>całkowite wycofanie wydania towaru</strong> — wydane pozycje powrócą na stan partii źródłowej w magazynie, a pozycje w buforze produkcyjnym oraz historia ruchów powiązana z tym RW zostaną usunięte.
                      <br /><br />
                      <span style={{ fontSize: 12, color: C.amber }}>
                        ⚠️ Jeśli wydany towar w buforze produkcyjnym został już przesunięty lub przetworzony w kolejnych ruchach magazynowych, operacja zostanie bezpiecznie zablokowana.
                      </span>
                    </>
                  ) : (
                    <>
                      Dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{doc.number}</strong> jest zatwierdzony.
                      <br /><br />
                      Usunięcie tego dokumentu spowoduje <strong style={{ color: C.red }}>całkowite wycofanie przyjętych partii z magazynu</strong> oraz usunięcie historii ruchów powiązanych z tym PZ.
                      <br /><br />
                      <span style={{ fontSize: 12, color: C.amber }}>
                        ⚠️ Jeśli jakakolwiek partia z tego przyjęcia została już częściowo lub całkowicie wydana (RW), przesunięta (MM) lub ujęta w spisie, operacja zostanie bezpiecznie zablokowana.
                      </span>
                    </>
                  )
                ) : (
                  <>
                    Czy na pewno chcesz trwale usunąć dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{doc.number}</strong> (status: {doc.status}) wraz ze wszystkimi jego pozycjami ({lines.length})?
                    <br /><br />
                    Ta operacja jest nieodwracalna.
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn onClick={() => setShowDeleteModal(false)} disabled={busy}>
                Wróć
              </Btn>
              <Btn danger onClick={handleDeleteConfirm} disabled={busy}>
                {busy ? "Usuwanie…" : `Tak, trwale usuń ${type}`}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATYWNY MODAL EDYCJI NAGŁÓWKA DOKUMENTU ─────────────────── */}
      {showEditHeaderModal && (
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
          onClick={() => !busy && setShowEditHeaderModal(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 550,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                Edycja danych dokumentu {doc.number}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                Możesz zmienić dane nagłówkowe dokumentu roboczego.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {type === "PZ" ? (
                <>
                  <Field label="Dostawca *">
                    <SupplierCombobox
                      value={editSupplier}
                      onChange={setEditSupplier}
                      suppliers={suppliers}
                      placeholder="Wpisz nazwę lub NIP dostawcy…"
                    />
                  </Field>
                  <Field label="Nr dokumentu dostawcy (WZ / faktura / list przewozowy)">
                    <input
                      style={inputStyle}
                      value={editExtNumber}
                      onChange={(e) => setEditExtNumber(e.target.value)}
                      placeholder="np. WZ/2026/0411"
                    />
                  </Field>
                  <Field label="Oczekiwane paczki (kontrola wstępna)">
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      value={editExpectedBundles}
                      onChange={(e) => setEditExpectedBundles(e.target.value)}
                      placeholder="np. 5"
                    />
                  </Field>
                </>
              ) : (
                <Field label="Cel wydania / Maszyna / Odbiorca">
                  <input
                    style={inputStyle}
                    value={editTargetNote}
                    onChange={(e) => setEditTargetNote(e.target.value)}
                    placeholder="np. Piła dwugłowicowa nr 1"
                  />
                </Field>
              )}
              <Field label="Uwagi">
                <input
                  style={inputStyle}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Dodatkowe uwagi…"
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn onClick={() => setShowEditHeaderModal(false)} disabled={busy}>
                Anuluj
              </Btn>
              <Btn primary onClick={handleSaveHeader} disabled={busy}>
                {busy ? "Zapisywanie…" : "Zapisz zmiany"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATYWNY MODAL USUNIĘCIA POZYCJI ───────────────────────────── */}
      {lineToDelete && (
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
          onClick={() => !busy && setLineToDelete(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 440,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                Usunięcie pozycji z dokumentu
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                Czy na pewno chcesz usunąć tę pozycję (<strong style={{ color: C.text }}>{lineToDelete.name}</strong>) ze szkicu dokumentu?
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn onClick={() => setLineToDelete(null)} disabled={busy}>
                Anuluj
              </Btn>
              <Btn danger onClick={handleRemoveLineConfirm} disabled={busy}>
                {busy ? "Usuwanie…" : "Usuń pozycję"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

export function DocumentListPage({
  type,
  title,
  subtitle,
  createLabel,
}: {
  type: DocType;
  title: string;
  subtitle: string;
  createLabel: string;
}) {
  const router = useRouter();
  const docs = useQuery(api.wms.listDocuments, { type });
  const suppliers = useQuery(api.suppliers.list, {}) ?? [];
  const createDraft = useMutation(api.wms.createDraft);
  const deleteDocument = useMutation(api.wms.deleteDocument);

  const [showNew, setShowNew] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: Id<"wms_documents">; number: string; status: string } | null>(null);
  const [supplier, setSupplier] = useState("");
  const [extNumber, setExtNumber] = useState("");
  const [targetNote, setTargetNote] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDeleteDocConfirm() {
    if (!docToDelete) return;
    setBusy(true);
    try {
      await deleteDocument({ id: docToDelete.id });
      toast.success(`Dokument ${docToDelete.number} został usunięty`);
      setDocToDelete(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const finalSupplier = supplier.trim();
    if (type === "PZ" && !finalSupplier) {
      toast.error("Wybierz lub wpisz dostawcę.");
      return;
    }

    setBusy(true);
    try {
      const res = await createDraft({
        type,
        supplier: finalSupplier || undefined,
        externalDocNumber: extNumber.trim() || undefined,
        targetNote: targetNote.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Utworzono dokument ${res.number}`);
      setShowNew(false);
      setSupplier("");
      setExtNumber("");
      setTargetNote("");
      setNotes("");
      router.push(`/admin/wms/${type.toLowerCase()}/${res.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title={title}
      subtitle={subtitle}
      actions={
        <Btn primary onClick={() => setShowNew(true)}>
          + {createLabel}
        </Btn>
      }
    >
      {showNew && (
        <Card title={`Nowy dokument ${type}`}>
          <Grid cols={3}>
            {type === "PZ" ? (
              <>
                <Field label="Dostawca *">
                  <SupplierCombobox
                    value={supplier}
                    onChange={setSupplier}
                    suppliers={suppliers}
                    placeholder="Wpisz nazwę lub NIP dostawcy…"
                  />
                </Field>
                <Field label="Nr dokumentu dostawcy (WZ / faktura / list przewozowy)">
                  <input style={inputStyle} value={extNumber} onChange={(e) => setExtNumber(e.target.value)} placeholder="np. WZ/2026/0411" />
                </Field>
              </>
            ) : type === "RW" ? (
              <Field label="Cel wydania / Maszyna / Odbiorca" span={2}>
                <input style={inputStyle} value={targetNote} onChange={(e) => setTargetNote(e.target.value)} placeholder="np. Piła dwugłowicowa nr 1" />
              </Field>
            ) : null}
            <Field label="Uwagi ogólne" span={2}>
              <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dodatkowe informacje…" />
            </Field>
          </Grid>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn primary onClick={handleCreate} disabled={busy}>
              {busy ? "Tworzenie…" : "Utwórz szkic dokumentu"}
            </Btn>
            <Btn onClick={() => setShowNew(false)}>Anuluj</Btn>
          </div>
        </Card>
      )}

      <Card pad={false}>
        {!docs ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Ładowanie dokumentów…</div>
        ) : docs.length === 0 ? (
          <Empty title={`Brak dokumentów ${type}`} text={`Użyj przycisku „+ ${createLabel}”, aby rozpocząć.`} />
        ) : (
          <Table headers={["Numer", "Data utworzenia", "Dostawca / Cel", "Pozycji", "Łącznie sztuk", "Status", "Autor", ""]}>
            {docs.map((d) => (
              <Tr key={d._id} onClick={() => router.push(`/admin/wms/${type.toLowerCase()}/${d._id}`)}>
                <Td mono style={{ fontWeight: 700 }}>{d.number}</Td>
                <Td muted nowrap>{fmtDate(d.createdAt)}</Td>
                <Td>{d.supplier ?? d.targetNote ?? d.externalDocNumber ?? "—"}</Td>
                <Td>{fmtNum(d.lineCount)}</Td>
                <Td nowrap>{fmtNum(d.totalPieces)} szt.</Td>
                <Td><Badge status={d.status} /></Td>
                <Td muted>{d.createdByName}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    <Link href={`/admin/wms/${type.toLowerCase()}/${d._id}`} className="fluent-btn" style={{ fontSize: 12, padding: "3px 10px" }}>
                      Szczegóły →
                    </Link>
                    {(type === "PZ" || d.status !== "ZATWIERDZONY") && (
                      <button
                        className="fluent-btn"
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          color: C.red,
                          borderColor: "rgba(248,81,73,0.3)",
                        }}
                        onClick={() => setDocToDelete({ id: d._id, number: d.number, status: d.status })}
                        title={`Usuń dokument ${d.number}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ─── NATYWNY MODAL USUNIĘCIA DOKUMENTU Z LISTY ─────────────────── */}
      {docToDelete && (
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
          onClick={() => !busy && setDocToDelete(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 500,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>
                Usuwanie dokumentu {docToDelete.number}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {docToDelete.status === "ZATWIERDZONY" ? (
                  type === "RW" ? (
                    <>
                      Dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{docToDelete.number}</strong> jest zatwierdzony.
                      <br /><br />
                      Usunięcie tego dokumentu wycofa wydanie materiałów — ilości powrócą na stan partii źródłowej w magazynie, a partia w buforze zostanie usunięta wraz z wpisami ruchów.
                      <br /><br />
                      <span style={{ fontSize: 12, color: C.amber }}>
                        ⚠️ Jeśli wydany towar w buforze został już przesunięty lub przetworzony, operacja zostanie bezpiecznie zablokowana.
                      </span>
                    </>
                  ) : (
                    <>
                      Dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{docToDelete.number}</strong> jest zatwierdzony.
                      <br /><br />
                      Usunięcie tego dokumentu wycofa przyjęte partie ze stanu magazynowego i usunie powiązane wpisy ruchów magazynowych.
                      <br /><br />
                      <span style={{ fontSize: 12, color: C.amber }}>
                        ⚠️ Jeśli partie zostały już częściowo wydane (RW) lub przesunięte (MM), usunięcie zostanie zablokowane.
                      </span>
                    </>
                  )
                ) : (
                  <>
                    Czy na pewno chcesz trwale usunąć dokument <strong style={{ color: C.text, fontFamily: "monospace" }}>{docToDelete.number}</strong> (status: {docToDelete.status})?
                    <br /><br />
                    Ta operacja jest nieodwracalna.
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <Btn onClick={() => setDocToDelete(null)} disabled={busy}>
                Anuluj
              </Btn>
              <Btn danger onClick={handleDeleteDocConfirm} disabled={busy}>
                {busy ? "Usuwanie…" : `Tak, usuń dokument`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

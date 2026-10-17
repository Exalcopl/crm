"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function DocumentDetailView({
  id,
  type,
  backHref,
}: {
  id: Id<"wms_documents">;
  type: DocType;
  backHref: string;
}) {
  const data = useQuery(api.wms.getDocument, { id });
  const materials = useQuery(api.wms.listProfiles, { allCategories: true });
  const locations = useQuery(api.wms.listLocations, { onlyActive: true });
  const lots = useQuery(api.wms.listLots, { includeDepleted: false });

  const approve = useMutation(api.wms.approve);
  const cancel = useMutation(api.wms.cancel);
  const addLine = useMutation(api.wms.addLine);
  const removeLine = useMutation(api.wms.removeLine);
  const generateUploadUrl = useMutation(api.wms.generateUploadUrl);

  const [busy, setBusy] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);

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
  const [lineKind, setLineKind] = useState<"BAR_BUNDLE" | "BAR" | "REMNANT">("BAR_BUNDLE");
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

  if (!data) {
    return (
      <Page title={`${type} — Dokument`} subtitle="Ładowanie dokumentu…">
        <div style={{ color: C.muted, fontSize: 13 }}>Wczytywanie szczegółów…</div>
      </Page>
    );
  }

  const { doc, lines, createdByName, approvedByName } = data;
  const isDraft = doc.status === "DRAFT";

  async function handleApprove() {
    if (!confirm(`Czy na pewno chcesz zatwierdzić dokument ${doc.number}? Operacja zaktualizuje stany magazynowe.`)) return;
    setBusy(true);
    try {
      const res = await approve({ id: doc._id });
      toast.success(`Dokument ${doc.number} został zatwierdzony`);
      if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) toast.warning(w);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!confirm(`Czy na pewno chcesz anulować dokument ${doc.number}?`)) return;
    setBusy(true);
    try {
      await cancel({ id: doc._id });
      toast.success("Dokument został anulowany");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLine() {
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
        quantityPieces: parseInt(lineQty, 10) || 1,
        lengthMm: lineLength ? parseInt(lineLength, 10) : undefined,
        widthMm: lineWidth ? parseInt(lineWidth, 10) : undefined,
        heightMm: lineHeight ? parseInt(lineHeight, 10) : undefined,
        thicknessMm: lineThickness ? parseFloat(lineThickness) : undefined,
        weightKg: lineWeight ? parseFloat(lineWeight) : undefined,
        customAttributes: Object.keys(lineCustomAttrs).length > 0 ? lineCustomAttrs : undefined,
        kind: type === "PZ" ? lineKind : undefined,
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

  async function handleRemoveLine(lineId: Id<"wms_document_lines">) {
    if (!confirm("Usunąć tę pozycję z dokumentu?")) return;
    try {
      await removeLine({ id: lineId });
      toast.success("Pozycja usunięta");
    } catch (e) {
      toast.error(errMsg(e));
    }
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
          {isDraft && (
            <>
              <Btn danger onClick={handleCancel} disabled={busy}>
                Anuluj dokument
              </Btn>
              <Btn primary onClick={handleApprove} disabled={busy || lines.length === 0}>
                {busy ? "Zatwierdzanie…" : "✓ Zatwierdź dokument"}
              </Btn>
            </>
          )}
        </>
      }
    >
      {/* Nagłówek dokumentu */}
      <Card title="Informacje o dokumencie">
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
                          <option value="">Wybierz materiał z bazy…</option>
                          {(materials ?? []).map((m) => (
                            <option key={m.material._id} value={m.material._id}>
                              {m.material.sku ? `[${m.material.sku}] ` : ""}{m.material.name} {m.category ? `(${m.category.name}${m.object ? ` → ${m.object.name}` : ""})` : ""}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {cat && (
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Kategoria / Obiekt</div>
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

                      {/* Rodzaj jednostki (dla profili) */}
                      {(!cat || cat.code === "PROFILE") && (
                        <Field label="Typ jednostki">
                          <select style={inputStyle} value={lineKind} onChange={(e) => setLineKind(e.target.value as "BAR_BUNDLE" | "BAR" | "REMNANT")}>
                            <option value="BAR_BUNDLE">Wiązka / kosz</option>
                            <option value="BAR">Pojedyncza sztanga / sztuka</option>
                            <option value="REMNANT">Spad / końcówka</option>
                          </select>
                        </Field>
                      )}

                      <Field label={`Liczba (${defaultUnit}) *`}>
                        <input style={inputStyle} type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                      </Field>

                      {/* Długość */}
                      {(!fc || fc.lengthMm?.enabled) && (
                        <Field label={`${fc?.lengthMm?.label || "Długość (mm)"} ${fc?.lengthMm?.required ? "*" : ""}`}>
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
                        <select style={inputStyle} value={lineToLoc} onChange={(e) => setLineToLoc(e.target.value)}>
                          <option value="">Wybierz regał / lokalizację…</option>
                          {(locations ?? []).map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
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
              type === "PZ" ? "Produkt / Obiekt" : "Partia źródłowa",
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
                  {line.ssccCode && <div style={{ fontSize: 10, fontFamily: "monospace" }}>SSCC: {line.ssccCode}</div>}
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
                    <Btn small danger onClick={() => handleRemoveLine(line._id)}>Usuń</Btn>
                  </Td>
                )}
              </Tr>
            ))}
          </Table>
        )}
      </Card>
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
  const createDraft = useMutation(api.wms.createDraft);

  const [showNew, setShowNew] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [extNumber, setExtNumber] = useState("");
  const [targetNote, setTargetNote] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await createDraft({
        type,
        supplier: supplier.trim() || undefined,
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
                  <input style={inputStyle} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="np. Aluprof, Pilkington, Aliplast, Wurth…" />
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
                  <Link href={`/admin/wms/${type.toLowerCase()}/${d._id}`} className="fluent-btn" style={{ fontSize: 12, padding: "3px 10px" }}>
                    Szczegóły →
                  </Link>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}

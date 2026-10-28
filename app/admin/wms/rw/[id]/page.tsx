"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  C,
  Page,
  Card,
  Table,
  Tr,
  Td,
  Badge,
  Btn,
  Empty,
  fmtDate,
  fmtNum,
  fmtMb,
  fmtKg,
  inputStyle,
  errMsg,
} from "../../_components/ui";
import { RwOrderPicker } from "../_components/rw-order-picker";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Trash2,
  Edit3,
  Plus,
  Building,
  Package,
  Layers,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";

export default function RwDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const data = useQuery(api.wms.getDocument, { id: id as Id<"wms_documents"> });
  const lots = useQuery(api.wms.listLots, { includeDepleted: false }) ?? [];

  const approve = useMutation(api.wms.approve);
  const deleteDocument = useMutation(api.wms.deleteDocument);
  const updateHeader = useMutation(api.wms.updateHeader);
  const addLine = useMutation(api.wms.addLine);
  const removeLine = useMutation(api.wms.removeLine);

  const [busy, setBusy] = useState(false);

  // Formularz dodawania pozycji (ze stanu magazynowego)
  const [showAddLine, setShowAddLine] = useState(false);
  const [lotSearch, setLotSearch] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<Id<"wms_lots"> | null>(null);
  const [lineQty, setLineQty] = useState("1");
  const [lineNote, setLineNote] = useState("");

  // Modale potwierdzeń i edycji
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditHeaderModal, setShowEditHeaderModal] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<{ id: Id<"wms_document_lines">; name: string } | null>(null);

  // Pola edycji nagłówka
  const [editOrderId, setEditOrderId] = useState<Id<"orders"> | undefined>(undefined);
  const [editOrderNumber, setEditOrderNumber] = useState<string | undefined>(undefined);
  const [editTargetNote, setEditTargetNote] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const doc = data?.doc;
  const lines = data?.lines ?? [];
  const isDraft = doc?.status === "DRAFT";
  const isApproved = doc?.status === "ZATWIERDZONY";

  // Wybrana partia w formularzu dodawania
  const chosenLot = useMemo(() => {
    if (!selectedLotId) return null;
    return lots.find((l) => l._id === selectedLotId) ?? null;
  }, [lots, selectedLotId]);

  // Filtrowanie partii do pobrania
  const availableLots = useMemo(() => {
    const q = lotSearch.trim().toLowerCase();
    const active = lots.filter((l) => l.status === "AVAILABLE" && l.quantityPieces > 0);
    if (!q) return active.slice(0, 30);
    return active
      .filter((l) => {
        const name = (l.materialName ?? "").toLowerCase();
        const sku = (l.materialSku ?? "").toLowerCase();
        const color = (l.colorCode ?? "").toLowerCase();
        const cat = (l.categoryName ?? "").toLowerCase();
        const heat = (l.heatNumber ?? "").toLowerCase();
        return name.includes(q) || sku.includes(q) || color.includes(q) || cat.includes(q) || heat.includes(q);
      })
      .slice(0, 30);
  }, [lots, lotSearch]);

  if (data === undefined) {
    return (
      <Page title="Wczytywanie dokumentu RW…" subtitle="Proszę czekać…">
        <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
          Wczytywanie szczegółów dokumentu wydania RW…
        </div>
      </Page>
    );
  }

  if (doc === null || !doc) {
    return (
      <Page title="Nie znaleziono dokumentu" subtitle="Dokument RW o podanym identyfikatorze nie istnieje.">
        <Card>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 16 }}>Dokument nie istnieje lub został usunięty.</div>
            <Link href="/admin/wms/rw" style={{ textDecoration: "none" }}>
              <Btn primary>← Powrót do listy RW</Btn>
            </Link>
          </div>
        </Card>
      </Page>
    );
  }

  const activeDoc = doc;

  const totalPieces = lines.reduce((acc, l) => acc + l.quantityPieces, 0);

  // Otwarcie edycji nagłówka
  function openEditHeader() {
    setEditOrderId(activeDoc.orderId);
    setEditOrderNumber(activeDoc.orderNumber);
    setEditTargetNote(activeDoc.targetNote ?? "");
    setEditNotes(activeDoc.notes ?? "");
    setShowEditHeaderModal(true);
  }

  // Zapis nagłówka
  async function handleSaveHeader() {
    if (!editOrderId) {
      toast.error("Wybierz zlecenie produkcyjne dla dokumentu RW.");
      return;
    }
    setBusy(true);
    try {
      await updateHeader({
        id: activeDoc._id,
        orderId: editOrderId,
        orderNumber: editOrderNumber,
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

  // Zatwierdzenie RW
  async function handleApproveConfirm() {
    if (lines.length === 0) {
      toast.error("Dokument nie zawiera żadnych pozycji do wydania.");
      setShowApproveConfirm(false);
      return;
    }
    setBusy(true);
    try {
      await approve({ id: activeDoc._id });
      toast.success(`Dokument ${activeDoc.number} został zatwierdzony. Stan magazynowy zaktualizowany.`);
      setShowApproveConfirm(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Usunięcie RW (szkic lub zatwierdzony z rollbackiem)
  async function handleDeleteConfirm() {
    setBusy(true);
    try {
      await deleteDocument({ id: activeDoc._id });
      toast.success(`Dokument ${activeDoc.number} został usunięty.`);
      setShowDeleteConfirm(false);
      router.push("/admin/wms/rw");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Dodanie pozycji ze stanu
  async function handleAddLineSubmit() {
    if (!chosenLot) {
      toast.error("Wybierz partię z magazynu.");
      return;
    }

    const qty = parseInt(lineQty, 10);
    if (!qty || qty <= 0) {
      toast.error("Podaj poprawną liczbę sztuk (większą od 0).");
      return;
    }

    if (qty > chosenLot.quantityPieces) {
      toast.error(`Maksymalna dostępna ilość na tej partii to ${chosenLot.quantityPieces} szt.`);
      return;
    }

    setBusy(true);
    try {
      await addLine({
        documentId: activeDoc._id,
        lotId: chosenLot._id,
        materialId: chosenLot.materialId,
        objectId: chosenLot.objectId,
        quantityPieces: qty,
        lengthMm: chosenLot.lengthMm,
        widthMm: chosenLot.widthMm,
        heightMm: chosenLot.heightMm,
        thicknessMm: chosenLot.thicknessMm,
        weightKg: chosenLot.weightKg,
        colorCode: chosenLot.colorCode,
        surfaceType: chosenLot.surfaceType,
        heatNumber: chosenLot.heatNumber,
        note: lineNote.trim() || undefined,
      });

      toast.success(`Dodano ${chosenLot.materialName} (${qty} szt.) do dokumentu`);
      setShowAddLine(false);
      setSelectedLotId(null);
      setLineQty("1");
      setLineNote("");
      setLotSearch("");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Usunięcie pojedynczej pozycji
  async function handleRemoveLineConfirm() {
    if (!lineToDelete) return;
    setBusy(true);
    try {
      await removeLine({ id: lineToDelete.id });
      toast.success("Pozycja została usunięta");
      setLineToDelete(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/admin/wms/rw"
            style={{
              color: C.muted,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${C.border}`,
              transition: "color 0.15s",
            }}
            title="Powrót do listy wydań RW"
          >
            <ArrowLeft size={16} />
          </Link>
          <span style={{ fontFamily: "monospace", letterSpacing: "-0.02em" }}>{doc.number}</span>
          <Badge status={doc.status} />
        </div>
      }
      subtitle={
        <span>
          Wydanie wewnętrzne RW · Utworzył: <b>{data.createdByName}</b> ({fmtDate(doc.createdAt)})
          {doc.approvedAt && data.approvedByName && (
            <span> · Zatwierdził: <b>{data.approvedByName}</b> ({fmtDate(doc.approvedAt)})</span>
          )}
        </span>
      }
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isDraft && (
            <>
              <Btn
                primary
                onClick={() => setShowApproveConfirm(true)}
                disabled={busy || lines.length === 0}
                style={{
                  background: lines.length > 0 ? "#238636" : undefined,
                  borderColor: lines.length > 0 ? "#2ea043" : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle size={15} />
                <span>Zatwierdź RW (Zdejmij ze stanu)</span>
              </Btn>

              <Btn onClick={openEditHeader} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Edit3 size={14} />
                <span>Edytuj nagłówek</span>
              </Btn>

              <Btn danger onClick={() => setShowDeleteConfirm(true)} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={14} />
                <span>Usuń szkic</span>
              </Btn>
            </>
          )}

          {isApproved && (
            <Btn
              danger
              onClick={() => setShowDeleteConfirm(true)}
              disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Trash2 size={14} />
              <span>Usuń RW (Wycofaj pobranie i przywróć stan)</span>
            </Btn>
          )}
        </div>
      }
    >
      {/* ─── KARTA POWIĄZANEGO ZLECENIA Z CRM ────────────────────────────── */}
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            #
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Powiązane zlecenie produkcyjne CRM
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              {doc.orderId ? (
                <Link
                  href={`/admin/zlecenia/${doc.orderId}`}
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#60a5fa",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{doc.orderNumber || "Zlecenie CRM"}</span>
                  <ExternalLink size={14} />
                </Link>
              ) : (
                <span style={{ color: "#f85149", fontWeight: 600 }}>Brak przypisanego zlecenia</span>
              )}

              {doc.clientName && (
                <>
                  <span style={{ color: C.muted }}>·</span>
                  <span style={{ fontSize: 14, color: C.text, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                    <Building size={14} color={C.muted} />
                    <span>{doc.clientName}</span>
                  </span>
                </>
              )}

              {doc.orderStatus && (
                <span
                  style={{
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#60a5fa",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  Status w CRM: {doc.orderStatus}
                </span>
              )}
            </div>

            {/* Informacje dodatkowe: Cel wydania i uwagi */}
            {(doc.targetNote || doc.notes) && (
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
                {doc.targetNote && (
                  <div>
                    <span style={{ color: C.muted }}>Cel / Stanowisko:</span>{" "}
                    <b style={{ color: C.text }}>{doc.targetNote}</b>
                  </div>
                )}
                {doc.notes && (
                  <div>
                    <span style={{ color: C.muted }}>Uwagi:</span>{" "}
                    <span style={{ color: C.text }}>{doc.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Link bezpośredni do CRM */}
        {doc.orderId && (
          <Link
            href={`/admin/zlecenia/${doc.orderId}`}
            style={{
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Karta zlecenia w CRM</span>
            <ExternalLink size={13} />
          </Link>
        )}
      </div>

      {/* ─── TABELA POZYCJI DOKUMENTU RW ─────────────────────────────────── */}
      <Card
        title={`Pozycje do wydania na zlecenie (${lines.length}) · ${fmtNum(totalPieces)} szt. łącznie`}
        right={
          isDraft ? (
            <Btn
              small
              primary
              onClick={() => setShowAddLine(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Plus size={14} />
              <span>Pobierz pozycję ze stanu</span>
            </Btn>
          ) : undefined
        }
        pad={false}
      >
        {lines.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Package size={36} color={C.muted} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Brak pozycji w dokumencie RW
            </div>
            <div style={{ fontSize: 13, color: C.muted, maxWidth: 460, margin: "0 auto 16px" }}>
              Kliknij poniższy przycisk, aby wybrać dostępne pozycje z magazynu i pobrać je do realizacji tego zlecenia.
            </div>
            {isDraft && (
              <Btn primary onClick={() => setShowAddLine(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={15} />
                <span>Pobierz materiał ze stanu magazynowego</span>
              </Btn>
            )}
          </div>
        ) : (
          <Table headers={["Lp.", "Indeks towarowy", "Grupa / Obiekt", "Parametry partii", "Ilość pobrana", "Uwagi", ""]}>
            {lines.map((line, idx) => {
              const hasDims = line.dimensionsSummary && line.dimensionsSummary !== "—";
              const hasColor = Boolean(line.colorCode || line.surfaceType);

              return (
                <Tr key={line._id}>
                  {/* Lp. */}
                  <Td mono style={{ color: C.muted, width: 40 }}>{idx + 1}</Td>

                  {/* Indeks */}
                  <Td>
                    <div style={{ fontWeight: 600, color: C.text }}>{line.materialName}</div>
                    {line.materialSku && (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
                        SKU: {line.materialSku}
                      </div>
                    )}
                  </Td>

                  {/* Grupa / Obiekt */}
                  <Td>
                    <div style={{ fontSize: 12, color: C.text }}>{line.categoryName}</div>
                    <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", padding: "1px 6px", borderRadius: 3, fontWeight: 600, display: "inline-block", marginTop: 2 }}>
                      {line.objectName}
                    </span>
                  </Td>

                  {/* Parametry */}
                  <Td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                      {hasDims && <span style={{ fontFamily: "monospace", color: C.text }}>📏 {line.dimensionsSummary}</span>}
                      {hasColor && <span style={{ color: C.muted }}>🎨 {line.colorCode} {line.surfaceType ? `(${line.surfaceType})` : ""}</span>}
                      {line.heatNumber && <span style={{ color: C.muted }}>Partia: {line.heatNumber}</span>}
                      {!hasDims && !hasColor && !line.heatNumber && <span style={{ color: C.muted, fontStyle: "italic" }}>Standard</span>}
                    </div>
                  </Td>

                  {/* Ilość */}
                  <Td nowrap>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa" }}>
                      {fmtNum(line.quantityPieces)} {line.unit}
                    </div>
                  </Td>

                  {/* Uwagi */}
                  <Td style={{ fontSize: 12, color: line.note ? C.text : C.muted }}>
                    {line.note || "—"}
                  </Td>

                  {/* Akcje */}
                  <Td nowrap style={{ width: 40 }}>
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => setLineToDelete({ id: line._id, name: line.materialName })}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.red,
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: 4,
                        }}
                        title="Usuń pozycję z RW"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ─── MODAL POBIERANIA MATERIAŁU ZE STANU (DODAWANIE LINII) ───────── */}
      {showAddLine && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !busy && setShowAddLine(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  Pobranie pozycji z magazynu do zlecenia {doc.orderNumber}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  Wybierz dostępną partię magazynową oraz podaj ilość do wydania.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLine(false)}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Wybór partii */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                  1. Wybierz dostępny indeks / partię z magazynu <span style={{ color: "#f85149" }}>*</span>
                </label>

                <div style={{ position: "relative", marginBottom: 8 }}>
                  <Search size={15} color={C.muted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: 32 }}
                    placeholder="Filtruj stany: wpisz nazwę indeksu, SKU, kolor, partię…"
                    value={lotSearch}
                    onChange={(e) => setLotSearch(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    background: "#12161c",
                  }}
                >
                  {availableLots.length === 0 ? (
                    <div style={{ padding: "16px 20px", color: C.muted, fontSize: 13, textAlign: "center" }}>
                      Brak dostępnych partii w magazynie spełniających kryteria.
                    </div>
                  ) : (
                    availableLots.map((l) => {
                      const isSel = selectedLotId === l._id;
                      return (
                        <div
                          key={l._id}
                          onClick={() => {
                            setSelectedLotId(l._id);
                            if (parseInt(lineQty, 10) > l.quantityPieces) {
                              setLineQty(String(l.quantityPieces));
                            }
                          }}
                          style={{
                            padding: "9px 12px",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            background: isSel ? "rgba(59, 130, 246, 0.15)" : "transparent",
                            transition: "background 0.12s",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 600, color: isSel ? "#60a5fa" : C.text, fontSize: 13 }}>
                                {l.materialName}
                              </span>
                              {l.materialSku && (
                                <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>
                                  ({l.materialSku})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {l.dimensionsSummary !== "—" && `📏 ${l.dimensionsSummary} · `}
                              {l.colorCode && `🎨 ${l.colorCode} · `}
                              {l.categoryName}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: isSel ? "#60a5fa" : "#34d399" }}>
                              {fmtNum(l.quantityPieces)} {l.unit}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted }}>dostępne</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Informacja o wybranej partii */}
              {chosenLot && (
                <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 6, padding: "10px 14px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: "#60a5fa" }}>Wybrano: {chosenLot.materialName}</div>
                  <div style={{ color: C.text, marginTop: 2 }}>
                    Dostępny stan magazynowy: <b>{chosenLot.quantityPieces} {chosenLot.unit}</b>
                    {chosenLot.totalMb > 0 && ` (${fmtMb(chosenLot.totalMb)})`}
                  </div>
                </div>
              )}

              {/* Ilość do pobrania */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                  2. Ilość sztuk do pobrania <span style={{ color: "#f85149" }}>*</span>
                </label>
                <input
                  style={{ ...inputStyle, width: 140, fontSize: 16, fontWeight: 700 }}
                  type="number"
                  min="1"
                  max={chosenLot ? chosenLot.quantityPieces : 99999}
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                />
                {chosenLot && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    Maksymalnie możesz pobrać {chosenLot.quantityPieces} {chosenLot.unit} z tej partii.
                  </div>
                )}
              </div>

              {/* Uwagi do pozycji */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                  3. Uwagi do pobrania (opcjonalnie)
                </label>
                <input
                  style={inputStyle}
                  placeholder="np. Formatka na drzwi lewe, docinka do ramy…"
                  value={lineNote}
                  onChange={(e) => setLineNote(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, justifyContent: "flex-end", background: "#161b22" }}>
              <Btn onClick={() => setShowAddLine(false)} disabled={busy}>Anuluj</Btn>
              <Btn primary onClick={handleAddLineSubmit} disabled={busy || !selectedLotId}>
                {busy ? "Dodawanie…" : "+ Dodaj pozycję do RW"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ZATWIERDZENIA RW ───────────────────────────────────────── */}
      {showApproveConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !busy && setShowApproveConfirm(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={20} color="#34d399" />
              <span>Zatwierdzenie dokumentu {doc.number}</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Czy na pewno chcesz zatwierdzić wydanie RW?
              <br /><br />
              Operacja spowoduje <b>trwałe zdjęcie {fmtNum(totalPieces)} szt. ze stanu magazynowego</b> oraz zarejestruje pobranie materiałów w karcie zlecenia <b>{doc.orderNumber}</b> w CRM.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={() => setShowApproveConfirm(false)} disabled={busy}>Wróć</Btn>
              <Btn primary onClick={handleApproveConfirm} disabled={busy} style={{ background: "#238636", borderColor: "#2ea043" }}>
                {busy ? "Zatwierdzanie…" : "Tak, zatwierdź i zdejmij ze stanu"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL EDYCJI NAGŁÓWKA / ZLECENIA ─────────────────────────────── */}
      {showEditHeaderModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
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
              maxWidth: 540,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
              Edycja nagłówka dokumentu {doc.number}
            </div>

            {/* Zlecenie CRM */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Powiązane zlecenie produkcyjne CRM <span style={{ color: "#f85149" }}>*</span>
              </label>
              <RwOrderPicker
                orderId={editOrderId}
                orderNumber={editOrderNumber}
                onChange={(ord) => {
                  setEditOrderId(ord?._id);
                  setEditOrderNumber(ord?.orderNumber);
                }}
              />
            </div>

            {/* Cel wydania */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Cel wydania / Stanowisko (opcjonalnie)
              </label>
              <input
                style={inputStyle}
                placeholder="np. Piła dwugłowicowa nr 1, Montaż zadaszeń…"
                value={editTargetNote}
                onChange={(e) => setEditTargetNote(e.target.value)}
              />
            </div>

            {/* Uwagi */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Uwagi do RW (opcjonalnie)
              </label>
              <input
                style={inputStyle}
                placeholder="Dodatkowe uwagi…"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={() => setShowEditHeaderModal(false)} disabled={busy}>Anuluj</Btn>
              <Btn primary onClick={handleSaveHeader} disabled={busy || !editOrderId}>
                {busy ? "Zapisywanie…" : "Zapisz zmiany"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL USUWANIA DOKUMENTU (SZKIC LUB ROLLBACK ZATWIERDZONEGO) ─── */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !busy && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: C.red, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={20} />
              <span>Usuwanie dokumentu {doc.number}</span>
            </div>

            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              {isApproved ? (
                <>
                  Dokument <b>{doc.number}</b> jest zatwierdzony.
                  <br /><br />
                  Usunięcie tego dokumentu spowoduje <b>całkowity zwrot wydanych ilości ({fmtNum(totalPieces)} szt.) z powrotem na stan magazynowy</b> oraz usunięcie wpisu rozchodu z historii zlecenia <b>{doc.orderNumber}</b>.
                </>
              ) : (
                <>
                  Czy na pewno chcesz trwale usunąć ten szkic dokumentu RW? Wszystkie dodane do niego pozycje robocze zostaną usunięte.
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={() => setShowDeleteConfirm(false)} disabled={busy}>Wróć</Btn>
              <Btn danger onClick={handleDeleteConfirm} disabled={busy}>
                {busy ? "Usuwanie…" : isApproved ? "Tak, wycofaj i usuń RW" : "Tak, usuń szkic"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL USUWANIA POJEDYNCZEJ POZYCJI ───────────────────────────── */}
      {lineToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
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
              maxWidth: 420,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              Usuń pozycję z dokumentu
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              Czy na pewno chcesz usunąć pozycję <b>{lineToDelete.name}</b> z tego dokumentu RW?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn onClick={() => setLineToDelete(null)} disabled={busy}>Wróć</Btn>
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

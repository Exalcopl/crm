"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  inputStyle,
  errMsg,
} from "../_components/ui";
import { RwOrderPicker } from "./_components/rw-order-picker";
import {
  Plus,
  Search,
  ExternalLink,
  ClipboardList,
  CheckCircle,
  Clock,
  Trash2,
  X,
  Building,
  Layers,
} from "lucide-react";

function RwListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramOrderId = searchParams.get("orderId") as Id<"orders"> | null;

  const docs = useQuery(api.wms.listDocuments, { type: "RW" });
  const orders = useQuery(api.orders.list, {}) ?? [];
  const createDraft = useMutation(api.wms.createDraft);
  const deleteDocument = useMutation(api.wms.deleteDocument);

  // Filtrowanie i wyszukiwanie
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "ZATWIERDZONY">("ALL");
  const [filterOrderId, setFilterOrderId] = useState<Id<"orders"> | null>(paramOrderId);

  // Stan modala nowego RW
  const [showNewModal, setShowNewModal] = useState(Boolean(paramOrderId));
  const [newOrderId, setNewOrderId] = useState<Id<"orders"> | undefined>(paramOrderId ?? undefined);
  const [newOrderNumber, setNewOrderNumber] = useState<string | undefined>();
  const [newTargetNote, setNewTargetNote] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Stan usuwania szkicu
  const [docToDelete, setDocToDelete] = useState<{ id: Id<"wms_documents">; number: string } | null>(null);

  // Statystyki
  const stats = useMemo(() => {
    if (!docs) return { total: 0, drafts: 0, approved: 0, pieces: 0 };
    return {
      total: docs.length,
      drafts: docs.filter((d) => d.status === "DRAFT").length,
      approved: docs.filter((d) => d.status === "ZATWIERDZONY").length,
      pieces: docs
        .filter((d) => d.status === "ZATWIERDZONY")
        .reduce((sum, d) => sum + (d.totalPieces ?? 0), 0),
    };
  }, [docs]);

  // Lista przefiltrowana
  const filteredDocs = useMemo(() => {
    if (!docs) return [];
    return docs.filter((d) => {
      // Filtr statusu
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;

      // Filtr konkretnego zlecenia
      if (filterOrderId && d.orderId !== filterOrderId) return false;

      // Wyszukiwanie tekstowe
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const num = d.number.toLowerCase();
      const ordNum = (d.orderNumber ?? "").toLowerCase();
      const client = (d.clientName ?? "").toLowerCase();
      const author = (d.createdByName ?? "").toLowerCase();
      const target = (d.targetNote ?? "").toLowerCase();

      return (
        num.includes(q) ||
        ordNum.includes(q) ||
        client.includes(q) ||
        author.includes(q) ||
        target.includes(q)
      );
    });
  }, [docs, statusFilter, filterOrderId, search]);

  // Obsługa tworzenia nowego RW
  async function handleCreateRw() {
    if (!newOrderId) {
      toast.error("Wybierz powiązane zlecenie produkcyjne z CRM.");
      return;
    }

    setBusy(true);
    try {
      const res = await createDraft({
        type: "RW",
        orderId: newOrderId,
        orderNumber: newOrderNumber,
        targetNote: newTargetNote.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      toast.success(`Utworzono dokument ${res.number}`);
      setShowNewModal(false);
      setNewOrderId(undefined);
      setNewOrderNumber(undefined);
      setNewTargetNote("");
      setNewNotes("");

      router.push(`/admin/wms/rw/${res.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Obsługa usunięcia dokumentu
  async function handleDeleteConfirm() {
    if (!docToDelete) return;
    setBusy(true);
    try {
      await deleteDocument({ id: docToDelete.id });
      toast.success(`Dokument ${docToDelete.number} został usunięty.`);
      setDocToDelete(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedOrderForFilter = orders.find((o) => o._id === filterOrderId);

  return (
    <Page
      title="RW — Rozchód wewnętrzny"
      subtitle="Wydawanie pozycji magazynowych bezpośrednio do realizacji zleceń produkcyjnych z CRM."
      actions={
        <Btn primary onClick={() => setShowNewModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} />
          <span>Nowe wydanie RW do zlecenia</span>
        </Btn>
      }
    >
      {/* ─── KARTY KPI ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <ClipboardList size={14} color="#60a5fa" />
            <span>Wszystkie dokumenty RW</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginTop: 4 }}>
            {stats.total}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} color="#fbbf24" />
            <span>W trakcie przygotowania</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fbbf24", marginTop: 4 }}>
            {stats.drafts} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>robocze</span>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={14} color="#34d399" />
            <span>Zatwierdzone wydania</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#34d399", marginTop: 4 }}>
            {stats.approved}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={14} color="#a78bfa" />
            <span>Łącznie wydane sztuki</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa", marginTop: 4 }}>
            {fmtNum(stats.pieces)} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>szt.</span>
          </div>
        </div>
      </div>

      {/* ─── PASEK WYSZUKIWANIA I FILTRÓW ─────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            style={{ ...inputStyle, paddingLeft: 34 }}
            placeholder="Szukaj: nr RW (RW/2026/…), nr zlecenia (#ST-…), klient, autor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtr statusu */}
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            style={{
              background: statusFilter === "ALL" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: statusFilter === "ALL" ? "#60a5fa" : C.muted,
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: statusFilter === "ALL" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Wszystkie ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("DRAFT")}
            style={{
              background: statusFilter === "DRAFT" ? "rgba(245, 158, 11, 0.2)" : "transparent",
              color: statusFilter === "DRAFT" ? "#fbbf24" : C.muted,
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: statusFilter === "DRAFT" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            W toku ({stats.drafts})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ZATWIERDZONY")}
            style={{
              background: statusFilter === "ZATWIERDZONY" ? "rgba(16, 185, 129, 0.2)" : "transparent",
              color: statusFilter === "ZATWIERDZONY" ? "#34d399" : C.muted,
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: statusFilter === "ZATWIERDZONY" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Zatwierdzone ({stats.approved})
          </button>
        </div>

        {/* Informacja o aktywnym filtrze zlecenia */}
        {selectedOrderForFilter && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <span>Zlecenie: <b>{selectedOrderForFilter.orderNumber}</b> ({selectedOrderForFilter.clientName})</span>
            <button
              type="button"
              onClick={() => {
                setFilterOrderId(null);
                router.replace("/admin/wms/rw");
              }}
              style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", padding: 0 }}
              title="Wyczyść filtr zlecenia"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ─── GŁÓWNA TABELA DOKUMENTÓW RW ─────────────────────────────────── */}
      <Card pad={false}>
        {!docs ? (
          <div style={{ padding: 24, color: C.muted, fontSize: 13, textAlign: "center" }}>
            Ładowanie dokumentów wydań wewnętrznych RW…
          </div>
        ) : filteredDocs.length === 0 ? (
          <Empty
            title={search || statusFilter !== "ALL" || filterOrderId ? "Brak wyników wyszukiwania" : "Brak dokumentów RW"}
            text={
              search || statusFilter !== "ALL" || filterOrderId
                ? "Dostosuj filtry lub wyszukiwaną frazę."
                : "Kliknij „+ Nowe wydanie RW do zlecenia”, aby utworzyć pierwsze pobranie materiałów ze stanu magazynowego."
            }
          />
        ) : (
          <Table headers={["Numer RW", "Powiązane zlecenie produkcyjne", "Data utworzenia", "Pozycje / Sztuki", "Cel / Maszyna", "Status", "Autor", ""]}>
            {filteredDocs.map((d) => {
              const isDraft = d.status === "DRAFT";

              return (
                <Tr
                  key={d._id}
                  onClick={() => router.push(`/admin/wms/rw/${d._id}`)}
                >
                  {/* 1. Numer dokumentu RW */}
                  <Td mono style={{ fontWeight: 700, fontSize: 13, color: "#60a5fa" }}>
                    {d.number}
                  </Td>

                  {/* 2. Zlecenie powiązane */}
                  <Td>
                    {d.orderId ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Link
                          href={`/admin/zlecenia/${d.orderId}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: "#60a5fa",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 13,
                          }}
                        >
                          <span>{d.orderNumber || "Zlecenie CRM"}</span>
                          <ExternalLink size={12} color="#60a5fa" />
                        </Link>
                        {d.clientName && (
                          <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                            <Building size={11} />
                            <span>{d.clientName}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: C.muted, fontStyle: "italic", fontSize: 12 }}>— Brak powiązania —</span>
                    )}
                  </Td>

                  {/* 3. Data */}
                  <Td nowrap style={{ fontSize: 12, color: C.muted }}>
                    {fmtDate(d.createdAt)}
                  </Td>

                  {/* 4. Pozycje / Sztuki */}
                  <Td nowrap>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {d.lineCount} {d.lineCount === 1 ? "pozycja" : d.lineCount < 5 ? "pozycje" : "pozycji"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {fmtNum(d.totalPieces ?? 0)} szt. łącznie
                    </div>
                  </Td>

                  {/* 5. Cel / Maszyna */}
                  <Td>
                    <span style={{ fontSize: 12, color: d.targetNote ? C.text : C.muted }}>
                      {d.targetNote || "—"}
                    </span>
                  </Td>

                  {/* 6. Status */}
                  <Td>
                    <Badge status={d.status} />
                  </Td>

                  {/* 7. Autor */}
                  <Td style={{ fontSize: 12, color: C.muted }}>
                    {d.createdByName}
                  </Td>

                  {/* 8. Akcje */}
                  <Td nowrap>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/admin/wms/rw/${d._id}`}
                        style={{
                          background: "rgba(255, 255, 255, 0.06)",
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        Otwórz →
                      </Link>

                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => setDocToDelete({ id: d._id, number: d.number })}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: C.red,
                            padding: "4px 6px",
                            cursor: "pointer",
                            borderRadius: 4,
                          }}
                          title="Usuń szkic RW"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ─── MODAL TWORZENIA NOWEGO WYDANIA RW ───────────────────────────── */}
      {showNewModal && (
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
          onClick={() => !busy && setShowNewModal(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 580,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                  Nowe wydanie magazynowe RW
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  Wybierz zlecenie produkcyjne, do którego zostaną pobrane materiały z magazynu.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Wybór zlecenia CRM */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Powiązane zlecenie produkcyjne z CRM <span style={{ color: "#f85149" }}>*</span>
              </label>
              <RwOrderPicker
                orderId={newOrderId}
                orderNumber={newOrderNumber}
                onChange={(ord) => {
                  setNewOrderId(ord?._id);
                  setNewOrderNumber(ord?.orderNumber);
                }}
                autoFocus
              />
            </div>

            {/* Cel wydania / Stanowisko */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Cel wydania / Maszyna / Stanowisko (opcjonalnie)
              </label>
              <input
                style={inputStyle}
                placeholder="np. Piła dwugłowicowa nr 1, Montaż zadaszeń, Zgrzewarka…"
                value={newTargetNote}
                onChange={(e) => setNewTargetNote(e.target.value)}
              />
            </div>

            {/* Uwagi ogólne */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Uwagi do dokumentu RW (opcjonalnie)
              </label>
              <input
                style={inputStyle}
                placeholder="Dodatkowe informacje dla magazyniera lub brygadzisty…"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>

            {/* Przyciski akcji */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <Btn onClick={() => setShowNewModal(false)} disabled={busy}>
                Anuluj
              </Btn>
              <Btn primary onClick={handleCreateRw} disabled={busy || !newOrderId}>
                {busy ? "Tworzenie dokumentu…" : "Utwórz RW i przejdź do doboru pozycji →"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL USUWANIA SZKICU DOKUMENTU ─────────────────────────────── */}
      {docToDelete && (
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
          onClick={() => !busy && setDocToDelete(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              width: "100%",
              maxWidth: 440,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              Usuwanie dokumentu {docToDelete.number}
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Czy na pewno chcesz trwale usunąć ten szkic dokumentu RW? Wszystkie dodane do niego pozycje robocze zostaną usunięte.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <Btn onClick={() => setDocToDelete(null)} disabled={busy}>
                Wróć
              </Btn>
              <Btn danger onClick={handleDeleteConfirm} disabled={busy}>
                {busy ? "Usuwanie…" : "Tak, usuń dokument"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

export default function RwListPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: C.muted, fontSize: 13 }}>Wczytywanie modułu RW…</div>}>
      <RwListPageContent />
    </Suspense>
  );
}

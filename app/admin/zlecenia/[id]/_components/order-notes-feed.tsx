"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";
import { usePermissions } from "@/app/admin/_lib/permissions";
import { ownerInitials } from "@/app/admin/_lib/quotes";
import { getUserColor } from "@/app/admin/_lib/users";

type OrderNote = {
  _id: Id<"orderNotes">;
  text: string;
  authorId: Id<"users"> | null;
  authorName: string;
  createdAt: number;
  isPartner?: boolean;
  sentToPartner?: boolean;
  isLegacy?: boolean;
  threadId?: Id<"orderNotes">;
  isPartnerThreadRoot?: boolean;
};

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "przed chwilą";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dni temu`;
  return new Date(ts).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}
export function OrderNotesFeed({ orderId, archived }: { orderId: Id<"orders">; archived?: boolean }) {
  const notes = useQuery(api.orderNotes.list, { orderId }) as OrderNote[] | undefined;
  const partner = useQuery(api.partners.getPartnerForOrder, { orderId });
  const partnerName = partner?.name || "Partnera";
  const hasPartner = Boolean(partner);

  const add = useMutation(api.orderNotes.add);
  const update = useMutation(api.orderNotes.update);
  const remove = useMutation(api.orderNotes.remove);

  const { user } = usePermissions();
  const currentUserId = (user as { _id?: Id<"users"> } | null | undefined)?._id;
  const isAdmin = user?.role?.name === "admin" || user?.role?.name === "super_admin";

  const [confirmId, setConfirmId] = useState<Id<"orderNotes"> | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edycja notatek wewnętrznych
  const [editId, setEditId] = useState<Id<"orderNotes"> | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAdd(opts: { sendToPartner?: boolean }) {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await add({
        orderId,
        text,
        authorName: user?.name ?? user?.email ?? "Zespół ALCO",
        sendToPartner: opts.sendToPartner,
      });
      setDraft("");
      toast.success(
        opts.sendToPartner
          ? `Wysłano wiadomość do ${partnerName}`
          : "Dodano notatkę wewnętrzną Exalco"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać wiadomości");
    } finally {
      setSubmitting(false);
    }
  }

  function commitEdit(id: Id<"orderNotes">, value: string) {
    const text = value.trim();
    if (!text) return;
    void update({ id, text }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać edycji");
    });
  }

  function onEditChange(id: Id<"orderNotes">, value: string) {
    setEditDraft(value);
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => commitEdit(id, value), 700);
  }

  function finishEdit(id: Id<"orderNotes">) {
    if (editTimer.current) clearTimeout(editTimer.current);
    commitEdit(id, editDraft);
    setEditId(null);
    setEditDraft("");
  }

  function cancelEdit() {
    if (editTimer.current) clearTimeout(editTimer.current);
    setEditId(null);
    setEditDraft("");
  }

  async function doRemove(id: Id<"orderNotes">) {
    try {
      await remove({ id });
      toast.success("Notatka usunięta");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się usunąć");
    } finally {
      setConfirmId(null);
    }
  }

  type FeedTab = "all" | "internal" | "partner";
  const [activeTab, setActiveTab] = useState<FeedTab>("all");

  const isPartnerEntry = (n: OrderNote) =>
    Boolean(n.isPartner || n.sentToPartner || n.isPartnerThreadRoot || n.threadId || n.authorName.includes("ADK") || !n.authorId);

  const orderedNotes = notes ? [...notes].sort((a, b) => b.createdAt - a.createdAt) : [];

  // Statystyki dla odznak (badges)
  const internalCount = orderedNotes.filter((n) => !isPartnerEntry(n)).length;
  const partnerNotes = orderedNotes.filter((n) => isPartnerEntry(n));
  const partnerCount = partnerNotes.length;

  const filteredNotes = activeTab === "internal"
    ? orderedNotes.filter((n) => !isPartnerEntry(n))
    : activeTab === "partner"
    ? partnerNotes
    : orderedNotes;

  return (
    <div className="client-detail-notes">
      {/* ── Przełącznik Segmentowy (Segmented Control) ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 8,
          padding: 4,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: activeTab === "all" ? "#21262d" : "transparent",
            color: activeTab === "all" ? "#f0f6fc" : "#8b949e",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>Wszystkie</span>
          <span style={{ fontSize: 10, background: activeTab === "all" ? "#30363d" : "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 10 }}>
            {orderedNotes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("internal")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: activeTab === "internal" ? "#21262d" : "transparent",
            color: activeTab === "internal" ? "#f0f6fc" : "#8b949e",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>📝 Wewnętrzne</span>
          <span style={{ fontSize: 10, background: activeTab === "internal" ? "rgba(35, 134, 54, 0.2)" : "rgba(255,255,255,0.05)", color: activeTab === "internal" ? "#3fb950" : "#8b949e", padding: "1px 6px", borderRadius: 10 }}>
            {internalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("partner")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "partner" ? "rgba(37,99,235,0.2)" : "transparent",
            color: activeTab === "partner" ? "#60a5fa" : "#8b949e",
            border: activeTab === "partner" ? "1px solid rgba(37,99,235,0.4)" : "1px solid transparent",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>💬 {hasPartner ? partnerName : "Komunikacja z Partnerem"}</span>
          {partnerCount > 0 && (
            <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "1px 6px", borderRadius: 10 }}>
              {partnerCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Tworzenie Nowej Notatki / Wiadomości do Partnera ── */}
      {!archived && (
        <div
          className="client-detail-notes-composer"
          style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 8,
            padding: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <textarea
            className="client-detail-notes-textarea"
            placeholder={
              activeTab === "partner"
                ? `Napisz wiadomość do ${partnerName}…`
                : activeTab === "internal"
                ? "Napisz notatkę wewnętrzną Exalco…"
                : hasPartner
                ? `Napisz notatkę wewnętrzną Exalco lub wiadomość do ${partnerName}…`
                : "Napisz notatkę wewnętrzną Exalco…"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={submitting}
            style={{
              background: "#161b22",
              color: "#f0f6fc",
              border: "1px solid #30363d",
              borderRadius: 6,
              fontSize: 13,
              width: "100%",
              padding: 10,
              outline: "none",
            }}
          />
          <div
            className="client-detail-notes-composer-foot"
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="client-detail-notes-hint" style={{ fontSize: 11, color: "#8b949e" }}>
              {activeTab === "partner"
                ? `💡 Wiadomość zostanie wysłana bezpośrednio do ${partnerName}.`
                : activeTab === "internal"
                ? "💡 Notatka wewnętrzna widoczna tylko dla pracowników Exalco."
                : hasPartner
                ? `💡 Notatka wewnętrzna widoczna w Exalco. Wiadomość do ${partnerName} trafia do partnera.`
                : "💡 Notatki wewnętrzne są widoczne tylko dla pracowników Exalco."}
            </span>

            <div style={{ display: "flex", gap: 8 }}>
              {activeTab !== "partner" && (
                <button
                  type="button"
                  className="fluent-btn fluent-btn-ghost fluent-btn-sm"
                  disabled={!draft.trim() || submitting}
                  onClick={() => void handleAdd({ sendToPartner: false })}
                  style={{
                    background: "#21262d",
                    border: "1px solid #30363d",
                    color: "#c9d1d9",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📝 Notatka wewnętrzna
                </button>
              )}

              {hasPartner && activeTab !== "internal" && (
                <button
                  type="button"
                  className="fluent-btn fluent-btn-primary fluent-btn-sm"
                  disabled={!draft.trim() || submitting}
                  onClick={() => void handleAdd({ sendToPartner: true })}
                  style={{
                    background: "#2563eb",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(37,99,235,0.4)",
                  }}
                >
                  📤 Wyślij wiadomość do {partnerName}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lista Wiadomości ── */}
      <div className="client-detail-notes-list" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {notes === undefined && <div className="client-detail-notes-empty">Wczytywanie wiadomości…</div>}
        {notes !== undefined && filteredNotes.length === 0 && (
          <div className="client-detail-notes-empty" style={{ textAlign: "center", color: "#8b949e", padding: 20, background: "#0d1117", borderRadius: 8, border: "1px solid #21262d" }}>
            {activeTab === "partner"
              ? `Brak wiadomości z ${partnerName}. Napisz pierwszą wiadomość powyżej.`
              : activeTab === "internal"
              ? "Brak notatek wewnętrznych w tym zleceniu."
              : "Brak notatek w tym zleceniu. Napisz pierwszą powyżej."}
          </div>
        )}

        {filteredNotes.map((n) => {
          const isIncomingPartner = Boolean(n.isPartner || (!n.sentToPartner && !n.isPartnerThreadRoot && (n.authorName.includes("ADK") || !n.authorId)));
          const isOutgoingPartner = !isIncomingPartner && Boolean(n.sentToPartner || n.isPartnerThreadRoot || n.threadId);
          const mine = !!currentUserId && n.authorId === currentUserId;
          const color = n.authorId ? getUserColor(n.authorId) : "#38bdf8";
          const isEditing = editId === n._id;
          const isConfirming = confirmId === n._id;

          // Blokada edycji dla wiadomości wysłanych do lub otrzymanych od partnera
          const isLocked = isIncomingPartner || isOutgoingPartner;

          return (
            <article
              key={n._id}
              className="client-detail-note"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderRadius: 8,
                padding: 14,
                background: isIncomingPartner
                  ? "rgba(56, 189, 248, 0.06)"
                  : isOutgoingPartner
                  ? "rgba(37, 99, 235, 0.06)"
                  : "#0d1117",
                border: isOutgoingPartner
                  ? "1px solid rgba(59, 130, 246, 0.35)"
                  : isIncomingPartner
                  ? "1px solid rgba(56, 189, 248, 0.3)"
                  : "1px solid #21262d",
                borderLeft: isIncomingPartner
                  ? "4px solid #38bdf8"
                  : isOutgoingPartner
                  ? "4px solid #2563eb"
                  : `4px solid ${color || "#238636"}`,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  className="client-detail-note-avatar"
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    ...(isIncomingPartner
                      ? { background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }
                      : color
                      ? { background: `${color}22`, color, borderColor: `${color}55` }
                      : {}),
                  }}
                >
                  {isIncomingPartner ? "🏢" : ownerInitials(n.authorName)}
                </div>

                <div className="client-detail-note-body" style={{ flex: 1 }}>
                  <div className="client-detail-note-head" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      className="client-detail-note-author"
                      style={{
                        fontWeight: 700,
                        color: isIncomingPartner ? "#38bdf8" : "#f0f6fc",
                        fontSize: 13,
                      }}
                    >
                      {isIncomingPartner ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          🏢 {n.authorName} <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, background: "rgba(56, 189, 248, 0.15)", padding: "1px 5px", borderRadius: 4 }}>Partner API</span>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {n.authorName}{" "}
                          <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, background: isOutgoingPartner ? "rgba(37,99,235,0.2)" : "rgba(35, 134, 54, 0.2)", color: isOutgoingPartner ? "#60a5fa" : "#3fb950", padding: "1px 5px", borderRadius: 4 }}>
                            {isOutgoingPartner ? `Wysłano do ${partnerName}` : "ALCO Wewnętrzna"}
                          </span>
                        </span>
                      )}
                    </span>

                    <span className="client-detail-note-time" style={{ fontSize: 11, color: "#8b949e", marginLeft: 4 }} title={new Date(n.createdAt).toLocaleString("pl-PL")}>
                      {relTime(n.createdAt)}
                    </span>

                    {/* Akcje: Edycja / Usuwanie (tylko dla notatek wewnętrznych) */}
                    {!archived && !isEditing && !isConfirming && !n.isLegacy && (
                      <span style={{ display: "inline-flex", gap: 4, marginLeft: "auto" }}>
                        {isLocked ? (
                          <span style={{ fontSize: 10, color: "#8b949e", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }} title="Wiadomość zablokowana — oficjalny wpis komunikacji z partnerem">
                            🔒 Oficjalna komunikacja
                          </span>
                        ) : (
                          <>
                            {mine && (
                              <button
                                type="button"
                                className="client-detail-note-remove"
                                onClick={() => { setEditId(n._id); setEditDraft(n.text); }}
                                title="Edytuj wiadomość"
                                aria-label="Edytuj wiadomość"
                              >
                                <I.edit s={12} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                className="client-detail-note-remove"
                                onClick={() => setConfirmId(n._id)}
                                title="Usuń wiadomość"
                                aria-label="Usuń wiadomość"
                              >
                                <I.trash s={12} />
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                      <textarea
                        className="client-detail-notes-textarea"
                        value={editDraft}
                        onChange={(e) => onEditChange(n._id, e.target.value)}
                        onBlur={() => finishEdit(n._id)}
                        rows={3}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                      />
                      <span className="client-detail-notes-hint" style={{ fontSize: 11, color: "#8b949e" }}>Autozapis · Esc anuluje edycję</span>
                    </div>
                  ) : (
                    <div className="client-detail-note-text" style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.45, color: "#e6edf3" }}>
                      {n.text}
                    </div>
                  )}

                  {isConfirming && (
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px",
                        background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.35)", borderRadius: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>Usunąć ten wpis z czatu? Tej operacji nie można cofnąć.</span>
                      <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={() => setConfirmId(null)}>Anuluj</button>
                      <button type="button" className="fluent-btn fluent-btn-sm" style={{ background: "#da3633", color: "#fff", border: "none" }} onClick={() => void doRemove(n._id)}>
                        <I.trash s={12} /> Usuń
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

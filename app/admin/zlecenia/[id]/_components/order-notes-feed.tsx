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
  isLegacy?: boolean;
  threadId?: Id<"orderNotes">;
  parentNoteId?: Id<"orderNotes">;
  isPartnerThreadRoot?: boolean;
  threadStatus?: "pending_response" | "replied" | "closed";
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
  const add = useMutation(api.orderNotes.add);
  const update = useMutation(api.orderNotes.update);
  const remove = useMutation(api.orderNotes.remove);
  const closeThread = useMutation(api.orderNotes.closeThread);
  const reopenThread = useMutation(api.orderNotes.reopenThread);

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

  // Stan wpisywania odpowiedzi w konkretnym wątku
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingThreadId, setReplyingThreadId] = useState<Id<"orderNotes"> | null>(null);

  async function handleAdd(opts: { isPartnerThread?: boolean }) {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await add({
        orderId,
        text,
        authorName: user?.name ?? user?.email ?? "Zespół ALCO",
        isPartnerThread: opts.isPartnerThread,
      });
      setDraft("");
      toast.success(
        opts.isPartnerThread
          ? "Wysłano wiadomość do ADK Okna (utworzono wątek)"
          : "Dodano notatkę wewnętrzną Exalco"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać wiadomości");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply(threadId: Id<"orderNotes">) {
    const text = (replyDrafts[threadId] ?? "").trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await add({
        orderId,
        text,
        authorName: user?.name ?? user?.email ?? "Zespół ALCO",
        threadId,
      });
      setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
      setReplyingThreadId(null);
      toast.success("Odpowiedź została wysłana do ADK Okna");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać odpowiedzi");
    } finally {
      setSubmitting(false);
    }
  }

  async function commitEdit(id: Id<"orderNotes">, value: string) {
    const text = value.trim();
    if (!text) return;
    try {
      await update({ id, text });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać edycji");
    }
  }

  function onEditChange(id: Id<"orderNotes">, value: string) {
    setEditDraft(value);
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => void commitEdit(id, value), 700);
  }

  function finishEdit(id: Id<"orderNotes">) {
    if (editTimer.current) clearTimeout(editTimer.current);
    void commitEdit(id, editDraft);
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

  async function handleToggleThreadStatus(rootNote: OrderNote) {
    try {
      if (rootNote.threadStatus === "closed") {
        await reopenThread({ threadId: rootNote._id });
        toast.success("Otworzono ponownie wątek z ADK Okna");
      } else {
        await closeThread({ threadId: rootNote._id });
        toast.success("Zamknięto wątek z ADK Okna");
      }
    } catch (e) {
      toast.error("Błąd zmiany stanu wątku");
    }
  }

  // Grupowanie notatek: oddziel wpisy wolne od odpowiedzi w pod-wątkach
  const threadMap = new Map<string, OrderNote[]>();
  const rootNotes: OrderNote[] = [];

  if (notes) {
    for (const n of notes) {
      if (n.threadId) {
        const list = threadMap.get(n.threadId) ?? [];
        list.push(n);
        threadMap.set(n.threadId, list);
      } else {
        rootNotes.push(n);
      }
    }
  }

  const orderedRoots = [...rootNotes].reverse();

  return (
    <div className="client-detail-notes">
      {/* ── Tworzenie Nowej Notatki / Wątku do ADK ── */}
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
            placeholder="Napisz notatkę wewnętrzną Exalco lub treść zapytania do ADK Okna…"
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
              💡 Notatka wewnętrzna widoczna tylko w Exalco. Wiadomość do ADK tworzy wątek z partnerem.
            </span>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="fluent-btn fluent-btn-ghost fluent-btn-sm"
                disabled={!draft.trim() || submitting}
                onClick={() => void handleAdd({ isPartnerThread: false })}
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

              <button
                type="button"
                className="fluent-btn fluent-btn-primary fluent-btn-sm"
                disabled={!draft.trim() || submitting}
                onClick={() => void handleAdd({ isPartnerThread: true })}
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
                📤 Wyślij wiadomość do ADK Okna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista Notatek i Wątków ── */}
      <div className="client-detail-notes-list" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {notes === undefined && <div className="client-detail-notes-empty">Wczytywanie wiadomości…</div>}
        {notes !== undefined && orderedRoots.length === 0 && (
          <div className="client-detail-notes-empty" style={{ textAlign: "center", color: "#8b949e", padding: 20, background: "#0d1117", borderRadius: 8, border: "1px solid #21262d" }}>
            Brak notatek w tym zleceniu. Napisz pierwszą powyżej.
          </div>
        )}

        {orderedRoots.map((n) => {
          const isThread = !!n.isPartnerThreadRoot;
          const replies = isThread ? (threadMap.get(n._id) ?? []) : [];
          const isPartnerMsg = n.isPartner || n.authorName.includes("ADK") || !n.authorId;
          const mine = !!currentUserId && n.authorId === currentUserId;
          const color = n.authorId ? getUserColor(n.authorId) : "#38bdf8";
          const isEditing = editId === n._id;
          const isConfirming = confirmId === n._id;

          // Blokada edycji dla wiadomości w wątkach partnera
          const isLocked = isThread || isPartnerMsg || !!n.threadId;

          // Status wątku
          const status = n.threadStatus ?? "pending_response";

          return (
            <article
              key={n._id}
              className="client-detail-note"
              style={{
                borderRadius: 8,
                padding: 14,
                background: isThread
                  ? "rgba(13, 17, 23, 0.95)"
                  : isPartnerMsg
                  ? "rgba(56, 189, 248, 0.05)"
                  : "#0d1117",
                border: isThread
                  ? `1px solid ${status === "replied" ? "rgba(59, 130, 246, 0.5)" : status === "closed" ? "#30363d" : "rgba(234, 179, 8, 0.5)"}`
                  : "1px solid #21262d",
                borderLeft: isThread
                  ? `4px solid ${status === "replied" ? "#3b82f6" : status === "closed" ? "#8b949e" : "#eab308"}`
                  : isPartnerMsg
                  ? "4px solid #38bdf8"
                  : `4px solid ${color || "#238636"}`,
                boxShadow: isThread ? "0 4px 14px rgba(0,0,0,0.4)" : undefined,
              }}
            >
              {/* Nagłówek Wątku (jeśli to korzeń wątku ADK) */}
              {isThread && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>
                      💬 Wątek komunikacji z ADK Okna
                    </span>
                    {status === "pending_response" && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(234, 179, 8, 0.15)", color: "#facc15", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(234, 179, 8, 0.3)" }}>
                        🟡 Oczekuje na odpowiedź ADK
                      </span>
                    )}
                    {status === "replied" && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                        🟢 Odpowiedziano przez ADK
                      </span>
                    )}
                    {status === "closed" && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(139, 148, 158, 0.15)", color: "#8b949e", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(139, 148, 158, 0.3)" }}>
                        ⚪ Wątek zamknięty
                      </span>
                    )}
                  </div>

                  {!archived && (
                    <button
                      type="button"
                      onClick={() => void handleToggleThreadStatus(n)}
                      style={{
                        background: "none",
                        border: "1px solid #30363d",
                        color: status === "closed" ? "#4ade80" : "#8b949e",
                        borderRadius: 4,
                        fontSize: 11,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      {status === "closed" ? "Otwórz ponownie" : "Zamknij wątek"}
                    </button>
                  )}
                </div>
              )}

              {/* Główna wiadomość */}
              <div style={{ display: "flex", gap: 10 }}>
                <div
                  className="client-detail-note-avatar"
                  aria-hidden
                  style={
                    isPartnerMsg
                      ? { background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }
                      : color
                      ? { background: `${color}22`, color, borderColor: `${color}55` }
                      : undefined
                  }
                >
                  {isPartnerMsg ? "🏢" : ownerInitials(n.authorName)}
                </div>

                <div className="client-detail-note-body" style={{ flex: 1 }}>
                  <div className="client-detail-note-head" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      className="client-detail-note-author"
                      style={{
                        fontWeight: 700,
                        color: isPartnerMsg ? "#38bdf8" : "#f0f6fc",
                        fontSize: 13,
                      }}
                    >
                      {isPartnerMsg ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          🏢 {n.authorName} <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, background: "rgba(56, 189, 248, 0.15)", padding: "1px 5px", borderRadius: 4 }}>Partner API</span>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {n.authorName}{" "}
                          <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, background: isThread ? "rgba(37,99,235,0.2)" : "rgba(35, 134, 54, 0.2)", color: isThread ? "#60a5fa" : "#3fb950", padding: "1px 5px", borderRadius: 4 }}>
                            {isThread ? "Zytanie do ADK" : "ALCO Wewnętrzna"}
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

              {/* ── Pod-wątek odpowiedzi w wątku z ADK ── */}
              {isThread && (
                <div style={{ marginTop: 12, paddingLeft: 20, borderLeft: "2px solid rgba(59, 130, 246, 0.3)", display: "flex", flexDirection: "column", gap: 10 }}>
                  {replies.map((reply) => {
                    const isPartnerReply = reply.isPartner || reply.authorName.includes("ADK");
                    const replyColor = reply.authorId ? getUserColor(reply.authorId) : "#38bdf8";

                    return (
                      <div
                        key={reply._id}
                        style={{
                          background: isPartnerReply ? "rgba(56, 189, 248, 0.08)" : "#161b22",
                          border: `1px solid ${isPartnerReply ? "rgba(56, 189, 248, 0.3)" : "#30363d"}`,
                          borderRadius: 6,
                          padding: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isPartnerReply ? "#38bdf8" : replyColor || "#f0f6fc" }}>
                            {isPartnerReply ? `🏢 ${reply.authorName} (ADK Okna)` : reply.authorName}
                          </span>
                          <span style={{ fontSize: 10, color: "#8b949e" }}>{relTime(reply.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.4, color: "#e6edf3", whiteSpace: "pre-wrap" }}>
                          {reply.text}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pole dopisywania kolejnej odpowiedzi w tym samym wątku */}
                  {!archived && status !== "closed" && (
                    <div style={{ marginTop: 4 }}>
                      {replyingThreadId === n._id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#161b22", padding: 8, borderRadius: 6, border: "1px solid #30363d" }}>
                          <textarea
                            placeholder="Wpisz odpowiedź w tym wątku do ADK Okna…"
                            value={replyDrafts[n._id] ?? ""}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [n._id]: e.target.value }))}
                            rows={2}
                            style={{ background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", borderRadius: 4, padding: 8, fontSize: 12, outline: "none" }}
                          />
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setReplyingThreadId(null)}
                              style={{ background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                            >
                              Anuluj
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSendReply(n._id)}
                              disabled={!(replyDrafts[n._id] ?? "").trim() || submitting}
                              style={{ background: "#2563eb", border: "none", color: "#fff", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                            >
                              Wyślij odpowiedź do ADK
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReplyingThreadId(n._id)}
                          style={{
                            background: "none",
                            border: "1px dashed rgba(59, 130, 246, 0.4)",
                            color: "#60a5fa",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "100%",
                            textAlign: "left",
                          }}
                        >
                          💬 Odpowiedz w tym wątku do ADK Okna…
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

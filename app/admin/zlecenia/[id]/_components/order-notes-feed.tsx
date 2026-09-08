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
  const { user } = usePermissions();
  const currentUserId = (user as { _id?: Id<"users"> } | null | undefined)?._id;
  const isAdmin = user?.role?.name === "admin" || user?.role?.name === "super_admin";
  const [confirmId, setConfirmId] = useState<Id<"orderNotes"> | null>(null);

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<Id<"orderNotes"> | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAdd() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await add({ orderId, text, authorName: user?.name ?? user?.email ?? "Zespół ALCO" });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać wiadomości");
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się usunąć");
    } finally {
      setConfirmId(null);
    }
  }

  const ordered = notes ? [...notes].reverse() : undefined; // Najnowsze na górze

  return (
    <div className="client-detail-notes">
      {!archived && (
        <div className="client-detail-notes-composer" style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 12 }}>
          <textarea
            className="client-detail-notes-textarea"
            placeholder="Napisz wiadomość / notatkę do ADK Okna… (Enter wysyła)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={submitting}
            style={{ background: "#161b22", color: "#f0f6fc", border: "1px solid #30363d", borderRadius: 6 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <div className="client-detail-notes-composer-foot" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="client-detail-notes-hint" style={{ fontSize: 11, color: "#8b949e" }}>
              Enter = wysłanie wiadomości w czacie · Shift+Enter = nowa linia
            </span>
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              disabled={!draft.trim() || submitting}
              onClick={() => void handleAdd()}
            >
              {submitting ? "Wysyłanie…" : "Wyślij wiadomość"}
            </button>
          </div>
        </div>
      )}

      <div className="client-detail-notes-list" style={{ marginTop: 12 }}>
        {ordered === undefined && <div className="client-detail-notes-empty">Wczytywanie wiadomości…</div>}
        {ordered !== undefined && ordered.length === 0 && (
          <div className="client-detail-notes-empty">Brak wiadomości w komunikatorze. Napisz pierwszą powyżej.</div>
        )}
        {ordered?.map((n) => {
          const isPartnerMsg = n.isPartner || n.authorName.includes("ADK") || !n.authorId;
          const mine = !!currentUserId && n.authorId === currentUserId;
          const color = n.authorId ? getUserColor(n.authorId) : "#38bdf8";
          const isEditing = editId === n._id;
          const isConfirming = confirmId === n._id;

          return (
            <article
              key={n._id}
              className="client-detail-note"
              style={
                isPartnerMsg
                  ? { borderLeft: "3px solid #38bdf8", background: "rgba(56, 189, 248, 0.06)", borderRadius: 8, padding: 12 }
                  : { borderLeft: `3px solid ${color || "#238636"}`, background: "#0d1117", borderRadius: 8, padding: 12 }
              }
            >
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
                        {n.authorName} <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, background: "rgba(35, 134, 54, 0.2)", color: "#3fb950", padding: "1px 5px", borderRadius: 4 }}>ALCO Team</span>
                      </span>
                    )}
                  </span>
                  <span className="client-detail-note-time" style={{ fontSize: 11, color: "#8b949e", marginLeft: 4 }} title={new Date(n.createdAt).toLocaleString("pl-PL")}>
                    {relTime(n.createdAt)}
                  </span>
                  {!archived && !isEditing && !isConfirming && !n.isLegacy && (mine || isAdmin) && (
                    <span style={{ display: "inline-flex", gap: 4, marginLeft: "auto" }}>
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
            </article>
          );
        })}
      </div>
    </div>
  );
}


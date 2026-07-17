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

type QuoteNote = {
  _id: Id<"quoteNotes">;
  text: string;
  authorId: Id<"users"> | null;
  authorName: string;
  createdAt: number;
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

export function QuoteNotesFeed({ quoteId, archived }: { quoteId: Id<"quotes">; archived?: boolean }) {
  const notes = useQuery(api.quoteNotes.list, { quoteId }) as QuoteNote[] | undefined;
  const add = useMutation(api.quoteNotes.add);
  const update = useMutation(api.quoteNotes.update);
  const remove = useMutation(api.quoteNotes.remove);
  const { user } = usePermissions();
  const currentUserId = (user as { _id?: Id<"users"> } | null | undefined)?._id;
  const isAdmin = user?.role?.name === "admin" || user?.role?.name === "super_admin";
  const [confirmId, setConfirmId] = useState<Id<"quoteNotes"> | null>(null);

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<Id<"quoteNotes"> | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAdd() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await add({ quoteId, text, authorName: user?.name ?? user?.email ?? "Nieznany" });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setSubmitting(false);
    }
  }

  async function commitEdit(id: Id<"quoteNotes">, value: string) {
    const text = value.trim();
    if (!text) return; // pustego nie zapisujemy
    try {
      await update({ id, text });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
    }
  }

  function onEditChange(id: Id<"quoteNotes">, value: string) {
    setEditDraft(value);
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => void commitEdit(id, value), 700);
  }

  function finishEdit(id: Id<"quoteNotes">) {
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

  async function doRemove(id: Id<"quoteNotes">) {
    try {
      await remove({ id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się usunąć");
    } finally {
      setConfirmId(null);
    }
  }

  const ordered = notes ? [...notes].reverse() : undefined; // najnowsze na górze

  return (
    <div className="client-detail-notes">
      {!archived && (
        <div className="client-detail-notes-composer">
          <textarea
            className="client-detail-notes-textarea"
            placeholder="Napisz notatkę do tej wyceny… (Enter aby dodać)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <div className="client-detail-notes-composer-foot">
            <span className="client-detail-notes-hint">Enter aby dodać · Shift+Enter = nowa linia</span>
          </div>
        </div>
      )}

      <div className="client-detail-notes-list">
        {ordered === undefined && <div className="client-detail-notes-empty">Wczytywanie…</div>}
        {ordered !== undefined && ordered.length === 0 && (
          <div className="client-detail-notes-empty">Brak wpisów. Dodaj pierwszy powyżej.</div>
        )}
        {ordered?.map((n) => {
          const mine = !!currentUserId && n.authorId === currentUserId;
          const color = n.authorId ? getUserColor(n.authorId) : undefined;
          const isEditing = editId === n._id;
          const isConfirming = confirmId === n._id;
          return (
            <article key={n._id} className="client-detail-note">
              <div
                className="client-detail-note-avatar"
                aria-hidden
                style={color ? { background: `${color}22`, color, borderColor: `${color}55` } : undefined}
              >
                {ownerInitials(n.authorName)}
              </div>
              <div className="client-detail-note-body">
                <div className="client-detail-note-head">
                  <span className="client-detail-note-author">{n.authorName}</span>
                  <span className="client-detail-note-time" title={new Date(n.createdAt).toLocaleString("pl-PL")}>
                    {relTime(n.createdAt)}
                  </span>
                  {!archived && !isEditing && !isConfirming && (mine || isAdmin) && (
                    <span style={{ display: "inline-flex", gap: 2, marginLeft: "auto" }}>
                      {mine && (
                        <button
                          type="button"
                          className="client-detail-note-remove"
                          onClick={() => { setEditId(n._id); setEditDraft(n.text); }}
                          title="Edytuj wpis"
                          aria-label="Edytuj wpis"
                        >
                          <I.edit s={11} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          className="client-detail-note-remove"
                          onClick={() => setConfirmId(n._id)}
                          title="Usuń wpis"
                          aria-label="Usuń wpis"
                        >
                          <I.trash s={11} />
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
                    <span className="client-detail-notes-hint">Autozapis · Esc anuluje edycję</span>
                  </div>
                ) : (
                  <div className="client-detail-note-text">{n.text}</div>
                )}

                {isConfirming && (
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px",
                      background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.35)", borderRadius: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>Usunąć ten wpis? Tej operacji nie można cofnąć.</span>
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

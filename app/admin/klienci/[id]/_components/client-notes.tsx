"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";
import { usePermissions } from "@/app/admin/_lib/permissions";
import { ownerInitials } from "@/app/admin/_lib/quotes";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientNotes({ clientId }: { clientId: Id<"clients"> }) {
  const notes = useQuery(api.clientNotes.list, { clientId });
  const add = useMutation(api.clientNotes.add);
  const remove = useMutation(api.clientNotes.remove);
  const { user } = usePermissions();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await add({
        clientId,
        text,
        authorName: user?.name ?? user?.email ?? "Nieznany",
      });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: Id<"clientNotes">) {
    if (!window.confirm("Usunąć notatkę?")) return;
    try {
      await remove({ id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się usunąć");
    }
  }

  return (
    <section className="client-detail-section client-detail-notes">
      <header className="client-detail-section-head">
        <div className="client-detail-section-title">
          <I.edit s={14} />
          <span>Notatki</span>
          <span className="client-detail-section-sub">
            · cross-quote, dotyczą klienta
          </span>
        </div>
      </header>

      <div className="client-detail-notes-composer">
        <textarea
          className="client-detail-notes-textarea"
          placeholder="np. preferuje kontakt mailowo, wraca co rok, polecony przez X"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
        <div className="client-detail-notes-composer-foot">
          <span className="client-detail-notes-hint">⌘+Enter aby zapisać</span>
          <button
            type="button"
            className="fluent-btn fluent-btn-primary"
            onClick={() => void handleAdd()}
            disabled={submitting || draft.trim().length === 0}
          >
            <I.plus s={13} sw={2.2} />
            <span>Dodaj notatkę</span>
          </button>
        </div>
      </div>

      <div className="client-detail-notes-list">
        {notes === undefined && (
          <div className="client-detail-notes-empty">Wczytywanie…</div>
        )}
        {notes !== undefined && notes.length === 0 && (
          <div className="client-detail-notes-empty">
            Brak notatek. Dodaj pierwszą powyżej.
          </div>
        )}
        {notes !== undefined &&
          notes
            .slice()
            .reverse()
            .map((n: any) => (
              <article key={n._id} className="client-detail-note">
                <div className="client-detail-note-avatar" aria-hidden>
                  {ownerInitials(n.authorName)}
                </div>
                <div className="client-detail-note-body">
                  <div className="client-detail-note-head">
                    <span className="client-detail-note-author">
                      {n.authorName}
                    </span>
                    <span className="client-detail-note-time">
                      {formatTimestamp(n.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="client-detail-note-remove"
                      onClick={() => void handleRemove(n._id)}
                      title="Usuń notatkę"
                      aria-label="Usuń notatkę"
                    >
                      <I.trash s={11} />
                    </button>
                  </div>
                  <div className="client-detail-note-text">{n.text}</div>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Quote } from "@/app/admin/_lib/quotes";
import { ownerInitials } from "@/app/admin/_lib/quotes";
import { useOwnerName } from "@/app/admin/_lib/owner-names";
import { I } from "@/app/admin/_lib/icons";

function formatNoteDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpisUwagiHorizontalSection({
  quote,
  archived,
}: {
  quote: Quote;
  archived: boolean;
}) {
  const author = useOwnerName(quote);
  const notes = useQuery(api.quoteNotes.list, { quoteId: quote._id }) ?? [];
  const addNote = useMutation(api.quoteNotes.add);
  const removeNote = useMutation(api.quoteNotes.remove);
  const [draft, setDraft] = useState("");

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    await addNote({ quoteId: quote._id, text, authorName: author });
    setDraft("");
  }

  return (
    <section className="quote-detail-notes-strip">
      <header className="quote-detail-notes-head">
        <div className="quote-detail-notes-title">
          <span className="quote-detail-notes-icon">
            <I.doc s={14} sw={2} />
          </span>
          <span>Opis / Uwagi</span>
          <span className="quote-detail-notes-count">{notes.length}</span>
        </div>
      </header>

      <form
        className="quote-detail-notes-add"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <span className="quote-detail-notes-add-icon">
          <I.plus s={14} />
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dodaj notatkę, opis lub uwagę… (Enter, aby dodać)"
          disabled={archived}
          className="quote-detail-notes-input"
        />
        <button
          type="submit"
          disabled={!draft.trim() || archived}
          className="quote-detail-notes-submit"
        >
          Dodaj
        </button>
      </form>

      {notes.length === 0 ? (
        <div className="quote-detail-notes-empty">
          Brak notatek. Dodaj pierwszą uwagę powyżej.
        </div>
      ) : (
        <div className="quote-detail-notes-track" role="list">
          {notes.map((n) => (
            <article
              key={n._id as unknown as string}
              className="quote-detail-note-card"
              role="listitem"
            >
              <div className="quote-detail-note-card-text">{n.text}</div>
              <footer className="quote-detail-note-card-foot">
                <span className="quote-detail-note-card-author">
                  <span className="kanban-card-owner-avatar quote-detail-note-card-avatar">
                    {ownerInitials(n.authorName)}
                  </span>
                  <span className="quote-detail-note-card-author-name">
                    {n.authorName}
                  </span>
                </span>
                <span className="quote-detail-note-card-date">
                  {formatNoteDate(n.createdAt)}
                </span>
                {!archived && (
                  <button
                    type="button"
                    className="quote-detail-note-card-remove"
                    onClick={() => void removeNote({ id: n._id })}
                    aria-label="Usuń notatkę"
                  >
                    <I.trash s={11} />
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

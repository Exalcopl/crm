"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Quote } from "@/app/admin/_lib/quotes";
import { ownerInitials } from "@/app/admin/_lib/quotes";
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
}: {
  quote: Quote;
  archived: boolean;
}) {
  const notes = useQuery(api.quoteNotes.list, { quoteId: quote._id }) ?? [];

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

      {notes.length === 0 ? (
        <div className="quote-detail-notes-empty">
          Klient nie podał opisu ani uwag.
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
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

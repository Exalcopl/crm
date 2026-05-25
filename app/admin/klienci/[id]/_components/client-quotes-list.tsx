"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";
import {
  QUOTE_STATUS_COLORS,
  deadlineTone,
  formatDeadline,
  getProjectTypeStyle,
  type Quote,
} from "@/app/admin/_lib/quotes";

type Filter = "active" | "archived" | "all";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ClientQuotesList({ clientId }: { clientId: Id<"clients"> }) {
  const quotes = useQuery(api.quotes.listByClient, { clientId }) as
    | Quote[]
    | undefined;
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{
    name: string;
    color: string;
  }>;
  const [filter, setFilter] = useState<Filter>("active");

  const filtered = useMemo(() => {
    if (!quotes) return [];
    if (filter === "all") return quotes;
    if (filter === "archived") return quotes.filter((q) => q.archived === true);
    return quotes.filter((q) => q.archived !== true);
  }, [quotes, filter]);

  return (
    <section className="client-detail-section client-detail-quotes">
      <header className="client-detail-section-head">
        <div className="client-detail-section-title">
          <I.doc s={14} />
          <span>Wyceny klienta</span>
          {quotes && (
            <span className="client-detail-section-sub">
              · {quotes.length} łącznie
            </span>
          )}
        </div>
        <div className="client-detail-quotes-filters" role="tablist">
          <FilterButton
            label="Aktywne"
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <FilterButton
            label="Archiwum"
            active={filter === "archived"}
            onClick={() => setFilter("archived")}
          />
          <FilterButton
            label="Wszystkie"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>
      </header>

      {quotes === undefined && (
        <div className="client-detail-quotes-empty">Wczytywanie…</div>
      )}

      {quotes !== undefined && filtered.length === 0 && (
        <div className="client-detail-quotes-empty">
          {filter === "archived"
            ? "Brak wycen w archiwum."
            : filter === "active"
              ? "Brak aktywnych wycen tego klienta."
              : "Brak wycen tego klienta."}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="client-detail-quotes-table" role="table">
          <div className="client-detail-quotes-head" role="row">
            <div role="columnheader">ID</div>
            <div role="columnheader">Typ</div>
            <div role="columnheader">Status</div>
            <div role="columnheader" className="align-right">
              Wartość
            </div>
            <div role="columnheader">Termin</div>
          </div>
          {filtered.map((q) => (
            <Link
              key={q._id}
              role="row"
              href={`/admin/wyceny/${q._id}`}
              className={`client-detail-quotes-row${q.archived ? " is-archived" : ""}`}
            >
              <div className="client-detail-quotes-id">{q.id}</div>
              <div className="client-detail-quotes-types">
                {q.projectType.map((t) => {
                  const s = getProjectTypeStyle(projectTypes, t);
                  return (
                    <span
                      key={t}
                      className="kanban-chip kanban-chip-type"
                      style={{
                        background: s.bg,
                        color: s.fg,
                        borderColor: s.border,
                      }}
                    >
                      <span
                        className="kanban-chip-dot"
                        style={{ background: s.fg }}
                      />
                      {t}
                    </span>
                  );
                })}
              </div>
              <div className="client-detail-quotes-status">
                <span
                  className="client-detail-quotes-status-dot"
                  style={{ background: QUOTE_STATUS_COLORS[q.status] }}
                  aria-hidden
                />
                <span>{q.status}</span>
              </div>
              <div className="client-detail-quotes-value align-right">
                {typeof q.value === "number" ? (
                  <>
                    {formatPLN(q.value)} <em>PLN</em>
                  </>
                ) : (
                  <span className="client-list-muted">—</span>
                )}
              </div>
              <div
                className={`client-detail-quotes-deadline tone-${deadlineTone(q.deadline)}`}
              >
                {formatDeadline(q.deadline)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`client-detail-quotes-filter${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

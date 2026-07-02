"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../_lib/icons";
import {
  getProjectTypeStyle,
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  deadlineTone,
  formatDeadline,
  ownerInitials,
  type Quote,
} from "../_lib/quotes";
import {
  resolveOwnerName,
  useOwnerName,
  useOwnerNamesMap,
} from "../_lib/owner-names";

type SortColumn =
  | "id"
  | "client"
  | "projectType"
  | "status"
  | "value"
  | "deadline"
  | "owner";
type SortState = { column: SortColumn; dir: "asc" | "desc" };

export function QuoteListView({
  quotes,
  emptyLabel = "Brak wycen pasujących do filtra.",
}: {
  quotes: Quote[];
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState<SortState>({ column: "deadline", dir: "asc" });
  const ownerMap = useOwnerNamesMap();
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;

  const sortedQuotes = useMemo(() => {
    const arr = [...quotes];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "id":
          cmp = a.id.localeCompare(b.id);
          break;
        case "client":
          cmp = a.contact.name.localeCompare(b.contact.name, "pl");
          break;
        case "projectType":
          cmp = a.projectType.join(", ").localeCompare(b.projectType.join(", "), "pl");
          break;
        case "status":
          cmp = QUOTE_STATUSES.indexOf(a.status) - QUOTE_STATUSES.indexOf(b.status);
          break;
        case "value":
          cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
          break;
        case "deadline":
          cmp = a.deadline.localeCompare(b.deadline);
          break;
        case "owner":
          cmp = resolveOwnerName(a, ownerMap).localeCompare(
            resolveOwnerName(b, ownerMap),
            "pl",
          );
          break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [quotes, sort, ownerMap]);

  const toggleSort = (column: SortColumn) => {
    setSort((s) =>
      s.column === column
        ? { column, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column, dir: "asc" },
    );
  };

  return (
    <div className="quote-list" role="table" aria-label="Lista wycen">
      <div className="quote-list-header" role="row">
        <SortHeader label="ID" column="id" sort={sort} onSort={toggleSort} />
        <SortHeader label="Klient" column="client" sort={sort} onSort={toggleSort} />
        <SortHeader label="Typ" column="projectType" sort={sort} onSort={toggleSort} />
        <SortHeader label="Status" column="status" sort={sort} onSort={toggleSort} />
        <SortHeader
          label="Wartość"
          column="value"
          sort={sort}
          onSort={toggleSort}
          align="right"
        />
        <SortHeader label="Termin" column="deadline" sort={sort} onSort={toggleSort} />
        <SortHeader
          label="Opiekun"
          column="owner"
          sort={sort}
          onSort={toggleSort}
          align="center"
        />
      </div>
      <div className="quote-list-body">
        {sortedQuotes.length === 0 ? (
          <div className="quote-list-empty">{emptyLabel}</div>
        ) : (
          sortedQuotes.map((q) => <QuoteListRow key={q.id} quote={q} projectTypes={projectTypes} />)
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (c: SortColumn) => void;
  align?: "right" | "center";
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      role="columnheader"
      className={`quote-list-header-cell${active ? " is-active" : ""}${
        align ? ` align-${align}` : ""
      }`}
      onClick={() => onSort(column)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span>{label}</span>
      <span className="quote-list-header-arrow" aria-hidden>
        {active ? (sort.dir === "asc" ? "▲" : "▼") : "▾"}
      </span>
    </button>
  );
}

function QuoteListRow({
  quote,
  projectTypes,
}: {
  quote: Quote;
  projectTypes: Array<{ name: string; color: string }>;
}) {
  const router = useRouter();
  const statusColor = QUOTE_STATUS_COLORS[quote.status];
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const ownerName = useOwnerName(quote);
  const go = () => router.push(`/admin/wyceny/${encodeURIComponent(quote.id)}`);
  return (
    <div
      className="quote-list-row"
      role="row"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="quote-list-cell quote-list-cell-id" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span>{quote.id}</span>
        {quote.customLabel && (
          <span
            style={{
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "var(--accent-primary)",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-line)",
              padding: "1px 6px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
            }}
            title={quote.customLabel}
          >
            🏷️ {quote.customLabel}
          </span>
        )}
      </div>
      <div className="quote-list-cell quote-list-cell-client">{quote.contact.name}</div>
      <div className="quote-list-cell">
        <div className="quote-list-types">
          {quote.projectType.map((t) => {
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
                <span className="kanban-chip-dot" style={{ background: s.fg }} />
                {t}
              </span>
            );
          })}
        </div>
      </div>
      <div className="quote-list-cell">
        <span className="quote-list-status" style={{ color: statusColor }}>
          <span className="quote-list-status-dot" />
          {quote.status}
        </span>
      </div>
      <div className="quote-list-cell quote-list-cell-value align-right">
        {hasValue ? (
          <>
            <span className="quote-list-value-num">
              {quote.value!.toLocaleString("pl-PL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="quote-list-value-unit">PLN</span>
          </>
        ) : (
          <span className="quote-list-value-empty">— brak —</span>
        )}
      </div>
      <div className="quote-list-cell">
        <span className={`kanban-chip kanban-chip-deadline tone-${tone}`}>
          <I.cal s={11} />
          {formatDeadline(quote.deadline)}
        </span>
      </div>
      <div className="quote-list-cell quote-list-cell-owner align-center">
        <span
          className="kanban-card-owner-avatar"
          title={ownerName}
          aria-label={ownerName}
        >
          {ownerInitials(ownerName)}
        </span>
      </div>
    </div>
  );
}

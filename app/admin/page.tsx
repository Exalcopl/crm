"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { I } from "./_lib/icons";
import {
  PROJECT_TYPE_STYLES,
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  deadlineTone,
  formatDeadline,
  ownerInitials,
  type ProjectType,
  type Quote,
  type QuoteStatus,
} from "./_lib/quotes";
import { setQuotes, useQuotes } from "./_lib/quotes-store";
import { RibbonBtn, RibbonGroup, RibbonToggleGroup } from "./_components/ribbon";

type WycenyViewMode = "kanban" | "lista";

function WycenyRibbon({
  view,
  onViewChange,
  onNewQuote,
}: {
  view: WycenyViewMode;
  onViewChange: (v: WycenyViewMode) => void;
  onNewQuote: () => void;
}) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Główna">
        <RibbonBtn
          icon={<I.plus s={22} />}
          label="Nowa wycena"
          primary
          onClick={onNewQuote}
        />
      </RibbonGroup>
      <RibbonGroup label="Widok">
        <RibbonToggleGroup
          value={view}
          onChange={onViewChange}
          options={[
            { value: "kanban", label: "Kanban" },
            { value: "lista", label: "Lista" },
          ]}
        />
      </RibbonGroup>
    </div>
  );
}

type QuoteFilter = "Wszystkie" | ProjectType | "Archiwum";

const FILTERS: QuoteFilter[] = [
  "Wszystkie",
  "Zadaszenia",
  "Pergola",
  "Stolarka",
  "Ogrodzenie",
  "Osłony okienne",
  "Inne",
  "Archiwum",
];

function WycenyView({ view }: { view: WycenyViewMode }) {
  const quotes = useQuotes();
  const [filter, setFilter] = useState<QuoteFilter>("Wszystkie");

  const counts = useMemo(() => {
    const c: Record<QuoteFilter, number> = {
      Wszystkie: quotes.length,
      Zadaszenia: 0,
      Pergola: 0,
      Stolarka: 0,
      Ogrodzenie: 0,
      "Osłony okienne": 0,
      Inne: 0,
      Archiwum: 0,
    };
    quotes.forEach((q) => {
      c[q.projectType] += 1;
      if (q.status === "Zrobione") c.Archiwum += 1;
    });
    return c;
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return quotes;
    if (filter === "Archiwum") return quotes.filter((q) => q.status === "Zrobione");
    return quotes.filter((q) => q.projectType === filter);
  }, [quotes, filter]);

  return (
    <>
      <KanbanFilterStrip value={filter} counts={counts} onChange={setFilter} />
      {view === "kanban" ? (
        <WycenyKanbanBoard
          quotes={quotes}
          setQuotes={setQuotes}
          filteredQuotes={filteredQuotes}
        />
      ) : (
        <WycenyList quotes={filteredQuotes} />
      )}
    </>
  );
}

function WycenyKanbanBoard({
  quotes,
  setQuotes,
  filteredQuotes,
}: {
  quotes: Quote[];
  setQuotes: (updater: (prev: Quote[]) => Quote[]) => void;
  filteredQuotes: Quote[];
}) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStatus = useMemo(() => {
    const map: Record<QuoteStatus, Quote[]> = {
      "Do zrobienia": [],
      "Kontakt z klientem": [],
      Pomiary: [],
      "Szykowanie produkcji": [],
      Zrobione: [],
    };
    filteredQuotes.forEach((q) => map[q.status].push(q));
    return map;
  }, [filteredQuotes]);

  const activeQuote = activeId ? quotes.find((q) => q.id === activeId) ?? null : null;

  const findContainer = (id: string): QuoteStatus | undefined => {
    if ((QUOTE_STATUSES as readonly string[]).includes(id)) return id as QuoteStatus;
    return quotes.find((q) => q.id === id)?.status;
  };

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    setQuotes((prev) => {
      const next = prev.filter((q) => q.id !== activeId);
      const moved = prev.find((q) => q.id === activeId);
      if (!moved) return prev;
      const updated: Quote = { ...moved, status: overContainer };

      const overIsColumn = (QUOTE_STATUSES as readonly string[]).includes(overId);
      if (overIsColumn) {
        return [...next, updated];
      }
      const overIndex = next.findIndex((q) => q.id === overId);
      if (overIndex === -1) return [...next, updated];
      return [...next.slice(0, overIndex), updated, ...next.slice(overIndex)];
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const container = findContainer(overId);
    if (!container) return;

    setQuotes((prev) => {
      const inContainer = prev.filter((q) => q.status === container);
      const others = prev.filter((q) => q.status !== container);
      const oldIndex = inContainer.findIndex((q) => q.id === activeId);
      const newIndex = inContainer.findIndex((q) => q.id === overId);
      if (oldIndex === -1) return prev;
      if (newIndex === -1) return prev;
      const reordered = arrayMove(inContainer, oldIndex, newIndex);
      return [...others, ...reordered];
    });
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="kanban-board">
        {QUOTE_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            color={QUOTE_STATUS_COLORS[status]}
            quotes={byStatus[status]}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeQuote ? <KanbanCardView quote={activeQuote} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanFilterStrip({
  value,
  counts,
  onChange,
}: {
  value: QuoteFilter;
  counts: Record<QuoteFilter, number>;
  onChange: (v: QuoteFilter) => void;
}) {
  return (
    <div className="kanban-filter-strip">
      {FILTERS.map((f) => {
        const active = value === f;
        const isMeta = f === "Wszystkie" || f === "Archiwum";
        const style = isMeta ? null : PROJECT_TYPE_STYLES[f];
        const metaActiveBg = f === "Wszystkie" ? "var(--accent-soft)" : "rgba(139, 148, 158, 0.18)";
        const metaActiveBorder = f === "Wszystkie" ? "var(--accent-line)" : "rgba(139, 148, 158, 0.6)";
        const metaActiveFg = f === "Wszystkie" ? "var(--text-accent)" : "#c9d1d9";
        const metaRail = f === "Wszystkie" ? "var(--accent-primary)" : "rgba(139, 148, 158, 0.7)";

        const activeStyle = active
          ? {
              background: style ? style.bg : metaActiveBg,
              borderColor: style ? style.border : metaActiveBorder,
              color: style ? style.fg : metaActiveFg,
            }
          : undefined;
        const railColor = style ? style.fg : metaRail;

        return (
          <button
            key={f}
            type="button"
            className={`kanban-filter-tile${active ? " active" : ""}${
              f === "Archiwum" ? " is-archive" : ""
            }`}
            style={activeStyle}
            onClick={() => onChange(f)}
            aria-pressed={active}
          >
            <span className="kanban-filter-tile-label">{f}</span>
            <span className="kanban-filter-tile-count">{counts[f]}</span>
            {!active && (
              <span
                className="kanban-filter-tile-rail"
                style={{ background: railColor }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function KanbanColumn({
  status,
  color,
  quotes,
}: {
  status: QuoteStatus;
  color: string;
  quotes: Quote[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ids = quotes.map((q) => q.id);
  return (
    <div className="kanban-column">
      <div className="kanban-column-header" style={{ color }}>
        {status} ({quotes.length})
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`kanban-column-body${isOver ? " is-over" : ""}`}
        >
          {quotes.map((q) => (
            <SortableKanbanCard key={q.id} quote={q} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableKanbanCard({ quote }: { quote: Quote }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: quote.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card${isDragging ? " is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isDragging) return;
        router.push(`/admin/wyceny/${quote.id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/admin/wyceny/${quote.id}`);
        }
      }}
    >
      <KanbanCardContent quote={quote} />
    </div>
  );
}

function KanbanCardView({ quote, overlay }: { quote: Quote; overlay?: boolean }) {
  return (
    <div className={`kanban-card${overlay ? " is-overlay" : ""}`}>
      <KanbanCardContent quote={quote} />
    </div>
  );
}

function KanbanCardContent({ quote }: { quote: Quote }) {
  const typeStyle = PROJECT_TYPE_STYLES[quote.projectType];
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  return (
    <>
      <div
        className="kanban-card-rail"
        style={{
          background: hasValue
            ? `linear-gradient(90deg, ${typeStyle.border}, transparent)`
            : `repeating-linear-gradient(90deg, ${typeStyle.border} 0 6px, transparent 6px 12px)`,
          opacity: hasValue ? 0.9 : 0.55,
        }}
      />
      <div className="kanban-card-head">
        <span
          className="kanban-chip kanban-chip-type"
          style={{
            background: typeStyle.bg,
            color: typeStyle.fg,
            borderColor: typeStyle.border,
          }}
        >
          <span
            className="kanban-chip-dot"
            style={{ background: typeStyle.fg }}
          />
          {quote.projectType}
        </span>
        <span className="kanban-card-id">{quote.id}</span>
      </div>
      <div className="kanban-card-client">{quote.contact.name}</div>
      {hasValue ? (
        <div className="kanban-card-value">
          <span className="kanban-card-value-num">
            {quote.value!.toLocaleString("pl-PL", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="kanban-card-value-unit">PLN</span>
        </div>
      ) : (
        <button
          type="button"
          className="kanban-card-value-empty"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <span className="kanban-card-value-empty-icon" aria-hidden>
            <I.plus s={12} sw={2.2} />
          </span>
          <span className="kanban-card-value-empty-label">Dodaj wycenę</span>
          <span className="kanban-card-value-empty-hint">brak kwoty</span>
        </button>
      )}
      <div className="kanban-card-footer">
        <span className={`kanban-chip kanban-chip-deadline tone-${tone}`}>
          <I.cal s={11} />
          {formatDeadline(quote.deadline)}
        </span>
        <div
          className="kanban-card-owner"
          title={quote.owner}
          aria-label={quote.owner}
        >
          <span className="kanban-card-owner-avatar">
            {ownerInitials(quote.owner)}
          </span>
        </div>
      </div>
    </>
  );
}

type SortColumn = "id" | "client" | "projectType" | "status" | "value" | "deadline" | "owner";
type SortState = { column: SortColumn; dir: "asc" | "desc" };

function WycenyList({ quotes }: { quotes: Quote[] }) {
  const [sort, setSort] = useState<SortState>({ column: "deadline", dir: "asc" });

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
          cmp = a.projectType.localeCompare(b.projectType, "pl");
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
          cmp = a.owner.localeCompare(b.owner, "pl");
          break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [quotes, sort]);

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
          label="Właściciel"
          column="owner"
          sort={sort}
          onSort={toggleSort}
          align="center"
        />
      </div>
      <div className="quote-list-body">
        {sortedQuotes.length === 0 ? (
          <div className="quote-list-empty">Brak wycen pasujących do filtra.</div>
        ) : (
          sortedQuotes.map((q) => <QuoteListRow key={q.id} quote={q} />)
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

function QuoteListRow({ quote }: { quote: Quote }) {
  const router = useRouter();
  const typeStyle = PROJECT_TYPE_STYLES[quote.projectType];
  const statusColor = QUOTE_STATUS_COLORS[quote.status];
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const go = () => router.push(`/admin/wyceny/${quote.id}`);
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
      <div className="quote-list-cell quote-list-cell-id">{quote.id}</div>
      <div className="quote-list-cell quote-list-cell-client">{quote.contact.name}</div>
      <div className="quote-list-cell">
        <span
          className="kanban-chip kanban-chip-type"
          style={{
            background: typeStyle.bg,
            color: typeStyle.fg,
            borderColor: typeStyle.border,
          }}
        >
          <span className="kanban-chip-dot" style={{ background: typeStyle.fg }} />
          {quote.projectType}
        </span>
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
          title={quote.owner}
          aria-label={quote.owner}
        >
          {ownerInitials(quote.owner)}
        </span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [wycenyView, setWycenyView] = useState<WycenyViewMode>("kanban");

  return (
    <>
      <WycenyRibbon
        view={wycenyView}
        onViewChange={setWycenyView}
        onNewQuote={() => router.push("/admin/wyceny/nowa")}
      />
      <main className="fluent-content">
        <WycenyView view={wycenyView} />
      </main>
    </>
  );
}


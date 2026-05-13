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
  type Quote,
  type QuoteStatus,
} from "./_lib/quotes";
import { setQuotes, useQuotes } from "./_lib/quotes-store";
import { RibbonBtn, RibbonGroup, RibbonToggleGroup } from "./_components/ribbon";
import {
  ProjectTypeFilterStrip,
  computeProjectTypeCounts,
  type ProjectTypeFilter,
} from "./_components/project-type-filter";
import { QuoteListView } from "./_components/quote-list";

type WycenyViewMode = "kanban" | "lista";

function WycenyRibbon({
  view,
  onViewChange,
  onNewQuote,
  onArchive,
}: {
  view: WycenyViewMode;
  onViewChange: (v: WycenyViewMode) => void;
  onNewQuote: () => void;
  onArchive: () => void;
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
        <RibbonBtn
          icon={<I.archive s={22} />}
          label="Archiwum"
          onClick={onArchive}
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

function WycenyView({ view }: { view: WycenyViewMode }) {
  const allQuotes = useQuotes();
  const quotes = useMemo(
    () => allQuotes.filter((q) => !q.archived),
    [allQuotes],
  );
  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");

  const counts = useMemo(() => computeProjectTypeCounts(quotes), [quotes]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return quotes;
    return quotes.filter((q) => q.projectType === filter);
  }, [quotes, filter]);

  return (
    <>
      <ProjectTypeFilterStrip value={filter} counts={counts} onChange={setFilter} />
      {view === "kanban" ? (
        <WycenyKanbanBoard
          quotes={quotes}
          setQuotes={setQuotes}
          filteredQuotes={filteredQuotes}
        />
      ) : (
        <QuoteListView quotes={filteredQuotes} />
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
      "Pomiary i uzgodnienia": [],
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
      <div className="kanban-card-client">{quote.contact.name}</div>
      <div className="kanban-card-footer">
        {hasValue ? (
          <div className="kanban-card-value">
            <span className="kanban-card-value-num">
              {quote.value!.toLocaleString("pl-PL", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
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
              <I.plus s={10} sw={2.2} />
            </span>
            <span className="kanban-card-value-empty-label">brak kwoty</span>
          </button>
        )}
        <span className={`kanban-chip kanban-chip-deadline tone-${tone}`}>
          <I.cal s={11} />
          {formatDeadline(quote.deadline)}
        </span>
      </div>
    </>
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
        onArchive={() => router.push("/admin/archiwum")}
      />
      <main className="fluent-content">
        <WycenyView view={wycenyView} />
      </main>
    </>
  );
}


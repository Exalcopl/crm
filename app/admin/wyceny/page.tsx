"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { I } from "../_lib/icons";
import {
  getProjectTypeStyle,
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  deadlineTone,
  formatDeadline,
  ownerInitials,
  type Quote,
  type QuoteStatus,
} from "../_lib/quotes";
import { OwnerNamesProvider, useOwnerName } from "../_lib/owner-names";
import { RibbonBtn, RibbonGroup, RibbonToggleGroup } from "../_components/ribbon";
import {
  ProjectTypeFilterStrip,
  computeProjectTypeCounts,
  type ProjectTypeFilter,
} from "../_components/project-type-filter";
import { QuoteListView } from "../_components/quote-list";

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
  const convexQuotes = useQuery(api.quotes.list) ?? [];
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const setStatusMutation = useMutation(api.quotes.setStatus);
  const [localQuotes, setLocalQuotes] = useState<Quote[]>([]);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) setLocalQuotes(convexQuotes as unknown as Quote[]);
  }, [convexQuotes]);

  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");
  const typeNames = useMemo(() => projectTypes.map((t) => t.name), [projectTypes]);
  const counts = useMemo(() => computeProjectTypeCounts(localQuotes, typeNames), [localQuotes, typeNames]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return localQuotes;
    return localQuotes.filter((q) => q.projectType.includes(filter));
  }, [localQuotes, filter]);

  function handleStatusChange(id: Id<"quotes">, status: QuoteStatus) {
    void setStatusMutation({ id, status });
  }

  return (
    <OwnerNamesProvider quotes={localQuotes}>
      <ProjectTypeFilterStrip allTypes={projectTypes} value={filter} counts={counts} onChange={setFilter} />
      {view === "kanban" ? (
        <WycenyKanbanBoard
          quotes={localQuotes}
          setQuotes={setLocalQuotes}
          filteredQuotes={filteredQuotes}
          onStatusChange={handleStatusChange}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={() => { isDraggingRef.current = false; }}
        />
      ) : (
        <QuoteListView quotes={filteredQuotes} />
      )}
    </OwnerNamesProvider>
  );
}

function WycenyKanbanBoard({
  quotes,
  setQuotes,
  filteredQuotes,
  onStatusChange,
  onDragStart,
  onDragEnd,
}: {
  quotes: Quote[];
  setQuotes: (updater: Quote[] | ((prev: Quote[]) => Quote[])) => void;
  filteredQuotes: Quote[];
  onStatusChange: (id: Id<"quotes">, status: QuoteStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
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
    onDragStart();
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
    onDragEnd();
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const container = findContainer(overId);
    if (!container) return;

    const movedQuote = quotes.find((q) => q.id === activeId);
    if (movedQuote && movedQuote.status !== container) {
      onStatusChange(movedQuote._id, container);
    }

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
      onDragCancel={() => { setActiveId(null); onDragEnd(); }}
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
        router.push(`/admin/wyceny/${encodeURIComponent(quote.id)}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/admin/wyceny/${encodeURIComponent(quote.id)}`);
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
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const primaryType = quote.projectType[0];
  const primaryStyle = primaryType ? getProjectTypeStyle(projectTypes, primaryType) : null;
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const ownerName = useOwnerName(quote);
  return (
    <>
      <div
        className="kanban-card-rail"
        style={
          primaryStyle
            ? {
                background: hasValue
                  ? `linear-gradient(90deg, ${primaryStyle.border}, transparent)`
                  : `repeating-linear-gradient(90deg, ${primaryStyle.border} 0 6px, transparent 6px 12px)`,
                opacity: hasValue ? 0.9 : 0.55,
              }
            : undefined
        }
      />
      <div className="kanban-card-head">
        <span className="kanban-card-id">{quote.id}</span>
        <div
          className="kanban-card-owner"
          title={ownerName}
          aria-label={ownerName}
        >
          <span className="kanban-card-owner-avatar">
            {ownerInitials(ownerName)}
          </span>
        </div>
      </div>
      <div className="kanban-card-types">
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

export default function WycenyPage() {
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


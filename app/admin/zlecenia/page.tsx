"use client";

import { useState, useMemo, useEffect, useRef, useId } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup, RibbonToggleGroup } from "../_components/ribbon";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  getProjectTypeStyle,
  deadlineTone,
  formatDeadline,
  ownerInitials,
} from "../_lib/quotes";
import { UserFilterBar } from "../_components/user-filter-bar";
import {
  ProjectTypeFilterStrip,
  computeProjectTypeCounts,
  type ProjectTypeFilter,
} from "../_components/project-type-filter";

type ZleceniaViewMode = "kanban" | "lista";
type OrderStatus = "nowe" | "akceptacja" | "kompletacja" | "produkcja" | "montaz" | "gotowe" | "wstrzymane";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  nowe: { label: "Nowe", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  akceptacja: { label: "Akceptacja", color: "#8250df", bg: "rgba(130, 80, 223, 0.15)" },
  kompletacja: { label: "W kompletacji", color: "#f0883e", bg: "rgba(240, 136, 62, 0.15)" },
  produkcja: { label: "W produkcji", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  montaz: { label: "Do montażu", color: "#d29922", bg: "rgba(210, 153, 34, 0.15)" },
  gotowe: { label: "Zrealizowane", color: "#3fb950", bg: "rgba(63, 185, 80, 0.15)" },
  wstrzymane: { label: "Wstrzymane", color: "#8b949e", bg: "rgba(139, 148, 158, 0.15)" },
};

function formatCurrency(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function ZleceniaRibbon({
  view,
  onViewChange,
}: {
  view: ZleceniaViewMode;
  onViewChange: (v: ZleceniaViewMode) => void;
}) {
  const router = useRouter();
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn
          icon={<I.plus s={22} />}
          label="Nowe zlecenie"
          onClick={() => {
            router.push("/admin/zlecenia/nowe");
          }}
        />
        <RibbonBtn
          icon={<I.archive s={22} />}
          label="Archiwum"
          onClick={() => {
            router.push("/admin/archiwum?tab=zlecenia");
          }}
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

export default function ZleceniaPage() {
  const [view, setView] = useState<ZleceniaViewMode>("kanban");
  const convexOrders = useQuery(api.orders.list) ?? [];
  const quotes = useQuery(api.quotes.list) ?? [];
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const allUsersRaw = useQuery(api.users.listAllAssignable) ?? [];
  
  const updateOrderStatus = useMutation(api.orders.updateStatus);

  const [localOrders, setLocalOrders] = useState<any[]>([]);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) setLocalOrders(convexOrders);
  }, [convexOrders]);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const currentUserId = allUsersRaw.find((u: any) => u.isCurrentUser)?._id;
  const allUsers = useMemo(() => {
    return [...allUsersRaw].sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return (a.name || a.email || "").localeCompare(b.name || b.email || "");
    });
  }, [allUsersRaw]);

  const quotesMap = useMemo(() => new Map<Id<"quotes">, Doc<"quotes">>(quotes.map((q: Doc<"quotes">) => [q._id, q])), [quotes]);
  const usersMap = useMemo(() => new Map<Id<"users">, string>(allUsersRaw.map((u: any) => [u._id, u.name || u.email || ""])), [allUsersRaw]);

  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");

  const ordersWithTypes = useMemo(() => {
    return localOrders.map((o) => {
      const q = o.quoteId ? quotesMap.get(o.quoteId) : undefined;
      return {
        ...o,
        projectType: o.projectType || q?.projectType || [],
      };
    });
  }, [localOrders, quotesMap]);

  const typeNames = useMemo(() => projectTypes.map((t) => t.name), [projectTypes]);
  const counts = useMemo(() => computeProjectTypeCounts(ordersWithTypes, typeNames), [ordersWithTypes, typeNames]);

  const filteredOrders = useMemo(() => {
    return ordersWithTypes.filter((o) => {
      const matchesUser = selectedUserIds.length === 0 || (o.ownerId && selectedUserIds.includes(o.ownerId));
      const matchesType = filter === "Wszystkie" || o.projectType.includes(filter);

      return matchesUser && matchesType;
    });
  }, [ordersWithTypes, selectedUserIds, filter]);

  async function handleStatusChange(id: Id<"orders">, status: OrderStatus) {
    try {
      await updateOrderStatus({ id, status });
      toast.success("Zmieniono status zlecenia");
    } catch (err: any) {
      toast.error(err.message || "Błąd podczas zmiany statusu");
    }
  }

  return (
    <>
      <ZleceniaRibbon view={view} onViewChange={setView} />
      <ProjectTypeFilterStrip allTypes={projectTypes} value={filter} counts={counts} onChange={setFilter} />
      <main className="fluent-content" style={{ display: "flex", flexDirection: "column", gap: 14 }}>


        {view === "kanban" ? (
          <ZleceniaKanbanBoard
            orders={localOrders}
            setOrders={setLocalOrders}
            filteredOrders={filteredOrders}
            onStatusChange={handleStatusChange}
            projectTypes={projectTypes}
            quotesMap={quotesMap}
            usersMap={usersMap}
            allUsers={allUsers}
            selectedUserIds={selectedUserIds}
            setSelectedUserIds={setSelectedUserIds}
            currentUserId={currentUserId}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => { isDraggingRef.current = false; }}
          />
        ) : (
          <div style={{ padding: "0 16px" }}>
            <UserFilterBar
              users={allUsers as any}
              selectedUserIds={selectedUserIds}
              currentUserId={currentUserId}
              onToggle={(id) => {
                setSelectedUserIds((prev) =>
                  prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
                );
              }}
              label="Filtruj przypisane zlecenia"
              variant="chip"
            />
            <div className="qvm-items-wrap" style={{ border: "1px solid #30363d", borderRadius: 8, overflow: "hidden", marginTop: 14 }}>
              <table className="qvm-items-table">
                <thead>
                  <tr>
                    <th className="qvm-th">Numer zlecenia</th>
                    <th className="qvm-th">Klient</th>
                    <th className="qvm-th">Wartość netto</th>
                    <th className="qvm-th">Produkcja</th>
                    <th className="qvm-th">Status</th>
                    <th className="qvm-th" style={{ width: 100 }}>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#8b949e" }}>
                        Brak zleceń do wyświetlenia
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order._id} className="qvm-tr">
                        <td className="qvm-td" style={{ fontWeight: 600 }}>
                          <Link href={`/admin/zlecenia/${order._id}`} style={{ color: "#58a6ff", textDecoration: "none" }}>
                            {order.orderNumber}
                          </Link>
                          {(() => {
                            const q = quotesMap.get(order.quoteId);
                            const label = order.customLabel || q?.customLabel;
                            if (!label) return null;
                            return (
                              <div style={{ marginTop: 2 }}>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                    color: "var(--accent-primary)",
                                    background: "var(--accent-soft)",
                                    border: "1px solid var(--accent-line)",
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                    display: "inline-block"
                                  }}
                                >
                                  🏷️ {label}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="qvm-td">
                          <div>{order.clientName}</div>
                          <div style={{ fontSize: 11, color: "#8b949e" }}>{order.clientPhone || order.clientEmail}</div>
                        </td>
                        <td className="qvm-td">{formatCurrency(order.valueNetto)}</td>

                        <td className="qvm-td" style={{ fontSize: 11 }}>
                          {order.productionStartDate || order.productionEndDate ? (
                            `${order.productionStartDate ? formatDeadline(order.productionStartDate) : "—"} do ${order.productionEndDate ? formatDeadline(order.productionEndDate) : "—"}`
                          ) : order.deadline ? (
                            formatDeadline(order.deadline)
                          ) : "—"}
                        </td>
                        <td className="qvm-td">
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 600,
                              background: STATUS_CONFIG[order.status as OrderStatus].bg,
                              color: STATUS_CONFIG[order.status as OrderStatus].color,
                            }}
                          >
                            {STATUS_CONFIG[order.status as OrderStatus].label}
                          </span>
                        </td>
                        <td className="qvm-td">
                          <select
                            value={order.status}
                            onChange={(e) => void handleStatusChange(order._id, e.target.value as OrderStatus)}
                            style={{
                              padding: "4px 8px",
                              background: "#0d1117",
                              border: "1px solid #30363d",
                              borderRadius: 4,
                              color: "white",
                              outline: "none",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {Object.entries(STATUS_CONFIG).map(([k, val]) => (
                              <option key={k} value={k}>
                                {val.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function ZleceniaKanbanBoard({
  orders,
  setOrders,
  filteredOrders,
  onStatusChange,
  projectTypes,
  quotesMap,
  usersMap,
  allUsers,
  selectedUserIds,
  setSelectedUserIds,
  currentUserId,
  onDragStart,
  onDragEnd,
}: {
  orders: any[];
  setOrders: (updater: any[] | ((prev: any[]) => any[])) => void;
  filteredOrders: any[];
  onStatusChange: (id: Id<"orders">, status: OrderStatus) => void;
  projectTypes: any[];
  quotesMap: Map<string, any>;
  usersMap: Map<string, string>;
  allUsers: any[];
  selectedUserIds: string[];
  setSelectedUserIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  currentUserId?: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const originalStatusRef = useRef<OrderStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStatus = useMemo(() => {
    const map: Record<OrderStatus, any[]> = {
      nowe: [],
      akceptacja: [],
      kompletacja: [],
      produkcja: [],
      montaz: [],
      gotowe: [],
      wstrzymane: [],
    };
    filteredOrders.forEach((o) => {
      if (map[o.status as OrderStatus]) {
        map[o.status as OrderStatus].push(o);
      }
    });
    return map;
  }, [filteredOrders]);

  const activeOrder = activeId ? orders.find((o) => o._id === activeId) ?? null : null;

  const findContainer = (id: string): OrderStatus | undefined => {
    const statuses = Object.keys(STATUS_CONFIG) as OrderStatus[];
    if (statuses.includes(id as OrderStatus)) return id as OrderStatus;
    return orders.find((o) => o._id === id)?.status;
  };

  function handleDragStart(e: DragStartEvent) {
    const actId = String(e.active.id);
    setActiveId(actId);
    onDragStart();
    const found = orders.find((o) => o._id === actId);
    if (found) {
      originalStatusRef.current = found.status;
    }
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

    setOrders((prev) => {
      const next = prev.filter((o) => o._id !== activeId);
      const moved = prev.find((o) => o._id === activeId);
      if (!moved) return prev;
      const updated = { ...moved, status: overContainer };

      const statuses = Object.keys(STATUS_CONFIG) as OrderStatus[];
      const overIsColumn = statuses.includes(overId as OrderStatus);
      if (overIsColumn) {
        return [...next, updated];
      }
      const overIndex = next.findIndex((o) => o._id === overId);
      if (overIndex === -1) return [...next, updated];
      return [...next.slice(0, overIndex), updated, ...next.slice(overIndex)];
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    onDragEnd();

    const originalStatus = originalStatusRef.current;
    originalStatusRef.current = null;

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const container = findContainer(overId);
    if (!container) return;

    const movedOrder = orders.find((o) => o._id === activeId);
    if (movedOrder && originalStatus && originalStatus !== container) {
      onStatusChange(movedOrder._id, container);
    }

    if (activeId === overId) return;

    setOrders((prev) => {
      const inContainer = prev.filter((o) => o.status === container);
      const others = prev.filter((o) => o.status !== container);
      const oldIndex = inContainer.findIndex((o) => o._id === activeId);
      const newIndex = inContainer.findIndex((o) => o._id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
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
      onDragCancel={() => {
        setActiveId(null);
        onDragEnd();
        originalStatusRef.current = null;
      }}
    >
      <div style={{ padding: "0 16px" }}>
        <UserFilterBar
          users={allUsers as any}
          selectedUserIds={selectedUserIds}
          currentUserId={currentUserId}
          onToggle={(id) => {
            setSelectedUserIds((prev) =>
              prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
            );
          }}
          label="Filtruj przypisane zlecenia"
          variant="chip"
        />
      </div>
      <div className="kanban-board">
        {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            color={STATUS_CONFIG[status].color}
            orders={byStatus[status]}
            projectTypes={projectTypes}
            quotesMap={quotesMap}
            usersMap={usersMap}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeOrder ? (
          <KanbanCardView
            order={activeOrder}
            projectTypes={projectTypes}
            quotesMap={quotesMap}
            usersMap={usersMap}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  color,
  orders,
  projectTypes,
  quotesMap,
  usersMap,
}: {
  status: OrderStatus;
  color: string;
  orders: any[];
  projectTypes: any[];
  quotesMap: Map<string, any>;
  usersMap: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ids = orders.map((o) => o._id);
  return (
    <div className="kanban-column">
      <div className="kanban-column-header" style={{ color }}>
        {STATUS_CONFIG[status].label} ({orders.length})
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`kanban-column-body${isOver ? " is-over" : ""}`}
        >
          {orders.map((o) => (
            <SortableKanbanCard
              key={o._id}
              order={o}
              projectTypes={projectTypes}
              quotesMap={quotesMap}
              usersMap={usersMap}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableKanbanCard({
  order,
  projectTypes,
  quotesMap,
  usersMap,
}: {
  order: any;
  projectTypes: any[];
  quotesMap: Map<string, any>;
  usersMap: Map<string, string>;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order._id });

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
        router.push(`/admin/zlecenia/${order._id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/admin/zlecenia/${order._id}`);
        }
      }}
    >
      <KanbanCardContent
        order={order}
        projectTypes={projectTypes}
        quotesMap={quotesMap}
        usersMap={usersMap}
      />
    </div>
  );
}

function KanbanCardView({
  order,
  projectTypes,
  quotesMap,
  usersMap,
  overlay,
}: {
  order: any;
  projectTypes: any[];
  quotesMap: Map<string, any>;
  usersMap: Map<string, string>;
  overlay?: boolean;
}) {
  return (
    <div className={`kanban-card${overlay ? " is-overlay" : ""}`}>
      <KanbanCardContent
        order={order}
        projectTypes={projectTypes}
        quotesMap={quotesMap}
        usersMap={usersMap}
      />
    </div>
  );
}

function KanbanCardContent({
  order,
  projectTypes,
  quotesMap,
  usersMap,
}: {
  order: any;
  projectTypes: any[];
  quotesMap: Map<string, any>;
  usersMap: Map<string, string>;
}) {
  const quote = quotesMap.get(order.quoteId);
  const projectType = order.projectType && order.projectType.length > 0 ? order.projectType : (quote?.projectType || []);
  const primaryType = projectType[0];
  const primaryStyle = primaryType ? getProjectTypeStyle(projectTypes, primaryType) : null;
  const targetDate = order.productionEndDate || order.deadline;
  const tone = deadlineTone(targetDate);
  const ownerName = order.ownerId ? usersMap.get(order.ownerId) || "" : "";

  return (
    <>
      <div
        className="kanban-card-rail"
        style={
          primaryStyle
            ? {
                background: `linear-gradient(90deg, ${primaryStyle.border}, transparent)`,
                opacity: 0.9,
              }
            : undefined
        }
      />
      <div className="kanban-card-head" style={{ flexWrap: "wrap", gap: "6px" }}>
        <span className="kanban-card-id" style={{ color: "#58a6ff" }}>{order.orderNumber}</span>
        {(() => {
          const label = order.customLabel || quote?.customLabel;
          if (!label) return null;
          return (
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
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "120px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
              }}
              title={label}
            >
              🏷️ {label}
            </span>
          );
        })()}
        {ownerName && (
          <div
            className="kanban-card-owner"
            title={ownerName}
            aria-label={ownerName}
          >
            <span className="kanban-card-owner-avatar">
              {ownerInitials(ownerName)}
            </span>
          </div>
        )}
      </div>
      <div className="kanban-card-types">
        {projectType.map((t: string) => {
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
      <div className="kanban-card-client">{order.clientName}</div>
      <div className="kanban-card-footer">
        <div className="kanban-card-value">
          <span className="kanban-card-value-num">
            {order.valueNetto.toLocaleString("pl-PL", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
          <span className="kanban-card-value-unit">PLN</span>
        </div>
      </div>
    </>
  );
}

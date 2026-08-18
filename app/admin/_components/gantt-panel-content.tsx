"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { BarChart3, ChevronLeft, ChevronRight, Plus, Search, Calendar, Landmark, User, Clock, UserCheck, Coins } from "lucide-react";
import { useMemo } from "react";

// timezone-agnostic date helpers
function formatDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getDaysDiff(startStr: string, endStr: string): number {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function formatTooltipDate(dateStr: string): string {
  if (!dateStr) return "—";
  const dateObj = new Date(dateStr + "T00:00:00");
  return dateObj.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł";
}

interface DragState {
  type: "move" | "resize-start" | "resize-end";
  orderId: Id<"orders">;
  startX: number;
  initialStart: string;
  initialEnd: string;
}

export function GanttPanelContent({
  onClose,
  onOpenOrder,
}: {
  onClose: () => void;
  onOpenOrder: (id: Id<"orders">) => void;
}) {
  const orders = useQuery(api.orders.list) ?? [];
  const quotes = useQuery(api.quotes.list) ?? [];
  const updateDates = useMutation(api.orders.updateDates);
  const projectTypes = useQuery(api.projectTypes.list) ?? [];
  const allUsers = useQuery(api.users.listAllAssignable) ?? [];
  const usersMap = useMemo(() => new Map(allUsers.map((u: any) => [u._id, u.name])), [allUsers]);

  const quotesMap = useMemo(() => new Map(quotes.map((q: any) => [q._id, q])), [quotes]);

  // Filter only production orders and resolve projectTypes from quote/order in a robust way
  const productionOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === "produkcja")
      .map((o) => {
        const q = o.quoteId ? quotesMap.get(o.quoteId) : undefined;
        
        let resolvedTypes: string[] = [];
        if (Array.isArray(o.projectType)) {
          resolvedTypes = o.projectType;
        } else if (typeof o.projectType === "string" && o.projectType) {
          resolvedTypes = [o.projectType];
        } else if (q && Array.isArray(q.projectType)) {
          resolvedTypes = q.projectType;
        } else if (q && typeof q.projectType === "string" && q.projectType) {
          resolvedTypes = [q.projectType];
        }

        return {
          ...o,
          projectType: resolvedTypes,
        };
      });
  }, [orders, quotesMap]);

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hoveredOrder, setHoveredOrder] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [timelineStart, setTimelineStart] = useState(() => {
    // Default to 5 days before today
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return formatDateStr(d);
  });

  const [drag, setDrag] = useState<DragState | null>(null);
  const [localDates, setLocalDates] = useState<Record<string, { start: string; end: string }>>({});
  const [isMutatingId, setIsMutatingId] = useState<Id<"orders"> | null>(null);

  // Sync DB dates to local drag dates when orders list changes, preserving active drag/mutating states
  useEffect(() => {
    const dates: Record<string, { start: string; end: string }> = {};
    for (const order of productionOrders) {
      const isUserInteracting = (drag && drag.orderId === order._id) || (isMutatingId === order._id);
      if (isUserInteracting && localDates[order._id]) {
        dates[order._id] = localDates[order._id];
      } else if (order.productionStartDate && order.productionEndDate) {
        dates[order._id] = {
          start: order.productionStartDate,
          end: order.productionEndDate,
        };
      }
    }
    setLocalDates(dates);
  }, [orders, drag, isMutatingId]);

  // Generate 30 days of timeline
  const days: { dateStr: string; label: string; dayNum: number; isWeekend: boolean; isToday: boolean }[] = [];
  const todayStr = formatDateStr(new Date());
  for (let i = 0; i < 30; i++) {
    const currentStr = addDays(timelineStart, i);
    const dateObj = new Date(currentStr + "T00:00:00");
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = currentStr === todayStr;
    const weekdayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
    days.push({
      dateStr: currentStr,
      label: weekdayNames[dayOfWeek],
      dayNum: dateObj.getDate(),
      isWeekend,
      isToday,
    });
  }

  // Calculate daily load (capacity)
  const dayCapacity: Record<string, number> = {};
  for (const day of days) {
    let count = 0;
    for (const order of productionOrders) {
      const dates = localDates[order._id] || (order.productionStartDate && order.productionEndDate ? { start: order.productionStartDate, end: order.productionEndDate } : null);
      if (dates && day.dateStr >= dates.start && day.dateStr <= dates.end) {
        count++;
      }
    }
    dayCapacity[day.dateStr] = count;
  }

  const getCapacityColor = (count: number) => {
    if (count >= 5) return { bg: "rgba(239, 68, 68, 0.12)", text: "#f85149", badge: "#ef4444", label: "Przeciążenie" };
    if (count >= 3) return { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b", badge: "#f59e0b", label: "Wysokie" };
    if (count >= 1) return { bg: "rgba(63, 185, 80, 0.08)", text: "#3fb950", badge: "#3fb950", label: "Niskie" };
    return { bg: "transparent", text: "#8b949e", badge: "transparent", label: "Pusto" };
  };

  // Helper to calculate maximum concurrency for an order's range
  const getMaxConcurrency = (startStr: string, endStr: string) => {
    let maxCount = 0;
    const startD = new Date(startStr + "T00:00:00");
    const endD = new Date(endStr + "T00:00:00");
    const tempD = new Date(startD);
    while (tempD <= endD) {
      const dateStr = tempD.toISOString().split("T")[0];
      let count = 0;
      for (const o of productionOrders) {
        const oDates = localDates[o._id] || (o.productionStartDate && o.productionEndDate ? { start: o.productionStartDate, end: o.productionEndDate } : null);
        if (oDates && dateStr >= oDates.start && dateStr <= oDates.end) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
      }
      tempD.setDate(tempD.getDate() + 1);
    }
    return maxCount;
  };

  // Filter orders by search term and selected project types
  const filteredOrders = productionOrders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.clientName.toLowerCase().includes(search.toLowerCase());

    if (selectedTypes.length === 0) return matchesSearch;

    const orderTypes = o.projectType || [];
    return matchesSearch && orderTypes.some((t: string) => selectedTypes.includes(t));
  });

  // Group orders by clientName
  const grouped: Record<string, typeof filteredOrders> = {};
  for (const o of filteredOrders) {
    if (!grouped[o.clientName]) {
      grouped[o.clientName] = [];
    }
    grouped[o.clientName].push(o);
  }

  const sortedClients = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  interface RowItem {
    type: "client" | "order";
    clientName: string;
    order?: typeof filteredOrders[0];
  }

  const rows: RowItem[] = [];
  for (const clientName of sortedClients) {
    rows.push({ type: "client", clientName });
    const clientOrders = grouped[clientName].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    for (const order of clientOrders) {
      rows.push({ type: "order", clientName, order });
    }
  }

  // Time navigation
  const shiftTimeline = (amount: number) => {
    setTimelineStart((prev) => addDays(prev, amount));
  };

  const jumpToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    setTimelineStart(formatDateStr(d));
  };

  // Schedule default ranges for unplanned orders
  const handleScheduleDefault = async (orderId: Id<"orders">) => {
    const start = todayStr;
    const end = addDays(start, 3); // 3 days default duration
    try {
      await updateDates({ id: orderId, productionStartDate: start, productionEndDate: end });
      toast.success("Zlecenie zaplanowane (domyślnie 3 dni)");
    } catch (e) {
      toast.error("Błąd planowania zlecenia");
    }
  };

  // Drag handlers
  const handleMouseDown = (
    e: React.MouseEvent,
    type: "move" | "resize-start" | "resize-end",
    orderId: Id<"orders">
  ) => {
    e.preventDefault();
    const dates = localDates[orderId];
    if (!dates) return;

    setDrag({
      type,
      orderId,
      startX: e.clientX,
      initialStart: dates.start,
      initialEnd: dates.end,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const dayWidth = 40; // matches width of col in px

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - drag.startX;
      const deltaDays = Math.round(deltaX / dayWidth);

      let newStart = drag.initialStart;
      let newEnd = drag.initialEnd;

      if (drag.type === "move") {
        newStart = addDays(drag.initialStart, deltaDays);
        newEnd = addDays(drag.initialEnd, deltaDays);
      } else if (drag.type === "resize-start") {
        newStart = addDays(drag.initialStart, deltaDays);
        if (newStart > drag.initialEnd) {
          newStart = drag.initialEnd;
        }
      } else if (drag.type === "resize-end") {
        newEnd = addDays(drag.initialEnd, deltaDays);
        if (newEnd < drag.initialStart) {
          newEnd = drag.initialStart;
        }
      }

      const current = localDates[drag.orderId];
      if (current && current.start === newStart && current.end === newEnd) {
        return;
      }

      const dates = { ...localDates };
      dates[drag.orderId] = { start: newStart, end: newEnd };
      setLocalDates(dates);
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const finalDates = localDates[drag.orderId];
      const mutatingId = drag.orderId;
      setIsMutatingId(mutatingId);
      setDrag(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (finalDates && (finalDates.start !== drag.initialStart || finalDates.end !== drag.initialEnd)) {
        try {
          await updateDates({
            id: mutatingId,
            productionStartDate: finalDates.start,
            productionEndDate: finalDates.end,
          });
          toast.success("Zaktualizowano termin produkcji");
        } catch (err) {
          // Revert to initial dates on failure
          setLocalDates(prev => ({
            ...prev,
            [mutatingId]: { start: drag.initialStart, end: drag.initialEnd }
          }));
          toast.error("Błąd aktualizacji terminu produkcji");
        } finally {
          setIsMutatingId(null);
        }
      } else {
        setIsMutatingId(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drag, localDates, updateDates, isMutatingId]);

  // Layout parameters
  const leftColWidth = 320;
  const dayWidth = 40;
  const rowHeight = 44;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117", color: "#c9d1d9" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #30363d", background: "#161b22" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart3 style={{ color: "#f59e0b", transform: "rotate(90deg)" }} size={20} />
          <span style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc" }}>Harmonogram Produkcji</span>
          <span style={{ background: "#21262d", color: "#8b949e", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
            {productionOrders.length} zlecenia w produkcji
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 18 }}
          title="Zamknij"
        >
          ✕
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid #30363d", background: "#0d1117", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161b22", borderRadius: 6, padding: "4px 10px", border: "1px solid #30363d", width: 260 }}>
            <Search size={14} style={{ color: "#8b949e" }} />
            <input
              type="text"
              placeholder="Szukaj zlecenia, klienta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: "transparent", border: "none", color: "white", outline: "none", fontSize: 13, width: "100%" }}
            />
          </div>

          {/* Project Type Filter Chips */}
          {projectTypes.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 500 }}>Typ projektu:</span>
              {projectTypes.map((type) => {
                const isActive = selectedTypes.includes(type.name);
                return (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => {
                      setSelectedTypes(prev => 
                        prev.includes(type.name) 
                          ? prev.filter(t => t !== type.name) 
                          : [...prev, type.name]
                      );
                    }}
                    style={{
                      background: isActive ? type.color || "#2563eb" : "#21262d",
                      color: isActive ? "#ffffff" : "#c9d1d9",
                      border: `1px solid ${isActive ? "transparent" : "#30363d"}`,
                      borderRadius: 12,
                      padding: "2px 10px",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.2s"
                    }}
                  >
                    {type.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => shiftTimeline(-7)}
            className="gantt-tool-btn"
            title="Poprzedni tydzień"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#21262d", border: "1px solid #30363d", borderRadius: 4, width: 28, height: 28, cursor: "pointer", color: "white" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={jumpToToday}
            className="gantt-tool-btn"
            style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 4, padding: "4px 12px", cursor: "pointer", color: "white", fontSize: 12, fontWeight: 500 }}
          >
            Dzisiaj
          </button>
          <button
            type="button"
            onClick={() => shiftTimeline(7)}
            className="gantt-tool-btn"
            title="Następny tydzień"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#21262d", border: "1px solid #30363d", borderRadius: 4, width: 28, height: 28, cursor: "pointer", color: "white" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Capacity Legend Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 24px", background: "#161b22", borderBottom: "1px solid #30363d", fontSize: 11, color: "#8b949e", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "#c9d1d9" }}>Kolory pasków (Obciążenie terminu):</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)" }} />
          <span>Zielone: 1-2 zlecenia równolegle (Optymalne)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 1px 3px rgba(245, 158, 11, 0.3)" }} />
          <span>Pomarańczowe: 3-4 zlecenia równolegle (Wysokie)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f85149 0%, #da3633 100%)", boxShadow: "0 1px 3px rgba(248, 81, 73, 0.3)" }} />
          <span>Czerwone: 5+ zleceń równolegle (Przeciążenie)</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Unified Table-Chart Wrapper */}
        <div style={{ flex: 1, display: "flex", overflow: "auto", position: "relative" }}>
          
          {/* Left Columns (Fixed Side) */}
          <div style={{ width: leftColWidth, flexShrink: 0, borderRight: "1px solid #30363d", background: "#161b22", zIndex: 3, position: "sticky", left: 0 }}>
            {/* Header Row */}
            <div style={{ height: 50, borderBottom: "2px solid #30363d", display: "flex", alignItems: "center", padding: "0 16px", fontWeight: 600, fontSize: 12, color: "#8b949e", textTransform: "uppercase" }}>
              Zlecenie / Klient
            </div>

            {/* Grouped Client and Order Rows */}
            {rows.map((row, idx) => {
              if (row.type === "client") {
                return (
                  <div
                    key={`client-${row.clientName}-${idx}`}
                    style={{
                      height: 28,
                      background: "#0d1117",
                      borderBottom: "1px solid #30363d",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#f0f6fc",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    🏢 {row.clientName}
                  </div>
                );
              }

              const order = row.order!;
              const isPlanned = !!(localDates[order._id] || (order.productionStartDate && order.productionEndDate));

              if (isPlanned) {
                return (
                  <div
                    key={order._id}
                    onClick={() => onOpenOrder(order._id)}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "0 16px",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#21262d")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#58a6ff" }}>{order.orderNumber}</span>
                      <span style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={10} />
                        {localDates[order._id] 
                          ? `${getDaysDiff(localDates[order._id].start, localDates[order._id].end) + 1} dni`
                          : "—"
                        }
                      </span>
                    </div>
                    {order.projectType && order.projectType.length > 0 && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
                        {order.projectType.map((t: string) => (
                          <span key={t} style={{ fontSize: 9, color: "#8b949e" }}>· {t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div
                    key={order._id}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 16px",
                    }}
                  >
                    <div onClick={() => onOpenOrder(order._id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#8b949e" }}>{order.orderNumber}</div>
                      <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic" }}>
                        Brak daty produkcji
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleScheduleDefault(order._id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#21262d",
                        border: "1px solid #30363d",
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                        color: "#f0f6fc",
                        fontSize: 11,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#f59e0b";
                        e.currentTarget.style.color = "#f59e0b";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#30363d";
                        e.currentTarget.style.color = "#f0f6fc";
                      }}
                    >
                      <Plus size={11} /> Zaplanuj
                    </button>
                  </div>
                );
              }
            })}

            {/* Empty state */}
            {filteredOrders.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#8b949e", fontSize: 12 }}>
                Brak zleceń w produkcji.
              </div>
            )}
          </div>

          {/* Right Gantt Chart Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
            
            {/* Timeline Headers */}
            <div style={{ display: "flex", height: 50, borderBottom: "2px solid #30363d", background: "#161b22", position: "sticky", top: 0, zIndex: 2 }}>
              {days.map((day) => {
                const loadCount = dayCapacity[day.dateStr] || 0;
                const cap = getCapacityColor(loadCount);
                return (
                  <div
                    key={day.dateStr}
                    style={{
                      width: dayWidth,
                      flexShrink: 0,
                      borderRight: "1px solid #21262d",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: day.isToday 
                        ? "rgba(245, 158, 11, 0.15)" 
                        : day.isWeekend 
                        ? "#0d1117" 
                        : cap.bg !== "transparent"
                        ? cap.bg
                        : "transparent",
                      color: day.isToday ? "#f59e0b" : day.isWeekend ? "#8b949e" : "#c9d1d9",
                      position: "relative"
                    }}
                    title={`${day.dateStr}: ${loadCount} ${loadCount === 1 ? "zlecenie" : loadCount < 5 ? "zlecenia" : "zleceń"} w produkcji (${cap.label})`}
                  >
                    <span style={{ fontSize: 9, textTransform: "uppercase" }}>{day.label}</span>
                    <span style={{ fontSize: 13, fontWeight: day.isToday ? 700 : 500 }}>{day.dayNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Timeline Grid Rows & Bars */}
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              
              {/* Today Vertical Line Indicator */}
              {(() => {
                const todayIndex = days.findIndex((d) => d.isToday);
                if (todayIndex !== -1) {
                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: todayIndex * dayWidth + (dayWidth / 2) - 1,
                        width: 2,
                        background: "#ef4444",
                        boxShadow: "0 0 8px #ef4444",
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    />
                  );
                }
                return null;
              })()}

              {/* Grouped Client and Order Grid Rows */}
              {rows.map((row, idx) => {
                if (row.type === "client") {
                  return (
                    <div
                      key={`grid-client-${row.clientName}-${idx}`}
                      style={{
                        height: 28,
                        background: "#0d1117",
                        borderBottom: "1px solid #30363d",
                        display: "flex",
                        position: "relative",
                      }}
                    >
                      {days.map((day) => {
                        const loadCount = dayCapacity[day.dateStr] || 0;
                        const cap = getCapacityColor(loadCount);
                        return (
                          <div
                            key={day.dateStr}
                            style={{
                              width: dayWidth,
                              height: "100%",
                              flexShrink: 0,
                              borderRight: "1px solid #21262d",
                              background: day.isWeekend 
                                ? "#0d1117" 
                                : cap.bg !== "transparent"
                                ? cap.bg
                                : "transparent",
                              pointerEvents: "none",
                              opacity: 0.4
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                }

                const order = row.order!;
                const dates = localDates[order._id];
                let barStyle: React.CSSProperties | null = null;

                if (dates) {
                  const startOffsetDays = getDaysDiff(timelineStart, dates.start);
                  const durationDays = getDaysDiff(dates.start, dates.end) + 1;
                  const left = startOffsetDays * dayWidth;
                  const width = durationDays * dayWidth;

                  const maxConcurrency = getMaxConcurrency(dates.start, dates.end);
                  let barGradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // Green (Niskie)
                  let barShadow = "0 2px 8px rgba(16, 185, 129, 0.3)";

                  if (maxConcurrency >= 5) {
                    barGradient = "linear-gradient(135deg, #f85149 0%, #da3633 100%)"; // Red (Przeciążenie)
                    barShadow = "0 2px 8px rgba(248, 81, 73, 0.4)";
                  } else if (maxConcurrency >= 3) {
                    barGradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"; // Orange (Wysokie)
                    barShadow = "0 2px 8px rgba(245, 158, 11, 0.3)";
                  }

                  barStyle = {
                    position: "absolute",
                    left: left,
                    width: width,
                    height: 26,
                    top: 9,
                    borderRadius: 4,
                    background: barGradient,
                    boxShadow: barShadow,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 10px",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "grab",
                    userSelect: "none",
                    zIndex: 1,
                    transition: drag?.orderId === order._id ? "none" : "left 0.1s, width 0.1s",
                  };
                }

                return (
                  <div
                    key={`grid-order-${order._id}`}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      position: "relative",
                    }}
                  >
                    {/* Background day columns styling */}
                    {days.map((day) => {
                      const loadCount = dayCapacity[day.dateStr] || 0;
                      const cap = getCapacityColor(loadCount);
                      return (
                        <div
                          key={day.dateStr}
                          style={{
                            width: dayWidth,
                            height: "100%",
                            flexShrink: 0,
                            borderRight: "1px solid #21262d",
                            background: day.isWeekend 
                              ? "#161b22" 
                              : cap.bg !== "transparent"
                              ? cap.bg
                              : "transparent",
                            pointerEvents: "none",
                          }}
                        />
                      );
                    })}

                    {/* Gantt Bar */}
                    {barStyle && (
                      <div
                        style={barStyle}
                        onMouseDown={(e) => handleMouseDown(e, "move", order._id)}
                        onMouseEnter={() => setHoveredOrder(order)}
                        onMouseMove={(e) => setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 })}
                        onMouseLeave={() => { setHoveredOrder(null); setTooltipPos(null); }}
                      >
                        {/* Resize Left Handle */}
                        <div
                          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "resize-start", order._id); }}
                        >
                          <div style={{ width: 2, height: 12, background: "rgba(255, 255, 255, 0.4)", borderRadius: 1 }} />
                        </div>

                        {/* Text Content */}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", pointerEvents: "none" }}>
                          {order.orderNumber}
                        </span>

                        {/* Resize Right Handle */}
                        <div
                          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "resize-end", order._id); }}
                        >
                          <div style={{ width: 2, height: 12, background: "rgba(255, 255, 255, 0.4)", borderRadius: 1 }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

      {/* Hover Tooltip / Popover */}
      {hoveredOrder && tooltipPos && (() => {
        const ownerName = hoveredOrder.ownerId ? usersMap.get(hoveredOrder.ownerId) || "" : "";
        const dates = localDates[hoveredOrder._id] || { start: hoveredOrder.productionStartDate, end: hoveredOrder.productionEndDate };
        const duration = (dates.start && dates.end) ? getDaysDiff(dates.start, dates.end) + 1 : 0;
        
        return (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x,
              top: tooltipPos.y,
              background: "rgba(22, 27, 34, 0.95)",
              backdropFilter: "blur(8px)",
              border: "1px solid #30363d",
              borderRadius: 8,
              padding: "12px 14px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
              zIndex: 1000,
              minWidth: 260,
              maxWidth: 320,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              color: "#c9d1d9",
              fontFamily: "inherit"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #21262d", paddingBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#58a6ff" }}>{hoveredOrder.orderNumber}</span>
              {duration > 0 && (
                <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                  {duration} dni
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div>Klient: <strong style={{ color: "#f0f6fc" }}>{hoveredOrder.clientName}</strong></div>
              {dates.start && dates.end && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#8b949e" }}>
                  <Calendar size={11} />
                  <span>{formatTooltipDate(dates.start)} – {formatTooltipDate(dates.end)}</span>
                </div>
              )}
              {ownerName && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#8b949e" }}>
                  <UserCheck size={11} />
                  <span>Opiekun: <strong style={{ color: "#f0f6fc" }}>{ownerName}</strong></span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#8b949e" }}>
                <Coins size={11} />
                <span>Wartość Netto: <strong style={{ color: "#3fb950" }}>{formatCurrency(hoveredOrder.valueNetto || 0)}</strong></span>
              </div>
            </div>

            {hoveredOrder.projectType && hoveredOrder.projectType.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                {hoveredOrder.projectType.map((t: string) => (
                  <span key={t} style={{ fontSize: 9, background: "#21262d", color: "#8b949e", padding: "1px 6px", borderRadius: 10, border: "1px solid #30363d" }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {hoveredOrder.notes && (
              <div style={{ borderTop: "1px solid #21262d", paddingTop: 6, fontSize: 11, color: "#8b949e", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {hoveredOrder.notes}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

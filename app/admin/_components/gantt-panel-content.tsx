"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { BarChart3, ChevronLeft, ChevronRight, Plus, Search, Calendar, Landmark, User, Clock, UserCheck, Coins, Truck } from "lucide-react";
import { useMemo } from "react";

// Local date formatting – uses date components to avoid UTC timezone shift.
// toISOString() converts local midnight → UTC, which in UTC+2 gives the previous day.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateStr(date: Date): string {
  return localDateStr(date);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function addWorkingDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return localDateStr(d);
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
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "production" | "assembly" | "unplanned">("all");
  const [barMode, setBarMode] = useState<"all" | "production" | "assembly">("all");

  const [hoveredOrder, setHoveredOrder] = useState<any | null>(null);
  const [hoveredType, setHoveredType] = useState<"production" | "assembly" | "delivery" | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const closeTimeoutRef = useRef<any>(null);
  const lastShiftRef = useRef<number>(0);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const [timelineStart, setTimelineStart] = useState(() => {
    // Default to 5 days before today
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return formatDateStr(d);
  });

  const [drag, setDrag] = useState<DragState | null>(null);
  const [localDates, setLocalDates] = useState<Record<string, { start: string; end: string }>>({});
  const [isMutatingId, setIsMutatingId] = useState<Id<"orders"> | null>(null);

  const [dragAssembly, setDragAssembly] = useState<DragState | null>(null);
  const [localAssemblyDates, setLocalAssemblyDates] = useState<Record<string, { start: string; end: string }>>({});
  const [isMutatingAssemblyId, setIsMutatingAssemblyId] = useState<Id<"orders"> | null>(null);

  // Sync DB production dates to local drag state
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

  // Sync DB assembly dates to local drag state
  useEffect(() => {
    const aDates: Record<string, { start: string; end: string }> = {};
    for (const order of productionOrders) {
      const isUserInteracting = (dragAssembly && dragAssembly.orderId === order._id) || (isMutatingAssemblyId === order._id);
      if (isUserInteracting && localAssemblyDates[order._id]) {
        aDates[order._id] = localAssemblyDates[order._id];
      } else if (order.assemblyStartDate && order.assemblyEndDate) {
        aDates[order._id] = {
          start: order.assemblyStartDate,
          end: order.assemblyEndDate,
        };
      }
    }
    setLocalAssemblyDates(aDates);
  }, [orders, dragAssembly, isMutatingAssemblyId]);

  // Generate 90 days of timeline (3 full months)
  const days: { dateStr: string; label: string; dayNum: number; isWeekend: boolean; isToday: boolean }[] = [];
  const todayStr = formatDateStr(new Date());
  for (let i = 0; i < 90; i++) {
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

  // Group contiguous days by month for timeline header
  const monthHeaderGroups: { monthLabel: string; count: number }[] = [];
  for (const day of days) {
    const d = new Date(day.dateStr + "T00:00:00");
    const monthName = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    if (monthHeaderGroups.length > 0 && monthHeaderGroups[monthHeaderGroups.length - 1].monthLabel === label) {
      monthHeaderGroups[monthHeaderGroups.length - 1].count++;
    } else {
      monthHeaderGroups.push({ monthLabel: label, count: 1 });
    }
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

  // Helper to calculate maximum concurrency for assembly range
  const getMaxAssemblyConcurrency = (startStr: string, endStr: string) => {
    let maxCount = 0;
    const startD = new Date(startStr + "T00:00:00");
    const endD = new Date(endStr + "T00:00:00");
    const tempD = new Date(startD);
    while (tempD <= endD) {
      const dateStr = tempD.toISOString().split("T")[0];
      let count = 0;
      for (const o of productionOrders) {
        const aDates = localAssemblyDates[o._id] || (o.assemblyStartDate && o.assemblyEndDate ? { start: o.assemblyStartDate, end: o.assemblyEndDate } : null);
        if (aDates && dateStr >= aDates.start && dateStr <= aDates.end) {
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

    if (!matchesSearch) return false;

    // Filter by project types
    if (selectedTypes.length > 0) {
      const orderTypes = o.projectType || [];
      if (!orderTypes.some((t: string) => selectedTypes.includes(t))) {
        return false;
      }
    }

    // Filter by schedule status (Produkcja / Montaż / Niezaplanowane)
    const hasProd = !!(localDates[o._id] || (o.productionStartDate && o.productionEndDate));
    const hasAsm = !!(localAssemblyDates[o._id] || (o.assemblyStartDate && o.assemblyEndDate));

    if (scheduleFilter === "production" && !hasProd) return false;
    if (scheduleFilter === "assembly" && !hasAsm) return false;
    if (scheduleFilter === "unplanned" && (hasProd || hasAsm)) return false;

    return true;
  });

  // Group orders by clientName
  const grouped: Record<string, typeof filteredOrders> = {};
  for (const o of filteredOrders) {
    if (!grouped[o.clientName]) {
      grouped[o.clientName] = [];
    }
    grouped[o.clientName].push(o);
  }

  interface RowItem {
    type: "client" | "order";
    clientName?: string;
    orderCount?: number;
    order?: typeof filteredOrders[0];
  }

  const rows: RowItem[] = [];
  for (const clientName of sortedClients) {
    const clientOrders = grouped[clientName].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    rows.push({ type: "client", clientName, orderCount: clientOrders.length });
    for (const order of clientOrders) {
      rows.push({ type: "order", order });
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
    const delivery = addWorkingDays(end, 2); // Automatically +2 working days!
    try {
      await updateDates({ 
        id: orderId, 
        productionStartDate: start, 
        productionEndDate: end,
        deliveryDate: delivery
      });
      toast.success("Zlecenie zaplanowane (termin produkcji i odbioru)");
    } catch (e) {
      toast.error("Błąd planowania zlecenia");
    }
  };
  // Remove dates (unplan order)
  const handleRemoveDates = async (e: React.MouseEvent, orderId: Id<"orders">) => {
    e.stopPropagation();
    try {
      await updateDates({ 
        id: orderId, 
        productionStartDate: null, 
        productionEndDate: null,
        deliveryDate: null // Clear delivery date as well!
      });
      toast.success("Usunięto terminy produkcji i odbioru");
      setHoveredOrder(null);
      setTooltipPos(null);
    } catch (err) {
      toast.error("Błąd usuwania terminu produkcji");
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

    const dayWidth = 48;

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
          // Auto-compute deliveryDate as +2 working days from the new production end
          const newDelivery = addWorkingDays(finalDates.end, 2);
          await updateDates({
            id: mutatingId,
            productionStartDate: finalDates.start,
            productionEndDate: finalDates.end,
            deliveryDate: newDelivery,
          });
          toast.success("Zaktualizowano termin produkcji i odbioru");
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

  // Assembly drag handler
  const handleAssemblyMouseDown = (
    e: React.MouseEvent,
    type: "move" | "resize-start" | "resize-end",
    orderId: Id<"orders">
  ) => {
    e.preventDefault();
    const aDates = localAssemblyDates[orderId];
    if (!aDates) return;
    setDragAssembly({
      type,
      orderId,
      startX: e.clientX,
      initialStart: aDates.start,
      initialEnd: aDates.end,
    });
  };

  useEffect(() => {
    if (!dragAssembly) return;
    const dayWidth = 48;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragAssembly.startX;
      const deltaDays = Math.round(deltaX / dayWidth);
      let newStart = dragAssembly.initialStart;
      let newEnd = dragAssembly.initialEnd;

      if (dragAssembly.type === "move") {
        newStart = addDays(dragAssembly.initialStart, deltaDays);
        newEnd = addDays(dragAssembly.initialEnd, deltaDays);
      } else if (dragAssembly.type === "resize-start") {
        newStart = addDays(dragAssembly.initialStart, deltaDays);
        if (newStart > dragAssembly.initialEnd) newStart = dragAssembly.initialEnd;
      } else if (dragAssembly.type === "resize-end") {
        newEnd = addDays(dragAssembly.initialEnd, deltaDays);
        if (newEnd < dragAssembly.initialStart) newEnd = dragAssembly.initialStart;
      }

      const current = localAssemblyDates[dragAssembly.orderId];
      if (current && current.start === newStart && current.end === newEnd) return;
      setLocalAssemblyDates(prev => ({ ...prev, [dragAssembly.orderId]: { start: newStart, end: newEnd } }));
    };

    const handleMouseUp = async () => {
      const finalDates = localAssemblyDates[dragAssembly.orderId];
      const mutatingId = dragAssembly.orderId;
      setIsMutatingAssemblyId(mutatingId);
      setDragAssembly(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (finalDates && (finalDates.start !== dragAssembly.initialStart || finalDates.end !== dragAssembly.initialEnd)) {
        try {
          await updateDates({
            id: mutatingId,
            assemblyStartDate: finalDates.start,
            assemblyEndDate: finalDates.end,
          });
          toast.success("Zaktualizowano termin montażu");
        } catch (err) {
          setLocalAssemblyDates(prev => ({
            ...prev,
            [mutatingId]: { start: dragAssembly.initialStart, end: dragAssembly.initialEnd },
          }));
          toast.error("Błąd aktualizacji terminu montażu");
        } finally {
          setIsMutatingAssemblyId(null);
        }
      } else {
        setIsMutatingAssemblyId(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragAssembly, localAssemblyDates, updateDates, isMutatingAssemblyId]);

  // Layout parameters
  const leftColWidth = 320;
  const dayWidth = 48;
  const rowHeight = 58; // single row with two stacked bars

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

          {/* Scheduling Status Filter Chips (Produkcja / Montaż / Niezaplanowane) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 500 }}>Stan planu:</span>
            {[
              { id: "all", label: "Wszystkie" },
              { id: "production", label: "Z produkcją", color: "#059669" },
              { id: "assembly", label: "Z montażem", color: "#ea580c" },
              { id: "unplanned", label: "Niezaplanowane", color: "#475569" },
            ].map((chip) => {
              const isActive = scheduleFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setScheduleFilter(chip.id as any)}
                  style={{
                    background: isActive ? (chip.color || "#2563eb") : "#21262d",
                    color: isActive ? "#ffffff" : "#c9d1d9",
                    border: `1px solid ${isActive ? "transparent" : "#30363d"}`,
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.15s",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {chip.color && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#ffffff" : chip.color }} />
                  )}
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Bar Visibility Mode (Wszystkie / Wyłącznie produkcja / Wyłącznie montaż) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginLeft: 4 }}>
            <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 500 }}>Widok pasków:</span>
            {[
              { id: "all", label: "Wszystkie paski" },
              { id: "production", label: "Wyłącznie produkcja", color: "#10b981" },
              { id: "assembly", label: "Wyłącznie montaż", color: "#f59e0b" },
            ].map((chip) => {
              const isActive = barMode === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setBarMode(chip.id as any)}
                  style={{
                    background: isActive ? (chip.color || "#2563eb") : "#21262d",
                    color: isActive ? "#ffffff" : "#c9d1d9",
                    border: `1px solid ${isActive ? "transparent" : "#30363d"}`,
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.15s",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {chip.color && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#ffffff" : chip.color }} />
                  )}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Capacity Legend Bar / Agenda */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 24px", background: "#161b22", borderBottom: "1px solid #30363d", fontSize: 11, color: "#8b949e", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "#c9d1d9" }}>Obciążenie Produkcji:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)" }} />
          <span>Zielony: 1-2</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 1px 3px rgba(245, 158, 11, 0.3)" }} />
          <span>Pomarańczowy: 3-4</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f85149 0%, #da3633 100%)", boxShadow: "0 1px 3px rgba(248, 81, 73, 0.3)" }} />
          <span>Czerwony: 5+</span>
        </div>

        <span style={{ fontWeight: 600, color: "#c9d1d9", marginLeft: 20 }}>Obciążenie Montaży:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)" }} />
          <span>Zielony: 1</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 1px 3px rgba(245, 158, 11, 0.3)" }} />
          <span>Pomarańczowy: 2</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f85149 0%, #da3633 100%)", boxShadow: "0 1px 3px rgba(248, 81, 73, 0.3)" }} />
          <span>Czerwony: 3+</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Unified Table-Chart Wrapper */}
        <div style={{ flex: 1, display: "flex", overflow: "auto", position: "relative" }}>
          
          {/* Left Columns (Fixed Side) */}
          <div style={{ width: leftColWidth, flexShrink: 0, borderRight: "1px solid #30363d", background: "#161b22", zIndex: 3, position: "sticky", left: 0 }}>
            {/* Header Row */}
            <div style={{ height: 54, borderBottom: "2px solid #30363d", display: "flex", alignItems: "center", padding: "0 16px", fontWeight: 600, fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", gap: 16 }}>
              <span style={{ flex: 1 }}>Zlecenie / Klient</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#059669", display: "inline-block" }} />
                  Produkcja
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#ea580c", display: "inline-block" }} />
                  Montaż
                </span>
              </span>
            </div>

            {/* Grouped Client and Order Rows */}
            {rows.map((row, idx) => {
              if (row.type === "client") {
                return (
                  <div
                    key={`client-${row.clientName}-${idx}`}
                    style={{
                      height: 28,
                      background: "#161b22",
                      borderTop: idx === 0 ? "none" : "2px solid #30363d",
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#38bdf8",
                      letterSpacing: "0.3px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 12 }}>🏢</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.clientName}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "#8b949e", fontWeight: 500 }}>
                      {row.orderCount} {row.orderCount === 1 ? "zlecenie" : "zlecenia"}
                    </span>
                  </div>
                );
              }

              const order = row.order!;
              const q = quotesMap.get(order.quoteId);
              const customLabel = order.customLabel || q?.customLabel;
              const prodDates = localDates[order._id];
              const asmDates = localAssemblyDates[order._id];
              const isPlanned = !!prodDates;
              return (
                <div
                  key={`left-${order._id}`}
                  style={{
                    height: rowHeight,
                    borderBottom: "1px solid #21262d",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "0 12px 0 20px",
                    background: "#0d1117",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    gap: 3,
                  }}
                  onClick={() => onOpenOrder(order._id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#161b22")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0d1117")}
                >
                  {/* Top line: order number + client */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", whiteSpace: "nowrap" }}>
                      #{order.orderNumber}
                    </span>
                    <span style={{ fontSize: 11, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {order.clientName}
                    </span>
                    {customLabel && (
                      <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 600, whiteSpace: "nowrap" }}>🏷️</span>
                    )}
                  </div>
                  {/* Bottom line: dates and actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Prod indicator */}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: prodDates ? "#34d399" : "#475569", fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, background: prodDates ? "#059669" : "#374151", display: "inline-block" }} />
                      {prodDates ? `${getDaysDiff(prodDates.start, prodDates.end) + 1}d prod.` : "brak prod."}
                    </span>
                    <span style={{ color: "#30363d", fontSize: 10 }}>·</span>
                    {/* Assembly indicator */}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: asmDates ? "#fb923c" : "#475569", fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, background: asmDates ? "#ea580c" : "#374151", display: "inline-block" }} />
                      {asmDates ? `${getDaysDiff(asmDates.start, asmDates.end) + 1}d mont.` : "brak mont."}
                    </span>
                    {/* Actions */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                      {!isPlanned && (
                        <button
                          type="button"
                          title="Zaplanuj produkcję"
                          onClick={(e) => { e.stopPropagation(); handleScheduleDefault(order._id); }}
                          style={{ background: "#064e3b", border: "1px solid #059669", borderRadius: 3, padding: "1px 6px", cursor: "pointer", color: "#6ee7b7", fontSize: 9, fontWeight: 600 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#059669"; e.currentTarget.style.color = "#fff"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#064e3b"; e.currentTarget.style.color = "#6ee7b7"; }}
                        >
                          + Zaplanuj
                        </button>
                      )}
                      {prodDates && (
                        <button
                          type="button"
                          title="Centruj na produkcji"
                          onClick={(e) => { e.stopPropagation(); setTimelineStart(addDays(prodDates.start, -5)); }}
                          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, padding: "1px 3px", color: "#475569" }}
                          onMouseEnter={(ev) => (ev.currentTarget.style.color = "#38bdf8")}
                          onMouseLeave={(ev) => (ev.currentTarget.style.color = "#475569")}
                        >
                          🎯
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
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
            <div style={{ display: "flex", flexDirection: "column", height: 54, borderBottom: "2px solid #30363d", background: "#161b22", position: "sticky", top: 0, zIndex: 2 }}>
              {/* Row 1: Month Headers */}
              <div style={{ display: "flex", height: 22, borderBottom: "1px solid #30363d", background: "#0d1117" }}>
                {monthHeaderGroups.map((m, idx) => (
                  <div
                    key={`month-hdr-${idx}`}
                    style={{
                      width: m.count * dayWidth,
                      flexShrink: 0,
                      borderRight: "1px solid #30363d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#58a6ff",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      padding: "0 4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    📅 {m.monthLabel}
                  </div>
                ))}
              </div>

              {/* Row 2: Days Header */}
              <div style={{ display: "flex", height: 32 }}>
                {days.map((day) => {
                  const loadCount = dayCapacity[day.dateStr] || 0;
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
                        background: "transparent",
                        color: day.isToday ? "#38bdf8" : day.isWeekend ? "#475569" : "#94a3b8",
                        position: "relative"
                      }}
                      title={`${day.dateStr}: ${loadCount} ${loadCount === 1 ? "zlecenie" : loadCount < 5 ? "zlecenia" : "zleceń"} w produkcji`}
                    >
                      <span style={{ fontSize: 9, textTransform: "uppercase", fontWeight: day.isToday ? 700 : 500 }}>{day.label}</span>
                      <span style={{ fontSize: 12, fontWeight: day.isToday ? 700 : 500 }}>{day.dayNum}</span>
                    </div>
                  );
                })}
              </div>
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
                        background: "#38bdf8",
                        boxShadow: "0 0 6px rgba(56, 189, 248, 0.4)",
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    />
                  );
                }
                return null;
              })()}

              {/* Rows grouped by client in right grid */}
              {rows.map((row, idx) => {
                if (row.type === "client") {
                  return (
                    <div
                      key={`grid-client-${row.clientName}-${idx}`}
                      style={{
                        height: 28,
                        background: "#161b22",
                        borderTop: idx === 0 ? "none" : "2px solid #30363d",
                        borderBottom: "1px solid #21262d",
                        display: "flex",
                        position: "relative",
                      }}
                    >
                      {days.map((day) => (
                        <div
                          key={day.dateStr}
                          style={{
                            width: dayWidth,
                            height: "100%",
                            flexShrink: 0,
                            borderRight: "1px solid #21262d",
                            background: "transparent",
                            pointerEvents: "none",
                          }}
                        />
                      ))}
                    </div>
                  );
                }

                const order = row.order!;
                const prodDates = localDates[order._id];
                const asmDates = localAssemblyDates[order._id];

                // Production bar
                let prodBarLeft = 0;
                let prodBarWidth = 0;
                let hasProdBar = false;
                let maxConcurrency = 1;
                if (prodDates) {
                  prodBarLeft = getDaysDiff(timelineStart, prodDates.start) * dayWidth;
                  prodBarWidth = (getDaysDiff(prodDates.start, prodDates.end) + 1) * dayWidth;
                  hasProdBar = true;
                  maxConcurrency = getMaxConcurrency(prodDates.start, prodDates.end);
                }

                // Dynamic capacity color logic for production card
                let prodGradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // Green (Optymalne: 1-2)
                let prodShadow = "0 2px 6px rgba(16, 185, 129, 0.25)";
                if (maxConcurrency >= 5) {
                  prodGradient = "linear-gradient(135deg, #f85149 0%, #da3633 100%)"; // Red (Przeciążenie: 5+)
                  prodShadow = "0 2px 6px rgba(248, 81, 73, 0.35)";
                } else if (maxConcurrency >= 3) {
                  prodGradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"; // Orange (Wysokie: 3-4)
                  prodShadow = "0 2px 6px rgba(245, 158, 11, 0.3)";
                }

                // Assembly bar
                let asmBarLeft = 0;
                let asmBarWidth = 0;
                let hasAsmBar = false;
                let maxAsmConcurrency = 1;
                if (asmDates) {
                  asmBarLeft = getDaysDiff(timelineStart, asmDates.start) * dayWidth;
                  asmBarWidth = (getDaysDiff(asmDates.start, asmDates.end) + 1) * dayWidth;
                  hasAsmBar = true;
                  maxAsmConcurrency = getMaxAssemblyConcurrency(asmDates.start, asmDates.end);
                }

                // Dynamic capacity color logic for assembly card (Thresholds: 1=Green, 2=Orange, 3+=Red)
                let asmGradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // Green (1 montaż)
                let asmShadow = "0 2px 6px rgba(16, 185, 129, 0.25)";
                if (maxAsmConcurrency >= 3) {
                  asmGradient = "linear-gradient(135deg, #f85149 0%, #da3633 100%)"; // Red (3+ montaży)
                  asmShadow = "0 2px 6px rgba(248, 81, 73, 0.35)";
                } else if (maxAsmConcurrency >= 2) {
                  asmGradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"; // Orange (2 montaże)
                  asmShadow = "0 2px 6px rgba(245, 158, 11, 0.3)";
                }

                // Live delivery date
                const isDraggingProd = drag && drag.orderId === order._id;
                const liveDeliveryDate = (isDraggingProd && prodDates)
                  ? addWorkingDays(prodDates.end, 2)
                  : order.deliveryDate;

                const deliveryOffsetDays = liveDeliveryDate ? getDaysDiff(timelineStart, liveDeliveryDate) : -1;
                const isDeliveryVisible = deliveryOffsetDays >= 0 && deliveryOffsetDays < 90;
                const prodEndOffsetDays = prodDates ? getDaysDiff(timelineStart, prodDates.end) : -999;
                const diffFromProdEnd = prodDates && liveDeliveryDate ? getDaysDiff(prodDates.end, liveDeliveryDate) : -999;
                const isWarning = prodDates && (diffFromProdEnd > 2 || diffFromProdEnd < 0);
                const deliveryColor = isWarning ? "#ef4444" : "#10b981";

                const showProdBar = hasProdBar && (barMode === "all" || barMode === "production");
                const showAsmBar = hasAsmBar && (barMode === "all" || barMode === "assembly");

                const PROD_TOP = barMode === "production" ? 15 : 4;
                const PROD_H = barMode === "production" ? 28 : 22;
                const ASM_TOP = barMode === "assembly" ? 15 : 32;
                const ASM_H = barMode === "assembly" ? 28 : 18;

                // Delivery pickup X coordinate
                const deliveryX = isDeliveryVisible
                  ? deliveryOffsetDays * dayWidth + dayWidth / 2
                  : prodDates ? (prodEndOffsetDays + 1) * dayWidth : -1;

                // Connector between Delivery pickup and Assembly start
                const asmCenterX = showAsmBar ? asmBarLeft : -1;
                const showAssemblyConnector = barMode === "all" && showProdBar && showAsmBar && deliveryX >= 0 && asmCenterX >= 0;
                const isAssemblyBeforeDelivery = showAssemblyConnector && asmBarLeft < deliveryX;
                const asmConnectorColor = isAssemblyBeforeDelivery ? "#ef4444" : "#ea580c";
                const connectorCenterY = ASM_TOP + ASM_H / 2;

                return (
                  <div
                    key={`grid-row-${order._id}`}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      position: "relative",
                      background: "#0d1117",
                    }}
                  >
                    {/* Background day columns */}
                    {days.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{
                          width: dayWidth,
                          height: "100%",
                          flexShrink: 0,
                          borderRight: day.isWeekend ? "1px solid #21262d" : "1px solid #161b22",
                          background: day.isWeekend ? "rgba(255,255,255,0.015)" : "transparent",
                          pointerEvents: "none",
                        }}
                      />
                    ))}

                    {/* Connector line between Delivery/Pickup and Assembly Start */}
                    {showAssemblyConnector && (
                      <>
                        {/* Vertical line from Delivery truck Y down to Assembly center Y */}
                        <div
                          style={{
                            position: "absolute",
                            left: deliveryX - 1,
                            top: PROD_TOP + PROD_H,
                            width: 2,
                            height: connectorCenterY - (PROD_TOP + PROD_H),
                            borderLeft: `2px dashed ${asmConnectorColor}`,
                            opacity: 0.8,
                            pointerEvents: "none",
                            zIndex: 1,
                          }}
                        />
                        {/* Horizontal line from Delivery X to Assembly Start X */}
                        {deliveryX !== asmBarLeft && (
                          <div
                            style={{
                              position: "absolute",
                              left: Math.min(deliveryX, asmBarLeft),
                              top: connectorCenterY - 1,
                              width: Math.abs(asmBarLeft - deliveryX),
                              height: 2,
                              borderBottom: `2px dashed ${asmConnectorColor}`,
                              opacity: 0.8,
                              pointerEvents: "none",
                              zIndex: 1,
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Production bar */}
                    {showProdBar && (
                      <div
                        style={{
                          position: "absolute",
                          left: prodBarLeft,
                          width: prodBarWidth,
                          height: PROD_H,
                          top: PROD_TOP,
                          borderRadius: 4,
                          background: prodGradient,
                          boxShadow: prodShadow,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 8px",
                          color: "white",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "grab",
                          userSelect: "none",
                          zIndex: 2,
                          transition: drag?.orderId === order._id ? "none" : "left 0.1s, width 0.1s",
                          overflow: "hidden",
                        }}
                        onMouseDown={(e) => handleMouseDown(e, "move", order._id)}
                        onMouseEnter={(e) => {
                          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredOrder(order);
                          setHoveredType("production");
                          setTooltipPos({ x: rect.left + rect.width / 2 - 130, y: rect.bottom + window.scrollY + 8 });
                        }}
                        onMouseLeave={() => {
                          closeTimeoutRef.current = setTimeout(() => {
                            setHoveredOrder(null); setHoveredType(null); setTooltipPos(null);
                          }, 250);
                        }}
                      >
                        {/* Resize left */}
                        <div
                          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "resize-start", order._id); }}
                        >
                          <div style={{ width: 2, height: 10, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                        </div>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "center", pointerEvents: "none", fontSize: 10 }}>
                          {isMutatingId === order._id ? "⏳" : `${order.orderNumber} · ${order.clientName}`}
                        </span>
                        {/* Resize right */}
                        <div
                          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "resize-end", order._id); }}
                        >
                          <div style={{ width: 2, height: 10, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                        </div>
                      </div>
                    )}

                    {/* Assembly bar */}
                    {showAsmBar && (
                      <div
                        style={{
                          position: "absolute",
                          left: asmBarLeft,
                          width: asmBarWidth,
                          height: ASM_H,
                          top: ASM_TOP,
                          borderRadius: 3,
                          background: asmGradient,
                          boxShadow: asmShadow,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 6px",
                          color: "white",
                          fontSize: 9,
                          fontWeight: 600,
                          cursor: "grab",
                          userSelect: "none",
                          zIndex: 2,
                          transition: dragAssembly?.orderId === order._id ? "none" : "left 0.1s, width 0.1s",
                          overflow: "hidden",
                        }}
                        onMouseDown={(e) => handleAssemblyMouseDown(e, "move", order._id)}
                        onMouseEnter={(e) => {
                          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredOrder(order);
                          setHoveredType("assembly");
                          setTooltipPos({ x: rect.left + rect.width / 2 - 130, y: rect.bottom + window.scrollY + 8 });
                        }}
                        onMouseLeave={() => {
                          closeTimeoutRef.current = setTimeout(() => {
                            setHoveredOrder(null); setHoveredType(null); setTooltipPos(null);
                          }, 250);
                        }}
                      >
                        {/* Resize left */}
                        <div
                          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleAssemblyMouseDown(e, "resize-start", order._id); }}
                        >
                          <div style={{ width: 2, height: 8, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                        </div>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "center", pointerEvents: "none" }}>
                          {isMutatingAssemblyId === order._id ? "⏳" : order.orderNumber}
                        </span>
                        {/* Resize right */}
                        <div
                          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseDown={(e) => { e.stopPropagation(); handleAssemblyMouseDown(e, "resize-end", order._id); }}
                        >
                          <div style={{ width: 2, height: 8, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                        </div>
                      </div>
                    )}

                    {/* Delivery truck indicator */}
                    {isDeliveryVisible && (
                      <>
                        {prodDates && deliveryOffsetDays > prodEndOffsetDays + 1 && (
                          <div style={{
                            position: "absolute",
                            left: (prodEndOffsetDays + 1) * dayWidth,
                            width: (deliveryOffsetDays - prodEndOffsetDays - 1) * dayWidth + dayWidth / 2,
                            height: 2,
                            borderBottom: `2px dashed ${deliveryColor}`,
                            top: PROD_TOP + PROD_H / 2,
                            zIndex: 1,
                            opacity: 0.7,
                            pointerEvents: "none",
                          }} />
                        )}
                        <div
                          style={{
                            position: "absolute",
                            left: deliveryOffsetDays * dayWidth + dayWidth / 2 - 8,
                            top: PROD_TOP,
                            zIndex: 3,
                            color: deliveryColor,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#0d1117",
                            borderRadius: "50%",
                            padding: 2,
                            border: `1px solid ${deliveryColor}`,
                            boxShadow: `0 0 6px ${deliveryColor}40`,
                          }}
                          onMouseEnter={(e) => {
                            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredOrder(order);
                            setHoveredType("delivery");
                            setTooltipPos({ x: rect.left + rect.width / 2 - 130, y: rect.bottom + window.scrollY + 8 });
                          }}
                          onMouseLeave={() => {
                            closeTimeoutRef.current = setTimeout(() => {
                              setHoveredOrder(null); setHoveredType(null); setTooltipPos(null);
                            }, 250);
                          }}
                        >
                          <Truck size={10} style={{ strokeWidth: 2.5 }} />
                        </div>
                      </>
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
            onMouseEnter={() => {
              if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            }}
            onMouseLeave={() => {
              setHoveredOrder(null);
              setHoveredType(null);
              setTooltipPos(null);
            }}
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
              pointerEvents: "auto",
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
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: hoveredType === "production" ? "#ffffff" : "#8b949e",
                  fontWeight: hoveredType === "production" ? 700 : 400,
                  background: hoveredType === "production" ? "rgba(16, 185, 129, 0.12)" : "transparent",
                  padding: hoveredType === "production" ? "2px 6px" : "0",
                  borderRadius: 4,
                }}>
                  <Calendar size={11} style={{ color: hoveredType === "production" ? "#10b981" : "#8b949e" }} />
                  <span>Produkcja: <strong style={{ color: hoveredType === "production" ? "#10b981" : "#f0f6fc", fontWeight: 700 }}>{formatTooltipDate(dates.start)} – {formatTooltipDate(dates.end)}</strong></span>
                </div>
              )}
              {hoveredOrder.deliveryDate && (() => {
                const diff = dates.end ? getDaysDiff(dates.end, hoveredOrder.deliveryDate) : -999;
                const isWarning = dates.end && (diff > 2 || diff < 0);
                const color = isWarning ? "#ef4444" : "#10b981";
                const isSelected = hoveredType === "delivery";
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: isSelected ? "#ffffff" : "#8b949e",
                    fontWeight: isSelected ? 700 : 400,
                    background: isSelected ? (isWarning ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.18)") : "transparent",
                    padding: isSelected ? "2px 6px" : "0",
                    borderRadius: 4,
                  }}>
                    <Truck size={11} style={{ color }} />
                    <span>
                      Odbiór produkcji: <strong style={{ color, fontWeight: 700 }}>{formatTooltipDate(hoveredOrder.deliveryDate)}</strong>
                      {dates.end && (
                        <span style={{ fontSize: 10, color: isWarning ? "#ff7b72" : "#8b949e", marginLeft: 4 }}>
                          ({diff >= 0 ? `+${diff}` : diff} dni)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
              {(() => {
                const aDates = localAssemblyDates[hoveredOrder._id] || (hoveredOrder.assemblyStartDate && hoveredOrder.assemblyEndDate ? { start: hoveredOrder.assemblyStartDate, end: hoveredOrder.assemblyEndDate } : null);
                if (!aDates) return null;
                const isSelected = hoveredType === "assembly";
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: isSelected ? "#ffffff" : "#8b5cf6",
                    fontWeight: isSelected ? 700 : 400,
                    background: isSelected ? "rgba(139, 92, 246, 0.18)" : "transparent",
                    padding: isSelected ? "2px 6px" : "0",
                    borderRadius: 4,
                  }}>
                    <Calendar size={11} style={{ color: isSelected ? "#a78bfa" : "#8b5cf6" }} />
                    <span>Montaż: <strong style={{ color: isSelected ? "#c084fc" : "#a78bfa", fontWeight: 700 }}>{formatTooltipDate(aDates.start)} – {formatTooltipDate(aDates.end)}</strong></span>
                  </div>
                );
              })()}
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
              {(() => {
                const q = quotesMap.get(hoveredOrder.quoteId);
                const label = hoveredOrder.customLabel || q?.customLabel;
                if (!label) return null;
                return (
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginTop: 2 }}>
                    🏷️ Wyróżnik: {label}
                  </div>
                );
              })()}
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

            {/* Remove production date button */}
            <div style={{ borderTop: "1px solid #21262d", paddingTop: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={(e) => handleRemoveDates(e, hoveredOrder._id)}
                style={{
                  width: "100%",
                  background: "rgba(248, 81, 73, 0.1)",
                  color: "#f85149",
                  border: "1px solid rgba(248, 81, 73, 0.2)",
                  borderRadius: 4,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f85149";
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "transparent";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(248, 81, 73, 0.1)";
                  e.currentTarget.style.color = "#f85149";
                  e.currentTarget.style.borderColor = "rgba(248, 81, 73, 0.2)";
                }}
              >
                ✕ Usuń termin produkcji
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

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

    // (delivery date filter removed)

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

  const sortedClients = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  interface RowItem {
    type: "client" | "order-header" | "order-production" | "order-assembly";
    clientName: string;
    order?: typeof filteredOrders[0];
  }

  const rows: RowItem[] = [];
  for (const clientName of sortedClients) {
    rows.push({ type: "client", clientName });
    const clientOrders = grouped[clientName].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    for (const order of clientOrders) {
      rows.push({ type: "order-header", clientName, order });
      rows.push({ type: "order-production", clientName, order });
      rows.push({ type: "order-assembly", clientName, order });
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
  const rowHeight = 36; // slightly tighter now we have two rows per order

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

               <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Month/Year selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#161b22", border: "1px solid #30363d", borderRadius: 4, padding: "2px 8px" }}>
            <Calendar size={13} style={{ color: "#58a6ff" }} />
            <span style={{ fontSize: 11, color: "#8b949e" }}>Skocz do miesiąca:</span>
            <input
              type="month"
              value={timelineStart.slice(0, 7)}
              onChange={(e) => {
                if (e.target.value) setTimelineStart(e.target.value + "-01");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#f0f6fc",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
                colorScheme: "dark",
                cursor: "pointer",
              }}
            />
          </div>
        </div>  
        </div>
      </div>

      {/* Capacity Legend Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 24px", background: "#161b22", borderBottom: "1px solid #30363d", fontSize: 11, color: "#8b949e", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "#c9d1d9" }}>Kolory pasków (Obciążenie terminu):</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)" }} />
          <span>Zielone: 1-2 zlecenia (Optymalne)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 1px 3px rgba(245, 158, 11, 0.3)" }} />
          <span>Pomarańczowe: 3-4 zlecenia (Wysokie)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #f85149 0%, #da3633 100%)", boxShadow: "0 1px 3px rgba(248, 81, 73, 0.3)" }} />
          <span>Czerwone: 5+ zleceń (Przeciążenie)</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Unified Table-Chart Wrapper */}
        <div style={{ flex: 1, display: "flex", overflow: "auto", position: "relative" }}>
          
          {/* Left Columns (Fixed Side) */}
          <div style={{ width: leftColWidth, flexShrink: 0, borderRight: "1px solid #30363d", background: "#161b22", zIndex: 3, position: "sticky", left: 0 }}>
            {/* Header Row */}
            <div style={{ height: 54, borderBottom: "2px solid #30363d", display: "flex", alignItems: "center", padding: "0 16px", fontWeight: 600, fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#f0f6fc",
                      letterSpacing: "0.3px",
                    }}
                  >
                    <span style={{ marginRight: 6, opacity: 0.8 }}>🏢</span>
                    <span style={{ textTransform: "uppercase" }}>{row.clientName}</span>
                  </div>
                );
              }

              // ── Order Header Row (Level 1 under Client) ───────────────
              if (row.type === "order-header") {
                const order = row.order!;
                const q = quotesMap.get(order.quoteId);
                const customLabel = order.customLabel || q?.customLabel;
                return (
                  <div
                    key={`hdr-${order._id}`}
                    onClick={() => onOpenOrder(order._id)}
                    style={{
                      height: 28,
                      background: "#161b22",
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 12px 0 24px",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#21262d")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#161b22")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>
                        Zlecenie #{order.orderNumber}
                      </span>
                      {customLabel && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: "#cbd5e1",
                            background: "#1e293b",
                            border: "1px solid #334155",
                            padding: "1px 6px",
                            borderRadius: 4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 120,
                          }}
                          title={customLabel}
                        >
                          🏷️ {customLabel}
                        </span>
                      )}
                    </div>
                    {order.projectType && order.projectType.length > 0 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {order.projectType.map((t: string) => (
                          <span key={t} style={{ fontSize: 9, color: "#64748b", fontWeight: 500 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Production Row (Level 2) ─────────────────────────────
              if (row.type === "order-production") {
                const order = row.order!;
                const isPlanned = !!(localDates[order._id] || (order.productionStartDate && order.productionEndDate));
                return (
                  <div
                    key={`prod-${order._id}`}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #1e293b",
                      borderLeft: "3px solid #10b981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 12px 0 36px",
                      background: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          background: "rgba(16, 185, 129, 0.12)",
                          color: "#34d399",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        PRODUKCJA
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {!isPlanned ? (
                        <button
                          type="button"
                          onClick={() => handleScheduleDefault(order._id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            background: "#064e3b",
                            border: "1px solid #059669",
                            borderRadius: 4,
                            padding: "2px 8px",
                            cursor: "pointer",
                            color: "#6ee7b7",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#059669"; e.currentTarget.style.color = "#ffffff"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#064e3b"; e.currentTarget.style.color = "#6ee7b7"; }}
                        >
                          <Plus size={10} /> Zaplanuj
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={10} />
                          {localDates[order._id] 
                            ? `${getDaysDiff(localDates[order._id].start, localDates[order._id].end) + 1} dni`
                            : "—"
                          }
                        </span>
                      )}
                      {localDates[order._id] && (
                        <button
                          type="button"
                          title="Centruj kalendarz na terminie produkcji"
                          onClick={(e) => {
                            e.stopPropagation();
                            const s = localDates[order._id].start;
                            if (s) setTimelineStart(addDays(s, -5));
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 11,
                            padding: 2,
                            color: "#64748b",
                          }}
                          onMouseEnter={(ev) => (ev.currentTarget.style.color = "#38bdf8")}
                          onMouseLeave={(ev) => (ev.currentTarget.style.color = "#64748b")}
                        >
                          🎯
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // ── Assembly Row (Level 3) ───────────────────────────────
              if (row.type === "order-assembly") {
                const order = row.order!;
                const aDates = localAssemblyDates[order._id];
                return (
                  <div
                    key={`asm-${order._id}`}
                    style={{
                      height: rowHeight,
                      borderBottom: "1px solid #1e293b",
                      borderLeft: "3px solid #f97316",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 12px 0 48px",
                      background: "#0d1117",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          background: "rgba(249, 115, 22, 0.12)",
                          color: "#fb923c",
                          border: "1px solid rgba(249, 115, 22, 0.25)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        MONTAŻ
                      </span>
                      {aDates && (
                        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 2, fontWeight: 500 }}>
                          ({getDaysDiff(aDates.start, aDates.end) + 1} dni)
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {aDates && (
                        <button
                          type="button"
                          title="Centruj kalendarz na terminie montażu"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (aDates.start) setTimelineStart(addDays(aDates.start, -5));
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 11,
                            padding: 2,
                            color: "#64748b",
                          }}
                          onMouseEnter={(ev) => (ev.currentTarget.style.color = "#fb923c")}
                          onMouseLeave={(ev) => (ev.currentTarget.style.color = "#64748b")}
                        >
                          🎯
                        </button>
                      )}
                      {!aDates && (
                        <button
                          type="button"
                          onClick={async () => {
                            const startD = new Date();
                            const s = localDateStr(startD);
                            const endD = new Date();
                            endD.setDate(endD.getDate() + 3);
                            const en = localDateStr(endD);
                            try {
                              await updateDates({ id: order._id, assemblyStartDate: s, assemblyEndDate: en });
                              toast.success("Zaplanowano montaż");
                            } catch { toast.error("Błąd planowania montażu"); }
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 3,
                            background: "#7c2d12", border: "1px solid #ea580c",
                            borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                            color: "#ffedd5", fontSize: 10, fontWeight: 600,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#c2410c"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#7c2d12"; }}
                        >
                          <Plus size={10} /> Montaż
                        </button>
                      )}
                      {aDates && (
                        <button
                          type="button"
                          title="Usuń daty montażu"
                          onClick={async () => {
                            try {
                              await updateDates({ id: order._id, assemblyStartDate: null, assemblyEndDate: null });
                              toast.success("Usunięto termin montażu");
                            } catch { toast.error("Błąd usuwania montażu"); }
                          }}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#f97316", padding: 2 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
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

              {/* Grouped Client and Order Grid Rows */}
              {rows.map((row, idx) => {
                if (row.type === "client") {
                  return (
                    <div
                      key={`grid-client-${row.clientName}-${idx}`}
                      style={{
                        height: 28,
                        background: "#0d1117",
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
                            borderRight: "1px solid #161b22",
                            background: "transparent",
                            pointerEvents: "none",
                          }}
                        />
                      ))}
                    </div>
                  );
                }

                // ── Order Header Row in right grid ─────────────────────
                if (row.type === "order-header") {
                  return (
                    <div
                      key={`grid-hdr-${row.order!._id}`}
                      style={{
                        height: 28,
                        background: "#0d1117",
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
                            borderRight: "1px solid #161b22",
                            background: "transparent",
                            pointerEvents: "none",
                          }}
                        />
                      ))}
                    </div>
                  );
                }

                // ── Assembly row in right grid ────────────────────────
                if (row.type === "order-assembly") {
                  const order = row.order!;
                  const aDates = localAssemblyDates[order._id];
                  const prodDates = localDates[order._id];

                  // Compute live delivery date (same logic as production row)
                  const isDraggingProd = drag && drag.orderId === order._id;
                  const liveDeliveryDate = (isDraggingProd && prodDates)
                    ? addWorkingDays(prodDates.end, 2)
                    : order.deliveryDate;

                  let assemblyBarStyle: React.CSSProperties | null = null;
                  let assemblyStartX = -1;

                  if (aDates) {
                    const startOff = getDaysDiff(timelineStart, aDates.start);
                    const dur = getDaysDiff(aDates.start, aDates.end) + 1;
                    assemblyStartX = startOff * dayWidth;

                    // Assembly bar styling (consistent warm amber)
                    const asmGradient = "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)";
                    const asmShadow = "0 2px 6px rgba(234, 88, 12, 0.25)";

                    assemblyBarStyle = {
                      position: "absolute",
                      left: assemblyStartX,
                      width: dur * dayWidth,
                      height: 20,
                      top: 8,
                      borderRadius: 4,
                      background: asmGradient,
                      boxShadow: asmShadow,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 8px",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "grab",
                      userSelect: "none",
                      zIndex: 1,
                      transition: dragAssembly?.orderId === order._id ? "none" : "left 0.1s, width 0.1s",
                    };
                  }

                  // Connector: vertical line at delivery date x + horizontal line to assembly bar start
                  const deliveryOffDays = liveDeliveryDate ? getDaysDiff(timelineStart, liveDeliveryDate) : -1;
                  const deliveryX = deliveryOffDays >= 0 ? deliveryOffDays * dayWidth + dayWidth / 2 : -1;
                  const showConnector = deliveryX >= 0 && assemblyStartX >= 0;
                  const connectorColor = "#10b981";
                  const centerY = rowHeight / 2;

                  return (
                    <div
                      key={`grid-asm-${order._id}`}
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
                            borderRight: "1px solid #0d1117",
                            background: day.isWeekend ? "#0a0f15" : "transparent",
                            pointerEvents: "none",
                          }}
                        />
                      ))}

                      {/* Connector: vertical line from top of row down to center at delivery x */}
                      {showConnector && (
                        <div
                          style={{
                            position: "absolute",
                            left: deliveryX,
                            top: 0,
                            width: 1,
                            height: centerY,
                            borderLeft: `2px dashed ${connectorColor}`,
                            opacity: 0.6,
                            pointerEvents: "none",
                            zIndex: 0,
                          }}
                        />
                      )}

                      {/* Connector: horizontal line from delivery x to assembly bar start at center y */}
                      {showConnector && deliveryX !== assemblyStartX && (
                        <div
                          style={{
                            position: "absolute",
                            left: Math.min(deliveryX, assemblyStartX),
                            top: centerY - 1,
                            width: Math.abs(assemblyStartX - deliveryX),
                            height: 2,
                            borderBottom: `2px dashed ${connectorColor}`,
                            opacity: 0.6,
                            pointerEvents: "none",
                            zIndex: 0,
                          }}
                        />
                      )}

                      {/* Assembly bar */}
                      {assemblyBarStyle && (
                        <div
                          style={assemblyBarStyle}
                          onMouseDown={(e) => handleAssemblyMouseDown(e, "move", order._id)}
                          onMouseEnter={(e) => {
                            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredOrder(order);
                            setHoveredType("assembly");
                            setTooltipPos({
                              x: rect.left + rect.width / 2 - 130,
                              y: rect.bottom + window.scrollY + 8
                            });
                          }}
                          onMouseLeave={() => {
                            closeTimeoutRef.current = setTimeout(() => {
                              setHoveredOrder(null);
                              setHoveredType(null);
                              setTooltipPos(null);
                            }, 250);
                          }}
                        >
                          {/* Resize left */}
                          <div
                            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseDown={(e) => { e.stopPropagation(); handleAssemblyMouseDown(e, "resize-start", order._id); }}
                          >
                            <div style={{ width: 2, height: 10, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                          </div>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", pointerEvents: "none", fontSize: 10 }}>
                            {isMutatingAssemblyId === order._id ? "⏳" : order.orderNumber}
                          </span>
                          {/* Resize right */}
                          <div
                            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseDown={(e) => { e.stopPropagation(); handleAssemblyMouseDown(e, "resize-end", order._id); }}
                          >
                            <div style={{ width: 2, height: 10, background: "rgba(255,255,255,0.4)", borderRadius: 1 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }


                // ── Production row in right grid ──────────────────────
                const order = row.order!;
                const dates = localDates[order._id];
                let barStyle: React.CSSProperties | null = null;

                if (dates) {
                  const startOffsetDays = getDaysDiff(timelineStart, dates.start);
                  const durationDays = getDaysDiff(dates.start, dates.end) + 1;
                  const left = startOffsetDays * dayWidth;
                  const width = durationDays * dayWidth;

                  // Production bar styling (consistent emerald green)
                  const barGradient = "linear-gradient(135deg, #059669 0%, #047857 100%)";
                  const barShadow = "0 2px 6px rgba(5, 150, 105, 0.25)";

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
                      background: "#0d1117",
                    }}
                  >
                    {/* Background day columns styling */}
                    {days.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{
                          width: dayWidth,
                          height: "100%",
                          flexShrink: 0,
                          borderRight: "1px solid #161b22",
                          background: "transparent",
                          pointerEvents: "none",
                        }}
                      />
                    ))}

                    {/* Gantt Bar */}
                    {barStyle && (
                      <div
                        style={barStyle}
                        onMouseDown={(e) => handleMouseDown(e, "move", order._id)}
                        onMouseEnter={(e) => {
                          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredOrder(order);
                          setHoveredType("production");
                          setTooltipPos({
                            x: rect.left + rect.width / 2 - 130,
                            y: rect.bottom + window.scrollY + 8
                          });
                        }}
                        onMouseLeave={() => {
                          closeTimeoutRef.current = setTimeout(() => {
                            setHoveredOrder(null);
                            setHoveredType(null);
                            setTooltipPos(null);
                          }, 250);
                        }}
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

                    {/* Delivery Date Visual Indicator */}
                    {(() => {
                      // During drag: compute delivery date live from current localDates.end
                      // After drag: fall back to DB deliveryDate
                      const isDraggingThis = drag && drag.orderId === order._id;
                      const liveDeliveryDate = (isDraggingThis && dates)
                        ? addWorkingDays(dates.end, 2)
                        : order.deliveryDate;

                      if (!liveDeliveryDate) return null;

                      const deliveryOffsetDays = getDaysDiff(timelineStart, liveDeliveryDate);
                      const isDeliveryVisible = deliveryOffsetDays >= 0 && deliveryOffsetDays < 30;

                      if (!isDeliveryVisible) return null;

                      const prodEndOffsetDays = dates ? getDaysDiff(timelineStart, dates.end) : -999;
                      const diffFromProdEnd = dates ? getDaysDiff(dates.end, liveDeliveryDate) : -999;

                      // Warn if delivery is before end of production or > 2 working days after
                      const isWarning = dates && (diffFromProdEnd > 2 || diffFromProdEnd < 0);
                      const deliveryColor = isWarning ? "#ef4444" : "#10b981";

                      return (
                        <>
                          {/* Dashed line connecting production end to delivery date */}
                          {dates && deliveryOffsetDays > prodEndOffsetDays + 1 && (
                            <div
                              style={{
                                position: "absolute",
                                left: (prodEndOffsetDays + 1) * dayWidth,
                                width: (deliveryOffsetDays - prodEndOffsetDays - 1) * dayWidth + (dayWidth / 2),
                                height: 2,
                                borderBottom: `2px dashed ${deliveryColor}`,
                                top: 21,
                                zIndex: 0,
                                opacity: 0.8,
                                pointerEvents: "none",
                              }}
                            />
                          )}

                          {/* Truck badge on delivery date */}
                          <div
                            style={{
                              position: "absolute",
                              left: deliveryOffsetDays * dayWidth + (dayWidth / 2) - 8,
                              top: 14,
                              zIndex: 2,
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
                              setTooltipPos({
                                x: rect.left + rect.width / 2 - 130,
                                y: rect.bottom + window.scrollY + 8
                              });
                            }}
                            onMouseLeave={() => {
                              closeTimeoutRef.current = setTimeout(() => {
                                setHoveredOrder(null);
                                setHoveredType(null);
                                setTooltipPos(null);
                              }, 250);
                            }}
                          >
                            <Truck size={10} style={{ strokeWidth: 2.5 }} />
                          </div>
                        </>
                      );
                    })()}
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

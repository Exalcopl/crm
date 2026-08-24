"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { X, Plus, ChevronLeft, ChevronRight, ExternalLink, Calendar, CheckSquare, Square, Trash2, User, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUserColor } from "@/app/admin/_lib/users";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
function getDaysDiff(startStr: string, endStr: string): number {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}
function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
function todayStr() {
  return localDateStr(new Date());
}

type Step = {
  _id: Id<"orderPreProdSteps">;
  orderId: Id<"orders">;
  title: string;
  startDate?: string;
  endDate?: string;
  assigneeId?: Id<"users">;
  done: boolean;
  order: number;
  createdAt: number;
};

interface DragState {
  type: "move" | "resize-start" | "resize-end";
  stepId: Id<"orderPreProdSteps">;
  startX: number;
  initialStart: string;
  initialEnd: string;
}

interface OrderPreProdGanttProps {
  orderId: Id<"orders">;
  orderNumber: string;
  clientName: string;
  onClose: () => void;
}

// Layout constants — bigger rows & bars
const DAY_WIDTH = 48;
const ROW_HEIGHT = 68;
const LEFT_COL = 300;
const HEADER_H = 38;
const BAR_H = 28;
const BAR_TOP = (ROW_HEIGHT - BAR_H) / 2;

const PRIMARY = "#d41d3c";

export function OrderPreProdGantt({ orderId, orderNumber, clientName, onClose }: OrderPreProdGanttProps) {
  const router = useRouter();
  const steps = (useQuery(api.orderPreProdSteps.list, { orderId }) ?? []) as Step[];
  const allUsers = (useQuery(api.users.listAllAssignable) ?? []) as any[];
  const usersMap = useMemo(() => new Map(allUsers.map((u: any) => [u._id, u])), [allUsers]);

  const addStep = useMutation(api.orderPreProdSteps.add);
  const updateDates = useMutation(api.orderPreProdSteps.updateDates);
  const updateTitle = useMutation(api.orderPreProdSteps.updateTitle);
  const setDone = useMutation(api.orderPreProdSteps.setDone);
  const setAssignee = useMutation(api.orderPreProdSteps.setAssignee);
  const removeStep = useMutation(api.orderPreProdSteps.remove);

  // Timeline state
  const [timelineStart, setTimelineStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return localDateStr(d);
  });
  const today = todayStr();

  // Filter by user
  const [filterUserId, setFilterUserId] = useState<Id<"users"> | null>(null);
  const [showUserFilter, setShowUserFilter] = useState(false);

  // Local optimistic dates for drag
  const [localDates, setLocalDates] = useState<Record<string, { start: string; end: string }>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mutatingId, setMutatingId] = useState<Id<"orderPreProdSteps"> | null>(null);

  // Sync DB → local
  useEffect(() => {
    if (drag) return;
    const next: Record<string, { start: string; end: string }> = {};
    for (const s of steps) {
      if (s.startDate && s.endDate) {
        next[s._id] = { start: s.startDate, end: s.endDate };
      }
    }
    setLocalDates(next);
  }, [steps, drag]);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [isAddRowActive, setIsAddRowActive] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  function activateAddRow() {
    setIsAddRowActive(true);
    setTimeout(() => newInputRef.current?.focus(), 30);
  }

  // Edit title inline
  const [editingId, setEditingId] = useState<Id<"orderPreProdSteps"> | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Assignee dropdown
  const [assigneeDropId, setAssigneeDropId] = useState<Id<"orderPreProdSteps"> | null>(null);

  // Generate 90 days
  const days = useMemo(() => {
    const result: { dateStr: string; dayNum: number; label: string; isWeekend: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < 90; i++) {
      const ds = addDays(timelineStart, i);
      const d = new Date(ds + "T00:00:00");
      const dow = d.getDay();
      const names = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
      result.push({ dateStr: ds, dayNum: d.getDate(), label: names[dow], isWeekend: dow === 0 || dow === 6, isToday: ds === today });
    }
    return result;
  }, [timelineStart, today]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const day of days) {
      const d = new Date(day.dateStr + "T00:00:00");
      const label = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
      if (groups.length > 0 && groups[groups.length - 1].label === label) {
        groups[groups.length - 1].count++;
      } else {
        groups.push({ label, count: 1 });
      }
    }
    return groups;
  }, [days]);

  // Drag logic
  const handleBarMouseDown = useCallback((e: React.MouseEvent, type: DragState["type"], step: Step) => {
    e.preventDefault();
    const dates = localDates[step._id];
    if (!dates) return;
    setDrag({ type, stepId: step._id, startX: e.clientX, initialStart: dates.start, initialEnd: dates.end });
  }, [localDates]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - drag.startX) / DAY_WIDTH);
      let ns = drag.initialStart, ne = drag.initialEnd;
      if (drag.type === "move") { ns = addDays(drag.initialStart, delta); ne = addDays(drag.initialEnd, delta); }
      else if (drag.type === "resize-start") { ns = addDays(drag.initialStart, delta); if (ns > ne) ns = ne; }
      else { ne = addDays(drag.initialEnd, delta); if (ne < ns) ne = ns; }
      setLocalDates(prev => ({ ...prev, [drag.stepId]: { start: ns, end: ne } }));
    };
    const onUp = async () => {
      const final = localDates[drag.stepId];
      const sid = drag.stepId;
      setMutatingId(sid);
      setDrag(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (final && (final.start !== drag.initialStart || final.end !== drag.initialEnd)) {
        try {
          await updateDates({ id: sid, startDate: final.start, endDate: final.end });
        } catch {
          setLocalDates(prev => ({ ...prev, [sid]: { start: drag.initialStart, end: drag.initialEnd } }));
          toast.error("Błąd aktualizacji dat");
        } finally {
          setMutatingId(null);
        }
      } else {
        setMutatingId(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, localDates, updateDates]);

  // Handlers
  async function handleAddTask() {
    const t = newTitle.trim();
    if (!t) { setIsAddRowActive(false); return; }
    try {
      await addStep({ orderId, title: t });
      setNewTitle("");
      setTimeout(() => newInputRef.current?.focus(), 30);
    } catch { toast.error("Błąd dodawania zadania"); }
  }

  async function handleToggleDone(step: Step) {
    try { await setDone({ id: step._id, done: !step.done }); }
    catch { toast.error("Błąd aktualizacji"); }
  }

  async function handleRemove(stepId: Id<"orderPreProdSteps">) {
    try { await removeStep({ id: stepId }); }
    catch { toast.error("Błąd usuwania zadania"); }
  }

  async function commitTitle(step: Step) {
    const t = editTitle.trim();
    if (t && t !== step.title) { try { await updateTitle({ id: step._id, title: t }); } catch { toast.error("Błąd zapisu"); } }
    setEditingId(null);
  }

  async function handleAssignee(stepId: Id<"orderPreProdSteps">, userId: Id<"users"> | null) {
    try { await setAssignee({ id: stepId, assigneeId: userId }); }
    catch { toast.error("Błąd przypisania"); }
    setAssigneeDropId(null);
  }

  async function handleQuickDate(step: Step) {
    const start = today;
    const end = addDays(start, 2);
    try {
      await updateDates({ id: step._id, startDate: start, endDate: end });
      toast.success("Ustawiono zakres dat — przesuń na osi czasu");
    } catch { toast.error("Błąd ustawiania dat"); }
  }

  const sorted = useMemo(() => {
    const base = [...steps].sort((a, b) => a.order - b.order);
    if (!filterUserId) return base;
    return base.filter(s => s.assigneeId === filterUserId);
  }, [steps, filterUserId]);

  const filterUser = filterUserId ? usersMap.get(filterUserId) : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "calc(100vw - 48px)", height: "calc(100vh - 48px)",
          background: "#0d1117", border: "1px solid #21262d",
          borderRadius: 12, overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 18px", background: "#161b22",
          borderBottom: "1px solid #21262d", flexShrink: 0,
          zIndex: 50, position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} style={{ color: PRIMARY }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>Zadania przedprodukcyjne</span>
            <span style={{ fontSize: 11, color: "#30363d" }}>·</span>
            <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 700 }}>#{orderNumber}</span>
            <span style={{ fontSize: 13, color: "#8b949e" }}>{clientName}</span>
            {/* Task count badge */}
            <span style={{ fontSize: 10, color: "#8b949e", background: "#21262d", border: "1px solid #30363d", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
              {sorted.length} {sorted.length === 1 ? "zadanie" : "zadań"}
            </span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Timeline nav */}
            <button type="button" onClick={() => setTimelineStart(prev => addDays(prev, -14))}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 3); setTimelineStart(localDateStr(d)); }}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#c9d1d9", fontSize: 11, fontWeight: 600 }}>
              Dziś
            </button>
            <button type="button" onClick={() => setTimelineStart(prev => addDays(prev, 14))}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}>
              <ChevronRight size={14} />
            </button>

            <div style={{ width: 1, height: 20, background: "#30363d" }} />

            {/* User filter */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowUserFilter(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: filterUserId ? `${PRIMARY}22` : "#21262d",
                  color: filterUserId ? PRIMARY : "#8b949e",
                  border: `1px solid ${filterUserId ? PRIMARY + "55" : "#30363d"}`,
                  borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                }}
              >
                <Filter size={12} />
                {filterUser ? filterUser.name : "Filtruj osobę"}
              </button>
              {showUserFilter && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
                  background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
                  padding: "6px 0", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                }}>
                  <div style={{ padding: "4px 10px 6px", fontSize: 10, color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Filtruj po osobie</div>
                  <button type="button" onClick={() => { setFilterUserId(null); setShowUserFilter(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: !filterUserId ? "rgba(212,29,60,0.08)" : "none", border: "none", cursor: "pointer", color: !filterUserId ? PRIMARY : "#8b949e", fontSize: 11, fontWeight: !filterUserId ? 700 : 400, textAlign: "left" }}>
                    Wszystkie osoby
                  </button>
                  {allUsers.map((u: any) => {
                    const color = getUserColor(u._id);
                    const isActive = filterUserId === u._id;
                    return (
                      <button key={u._id} type="button" onClick={() => { setFilterUserId(u._id); setShowUserFilter(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: isActive ? "rgba(212,29,60,0.08)" : "none", border: "none", cursor: "pointer", color: isActive ? PRIMARY : "#c9d1d9", fontSize: 11, fontWeight: isActive ? 700 : 400, textAlign: "left" }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}22`, color, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {u.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 20, background: "#30363d" }} />

            {/* + Dodaj zadanie */}
            <button type="button" onClick={activateAddRow}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: `rgba(212, 29, 60, 0.1)`, color: PRIMARY,
                border: `1px solid rgba(212, 29, 60, 0.3)`, borderRadius: 6,
                padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = PRIMARY; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(212, 29, 60, 0.1)"; e.currentTarget.style.color = PRIMARY; }}
            >
              <Plus size={13} /> Dodaj zadanie
            </button>

            {/* → Otwórz zlecenie */}
            <button type="button" onClick={() => router.push(`/admin/zlecenia/${orderId}`)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#21262d", color: "#8b949e", border: "1px solid #30363d", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#c9d1d9"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}
            >
              <ExternalLink size={13} /> Otwórz zlecenie
            </button>

            {/* ✕ Zamknij */}
            <button type="button" onClick={onClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", padding: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }} onClick={() => { setAssigneeDropId(null); setShowUserFilter(false); }}>

          {/* ── Left column ── */}
          <div style={{ width: LEFT_COL, flexShrink: 0, borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0d1117" }}>
            {/* Header spacer */}
            <div style={{ height: HEADER_H * 2, borderBottom: "1px solid #21262d", background: "#0d1117", display: "flex", alignItems: "flex-end", padding: "0 16px 8px" }}>
              <span style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Zadanie</span>
            </div>

            {/* Task rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {sorted.map((step, index) => {
                const dates = localDates[step._id];
                const dur = dates ? getDaysDiff(dates.start, dates.end) + 1 : 0;
                const assignee = step.assigneeId ? usersMap.get(step.assigneeId) : null;
                const color = step.assigneeId ? getUserColor(step.assigneeId) : "#475569";
                const isEditing = editingId === step._id;
                const isOpen = assigneeDropId === step._id;

                return (
                  <div
                    key={step._id}
                    style={{
                      height: ROW_HEIGHT,
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 14px",
                      borderBottom: "1px solid #161b22",
                      background: step.done
                        ? "rgba(63,185,80,0.04)"
                        : index % 2 === 0 ? "#0d1117" : "#0f1318",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (!step.done) (e.currentTarget as HTMLElement).style.background = "#1c2128"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = step.done ? "rgba(63,185,80,0.04)" : index % 2 === 0 ? "#0d1117" : "#0f1318"; }}
                  >
                    {/* Done stripe */}
                    {step.done && (
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#3fb950", borderRadius: "0 0 0 0" }} />
                    )}

                    {/* Checkbox */}
                    <button type="button" onClick={() => handleToggleDone(step)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: step.done ? "#3fb950" : "#475569", flexShrink: 0, display: "flex" }}>
                      {step.done ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => commitTitle(step)}
                          onKeyDown={e => { if (e.key === "Enter") commitTitle(step); if (e.key === "Escape") setEditingId(null); }}
                          style={{ width: "100%", background: "#161b22", border: `1px solid ${PRIMARY}`, borderRadius: 4, padding: "4px 7px", color: "#f0f6fc", fontSize: 13, outline: "none" }}
                        />
                      ) : (
                        <span
                          onClick={() => { setEditingId(step._id); setEditTitle(step.title); }}
                          style={{
                            display: "block", fontSize: 13, fontWeight: 500,
                            color: step.done ? "#6e7681" : "#e6edf3",
                            textDecoration: step.done ? "line-through" : "none",
                            cursor: "text",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                          title={step.title}
                        >
                          {step.title}
                        </span>
                      )}
                      {/* Duration + dates sub-label */}
                      {dur > 0 && dates && (
                        <span style={{ fontSize: 10, color: "#6e7681", display: "block", marginTop: 1 }}>
                          {fmtDate(dates.start)} – {fmtDate(dates.end)} · {dur}d
                        </span>
                      )}
                    </div>

                    {/* Assignee avatar + dropdown */}
                    <div style={{ position: "relative", flexShrink: 0, zIndex: isOpen ? 210 : 1 }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setAssigneeDropId(prev => prev === step._id ? null : step._id); }}
                        title={assignee?.name ?? "Przypisz osobę"}
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          border: `2px solid ${assignee ? color + "88" : "#30363d"}`,
                          background: assignee ? `${color}22` : "#161b22",
                          color: assignee ? color : "#475569",
                          fontSize: 9, fontWeight: 800,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {assignee
                          ? assignee.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                          : <User size={11} />
                        }
                      </button>

                      {isOpen && (
                        <div
                          style={{
                            position: "absolute", top: "calc(100% + 6px)", right: 0,
                            zIndex: 9999,
                            background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
                            padding: "6px 0", minWidth: 200, boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ padding: "4px 10px 6px", fontSize: 10, color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Przypisz osobę</div>
                          {step.assigneeId && (
                            <button type="button" onClick={() => handleAssignee(step._id, null)}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", color: "#f85149", fontSize: 11, textAlign: "left" }}>
                              <X size={11} /> Usuń przypisanie
                            </button>
                          )}
                          {allUsers.map((u: any) => (
                            <button key={u._id} type="button" onClick={() => handleAssignee(step._id, u._id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: u._id === step.assigneeId ? `${PRIMARY}11` : "none", border: "none", cursor: "pointer", color: u._id === step.assigneeId ? PRIMARY : "#c9d1d9", fontSize: 11, textAlign: "left" }}>
                              <span style={{ width: 22, height: 22, borderRadius: "50%", background: `${getUserColor(u._id)}22`, color: getUserColor(u._id), fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {u.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                              {u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button type="button" onClick={() => handleRemove(step._id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}

              {/* Always-visible add task row */}
              <div
                style={{
                  height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 10,
                  padding: "0 14px",
                  borderBottom: "1px solid #161b22",
                  background: isAddRowActive ? `rgba(212,29,60,0.04)` : "transparent",
                  cursor: isAddRowActive ? "default" : "pointer",
                  transition: "background 0.15s",
                }}
                onClick={() => { if (!isAddRowActive) activateAddRow(); }}
                onMouseEnter={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "rgba(212,29,60,0.02)"; }}
                onMouseLeave={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ color: isAddRowActive ? PRIMARY : "#374151", flexShrink: 0, display: "flex" }}>
                  <Plus size={14} />
                </span>
                {isAddRowActive ? (
                  <>
                    <input
                      ref={newInputRef}
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Nazwa zadania… (Enter aby dodać)"
                      onBlur={() => { if (!newTitle.trim()) setIsAddRowActive(false); }}
                      onKeyDown={e => {
                        if (e.key === "Enter") { void handleAddTask(); }
                        if (e.key === "Escape") { setIsAddRowActive(false); setNewTitle(""); }
                      }}
                      style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${PRIMARY}`, color: "#f0f6fc", fontSize: 13, padding: "2px 0", outline: "none" }}
                    />
                    <button type="button" onMouseDown={e => { e.preventDefault(); void handleAddTask(); }}
                      style={{ background: PRIMARY, border: "none", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", cursor: "pointer", flexShrink: 0 }}>
                      Dodaj
                    </button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); setIsAddRowActive(false); setNewTitle(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0, padding: 2 }}>
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: "#374151", userSelect: "none" }}>Dodaj zadanie…</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <div style={{ minWidth: days.length * DAY_WIDTH }}>

              {/* Month row */}
              <div style={{ display: "flex", height: HEADER_H, background: "#0d1117", borderBottom: "1px solid #21262d", position: "sticky", top: 0, zIndex: 20 }}>
                {monthGroups.map((g, i) => (
                  <div key={i} style={{ width: g.count * DAY_WIDTH, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 10px", borderRight: "1px solid #21262d" }}>
                    <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 700, textTransform: "capitalize" }}>{g.label}</span>
                  </div>
                ))}
              </div>

              {/* Day row */}
              <div style={{ display: "flex", height: HEADER_H, background: "#0d1117", borderBottom: "1px solid #21262d", position: "sticky", top: HEADER_H, zIndex: 20 }}>
                {days.map((day) => (
                  <div key={day.dateStr} style={{
                    width: DAY_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    borderRight: "1px solid #21262d",
                    background: day.isToday ? `${PRIMARY}12` : day.isWeekend ? "rgba(255,255,255,0.01)" : "transparent",
                  }}>
                    <span style={{ fontSize: 9, color: day.isToday ? PRIMARY : day.isWeekend ? "#374151" : "#8b949e", fontWeight: 700 }}>{day.label}</span>
                    <span style={{ fontSize: 12, color: day.isToday ? PRIMARY : day.isWeekend ? "#475569" : "#c9d1d9", fontWeight: day.isToday ? 800 : 400 }}>{day.dayNum}</span>
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {sorted.map((step, index) => {
                const dates = localDates[step._id];
                const hasBar = !!dates;

                let barLeft = 0, barWidth = 0;
                if (dates) {
                  const startIdx = days.findIndex(d => d.dateStr === dates.start);
                  const endIdx = days.findIndex(d => d.dateStr === dates.end);
                  if (startIdx !== -1 && endIdx !== -1) {
                    barLeft = startIdx * DAY_WIDTH;
                    barWidth = (endIdx - startIdx + 1) * DAY_WIDTH;
                  } else if (startIdx !== -1) {
                    barLeft = startIdx * DAY_WIDTH;
                    barWidth = DAY_WIDTH;
                  }
                }

                const isMutating = mutatingId === step._id;

                return (
                  <div key={step._id} style={{
                    display: "flex", position: "relative", height: ROW_HEIGHT,
                    borderBottom: "1px solid #161b22",
                    background: step.done ? "rgba(63,185,80,0.02)" : index % 2 === 0 ? "#0d1117" : "#0f1318",
                  }}>
                    {/* Day columns */}
                    {days.map((day) => (
                      <div key={day.dateStr} style={{
                        width: DAY_WIDTH, flexShrink: 0, height: ROW_HEIGHT, borderRight: "1px solid #161b22",
                        background: day.isToday ? `${PRIMARY}06` : day.isWeekend ? "rgba(255,255,255,0.008)" : "transparent",
                      }} />
                    ))}

                    {/* Bar */}
                    {hasBar && barWidth > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: barLeft + 3, top: BAR_TOP,
                          width: barWidth - 6, height: BAR_H,
                          background: step.done
                            ? "linear-gradient(90deg, rgba(63,185,80,0.25) 0%, rgba(63,185,80,0.15) 100%)"
                            : `linear-gradient(90deg, rgba(212,29,60,0.28) 0%, rgba(212,29,60,0.18) 100%)`,
                          border: `1px solid ${step.done ? "#3fb95055" : PRIMARY + "55"}`,
                          borderRadius: 6,
                          cursor: "grab",
                          opacity: isMutating ? 0.5 : 1,
                          transition: "opacity 0.15s",
                          display: "flex", alignItems: "center",
                          userSelect: "none",
                          boxShadow: step.done ? "0 1px 4px rgba(63,185,80,0.15)" : `0 1px 4px rgba(212,29,60,0.15)`,
                        }}
                        onMouseDown={e => handleBarMouseDown(e, "move", step)}
                      >
                        {/* Resize left handle */}
                        <div style={{ position: "absolute", left: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }}
                          onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-start", step); }} />

                        {/* Label */}
                        <span style={{ fontSize: 11, color: step.done ? "#3fb950" : PRIMARY, fontWeight: 700, padding: "0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {step.title}
                        </span>

                        {/* Date range */}
                        <span style={{ fontSize: 10, color: step.done ? "#3fb95088" : `${PRIMARY}99`, padding: "0 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {fmtDate(dates!.start)} – {fmtDate(dates!.end)}
                        </span>

                        {/* Resize right handle */}
                        <div style={{ position: "absolute", right: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }}
                          onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-end", step); }} />
                      </div>
                    )}

                    {/* No-date quick-add */}
                    {!hasBar && (
                      <div style={{ position: "absolute", left: 10, top: BAR_TOP, height: BAR_H, display: "flex", alignItems: "center" }}>
                        <button type="button" onClick={() => handleQuickDate(step)}
                          style={{ background: "#161b22", border: "1px dashed #30363d", borderRadius: 6, color: "#475569", fontSize: 10, padding: "4px 12px", cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.color = PRIMARY; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#475569"; }}>
                          + Ustaw datę
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add row placeholder in timeline */}
              {isAddRowActive && (
                <div style={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", borderBottom: "1px solid #161b22", background: `rgba(212,29,60,0.02)` }}>
                  {days.map(day => (
                    <div key={day.dateStr} style={{ width: DAY_WIDTH, flexShrink: 0, height: ROW_HEIGHT, borderRight: "1px solid #161b22" }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

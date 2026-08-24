"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { X, Plus, ChevronLeft, ChevronRight, ExternalLink, Calendar, CheckSquare, Square, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUserColor } from "@/app/admin/_lib/users";

// ─── Date helpers ────────────────────────────────────────────────────────────
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

const DAY_WIDTH = 44;
const ROW_HEIGHT = 52;
const LEFT_COL = 280;
const HEADER_H = 40;
const BAR_H = 22;
const BAR_TOP = (ROW_HEIGHT - BAR_H) / 2;

const STATUS_LABELS: Record<string, string> = {
  nowe: "Nowe",
  akceptacja: "Akceptacja",
  kompletacja: "Kompletacja",
  produkcja: "Produkcja",
  montaz: "Montaż",
  gotowe: "Gotowe",
  wstrzymane: "Wstrzymane",
};

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

  // New step form
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
  async function handleAddStep() {
    const t = newTitle.trim();
    if (!t) { setIsAddRowActive(false); return; }
    try {
      await addStep({ orderId, title: t });
      setNewTitle("");
      // Keep add row active so user can quickly add another
      setTimeout(() => newInputRef.current?.focus(), 30);
    } catch { toast.error("Błąd dodawania etapu"); }
  }

  async function handleToggleDone(step: Step) {
    try { await setDone({ id: step._id, done: !step.done }); }
    catch { toast.error("Błąd aktualizacji"); }
  }

  async function handleRemove(stepId: Id<"orderPreProdSteps">) {
    try { await removeStep({ id: stepId }); }
    catch { toast.error("Błąd usuwania etapu"); }
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

  // Quick-set default date range for a step without dates
  async function handleQuickDate(step: Step) {
    const start = today;
    const end = addDays(start, 2);
    try {
      await updateDates({ id: step._id, startDate: start, endDate: end });
      toast.success("Ustawiono domyślny zakres dat — przesuń na osi czasu");
    } catch { toast.error("Błąd ustawiania dat"); }
  }

  const sorted = [...steps].sort((a, b) => a.order - b.order);

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
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} style={{ color: "#58a6ff" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>Etapy przedprodukcyjne</span>
            <span style={{ fontSize: 11, color: "#30363d" }}>·</span>
            <span style={{ fontSize: 13, color: "#58a6ff", fontWeight: 700 }}>#{orderNumber}</span>
            <span style={{ fontSize: 13, color: "#8b949e" }}>{clientName}</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Timeline nav */}
            <button
              type="button"
              onClick={() => setTimelineStart(prev => addDays(prev, -14))}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => { const d = new Date(); d.setDate(d.getDate() - 3); setTimelineStart(localDateStr(d)); }}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#c9d1d9", fontSize: 11, fontWeight: 600 }}
            >
              Dziś
            </button>
            <button
              type="button"
              onClick={() => setTimelineStart(prev => addDays(prev, 14))}
              style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}
            >
              <ChevronRight size={14} />
            </button>

            <div style={{ width: 1, height: 20, background: "#30363d" }} />

            {/* + Dodaj etap */}
            <button
              type="button"
              onClick={activateAddRow}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: 6,
                padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#38bdf8"; e.currentTarget.style.color = "#0d1117"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(56, 189, 248, 0.12)"; e.currentTarget.style.color = "#38bdf8"; }}
            >
              <Plus size={13} /> Dodaj etap
            </button>

            {/* → Otwórz zlecenie */}
            <button
              type="button"
              onClick={() => router.push(`/admin/zlecenia/${orderId}`)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#21262d", color: "#8b949e",
                border: "1px solid #30363d", borderRadius: 6,
                padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#c9d1d9"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}
            >
              <ExternalLink size={13} /> Otwórz zlecenie
            </button>

            {/* ✕ Zamknij */}
            <button
              type="button"
              onClick={onClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", padding: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Left column */}
          <div style={{ width: LEFT_COL, flexShrink: 0, borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Month+day header spacer */}
            <div style={{ height: HEADER_H * 2, borderBottom: "1px solid #21262d", background: "#0d1117", display: "flex", alignItems: "flex-end", padding: "0 14px 8px" }}>
              <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 600 }}>Etap</span>
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>

              {sorted.map((step) => {
                const dates = localDates[step._id];
                const dur = dates ? getDaysDiff(dates.start, dates.end) + 1 : 0;
                const assignee = step.assigneeId ? usersMap.get(step.assigneeId) : null;
                const color = step.assigneeId ? getUserColor(step.assigneeId) : "#475569";
                const isEditing = editingId === step._id;

                return (
                  <div
                    key={step._id}
                    style={{
                      height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 8,
                      padding: "0 12px", borderBottom: "1px solid #161b22",
                      background: step.done ? "rgba(63,185,80,0.03)" : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { if (!step.done) (e.currentTarget as HTMLElement).style.background = "#0d1117e8"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = step.done ? "rgba(63,185,80,0.03)" : "transparent"; }}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleDone(step)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: step.done ? "#3fb950" : "#475569", flexShrink: 0 }}
                    >
                      {step.done ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>

                    {/* Title */}
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => commitTitle(step)}
                        onKeyDown={e => { if (e.key === "Enter") commitTitle(step); if (e.key === "Escape") setEditingId(null); }}
                        style={{
                          flex: 1, background: "#161b22", border: "1px solid #38bdf8",
                          borderRadius: 4, padding: "3px 6px", color: "#f0f6fc", fontSize: 12, outline: "none",
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingId(step._id); setEditTitle(step.title); }}
                        style={{
                          flex: 1, fontSize: 12, color: step.done ? "#8b949e" : "#f0f6fc",
                          textDecoration: step.done ? "line-through" : "none",
                          cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                        title={step.title}
                      >
                        {step.title}
                      </span>
                    )}

                    {/* Duration badge */}
                    {dur > 0 && (
                      <span style={{ fontSize: 9, color: "#8b949e", background: "#161b22", border: "1px solid #21262d", borderRadius: 4, padding: "1px 5px", flexShrink: 0, fontWeight: 600 }}>
                        {dur}d
                      </span>
                    )}

                    {/* Assignee */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setAssigneeDropId(prev => prev === step._id ? null : step._id)}
                        title={assignee?.name ?? "Przypisz osobę"}
                        style={{
                          width: 22, height: 22, borderRadius: "50%", border: `1px solid ${color}66`,
                          background: `${color}22`, color, fontSize: 9, fontWeight: 700,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {assignee ? (assignee.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()) : <User size={10} />}
                      </button>

                      {assigneeDropId === step._id && (
                        <div
                          style={{
                            position: "absolute", bottom: "110%", right: 0, zIndex: 200,
                            background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
                            padding: "6px 0", minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ padding: "4px 10px 6px", fontSize: 10, color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Przypisz osobę</div>
                          {step.assigneeId && (
                            <button
                              type="button"
                              onClick={() => handleAssignee(step._id, null)}
                              style={{ display: "block", width: "100%", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#f85149", fontSize: 11 }}
                            >
                              ✕ Usuń przypisanie
                            </button>
                          )}
                          {allUsers.map((u: any) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => handleAssignee(step._id, u._id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                padding: "6px 10px", background: u._id === step.assigneeId ? "rgba(56,189,248,0.08)" : "none",
                                border: "none", cursor: "pointer", color: "#c9d1d9", fontSize: 11,
                              }}
                            >
                              <span style={{ width: 20, height: 20, borderRadius: "50%", background: `${getUserColor(u._id)}22`, color: getUserColor(u._id), fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {u.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                              {u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemove(step._id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}


              {/* Always-visible add row at the bottom */}
              <div
                style={{
                  height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 8,
                  padding: "0 12px",
                  borderBottom: "1px solid #161b22",
                  background: isAddRowActive ? "rgba(56,189,248,0.04)" : "transparent",
                  cursor: isAddRowActive ? "default" : "pointer",
                  transition: "background 0.15s",
                }}
                onClick={() => { if (!isAddRowActive) activateAddRow(); }}
                onMouseEnter={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.03)"; }}
                onMouseLeave={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ color: isAddRowActive ? "#38bdf8" : "#374151", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <Plus size={13} />
                </span>
                {isAddRowActive ? (
                  <>
                    <input
                      ref={newInputRef}
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Nazwa etapu… (Enter aby dodać)"
                      onBlur={() => { if (!newTitle.trim()) setIsAddRowActive(false); }}
                      onKeyDown={e => {
                        if (e.key === "Enter") { void handleAddStep(); }
                        if (e.key === "Escape") { setIsAddRowActive(false); setNewTitle(""); }
                      }}
                      style={{
                        flex: 1, background: "transparent", border: "none",
                        borderBottom: "1px solid #38bdf8",
                        color: "#f0f6fc", fontSize: 12, padding: "2px 0", outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); void handleAddStep(); }}
                      style={{ background: "#38bdf8", border: "none", borderRadius: 4, color: "#0d1117", fontSize: 10, fontWeight: 700, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
                    >
                      Dodaj
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); setIsAddRowActive(false); setNewTitle(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0, padding: 2 }}
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "#374151", userSelect: "none" }}>Dodaj etap…</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div style={{ flex: 1, overflow: "auto", position: "relative" }} onClick={() => setAssigneeDropId(null)}>
            {/* Sticky header wrapper */}
            <div style={{ minWidth: days.length * DAY_WIDTH }}>
              {/* Month row */}
              <div style={{ display: "flex", height: HEADER_H, background: "#0d1117", borderBottom: "1px solid #21262d", position: "sticky", top: 0, zIndex: 10 }}>
                {monthGroups.map((g, i) => (
                  <div key={i} style={{ width: g.count * DAY_WIDTH, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 8px", borderRight: "1px solid #21262d" }}>
                    <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 600, textTransform: "capitalize" }}>{g.label}</span>
                  </div>
                ))}
              </div>

              {/* Day row */}
              <div style={{ display: "flex", height: HEADER_H, background: "#0d1117", borderBottom: "1px solid #21262d", position: "sticky", top: HEADER_H, zIndex: 10 }}>
                {days.map((day) => (
                  <div key={day.dateStr} style={{
                    width: DAY_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    borderRight: "1px solid #21262d",
                    background: day.isToday ? "rgba(56,189,248,0.08)" : day.isWeekend ? "rgba(255,255,255,0.01)" : "transparent",
                  }}>
                    <span style={{ fontSize: 9, color: day.isToday ? "#38bdf8" : day.isWeekend ? "#374151" : "#8b949e", fontWeight: 600 }}>{day.label}</span>
                    <span style={{ fontSize: 11, color: day.isToday ? "#38bdf8" : day.isWeekend ? "#475569" : "#c9d1d9", fontWeight: day.isToday ? 800 : 400 }}>{day.dayNum}</span>
                  </div>
                ))}
              </div>

              {/* Step rows */}
              {sorted.map((step) => {
                const dates = localDates[step._id];
                const hasBar = !!dates;

                // Compute bar offset & width
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

                const barColor = step.done ? "#3fb950" : "#38bdf8";
                const isMutating = mutatingId === step._id;

                return (
                  <div key={step._id} style={{ display: "flex", position: "relative", height: ROW_HEIGHT, borderBottom: "1px solid #161b22" }}>
                    {/* Day columns */}
                    {days.map((day) => (
                      <div key={day.dateStr} style={{
                        width: DAY_WIDTH, flexShrink: 0, height: ROW_HEIGHT, borderRight: "1px solid #161b22",
                        background: day.isToday ? "rgba(56,189,248,0.04)" : day.isWeekend ? "rgba(255,255,255,0.01)" : "transparent",
                      }} />
                    ))}

                    {/* Bar */}
                    {hasBar && barWidth > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: barLeft + 2, top: BAR_TOP,
                          width: barWidth - 4, height: BAR_H,
                          background: step.done ? "rgba(63,185,80,0.2)" : "rgba(56,189,248,0.18)",
                          border: `1px solid ${barColor}55`,
                          borderRadius: 5, cursor: "grab",
                          opacity: isMutating ? 0.6 : 1,
                          transition: "opacity 0.15s",
                          display: "flex", alignItems: "center",
                          userSelect: "none",
                        }}
                        onMouseDown={e => handleBarMouseDown(e, "move", step)}
                      >
                        {/* Resize left */}
                        <div
                          style={{ position: "absolute", left: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }}
                          onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-start", step); }}
                        />
                        {/* Label */}
                        <span style={{ fontSize: 10, color: barColor, fontWeight: 600, padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {step.title}
                        </span>
                        {/* Dates */}
                        <span style={{ fontSize: 9, color: `${barColor}aa`, padding: "0 6px", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {fmtDate(dates.start)} – {fmtDate(dates.end)}
                        </span>
                        {/* Resize right */}
                        <div
                          style={{ position: "absolute", right: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }}
                          onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-end", step); }}
                        />
                      </div>
                    )}

                    {/* No-date quick-add button */}
                    {!hasBar && (
                      <div
                        style={{ position: "absolute", left: 8, top: BAR_TOP, height: BAR_H, display: "flex", alignItems: "center" }}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuickDate(step)}
                          style={{
                            background: "#161b22", border: "1px dashed #30363d", borderRadius: 5,
                            color: "#475569", fontSize: 10, padding: "3px 10px", cursor: "pointer",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.color = "#38bdf8"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#475569"; }}
                        >
                          + Ustaw datę
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add row placeholder in timeline — matches the ghost add row in left column */}
              {isAddRowActive && (
                <div style={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", borderBottom: "1px solid #161b22", background: "rgba(56,189,248,0.02)" }}>
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

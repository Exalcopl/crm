"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { X, Plus, ChevronLeft, ChevronRight, ExternalLink, Calendar, CheckSquare, Square, Trash2, User, Filter, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUserColor } from "@/app/admin/_lib/users";

// ─── Date helpers ──────────────────────────────────────────────────────────────
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
function todayStr() { return localDateStr(new Date()); }

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = {
  _id: Id<"orderPreProdSteps">;
  orderId: Id<"orders">;
  title: string;
  startDate?: string;
  endDate?: string;
  assigneeId?: Id<"users">;
  done: boolean;
  order: number;
  parentId?: Id<"orderPreProdSteps">;
  createdAt: number;
};

type DragState = {
  type: "move" | "resize-start" | "resize-end";
  stepId: Id<"orderPreProdSteps">;
  startX: number;
  initialStart: string;
  initialEnd: string;
};

type FlatRow = { step: Step; depth: 0 | 1; parentStep: Step | null };

function buildFlatRows(steps: Step[], filterUserId: Id<"users"> | null): FlatRow[] {
  const parents = steps.filter(s => !s.parentId).sort((a, b) => a.order - b.order);
  const childrenOf = (parentId: Id<"orderPreProdSteps">) =>
    steps.filter(s => s.parentId === parentId).sort((a, b) => a.order - b.order);

  const result: FlatRow[] = [];
  for (const parent of parents) {
    const kids = childrenOf(parent._id);
    const kidsFiltered = filterUserId ? kids.filter(c => c.assigneeId === filterUserId) : kids;
    const parentMatches = !filterUserId || parent.assigneeId === filterUserId;

    if (parentMatches || kidsFiltered.length > 0) {
      result.push({ step: parent, depth: 0, parentStep: null });
      for (const child of kidsFiltered) {
        result.push({ step: child, depth: 1, parentStep: parent });
      }
    }
  }
  return result;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const DAY_WIDTH = 52;
const ROW_HEIGHT = 96;
const LEFT_COL = 310;
const HEADER_H = 38;
const BAR_H = 58;
const BAR_H_SUB = 42;
const BAR_TOP = (ROW_HEIGHT - BAR_H) / 2;
const BAR_TOP_SUB = (ROW_HEIGHT - BAR_H_SUB) / 2;
const PRIMARY = "#d41d3c";
const SUB_INDENT = 22;

interface OrderPreProdGanttProps {
  orderId: Id<"orders">;
  orderNumber: string;
  clientName: string;
  onClose: () => void;
}

export function OrderPreProdGantt({ orderId, orderNumber, clientName, onClose }: OrderPreProdGanttProps) {
  const router = useRouter();
  const steps = (useQuery(api.orderPreProdSteps.list, { orderId }) ?? []) as Step[];
  const allUsers = (useQuery(api.users.listAllAssignable) ?? []) as any[];
  const usersMap = useMemo(() => new Map(allUsers.map((u: any) => [u._id, u])), [allUsers]);

  const addStepMut = useMutation(api.orderPreProdSteps.add);
  const updateDates = useMutation(api.orderPreProdSteps.updateDates);
  const updateTitle = useMutation(api.orderPreProdSteps.updateTitle);
  const setDone = useMutation(api.orderPreProdSteps.setDone);
  const setAssignee = useMutation(api.orderPreProdSteps.setAssignee);
  const removeStep = useMutation(api.orderPreProdSteps.remove);

  // ── Timeline
  const [timelineStart, setTimelineStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 3); return localDateStr(d);
  });
  const today = todayStr();

  // ── Filters
  const [filterUserId, setFilterUserId] = useState<Id<"users"> | null>(null);
  const [showUserFilter, setShowUserFilter] = useState(false);

  // ── Drag
  const [localDates, setLocalDates] = useState<Record<string, { start: string; end: string }>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mutatingId, setMutatingId] = useState<Id<"orderPreProdSteps"> | null>(null);

  useEffect(() => {
    if (drag) return;
    const next: Record<string, { start: string; end: string }> = {};
    for (const s of steps) {
      if (s.startDate && s.endDate) next[s._id] = { start: s.startDate, end: s.endDate };
    }
    setLocalDates(next);
  }, [steps, drag]);

  // ── Add task / subtask
  const [newTitle, setNewTitle] = useState("");
  const [isAddRowActive, setIsAddRowActive] = useState(false);
  const [addingParentId, setAddingParentId] = useState<Id<"orderPreProdSteps"> | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  function activateAddRow(parentId?: Id<"orderPreProdSteps">) {
    setAddingParentId(parentId ?? null);
    setIsAddRowActive(true);
    setTimeout(() => newInputRef.current?.focus(), 30);
  }

  // ── Edit inline
  const [editingId, setEditingId] = useState<Id<"orderPreProdSteps"> | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // ── Assignee dropdown
  const [assigneeDropId, setAssigneeDropId] = useState<Id<"orderPreProdSteps"> | null>(null);

  // ── Days
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
      if (groups.length > 0 && groups[groups.length - 1].label === label) groups[groups.length - 1].count++;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [days]);

  // ── Drag logic
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
      setMutatingId(sid); setDrag(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (final && (final.start !== drag.initialStart || final.end !== drag.initialEnd)) {
        try { await updateDates({ id: sid, startDate: final.start, endDate: final.end }); }
        catch { setLocalDates(prev => ({ ...prev, [sid]: { start: drag.initialStart, end: drag.initialEnd } })); toast.error("Błąd aktualizacji dat"); }
        finally { setMutatingId(null); }
      } else { setMutatingId(null); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, localDates, updateDates]);

  // ── Handlers
  async function handleAddTask() {
    const t = newTitle.trim();
    if (!t) { setIsAddRowActive(false); setAddingParentId(null); return; }
    try {
      await addStepMut({ orderId, title: t, parentId: addingParentId ?? undefined });
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
    try { await updateDates({ id: step._id, startDate: start, endDate: end }); toast.success("Ustawiono daty — przesuń na osi czasu"); }
    catch { toast.error("Błąd ustawiania dat"); }
  }

  // ── Flat rows (tree → flat with depth info)
  const flatRows = useMemo(() => buildFlatRows(steps, filterUserId), [steps, filterUserId]);

  // ── Bar position calculator (for SVG dependency lines)
  function getBarRect(stepId: Id<"orderPreProdSteps">, rowIdx: number) {
    const dates = localDates[stepId];
    if (!dates) return null;
    const startIdx = days.findIndex(d => d.dateStr === dates.start);
    const endIdx = days.findIndex(d => d.dateStr === dates.end);
    if (startIdx === -1) return null;
    const ei = endIdx === -1 ? startIdx : endIdx;
    return {
      left: startIdx * DAY_WIDTH + 3,
      right: (ei + 1) * DAY_WIDTH - 3,
      centerY: rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
    };
  }

  // ── SVG dependency lines data
  const depLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < flatRows.length; i++) {
      const { step, parentStep } = flatRows[i];
      if (!parentStep) continue;
      const parentIdx = flatRows.findIndex(r => r.step._id === parentStep._id);
      if (parentIdx === -1) continue;
      const parentRect = getBarRect(parentStep._id, parentIdx);
      const childRect = getBarRect(step._id, i);
      if (!parentRect || !childRect) continue;
      lines.push({ x1: parentRect.right, y1: parentRect.centerY, x2: childRect.left, y2: childRect.centerY });
    }
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, localDates, days]);

  const filterUser = filterUserId ? usersMap.get(filterUserId) : null;
  const totalTimelineHeight = (flatRows.length + (isAddRowActive ? 1 : 0)) * ROW_HEIGHT;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "calc(100vw - 48px)", height: "calc(100vh - 48px)", background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "#161b22", borderBottom: "1px solid #21262d", flexShrink: 0, zIndex: 50, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} style={{ color: PRIMARY }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>Zadania przedprodukcyjne</span>
            <span style={{ fontSize: 11, color: "#30363d" }}>·</span>
            <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 700 }}>#{orderNumber}</span>
            <span style={{ fontSize: 13, color: "#8b949e" }}>{clientName}</span>
            <span style={{ fontSize: 10, color: "#8b949e", background: "#21262d", border: "1px solid #30363d", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
              {flatRows.length} {flatRows.length === 1 ? "zadanie" : "zadań"}
            </span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Timeline nav */}
            <button type="button" onClick={() => setTimelineStart(p => addDays(p, -14))} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 3); setTimelineStart(localDateStr(d)); }} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#c9d1d9", fontSize: 11, fontWeight: 600 }}>Dziś</button>
            <button type="button" onClick={() => setTimelineStart(p => addDays(p, 14))} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#c9d1d9" }}><ChevronRight size={14} /></button>

            <div style={{ width: 1, height: 20, background: "#30363d" }} />

            {/* User filter */}
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowUserFilter(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: filterUserId ? `${PRIMARY}22` : "#21262d", color: filterUserId ? PRIMARY : "#8b949e", border: `1px solid ${filterUserId ? PRIMARY + "55" : "#30363d"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                <Filter size={12} />
                {filterUser ? filterUser.name : "Filtruj osobę"}
              </button>
              {showUserFilter && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "6px 0", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: "4px 10px 6px", fontSize: 10, color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Filtruj po osobie</div>
                  <button type="button" onClick={() => { setFilterUserId(null); setShowUserFilter(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: !filterUserId ? `${PRIMARY}11` : "none", border: "none", cursor: "pointer", color: !filterUserId ? PRIMARY : "#8b949e", fontSize: 11, fontWeight: !filterUserId ? 700 : 400, textAlign: "left" }}>
                    Wszystkie osoby
                  </button>
                  {allUsers.map((u: any) => {
                    const color = getUserColor(u._id);
                    const isActive = filterUserId === u._id;
                    return (
                      <button key={u._id} type="button" onClick={() => { setFilterUserId(u._id); setShowUserFilter(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: isActive ? `${PRIMARY}11` : "none", border: "none", cursor: "pointer", color: isActive ? PRIMARY : "#c9d1d9", fontSize: 11, fontWeight: isActive ? 700 : 400, textAlign: "left" }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}22`, color, fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

            <button type="button" onClick={() => activateAddRow()}
              style={{ display: "flex", alignItems: "center", gap: 6, background: `rgba(212,29,60,0.1)`, color: PRIMARY, border: `1px solid rgba(212,29,60,0.3)`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              onMouseEnter={e => { e.currentTarget.style.background = PRIMARY; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,29,60,0.1)"; e.currentTarget.style.color = PRIMARY; }}>
              <Plus size={13} /> Dodaj zadanie
            </button>

            <button type="button" onClick={() => { onClose(); router.push(`/admin/zlecenia/${orderId}`); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#21262d", color: "#8b949e", border: "1px solid #30363d", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#c9d1d9"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}>
              <ExternalLink size={13} /> Otwórz zlecenie
            </button>

            <button type="button" onClick={onClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b949e", padding: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }} onClick={() => { setAssigneeDropId(null); setShowUserFilter(false); }}>

          {/* ── Left column ── */}
          <div style={{ width: LEFT_COL, flexShrink: 0, borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0d1117" }}>
            <div style={{ height: HEADER_H * 2, borderBottom: "1px solid #21262d", background: "#0d1117", display: "flex", alignItems: "flex-end", padding: "0 16px 8px" }}>
              <span style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Zadanie</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {flatRows.map((row, index) => {
                const { step, depth, parentStep } = row;
                const dates = localDates[step._id];
                const assignee = step.assigneeId ? usersMap.get(step.assigneeId) : null;
                const color = step.assigneeId ? getUserColor(step.assigneeId) : "#475569";
                const isEditing = editingId === step._id;
                const isOpen = assigneeDropId === step._id;
                const isSubtask = depth === 1;

                return (
                  <div
                    key={step._id}
                    style={{
                      height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 8,
                      padding: `0 12px 0 ${isSubtask ? 32 : 14}px`,
                      borderBottom: "1px solid #161b22",
                      borderLeft: isSubtask ? `2px solid ${PRIMARY}33` : "2px solid transparent",
                      background: step.done ? "rgba(63,185,80,0.03)" : index % 2 === 0 ? "#0d1117" : "#0f1318",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1c2128"; (e.currentTarget as HTMLElement).querySelector(".row-actions")?.setAttribute("style", "display:flex"); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = step.done ? "rgba(63,185,80,0.03)" : index % 2 === 0 ? "#0d1117" : "#0f1318"; }}
                  >
                    {/* Done stripe */}
                    {step.done && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: isSubtask ? 0 : 3, background: "#3fb950" }} />}

                    {/* Subtask tree connector */}
                    {isSubtask && (
                      <div style={{ position: "absolute", left: 14, top: 0, bottom: "50%", width: 10, borderLeft: `1px dashed ${PRIMARY}44`, borderBottom: `1px dashed ${PRIMARY}44`, borderBottomLeftRadius: 4 }} />
                    )}

                    {/* Checkbox */}
                    <button type="button" onClick={() => handleToggleDone(step)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: step.done ? "#3fb950" : "#475569", flexShrink: 0, display: "flex" }}>
                      {step.done ? <CheckSquare size={isSubtask ? 14 : 16} /> : <Square size={isSubtask ? 14 : 16} />}
                    </button>

                    {/* Title + sub-info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => commitTitle(step)}
                          onKeyDown={e => { if (e.key === "Enter") commitTitle(step); if (e.key === "Escape") setEditingId(null); }}
                          style={{ width: "100%", background: "#161b22", border: `1px solid ${PRIMARY}`, borderRadius: 4, padding: "4px 7px", color: "#f0f6fc", fontSize: isSubtask ? 12 : 13, outline: "none" }} />
                      ) : (
                        <span onClick={() => { setEditingId(step._id); setEditTitle(step.title); }}
                          style={{ display: "block", fontSize: isSubtask ? 12 : 13, fontWeight: isSubtask ? 400 : 600, color: step.done ? "#6e7681" : isSubtask ? "#c9d1d9" : "#e6edf3", textDecoration: step.done ? "line-through" : "none", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={step.title}>
                          {step.title}
                        </span>
                      )}
                      {dates && !isEditing && (
                        <span style={{ fontSize: 10, color: "#6e7681", display: "block", marginTop: 1 }}>
                          {fmtDate(dates.start)} – {fmtDate(dates.end)} · {getDaysDiff(dates.start, dates.end) + 1}d
                        </span>
                      )}
                    </div>

                    {/* Assignee */}
                    <div style={{ position: "relative", flexShrink: 0, zIndex: isOpen ? 210 : 1 }}>
                      <button type="button" onClick={e => { e.stopPropagation(); setAssigneeDropId(prev => prev === step._id ? null : step._id); }}
                        title={assignee?.name ?? "Przypisz osobę"}
                        style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${assignee ? color + "88" : "#30363d"}`, background: assignee ? `${color}22` : "#161b22", color: assignee ? color : "#475569", fontSize: 8, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {assignee ? assignee.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : <User size={10} />}
                      </button>
                      {isOpen && (
                        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "6px 0", minWidth: 200, boxShadow: "0 12px 32px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>
                          <div style={{ padding: "4px 10px 6px", fontSize: 10, color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Przypisz osobę</div>
                          {step.assigneeId && <button type="button" onClick={() => handleAssignee(step._id, null)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", color: "#f85149", fontSize: 11, textAlign: "left" }}><X size={11} /> Usuń przypisanie</button>}
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

                    {/* Add subtask button (only on top-level tasks) */}
                    {!isSubtask && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); activateAddRow(step._id); }}
                        title="Dodaj podzadanie"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = PRIMARY; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}>
                        <GitBranch size={12} />
                      </button>
                    )}

                    {/* Delete */}
                    <button type="button" onClick={() => handleRemove(step._id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f85149"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#374151"; }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}

              {/* Always-visible add row */}
              <div
                style={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderBottom: "1px solid #161b22", background: isAddRowActive ? `rgba(212,29,60,0.04)` : "transparent", cursor: isAddRowActive ? "default" : "pointer", transition: "background 0.15s" }}
                onClick={() => { if (!isAddRowActive) activateAddRow(); }}
                onMouseEnter={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "rgba(212,29,60,0.02)"; }}
                onMouseLeave={e => { if (!isAddRowActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ color: isAddRowActive ? PRIMARY : "#374151", flexShrink: 0, display: "flex" }}><Plus size={14} /></span>
                {isAddRowActive ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    {addingParentId && (
                      <span style={{ fontSize: 9, color: PRIMARY, fontWeight: 600 }}>
                        Podzadanie: {steps.find(s => s._id === addingParentId)?.title ?? ""}
                      </span>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input ref={newInputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        placeholder={addingParentId ? "Nazwa podzadania…" : "Nazwa zadania… (Enter)"}
                        onBlur={() => { if (!newTitle.trim()) { setIsAddRowActive(false); setAddingParentId(null); } }}
                        onKeyDown={e => { if (e.key === "Enter") void handleAddTask(); if (e.key === "Escape") { setIsAddRowActive(false); setNewTitle(""); setAddingParentId(null); } }}
                        style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${PRIMARY}`, color: "#f0f6fc", fontSize: 13, padding: "2px 0", outline: "none" }} />
                      <button type="button" onMouseDown={e => { e.preventDefault(); void handleAddTask(); }}
                        style={{ background: PRIMARY, border: "none", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", cursor: "pointer", flexShrink: 0 }}>Dodaj</button>
                      <button type="button" onMouseDown={e => { e.preventDefault(); setIsAddRowActive(false); setNewTitle(""); setAddingParentId(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0, padding: 2 }}><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "#374151", userSelect: "none" }}>Dodaj zadanie…</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <div style={{ minWidth: days.length * DAY_WIDTH, position: "relative" }}>

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
                {days.map(day => (
                  <div key={day.dateStr} style={{ width: DAY_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid #21262d", background: day.isToday ? `${PRIMARY}12` : day.isWeekend ? "rgba(255,255,255,0.01)" : "transparent" }}>
                    <span style={{ fontSize: 9, color: day.isToday ? PRIMARY : day.isWeekend ? "#374151" : "#8b949e", fontWeight: 700 }}>{day.label}</span>
                    <span style={{ fontSize: 12, color: day.isToday ? PRIMARY : day.isWeekend ? "#475569" : "#c9d1d9", fontWeight: day.isToday ? 800 : 400 }}>{day.dayNum}</span>
                  </div>
                ))}
              </div>

              {/* Rows + SVG overlay wrapper */}
              <div style={{ position: "relative" }}>

                {/* Task rows */}
                {flatRows.map((row, index) => {
                  const { step, depth } = row;
                  const dates = localDates[step._id];
                  const isSubtask = depth === 1;

                  let barLeft = 0, barWidth = 0;
                  if (dates) {
                    const si = days.findIndex(d => d.dateStr === dates.start);
                    const ei = days.findIndex(d => d.dateStr === dates.end);
                    if (si !== -1) {
                      barLeft = si * DAY_WIDTH + 3;
                      barWidth = ((ei !== -1 ? ei : si) - si + 1) * DAY_WIDTH - 6;
                    }
                  }

                  const barH = isSubtask ? BAR_H_SUB : BAR_H;
                  const barTop = isSubtask ? BAR_TOP_SUB : BAR_TOP;
                  const isMutating = mutatingId === step._id;

                  return (
                    <div key={step._id} style={{ display: "flex", position: "relative", height: ROW_HEIGHT, borderBottom: "1px solid #161b22", background: step.done ? "rgba(63,185,80,0.02)" : index % 2 === 0 ? "#0d1117" : "#0f1318" }}>
                      {days.map(day => (
                        <div key={day.dateStr} style={{ width: DAY_WIDTH, flexShrink: 0, height: ROW_HEIGHT, borderRight: "1px solid #161b22", background: day.isToday ? `${PRIMARY}05` : day.isWeekend ? "rgba(255,255,255,0.006)" : "transparent" }} />
                      ))}

                      {/* Bar */}
                      {dates && barWidth > 0 && (
                        <div
                          style={{ position: "absolute", left: barLeft, top: barTop, width: barWidth, height: barH, background: step.done ? "linear-gradient(135deg,rgba(63,185,80,0.22),rgba(63,185,80,0.12))" : isSubtask ? `linear-gradient(135deg,rgba(212,29,60,0.22),rgba(212,29,60,0.12))` : `linear-gradient(135deg,rgba(212,29,60,0.32),rgba(212,29,60,0.18))`, border: `1px solid ${step.done ? "#3fb95066" : PRIMARY + (isSubtask ? "44" : "77")}`, borderRadius: isSubtask ? 5 : 7, cursor: "grab", opacity: isMutating ? 0.5 : 1, transition: "opacity 0.15s", display: "flex", flexDirection: "column", justifyContent: "center", userSelect: "none", overflow: "hidden", boxShadow: step.done ? "0 2px 8px rgba(63,185,80,0.14)" : `0 2px 8px rgba(212,29,60,${isSubtask ? "0.12" : "0.22"})` }}
                          onMouseDown={e => handleBarMouseDown(e, "move", step)}
                        >
                          {/* Resize left */}
                          <div style={{ position: "absolute", left: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }} onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-start", step); }} />

                          {/* Bar content */}
                          <div style={{ padding: "0 10px 0 12px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                            {/* Title row */}
                            <span style={{ fontSize: isSubtask ? 11 : 13, color: step.done ? "#3fb950" : "#f0f6fc", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {step.done ? "✓ " : ""}{step.title}
                            </span>
                            {/* Date + duration row */}
                            <span style={{ fontSize: 10, color: step.done ? "#3fb95099" : `${PRIMARY}cc`, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {fmtDate(dates.start)} → {fmtDate(dates.end)} · {getDaysDiff(dates.start, dates.end) + 1}d
                            </span>
                            {/* Assignee row (only on parent bars with enough space) */}
                            {!isSubtask && step.assigneeId && usersMap.get(step.assigneeId) && (
                              <span style={{ fontSize: 10, color: `${getUserColor(step.assigneeId)}cc`, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                👤 {usersMap.get(step.assigneeId)?.name}
                              </span>
                            )}
                          </div>

                          {/* Resize right */}
                          <div style={{ position: "absolute", right: 0, top: 0, width: 8, height: "100%", cursor: "ew-resize" }} onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, "resize-end", step); }} />
                        </div>
                      )}

                      {/* No-date button */}
                      {!dates && (
                        <div style={{ position: "absolute", left: isSubtask ? SUB_INDENT + 10 : 10, top: barTop, height: barH, display: "flex", alignItems: "center" }}>
                          <button type="button" onClick={() => handleQuickDate(step)}
                            style={{ background: "#161b22", border: "1px dashed #30363d", borderRadius: 5, color: "#475569", fontSize: 10, padding: "3px 10px", cursor: "pointer" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.color = PRIMARY; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#475569"; }}>
                            + Ustaw datę
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add row placeholder */}
                {isAddRowActive && (
                  <div style={{ height: ROW_HEIGHT, display: "flex", alignItems: "center", borderBottom: "1px solid #161b22", background: `rgba(212,29,60,0.02)` }}>
                    {days.map(day => <div key={day.dateStr} style={{ width: DAY_WIDTH, flexShrink: 0, height: ROW_HEIGHT, borderRight: "1px solid #161b22" }} />)}
                  </div>
                )}

                {/* ── SVG dependency lines ── */}
                {depLines.length > 0 && (
                  <svg
                    style={{ position: "absolute", top: 0, left: 0, width: days.length * DAY_WIDTH, height: totalTimelineHeight, pointerEvents: "none", zIndex: 15, overflow: "visible" }}
                  >
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.75)" />
                      </marker>
                    </defs>
                    {depLines.map((line, i) => {
                      const cx1 = line.x1 + Math.max(24, Math.abs(line.x2 - line.x1) * 0.3);
                      const cx2 = line.x2 - Math.max(24, Math.abs(line.x2 - line.x1) * 0.3);
                      return (
                        <path
                          key={i}
                          d={`M${line.x1},${line.y1} C${cx1},${line.y1} ${cx2},${line.y2} ${line.x2},${line.y2}`}
                          stroke="rgba(255,255,255,0.75)"
                          strokeWidth={2}
                          strokeDasharray="7,4"
                          fill="none"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import { ownerInitials } from "../_lib/quotes";
import { usePermissions } from "../_lib/permissions";
import { UserFilterBar } from "../_components/user-filter-bar";
import "./panel.css";

type TaskWithQuote = Doc<"tasks"> & {
  quote: { code: string; contactName: string };
};
type TaskStatus = TaskWithQuote["status"];

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "todo", label: "TODO", accent: "#8b949e" },
  { id: "in_progress", label: "IN PROGRESS", accent: "#79c0ff" },
  { id: "done", label: "DONE", accent: "#3fb950" },
];

const TODAY = new Date("2026-05-25");

function parseDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function daysFromToday(iso: string | undefined): number | null {
  const d = parseDate(iso);
  if (d === null) return null;
  const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((x.getTime() - t.getTime()) / 86_400_000);
}

function dueTone(iso: string | undefined): "overdue" | "soon" | "ok" | "none" {
  const days = daysFromToday(iso);
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= 2) return "soon";
  return "ok";
}

function formatDueShort(iso: string | undefined): string {
  if (!iso) return "—";
  const days = daysFromToday(iso);
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  if (days === -1) return "wczoraj";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" });
}

function pickFirstName(name: string | null, email: string | null): string | null {
  const base = name?.trim() || email?.trim() || "";
  if (!base) return null;
  return base.split(" ")[0].split("@")[0];
}

function greetingFor(h: number): string {
  if (h >= 5 && h < 12) return "Dzień dobry";
  if (h >= 12 && h < 18) return "Dzień dobry";
  return "Dobry wieczór";
}

function useGreeting(): string {
  const [hour, setHour] = useState(12);
  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    tick();
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return greetingFor(hour);
}

type AssignableUser = {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
};

export default function PanelPage() {
  const { user, isLoading } = usePermissions();
  const greeting = useGreeting();
  const tasks = (useQuery(api.tasks.listMine) ?? []) as TaskWithQuote[];
  const assignees = (useQuery(api.users.listAssignable) ?? []) as AssignableUser[];
  const setStatus = useMutation(api.tasks.setStatus);
  const [activeTask, setActiveTask] = useState<TaskWithQuote | null>(null);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const currentUserId = assignees.find((u) => u._id === user?._id)?._id; // or from user context

  const allUsersRaw = useQuery(api.users.listAllAssignable) ?? [];
  const allUsers = useMemo(() => {
    return [...allUsersRaw].sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return (a.name || a.email || "").localeCompare(b.name || b.email || "");
    });
  }, [allUsersRaw]);

  const filteredTasks = useMemo(() => {
    if (selectedUserIds.length === 0) return tasks;
    return tasks.filter((t) => {
      // If task has no assignees, we can decide whether to show it. We'll hide it if filters are active.
      if (!t.assigneeIds || t.assigneeIds.length === 0) return false;
      return t.assigneeIds.some((id) => selectedUserIds.includes(id as string));
    });
  }, [tasks, selectedUserIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, TaskWithQuote[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of filteredTasks) map[t.status].push(t);
    return map;
  }, [filteredTasks]);

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    setActiveTask(
      tasks.find((t) => (t._id as unknown as string) === id) ?? null,
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    if (!e.over) return;
    const taskId = e.active.id as Id<"tasks">;
    const newStatus = e.over.id as TaskStatus;
    const task = tasks.find(
      (t) => (t._id as unknown as string) === (taskId as unknown as string),
    );
    if (!task || task.status === newStatus) return;
    void setStatus({ id: taskId, status: newStatus });
  }

  const firstName = pickFirstName(user?.name ?? null, user?.email ?? null);
  const greetingLine = isLoading
    ? "…"
    : `${greeting}${firstName ? `, ${firstName}` : ""}!`;

  const isSuperAdmin = user?.role?.name === "super_admin";
  const subTitle = isSuperAdmin
    ? "Wszystkie zadania przypisane do użytkowników w systemie."
    : "Twoje zadania przypisane bezpośrednio do Ciebie oraz z powiązanych wycen.";

  return (
    <main className="fluent-content panel-page">
      <header className="panel-greeting">
        <h1 className="panel-greeting-title">{greetingLine}</h1>
        <p className="panel-greeting-sub">
          {subTitle}
        </p>
      </header>

      {tasks.length === 0 ? (
        <div className="panel-empty">
          <div className="panel-empty-icon">
            <I.check s={22} sw={2} />
          </div>
          <div className="panel-empty-title">Brak zadań</div>
          <div className="panel-empty-sub">
            Nie masz aktualnie przypisanych zadań. Zadania możesz utworzyć
            w widoku szczegółów wyceny.
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {allUsers.length > 0 && (
            <UserFilterBar
              users={allUsers as { _id: string; name: string | null; email: string | null }[]}
              selectedUserIds={selectedUserIds}
              currentUserId={currentUserId as string | undefined}
              onToggle={(id, isMe) => {
                setSelectedUserIds((prev) => {
                  if (prev.includes(id)) {
                    return prev.filter((pid) => pid !== id);
                  } else {
                    return [...prev, id];
                  }
                });
              }}
              label="Filtruj przypisane zadania"
              variant="chip"
            />
          )}

          <div className="panel-tasks-board">
            {COLUMNS.map((col) => (
              <PanelKanbanColumn
                key={col.id}
                col={col}
                tasks={byColumn[col.id]}
                assignees={assignees}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <PanelTaskCard
                task={activeTask}
                assignees={assignees}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  );
}

function PanelKanbanColumn({
  col,
  tasks,
  assignees,
}: {
  col: { id: TaskStatus; label: string; accent: string };
  tasks: TaskWithQuote[];
  assignees: AssignableUser[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`quote-detail-tasks-col${isOver ? " is-over" : ""}`}
      style={{ "--col-accent": col.accent } as React.CSSProperties}
    >
      <div className="quote-detail-tasks-col-head">
        <span className="quote-detail-tasks-col-dot" />
        <span className="quote-detail-tasks-col-label">{col.label}</span>
        <span className="quote-detail-tasks-col-count">{tasks.length}</span>
      </div>

      <div className="quote-detail-tasks-col-body">
        {tasks.length === 0 ? (
          <div className="panel-col-empty">—</div>
        ) : (
          tasks.map((t) => (
            <PanelTaskCard
              key={t._id as unknown as string}
              task={t}
              assignees={assignees}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PanelTaskCard({
  task,
  assignees,
  isOverlay,
}: {
  task: TaskWithQuote;
  assignees: AssignableUser[];
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id as unknown as string,
    disabled: isOverlay,
  });

  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const assignTask = useMutation(api.tasks.assign);
  const [editing, setEditing] = useState(false);

  const tone = dueTone(task.dueDate);
  const draggable = !isOverlay && !editing;

  const toneColor = tone === "overdue" ? "#f85149" : tone === "soon" ? "#d29922" : "#3fb950";

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card panel-task-card${isDragging ? " is-dragging" : ""}${isOverlay ? " is-overlay" : ""}${draggable ? " is-draggable" : ""}`}
      style={{ opacity: isDragging && !isOverlay ? 0 : 1 }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div
        className="kanban-card-rail"
        style={{
          background: `linear-gradient(90deg, ${toneColor}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div className="kanban-card-head" style={{ flexWrap: "wrap", gap: "6px" }}>
        {editing ? (
          <input
            type="text"
            defaultValue={task.title}
            autoFocus
            onBlur={(e) => {
              const v = e.target.value.trim();
              setEditing(false);
              if (v && v !== task.title) {
                void updateTask({ id: task._id, title: v });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="quote-detail-task-card-title-input"
            style={{ flex: 1, minWidth: "120px" }}
          />
        ) : (
          <button
            type="button"
            className="kanban-card-id"
            style={{ background: "none", border: "none", cursor: "text", padding: 0, flex: 1, textAlign: "left", whiteSpace: "normal" }}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {task.title}
          </button>
        )}

        {task.quote && (
          <Link
            href={`/admin/wyceny/${encodeURIComponent(task.quote.code)}`}
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
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              textDecoration: "none"
            }}
            title={`${task.quote.code} · ${task.quote.contactName}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            🏷️ {task.quote.code}
          </Link>
        )}

        <div className="kanban-card-owner" onPointerDown={(e) => e.stopPropagation()}>
          <AssigneePicker
            assignees={assignees}
            currentIds={task.assigneeIds ?? []}
            disabled={isOverlay}
            onAssign={(userIds) =>
              void assignTask({ id: task._id, assigneeIds: userIds })
            }
          />
        </div>
      </div>

      <div className="kanban-card-client" style={{ marginTop: "4px" }}>
        {task.quote ? task.quote.contactName : "Zadanie wewnętrzne"}
      </div>

      {task.description && (
        <div className="kanban-card-client" style={{ whiteSpace: "pre-wrap", opacity: 0.6, fontSize: "11px", marginTop: "2px" }}>
          {task.description}
        </div>
      )}

      <div className="kanban-card-footer" style={{ marginTop: "8px", alignItems: "center" }}>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <DueDatePicker
            dueDate={task.dueDate}
            tone={tone}
            disabled={isOverlay}
            onChange={(d) =>
              void updateTask({ id: task._id, dueDate: d ?? null })
            }
          />
        </div>

        {!isOverlay && (
          <button
            type="button"
            className="quote-detail-task-card-remove"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void removeTask({ id: task._id })}
            aria-label="Usuń zadanie"
          >
            <I.trash s={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function AssigneePicker({
  assignees,
  currentIds,
  disabled,
  onAssign,
}: {
  assignees: AssignableUser[];
  currentIds: Id<"users">[];
  disabled?: boolean;
  onAssign: (userIds: Id<"users">[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="quote-detail-task-assignee" ref={wrapperRef}>
      <button
        type="button"
        className={`quote-detail-task-assignee-btn${currentIds.length > 0 ? "" : " is-empty"}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={currentIds.length > 0 ? `${currentIds.length} przypisanych` : "Przypisz osoby"}
      >
        {currentIds.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
            {currentIds.map((id, index) => {
              const u = assignees.find((a) => a._id === id);
              const label = u?.name?.trim() || u?.email?.trim() || "—";
              const firstName = label.split(" ")[0];
              return (
                <span
                  key={id}
                  className="quote-detail-task-assignee-badge"
                  title={label}
                  style={{
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {firstName}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="quote-detail-task-assignee-empty">
            <I.userPlus s={12} sw={2} />
          </span>
        )}
      </button>
      {open && (
        <div className="quote-detail-task-assignee-popover" role="listbox" style={{ padding: "4px" }}>
          {assignees.map((u) => {
            const label = u.name?.trim() || u.email?.trim() || "—";
            const active = currentIds.includes(u._id);
            return (
              <button
                key={u._id as unknown as string}
                type="button"
                role="option"
                aria-selected={active}
                className={`quote-detail-task-assignee-option${active ? " is-active" : ""}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 8px" }}
                onClick={() => {
                  const nextIds = active
                    ? currentIds.filter((id) => id !== u._id)
                    : [...currentIds, u._id];
                  onAssign(nextIds);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar">
                    {ownerInitials(label)}
                  </span>
                  <span>{label}</span>
                </div>
                {active && (
                  <span style={{ color: "#3fb950", fontSize: "12px", marginLeft: "8px" }}>✓</span>
                )}
              </button>
            );
          })}
          {currentIds.length > 0 && (
            <div style={{ borderTop: "1px solid #21262d", marginTop: "4px", paddingTop: "4px" }}>
              <button
                type="button"
                className="quote-detail-task-assignee-option"
                style={{ width: "100%", color: "#f85149", justifyContent: "center", padding: "6px" }}
                onClick={() => {
                  onAssign([]);
                  setOpen(false);
                }}
              >
                <span>Wyczyść przypisania</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DueDatePicker({
  dueDate,
  tone,
  disabled,
  onChange,
}: {
  dueDate?: string;
  tone: "overdue" | "soon" | "ok" | "none";
  disabled?: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="quote-detail-task-due" ref={wrapperRef}>
      <button
        type="button"
        className={`quote-detail-task-due-btn tone-${tone}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <I.cal s={11} />
        <span>{formatDueShort(dueDate)}</span>
      </button>
      {open && (
        <div className="quote-detail-task-due-popover">
          <input
            type="date"
            defaultValue={dueDate ?? ""}
            onChange={(e) => {
              onChange(e.target.value || null);
              setOpen(false);
            }}
            className="quote-detail-task-due-input"
          />
          {dueDate && (
            <button
              type="button"
              className="quote-detail-task-due-clear"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Wyczyść
            </button>
          )}
        </div>
      )}
    </div>
  );
}

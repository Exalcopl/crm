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

function pickFirstName(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const first = name.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (email) {
    const local = email.split("@")[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "";
}

function greetingFor(hour: number): string {
  if (hour >= 22 || hour < 5) return "Witaj z powrotem";
  if (hour < 12) return "Dzień dobry";
  if (hour < 18) return "Dzień dobry";
  return "Dobry wieczór";
}

function useGreeting(): string {
  const [hour, setHour] = useState<number>(() => new Date().getHours());
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, TaskWithQuote[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

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

  return (
    <main className="fluent-content panel-page">
      <header className="panel-greeting">
        <h1 className="panel-greeting-title">{greetingLine}</h1>
        <p className="panel-greeting-sub">
          Twoje zadania ze wszystkich aktywnych wycen.
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

  const assignee = assignees.find(
    (a) =>
      (a._id as unknown as string) === (task.assigneeId as unknown as string),
  );
  const assigneeName =
    assignee?.name?.trim() || assignee?.email?.trim() || null;
  const tone = dueTone(task.dueDate);

  const draggable = !isOverlay && !editing;

  return (
    <div
      ref={setNodeRef}
      className={`quote-detail-task-card panel-task-card${isDragging ? " is-dragging" : ""}${isOverlay ? " is-overlay" : ""}${draggable ? " is-draggable" : ""}`}
      style={{ opacity: isDragging && !isOverlay ? 0 : 1 }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div className="quote-detail-task-card-top">
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
          />
        ) : (
          <button
            type="button"
            className="quote-detail-task-card-title"
            onClick={() => setEditing(true)}
          >
            {task.title}
          </button>
        )}
        {!isOverlay && (
          <button
            type="button"
            className="quote-detail-task-card-remove"
            onClick={() => void removeTask({ id: task._id })}
            aria-label="Usuń zadanie"
          >
            <I.trash s={11} />
          </button>
        )}
      </div>

      <Link
        href={`/admin/wyceny/${encodeURIComponent(task.quote.code)}`}
        className="panel-task-card-quote"
        title={`${task.quote.code} · ${task.quote.contactName}`}
      >
        <span className="panel-task-card-quote-code">{task.quote.code}</span>
        <span className="panel-task-card-quote-sep">·</span>
        <span className="panel-task-card-quote-client">
          {task.quote.contactName}
        </span>
      </Link>

      <div className="quote-detail-task-card-foot">
        <AssigneePicker
          assignees={assignees}
          currentId={task.assigneeId}
          currentName={assigneeName}
          disabled={isOverlay}
          onAssign={(userId) =>
            void assignTask({ id: task._id, assigneeId: userId })
          }
        />
        <DueDatePicker
          dueDate={task.dueDate}
          tone={tone}
          disabled={isOverlay}
          onChange={(d) =>
            void updateTask({ id: task._id, dueDate: d ?? null })
          }
        />
      </div>
    </div>
  );
}

function AssigneePicker({
  assignees,
  currentId,
  currentName,
  disabled,
  onAssign,
}: {
  assignees: AssignableUser[];
  currentId: Id<"users"> | null;
  currentName: string | null;
  disabled?: boolean;
  onAssign: (userId: Id<"users"> | null) => void;
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
        className={`quote-detail-task-assignee-btn${currentId ? "" : " is-empty"}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={currentName ?? "Przypisz osobę"}
      >
        {currentId ? (
          <span className="kanban-card-owner-avatar quote-detail-task-assignee-avatar">
            {ownerInitials(currentName ?? "—")}
          </span>
        ) : (
          <span className="quote-detail-task-assignee-empty">
            <I.userPlus s={12} sw={2} />
          </span>
        )}
      </button>
      {open && (
        <div className="quote-detail-task-assignee-popover" role="listbox">
          <button
            type="button"
            className={`quote-detail-task-assignee-option${currentId === null ? " is-active" : ""}`}
            onClick={() => {
              onAssign(null);
              setOpen(false);
            }}
          >
            <span className="quote-detail-task-assignee-option-avatar">—</span>
            <span>Bez przypisania</span>
          </button>
          {assignees.map((u) => {
            const label = u.name?.trim() || u.email?.trim() || "—";
            const active =
              (u._id as unknown as string) === (currentId as unknown as string);
            return (
              <button
                key={u._id as unknown as string}
                type="button"
                role="option"
                aria-selected={active}
                className={`quote-detail-task-assignee-option${active ? " is-active" : ""}`}
                onClick={() => {
                  onAssign(u._id);
                  setOpen(false);
                }}
              >
                <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar">
                  {ownerInitials(label)}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Quote } from "@/app/admin/_lib/quotes";
import { ownerInitials } from "@/app/admin/_lib/quotes";
import { I } from "@/app/admin/_lib/icons";

type TaskDoc = Doc<"tasks">;
type TaskStatus = TaskDoc["status"];

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const TODAY = new Date("2026-05-25");

function parseDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function daysFromToday(iso: string | undefined): number | null {
  const d = parseDate(iso);
  if (!d) return null;
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

type AssignableUser = {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  isCurrentUser: boolean;
};

export function TasksKanban({
  quote,
  archived,
}: {
  quote: Quote;
  archived: boolean;
}) {
  const tasksRaw = useQuery(api.tasks.list, { quoteId: quote._id });
  const tasks = useMemo(() => (tasksRaw ?? []) as TaskDoc[], [tasksRaw]);
  const assignees = (useQuery(api.users.listAllAssignable) ?? []) as AssignableUser[];
  const setStatus = useMutation(api.tasks.setStatus);

  const sorted = useMemo(() => {
    const order: Record<TaskStatus, number> = { todo: 0, in_progress: 1, done: 2 };
    return [...tasks].sort((a, b) => order[a.status] - order[b.status]);
  }, [tasks]);

  return (
    <div className="quote-detail-tasks">
      <header className="quote-detail-tasks-head">
        <div className="quote-detail-tasks-title">
          <span className="quote-detail-tasks-icon"><I.check s={14} sw={2.2} /></span>
          <span>Zadania</span>
          <span className="quote-detail-tasks-count">{tasks.length}</span>
        </div>
      </header>

      <div className="quote-detail-todo-list">
        {sorted.map((task) => (
          <TodoRow
            key={task._id as unknown as string}
            task={task}
            assignees={assignees}
            archived={archived}
            onCycleStatus={() =>
              void setStatus({ id: task._id, status: STATUS_CYCLE[task.status] })
            }
          />
        ))}
        {!archived && <AddTaskRow quoteId={quote._id} />}
      </div>
    </div>
  );
}

function TodoRow({
  task,
  assignees,
  archived,
  onCycleStatus,
}: {
  task: TaskDoc;
  assignees: AssignableUser[];
  archived: boolean;
  onCycleStatus: () => void;
}) {
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const assignTask = useMutation(api.tasks.assign);
  const [editing, setEditing] = useState(false);
  const tone = dueTone(task.dueDate);

  const assignee = assignees.find(
    (a) => (a._id as unknown as string) === (task.assigneeId as unknown as string),
  );
  const assigneeName = assignee?.name?.trim() || assignee?.email?.trim() || null;

  return (
    <div className={`quote-detail-todo-row${task.status === "done" ? " is-done" : ""}${task.status === "in_progress" ? " is-progress" : ""}`}>
      <button
        type="button"
        className={`quote-detail-todo-status status-${task.status}`}
        onClick={onCycleStatus}
        disabled={archived}
        title={task.status === "todo" ? "Zacznij" : task.status === "in_progress" ? "Ukończ" : "Cofnij"}
      >
        {task.status === "done" && <I.check s={10} sw={2.5} />}
        {task.status === "in_progress" && <span className="todo-status-dot" />}
      </button>

      {editing ? (
        <input
          type="text"
          defaultValue={task.title}
          autoFocus
          className="quote-detail-todo-title-input"
          onBlur={(e) => {
            const v = e.target.value.trim();
            setEditing(false);
            if (v && v !== task.title) void updateTask({ id: task._id, title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="quote-detail-todo-title"
          onClick={() => !archived && setEditing(true)}
          disabled={archived}
        >
          {task.title}
        </button>
      )}

      <div className="quote-detail-todo-meta">
        <AssigneePicker
          assignees={assignees}
          currentId={task.assigneeId}
          currentName={assigneeName}
          disabled={archived}
          onAssign={(userId) => void assignTask({ id: task._id, assigneeId: userId })}
        />
        <DueDatePicker
          dueDate={task.dueDate}
          tone={tone}
          disabled={archived}
          onChange={(d) => void updateTask({ id: task._id, dueDate: d ?? null })}
        />
        {!archived && (
          <button
            type="button"
            className="quote-detail-todo-remove"
            onClick={() => void removeTask({ id: task._id })}
            aria-label="Usuń zadanie"
          >
            <I.trash s={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function AddTaskRow({ quoteId }: { quoteId: Id<"quotes"> }) {
  const addTask = useMutation(api.tasks.add);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setAdding(true);
    try {
      await addTask({ quoteId, title, status: "todo" });
      setDraft("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <form className="quote-detail-todo-add" onSubmit={(e) => void submit(e)}>
      <span className="quote-detail-todo-add-icon"><I.plus s={11} sw={2} /></span>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Dodaj zadanie..."
        disabled={adding}
        className="quote-detail-todo-add-input"
      />
    </form>
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
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
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

  const me = assignees.find((u) => u.isCurrentUser) ?? null;
  const meLabel = me ? me.name?.trim() || me.email?.trim() || "—" : null;
  const meIsAssigned =
    me !== null &&
    (me._id as unknown as string) === (currentId as unknown as string);

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
            onClick={() => { onAssign(null); setOpen(false); }}
          >
            <span className="quote-detail-task-assignee-option-avatar">—</span>
            <span>Bez przypisania</span>
          </button>
          {me && !meIsAssigned && (
            <button
              type="button"
              className="quote-detail-task-assignee-option quote-detail-task-assignee-option-me"
              onClick={() => { onAssign(me._id); setOpen(false); }}
              title={meLabel ?? undefined}
            >
              <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar quote-detail-task-assignee-option-avatar-me">
                {ownerInitials(meLabel ?? "—")}
              </span>
              <span>Przypisz mnie</span>
              <span className="quote-detail-task-assignee-option-me-name">({meLabel})</span>
            </button>
          )}
          <div className="quote-detail-task-assignee-sep" aria-hidden />
          {assignees.map((u) => {
            const label = u.name?.trim() || u.email?.trim() || "—";
            const active = (u._id as unknown as string) === (currentId as unknown as string);
            return (
              <button
                key={u._id as unknown as string}
                type="button"
                role="option"
                aria-selected={active}
                className={`quote-detail-task-assignee-option${active ? " is-active" : ""}`}
                onClick={() => { onAssign(u._id); setOpen(false); }}
              >
                <span className="kanban-card-owner-avatar quote-detail-task-assignee-option-avatar">
                  {ownerInitials(label)}
                </span>
                <span>
                  {label}
                  {u.isCurrentUser && (
                    <span className="quote-detail-task-assignee-option-tag">Ty</span>
                  )}
                </span>
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
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
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
            onChange={(e) => { onChange(e.target.value || null); setOpen(false); }}
            className="quote-detail-task-due-input"
          />
          {dueDate && (
            <button
              type="button"
              className="quote-detail-task-due-clear"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Wyczyść
            </button>
          )}
        </div>
      )}
    </div>
  );
}

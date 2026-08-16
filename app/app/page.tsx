"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../admin/_lib/icons";
import { ownerInitials } from "../admin/_lib/quotes";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Types ─────────────────────────────────────────────────────────────────
type TaskStatus = "todo" | "in_progress" | "done";

interface PinSession {
  userId: string;
  email: string;
  name: string;
}

// ─── Session helpers (sessionStorage) ─────────────────────────────────────
const SESSION_KEY = "app_pin_session";

function loadSession(): PinSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PinSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PinSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Calendar helper functions ──────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // 0 = Sunday, 1 = Monday. We want Monday to be 0
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function MobileAppPage() {
  const resolvePin = useAction(api.authPin.resolvePin);

  // Session state
  const [session, setSession] = useState<PinSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Load session from sessionStorage on mount (client only)
  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setSessionReady(true);
  }, []);

  // PIN input state
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  // General navigation view: "tasks" | "calendar"
  const [activeView, setActiveView] = useState<"tasks" | "calendar">("tasks");
  const [fabExpanded, setFabExpanded] = useState(false);

  // Custom premium modal/toast alerts and confirms
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function triggerConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmDialog({ title, message, onConfirm });
  }

  function triggerToast(message: string, type: "success" | "error" = "success") {
    setToastMsg({ message, type });
  }

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Task UI state
  const [activeTab, setActiveTab] = useState<"all" | TaskStatus>("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  // Calendar UI state
  const todayDate = new Date();
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`
  );
  const [calendarType, setCalendarType] = useState<"private" | "company">("private");

  // Calendar event modal state
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("10:00");
  const [eventCategory, setEventCategory] = useState("general");
  const [eventIsPrivate, setEventIsPrivate] = useState(false);
  const [editingEventId, setEditingEventId] = useState<Id<"calendarEvents"> | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);

  // Pre-select current user on task modal open
  useEffect(() => {
    if (newTaskOpen && session) {
      setSelectedAssignees([session.userId]);
    }
  }, [newTaskOpen, session]);

  // Pre-select current date on event modal open
  useEffect(() => {
    if (newEventOpen && !eventDate) {
      setEventDate(selectedDateStr);
    }
  }, [newEventOpen, selectedDateStr, eventDate]);

  // Convex queries – skip when no session
  const tasks = useQuery(
    api.tasks.listForUser,
    session ? { userId: session.userId } : "skip",
  );
  const assignees = useQuery(
    api.users.listAllAssignableForApp,
    session ? { currentUserId: session.userId } : "skip",
  );
  const categories = useQuery(
    api.calendarCategories.listForApp,
    session ? {} : "skip",
  ) ?? [];

  // Monthly date ranges
  const monthStartRange = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const monthEndRange = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(getDaysInMonth(currentYear, currentMonth)).padStart(2, "0")}`;

  const privateEvents = useQuery(
    api.calendarEvents.listPrivateEventsByRangeForApp,
    session
      ? {
          startDate: monthStartRange,
          endDate: monthEndRange,
          userIds: [session.userId as any],
          currentUserId: session.userId,
        }
      : "skip",
  ) ?? [];

  const companyEvents = useQuery(
    api.calendarEvents.listCompanyEventsByRangeForApp,
    session
      ? {
          startDate: monthStartRange,
          endDate: monthEndRange,
          currentUserId: session.userId,
        }
      : "skip",
  ) ?? [];

  // Active events list
  const activeEvents = calendarType === "private" ? privateEvents : companyEvents;

  // Mutations
  const updateTaskStatus = useMutation(api.tasks.setStatusForApp);
  const createTask = useMutation(api.tasks.addForApp);
  const createEvent = useMutation(api.calendarEvents.createEventForApp);
  const updateEvent = useMutation(api.calendarEvents.updateEventForApp);
  const removeEvent = useMutation(api.calendarEvents.removeEventForApp);

  // ── PIN keypad handler ──
  async function handleKeyPress(key: string) {
    if (authenticating) return;
    setAuthError(null);

    let next = pinInput;
    if (key === "backspace") next = pinInput.slice(0, -1);
    else if (key === "clear") next = "";
    else if (/^\d$/.test(key) && pinInput.length < 6) next = pinInput + key;
    setPinInput(next);

    // Auto-submit at 4+ digits
    if (next.length >= 4 && key !== "backspace" && key !== "clear") {
      setAuthenticating(true);
      try {
        const result = await resolvePin({ pin: next });
        if (!result) {
          setAuthError("Niepoprawny kod PIN lub brak przypisanego konta.");
          setPinInput("");
          return;
        }
        const s: PinSession = {
          userId: result.userId,
          email: result.email,
          name: result.name,
        };
        saveSession(s);
        setSession(s);
        setPinInput("");
      } catch {
        setAuthError("Błąd połączenia. Spróbuj ponownie.");
        setPinInput("");
      } finally {
        setAuthenticating(false);
      }
    }
  }

  // ── Create task ──
  async function handleCreateTask() {
    if (!taskTitle.trim() || !session) return;
    setCreatingTask(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        dueDate: taskDueDate || undefined,
        assigneeIds: selectedAssignees.length > 0 ? (selectedAssignees as any[]) : [session.userId as any],
        status: "todo",
        currentUserId: session.userId,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskDueDate("");
      setNewTaskOpen(false);
      triggerToast("Zadanie zostało utworzone.", "success");
    } catch {
      triggerToast("Nie udało się utworzyć zadania.", "error");
    } finally {
      setCreatingTask(false);
    }
  }

  // ── Create or edit calendar event ──
  async function handleSaveEvent() {
    if (!eventTitle.trim() || !session) return;
    setSavingEvent(true);
    try {
      if (editingEventId) {
        await updateEvent({
          id: editingEventId,
          title: eventTitle.trim(),
          description: eventDesc.trim() || undefined,
          date: eventDate,
          startTime: eventStartTime,
          endTime: eventEndTime,
          isPrivate: eventIsPrivate,
          category: eventCategory,
          currentUserId: session.userId,
        });
        triggerToast("Wydarzenie zostało zaktualizowane.", "success");
      } else {
        await createEvent({
          title: eventTitle.trim(),
          description: eventDesc.trim() || undefined,
          date: eventDate,
          startTime: eventStartTime,
          endTime: eventEndTime,
          isPrivate: eventIsPrivate,
          color: categories.find((c: any) => c.code === eventCategory)?.color || "#64748b",
          type: calendarType,
          category: eventCategory,
          currentUserId: session.userId,
        });
        triggerToast("Wydarzenie zostało utworzone.", "success");
      }
      resetEventForm();
    } catch (err) {
      triggerToast("Nie udało się zapisać wydarzenia.", "error");
    } finally {
      setSavingEvent(false);
    }
  }

  // ── Delete event ──
  async function handleDeleteEvent(id: Id<"calendarEvents">) {
    if (!session) return;
    triggerConfirm(
      "Usuń wydarzenie",
      "Czy na pewno chcesz usunąć to wydarzenie?",
      async () => {
        try {
          await removeEvent({ id, currentUserId: session.userId });
          resetEventForm();
          triggerToast("Wydarzenie zostało usunięte.", "success");
        } catch {
          triggerToast("Nie udało się usunąć wydarzenia.", "error");
        }
      }
    );
  }

  function resetEventForm() {
    setEventTitle("");
    setEventDesc("");
    setEventDate("");
    setEventStartTime("09:00");
    setEventEndTime("10:00");
    setEventCategory("general");
    setEventIsPrivate(false);
    setEditingEventId(null);
    setNewEventOpen(false);
  }

  // ── Open event for editing ──
  function handleEditEvent(e: any) {
    setEditingEventId(e._id);
    setEventTitle(e.title);
    setEventDesc(e.description || "");
    setEventDate(e.date);
    setEventStartTime(e.startTime || "09:00");
    setEventEndTime(e.endTime || "10:00");
    setEventCategory(e.category || "general");
    setEventIsPrivate(!!e.isPrivate);
    setNewEventOpen(true);
  }

  // ── Logout ──
  function handleLogout() {
    clearSession();
    setSession(null);
    setPinInput("");
    setAuthError(null);
  }

  // ── Month nav helpers ──
  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  // Hydration guard
  if (!sessionReady) {
    return (
      <div className="pin-lock-overlay">
        <div className="pin-lock-logo">E</div>
      </div>
    );
  }

  // PIN Lock Screen
  if (!session) {
    return (
      <div className="pin-lock-overlay">
        <div className="pin-lock-brand">
          <div className="pin-lock-logo">E</div>
          <h1 className="pin-lock-title">Exalco Tasks</h1>
          <div className="pin-lock-sub">Wpisz swój PIN, aby odblokować</div>
        </div>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-dot ${pinInput.length > i ? "filled" : ""}`} />
          ))}
        </div>

        {authError && <div className="pin-error">{authError}</div>}
        {authenticating && <div className="pin-loading">Weryfikowanie…</div>}

        <div className="pin-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              className="pin-key"
              onClick={() => handleKeyPress(n)}
              disabled={authenticating}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="pin-key action-key"
            onClick={() => handleKeyPress("clear")}
            disabled={authenticating}
          >
            Usuń
          </button>
          <button
            type="button"
            className="pin-key"
            onClick={() => handleKeyPress("0")}
            disabled={authenticating}
          >
            0
          </button>
          <button
            type="button"
            className="pin-key action-key"
            onClick={() => handleKeyPress("backspace")}
            disabled={authenticating}
          >
            ⌫
          </button>
        </div>
      </div>
    );
  }

  // ── Render Views ────────────────────────────────────────────────────────
  const allTasks = (tasks ?? []) as any[];
  const counts = {
    all: allTasks.length,
    todo: allTasks.filter((t: any) => t.status === "todo").length,
    in_progress: allTasks.filter((t: any) => t.status === "in_progress").length,
    done: allTasks.filter((t: any) => t.status === "done").length,
  };
  const filteredTasks =
    activeTab === "all" ? allTasks : allTasks.filter((t: any) => t.status === activeTab);

  const taskTabs: { key: "all" | TaskStatus; label: string }[] = [
    { key: "all", label: "Wszystkie" },
    { key: "todo", label: "Do zrobienia" },
    { key: "in_progress", label: "W trakcie" },
    { key: "done", label: "Zrobione" },
  ];

  function cycleStatus(current: TaskStatus): TaskStatus {
    if (current === "todo") return "in_progress";
    if (current === "in_progress") return "done";
    return "todo";
  }

  const assigneeMap = new Map<string, any>(
    ((assignees ?? []) as any[]).map((u: any) => [u._id, u]),
  );

  // Calendar Day rendering calculations
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarCells = [];

  // Pad the start of calendar month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  // Selected day's events
  const selectedDateEvents = activeEvents.filter((e: any) => e.date === selectedDateStr);

  return (
    <>
      {/* Top Header */}
      <header className="mobile-app-header">
        <div className="mobile-app-brand">
          <div className="mobile-app-logo">E</div>
          <div>
            <h1 className="mobile-app-title">Exalco CRM</h1>
            <div className="mobile-app-sub">{session.name || session.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="mobile-header-btn mobile-header-btn--ghost"
            onClick={handleLogout}
            title="Wyloguj"
          >
            <I.signOut s={18} />
          </button>
        </div>
      </header>

      {/* ── View 1: Tasks Dashboard ── */}
      {activeView === "tasks" && (
        <>
          {/* Tabs */}
          <nav className="mobile-tabs">
            {taskTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`mobile-tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {counts[tab.key] > 0 && <span className="mobile-tab-badge">{counts[tab.key]}</span>}
              </button>
            ))}
          </nav>

          {/* Task List */}
          <main className="mobile-task-list">
            {filteredTasks.length === 0 ? (
              <div className="mobile-empty">
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
                <div>Brak zadań w tej kategorii</div>
              </div>
            ) : (
              filteredTasks.map((task: any) => {
                const isDone = task.status === "done";
                const isInProgress = task.status === "in_progress";
                return (
                  <div key={task._id} className="mobile-task-card">
                    <div className="mobile-task-card-header">
                      <h3
                        className="mobile-task-card-title"
                        style={{
                          textDecoration: isDone ? "line-through" : "none",
                          opacity: isDone ? 0.5 : 1,
                        }}
                      >
                        {task.title}
                      </h3>
                      <button
                        type="button"
                        className={`mobile-status-pill status-${task.status}`}
                        onClick={() =>
                          void updateTaskStatus({
                            id: task._id,
                            status: cycleStatus(task.status),
                            currentUserId: session.userId,
                          })
                        }
                      >
                        {isDone ? "✓ DONE" : isInProgress ? "⚡ W TRAKCIE" : "○ TODO"}
                      </button>
                    </div>

                    {task.description && (
                      <div className="mobile-task-card-desc">{task.description}</div>
                    )}

                    {task.quote && (
                      <div className="mobile-task-quote-badge">
                        <I.doc s={11} />
                        {task.quote.code} · {task.quote.contactName}
                      </div>
                    )}

                    <div className="mobile-task-card-footer">
                      <div className="mobile-task-meta">
                        <I.cal s={11} />
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString("pl-PL", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "Brak terminu"}
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {(task.assigneeIds ?? []).map((aid: string) => {
                          const u = assigneeMap.get(aid);
                          return u ? (
                            <div
                              key={aid}
                              className="kanban-card-owner-avatar"
                              title={u.name || u.email}
                            >
                              {ownerInitials(u.name || u.email)}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {/* Bottom padding for nav bar */}
            <div style={{ height: "100px" }} />
          </main>
        </>
      )}

      {/* ── View 2: Calendar Dashboard ── */}
      {activeView === "calendar" && (
        <>
          {/* Sub tabs switcher */}
          <div className="mobile-cal-sub-nav">
            <button
              type="button"
              className={`mobile-cal-sub-btn ${calendarType === "private" ? "active" : ""}`}
              onClick={() => setCalendarType("private")}
            >
              Kalendarz Prywatny
            </button>
            <button
              type="button"
              className={`mobile-cal-sub-btn ${calendarType === "company" ? "active" : ""}`}
              onClick={() => setCalendarType("company")}
            >
              Kalendarz Firmowy
            </button>
          </div>

          <main className="mobile-cal-view">
            {/* Month selector */}
            <div className="mobile-cal-month-bar">
              <button type="button" className="mobile-cal-arrow" onClick={prevMonth}>◀</button>
              <div className="mobile-cal-month-title">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </div>
              <button type="button" className="mobile-cal-arrow" onClick={nextMonth}>▶</button>
            </div>

            {/* Calendar Grid */}
            <div className="mobile-cal-grid">
              {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((dayName) => (
                <div key={dayName} className="mobile-cal-grid-header-cell">
                  {dayName}
                </div>
              ))}

              {calendarCells.map((dayNum, cellIdx) => {
                if (dayNum === null) {
                  return <div key={`empty-${cellIdx}`} className="mobile-cal-day-cell empty" />;
                }

                const cellDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isSelected = selectedDateStr === cellDateStr;
                const cellEvents = activeEvents.filter((e: any) => e.date === cellDateStr);

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    className={`mobile-cal-day-cell ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedDateStr(cellDateStr)}
                  >
                    <span className="mobile-cal-day-number">{dayNum}</span>
                    <div className="mobile-cal-day-dots">
                      {cellEvents.slice(0, 3).map((e: any, eIdx: number) => (
                        <span
                          key={`dot-${e._id || eIdx}`}
                          className="mobile-cal-day-dot"
                          style={{ background: e.color || "#d41d3c" }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Agenda (Daily events list) */}
            <div className="mobile-cal-agenda">
              <h2 className="mobile-cal-agenda-title">
                Plan dnia: {new Date(selectedDateStr).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
              </h2>

              {selectedDateEvents.length === 0 ? (
                <div className="mobile-cal-agenda-empty">Brak zaplanowanych wydarzeń</div>
              ) : (
                <div className="mobile-cal-agenda-list">
                  {selectedDateEvents.map((event: any) => (
                    <div
                      key={event._id}
                      className="mobile-cal-event-card"
                      onClick={() => handleEditEvent(event)}
                    >
                      <div
                        className="mobile-cal-event-accent"
                        style={{ background: event.color || "#d41d3c" }}
                      />
                      <div className="mobile-cal-event-content">
                        <div className="mobile-cal-event-time">
                          {event.startTime} - {event.endTime}
                        </div>
                        <h4 className="mobile-cal-event-name">{event.title}</h4>
                        {event.description && (
                          <p className="mobile-cal-event-desc">{event.description}</p>
                        )}
                      </div>
                      <span style={{ color: "var(--text-muted)", marginLeft: "8px", display: "inline-flex", flexShrink: 0 }}>
                        <I.edit s={14} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Nav height offset */}
            <div style={{ height: "100px" }} />
          </main>
        </>
      )}

      {/* ── Bottom Navigation ── */}
      <nav className={`mobile-bottom-nav ${fabExpanded ? "mobile-bottom-nav--dimmed" : ""}`}>
        {/* Zadania */}
        <button
          type="button"
          className={`mobile-nav-btn ${activeView === "tasks" ? "mobile-nav-btn--active" : ""}`}
          onClick={() => {
            setActiveView("tasks");
            setFabExpanded(false);
          }}
        >
          <I.check s={20} />
          <span className="mobile-nav-label">Zadania</span>
        </button>

        {/* Sygnet – center elevated trigger */}
        <div className={`mobile-nav-sygnet-wrap ${fabExpanded ? "mobile-nav-sygnet-wrap--expanded" : ""}`}>
          {/* Green Zadania bubble (Left) */}
          <button
            type="button"
            className="mobile-nav-bubble mobile-nav-bubble--tasks"
            onClick={() => {
              setFabExpanded(false);
              setNewTaskOpen(true);
            }}
            aria-label="Utwórz zadanie"
            title="Nowe zadanie"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>

          {/* Blue Zdarzenie bubble (Right) */}
          <button
            type="button"
            className="mobile-nav-bubble mobile-nav-bubble--events"
            onClick={() => {
              setFabExpanded(false);
              setNewEventOpen(true);
            }}
            aria-label="Utwórz zdarzenie"
            title="Nowe zdarzenie"
          >
            <I.cal s={20} />
          </button>

          {/* Red + sygnet */}
          <button
            type="button"
            className="mobile-nav-sygnet"
            onClick={() => setFabExpanded((v) => !v)}
            aria-label="Menu"
          >
            <span className={`mobile-fab-icon-wrap ${fabExpanded ? "mobile-fab-icon-wrap--rotated" : ""}`}>
              <I.plus s={24} />
            </span>
          </button>
        </div>

        {/* Kalendarz */}
        <button
          type="button"
          className={`mobile-nav-btn ${activeView === "calendar" ? "mobile-nav-btn--active" : ""}`}
          onClick={() => {
            setActiveView("calendar");
            setFabExpanded(false);
          }}
        >
          <I.cal s={20} />
          <span className="mobile-nav-label">Kalendarz</span>
        </button>
      </nav>

      {/* Backdrop to close FAB bubbles */}
      {fabExpanded && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 48 }}
          onClick={() => setFabExpanded(false)}
        />
      )}

      {/* Bottom Sheet – New/Edit Task */}
      {newTaskOpen && (
        <div
          className="mobile-sheet-backdrop"
          onClick={(e) => e.target === e.currentTarget && setNewTaskOpen(false)}
        >
          <div className="mobile-sheet">
            <div className="mobile-sheet-header">
              <h2 className="mobile-sheet-title">Nowe zadanie</h2>
              <button
                type="button"
                className="mobile-sheet-close"
                onClick={() => setNewTaskOpen(false)}
                aria-label="Zamknij"
              >
                <I.x s={20} />
              </button>
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Tytuł zadania *</label>
              <input
                className="mobile-sheet-input"
                placeholder="np. Skontaktować się z klientem..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Opis szczegółowy</label>
              <textarea
                className="mobile-sheet-input mobile-sheet-textarea"
                placeholder="Dodatkowe notatki, szczegóły..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={4}
              />
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Termin wykonania</label>
              <input
                type="date"
                className="mobile-sheet-input"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Przypisz do (Osoba odpowiedzialna)</label>
              <div className="mobile-sheet-assignees">
                {((assignees ?? []) as any[]).map((u: any) => {
                  const isSel = selectedAssignees.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      className={`mobile-sheet-assignee-chip ${isSel ? "active" : ""}`}
                      onClick={() => {
                        if (isSel) {
                          if (selectedAssignees.length > 1) {
                            setSelectedAssignees(selectedAssignees.filter((id) => id !== u._id));
                          }
                        } else {
                          setSelectedAssignees([...selectedAssignees, u._id]);
                        }
                      }}
                    >
                      <div className="kanban-card-owner-avatar-mini">
                        {ownerInitials(u.name || u.email)}
                      </div>
                      <span className="mobile-sheet-assignee-name">{u.name || u.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mobile-sheet-actions">
              <button
                type="button"
                className="mobile-sheet-btn mobile-sheet-btn--submit"
                onClick={handleCreateTask}
                disabled={creatingTask || !taskTitle.trim()}
              >
                {creatingTask ? "Zapisywanie..." : "Utwórz zadanie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet – New/Edit Calendar Event */}
      {newEventOpen && (
        <div
          className="mobile-sheet-backdrop"
          onClick={(e) => e.target === e.currentTarget && resetEventForm()}
        >
          <div className="mobile-sheet">
            <div className="mobile-sheet-header">
              <h2 className="mobile-sheet-title">
                {editingEventId ? "Edytuj wydarzenie" : "Nowe wydarzenie"}
              </h2>
              <button
                type="button"
                className="mobile-sheet-close"
                onClick={resetEventForm}
                aria-label="Zamknij"
              >
                <I.x s={20} />
              </button>
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Tytuł wydarzenia *</label>
              <input
                className="mobile-sheet-input"
                placeholder="Nazwa wydarzenia..."
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Opis (opcjonalnie)</label>
              <textarea
                className="mobile-sheet-input mobile-sheet-textarea"
                placeholder="Szczegóły wydarzenia..."
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Data</label>
              <input
                type="date"
                className="mobile-sheet-input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div className="mobile-sheet-field" style={{ flex: 1 }}>
                <label className="mobile-sheet-label">Od</label>
                <input
                  type="time"
                  className="mobile-sheet-input"
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                />
              </div>
              <div className="mobile-sheet-field" style={{ flex: 1 }}>
                <label className="mobile-sheet-label">Do</label>
                <input
                  type="time"
                  className="mobile-sheet-input"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="mobile-sheet-field">
              <label className="mobile-sheet-label">Kategoria</label>
              <select
                className="mobile-sheet-input"
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                style={{
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "40px"
                }}
              >
                {categories.map((c: any) => (
                  <option key={c.code} value={c.code} style={{ background: "var(--bg-surface, #141b2d)" }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {calendarType === "private" && (
              <div className="mobile-sheet-field-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0" }}>
                <input
                  type="checkbox"
                  id="eventIsPrivate"
                  checked={eventIsPrivate}
                  onChange={(e) => setEventIsPrivate(e.target.checked)}
                  style={{ width: "20px", height: "20px", accentColor: "#d41d3c" }}
                />
                <label htmlFor="eventIsPrivate" className="mobile-sheet-label" style={{ textTransform: "none", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                  Wydarzenie prywatne (tylko dla mnie)
                </label>
              </div>
            )}

            <div className="mobile-sheet-actions" style={{ gap: "12px" }}>
              {editingEventId && (
                <button
                  type="button"
                  className="mobile-sheet-btn"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(220, 38, 38, 0.4)",
                    color: "#f87171",
                    flex: 1
                  }}
                  onClick={() => handleDeleteEvent(editingEventId)}
                >
                  Usuń
                </button>
              )}
              <button
                type="button"
                className="mobile-sheet-btn mobile-sheet-btn--submit"
                onClick={handleSaveEvent}
                disabled={savingEvent || !eventTitle.trim()}
                style={{ flex: editingEventId ? 2 : 1 }}
              >
                {savingEvent ? "Zapisywanie..." : editingEventId ? "Zapisz zmiany" : "Utwórz wydarzenie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog Sheet ── */}
      {confirmDialog && (
        <div className="mobile-sheet-backdrop" style={{ zIndex: 110 }}>
          <div className="mobile-confirm-dialog">
            <div className="mobile-confirm-icon">
              <I.alert s={24} />
            </div>
            <h3 className="mobile-confirm-title">{confirmDialog.title}</h3>
            <p className="mobile-confirm-message">{confirmDialog.message}</p>
            <div className="mobile-confirm-actions">
              <button
                type="button"
                className="mobile-confirm-btn mobile-confirm-btn--cancel"
                onClick={() => setConfirmDialog(null)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="mobile-confirm-btn mobile-confirm-btn--confirm"
                onClick={confirmDialog.onConfirm}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Popup Banner ── */}
      {toastMsg && (
        <div className={`mobile-toast mobile-toast--${toastMsg.type}`}>
          {toastMsg.type === "success" ? <I.check s={16} /> : <I.alert s={16} />}
          <span>{toastMsg.message}</span>
        </div>
      )}
    </>
  );
}

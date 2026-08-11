"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../admin/_lib/icons";
import { ownerInitials } from "../admin/_lib/quotes";

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

  // Task UI state
  const [activeTab, setActiveTab] = useState<"all" | TaskStatus>("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [activeView, setActiveView] = useState<"tasks" | "calendar">("tasks");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  // Pre-select current user on modal open
  useEffect(() => {
    if (newTaskOpen && session) {
      setSelectedAssignees([session.userId]);
    }
  }, [newTaskOpen, session]);

  // Convex queries – skip when no session
  const tasks = useQuery(
    api.tasks.listForUser,
    session ? { userId: session.userId } : "skip",
  );
  const assignees = useQuery(
    api.users.listAllAssignableForApp,
    session ? { currentUserId: session.userId } : "skip",
  );
  const updateTaskStatus = useMutation(api.tasks.setStatus);
  const createTask = useMutation(api.tasks.add);

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
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskDueDate("");
      setNewTaskOpen(false);
    } catch {
      alert("Nie udało się utworzyć zadania.");
    } finally {
      setCreatingTask(false);
    }
  }

  // ── Logout ──
  function handleLogout() {
    clearSession();
    setSession(null);
    setPinInput("");
    setAuthError(null);
  }

  // ── Hydration guard – don't render until sessionStorage is read ──
  if (!sessionReady) {
    return (
      <div className="pin-lock-overlay">
        <div className="pin-lock-logo">E</div>
      </div>
    );
  }

  // ── PIN Lock Screen ──
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

        {authError && (
          <div className="pin-error">{authError}</div>
        )}

        {authenticating && (
          <div className="pin-loading">Weryfikowanie…</div>
        )}

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

  // ── Task View ──
  const allTasks = (tasks ?? []) as any[];
  const counts = {
    all: allTasks.length,
    todo: allTasks.filter((t: any) => t.status === "todo").length,
    in_progress: allTasks.filter((t: any) => t.status === "in_progress").length,
    done: allTasks.filter((t: any) => t.status === "done").length,
  };
  const filtered =
    activeTab === "all" ? allTasks : allTasks.filter((t: any) => t.status === activeTab);

  const tabs: { key: "all" | TaskStatus; label: string }[] = [
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

  return (
    <>
      {/* Top Header */}
      <header className="mobile-app-header">
        <div className="mobile-app-brand">
          <div className="mobile-app-logo">E</div>
          <div>
            <h1 className="mobile-app-title">Zadania</h1>
            <div className="mobile-app-sub">{session.name || session.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="mobile-header-btn"
            onClick={() => setNewTaskOpen(true)}
          >
            <I.plus s={14} /> Dodaj
          </button>
          <button
            type="button"
            className="mobile-header-btn mobile-header-btn--ghost"
            onClick={handleLogout}
            title="Wyloguj"
          >
            <I.signOut s={16} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mobile-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`mobile-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="mobile-tab-badge">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Task List */}
      <main className="mobile-task-list">
        {filtered.length === 0 ? (
          <div className="mobile-empty">
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
            <div>Brak zadań w tej kategorii</div>
          </div>
        ) : (
          filtered.map((task: any) => {
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

      {/* ── Bottom Navigation ── */}
      <nav className={`mobile-bottom-nav ${fabExpanded ? "mobile-bottom-nav--dimmed" : ""}`}>
        {/* Zadania */}
        <button
          type="button"
          className={`mobile-nav-btn ${activeView === "tasks" ? "mobile-nav-btn--active" : ""}`}
          onClick={() => { setActiveView("tasks"); setFabExpanded(false); }}
        >
          <I.check s={20} />
          <span className="mobile-nav-label">Zadania</span>
        </button>

        {/* Sygnet – center elevated trigger */}
        <div className={`mobile-nav-sygnet-wrap ${fabExpanded ? "mobile-nav-sygnet-wrap--expanded" : ""}`}>
          {/* Green Zadania bubble */}
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
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
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
          onClick={() => { setActiveView("calendar"); setFabExpanded(false); }}
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

      {/* Bottom Sheet – New Task */}
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
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../../_lib/icons";
import { ownerInitials } from "../../_lib/quotes";
import { UserFilterBar } from "../../_components/user-filter-bar";
import "../panel.css";

import { usePermissions } from "../../_lib/permissions";

export default function ArchivedTasksPage() {
  const users = useQuery(api.users.list, {});
  const tasks = useQuery(api.tasks.listArchived);
  const { user: currentUser, isLoading } = usePermissions();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  if (tasks === undefined || users === undefined || isLoading) {
    return (
      <main className="fluent-content panel-page">
        <div style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
          Ładowanie archiwum...
        </div>
      </main>
    );
  }

  const currentUserId = currentUser?._id;
  
  // Opcjonalne filtrowanie: jeśli zaznaczono kogoś, pokaż tylko przypisane do tych osób
  const filteredTasks = selectedUserIds.length > 0
    ? tasks.filter((t) => t.assigneeIds?.some((id) => selectedUserIds.includes(id)))
    : tasks;

  const allUsers = users
    .filter((u) => u.isAssignable)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <main className="fluent-content panel-page">
      <header className="panel-greeting" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="panel-greeting-title">Archiwum zadań</h1>
          <p className="panel-greeting-sub">
            Historia zakończonych zadań (status DONE).
          </p>
        </div>
        <div>
          <Link
            href="/admin/panel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              backgroundColor: "var(--bg-card-hover)",
              color: "var(--fg-muted)",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 500,
              border: "1px solid var(--border)",
            }}
          >
            <I.arrowLeft s={16} />
            Wróć do Panelu
          </Link>
        </div>
      </header>

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

      {filteredTasks.length === 0 ? (
        <div className="panel-empty" style={{ marginTop: 20 }}>
          <div className="panel-empty-icon">
            <I.archive s={22} sw={2} />
          </div>
          <div className="panel-empty-title">Archiwum puste</div>
          <div className="panel-empty-sub">
            Nie znaleziono żadnych archiwalnych zadań.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredTasks.map((task) => (
            <ArchivedTaskCard key={task._id} task={task} users={users} />
          ))}
        </div>
      )}
    </main>
  );
}

function ArchivedTaskCard({ task, users }: { task: any; users: any[] }) {
  return (
    <div className="panel-card" style={{ padding: "16px", opacity: 0.8, cursor: "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h4 className="panel-card-title">{task.title}</h4>
        <span style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>
          {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ""}
        </span>
      </div>
      {task.description && (
        <p className="panel-card-desc">{task.description}</p>
      )}
      <div className="panel-card-footer" style={{ marginTop: "12px" }}>
        {task.quote && (
          <Link href={`/admin/wyceny/${task.quote.code}`} className="panel-card-quote">
            {task.quote.code} • {task.quote.contactName}
          </Link>
        )}
        {!task.quote && <div />}
        <div className="panel-card-assignees">
          {task.assigneeIds && task.assigneeIds.length > 0 ? (
            task.assigneeIds.map((aid: string) => {
              const u = users.find((x) => x._id === aid);
              return u ? (
                <div key={aid} className="panel-assignee-avatar">
                  {ownerInitials(u.name || u.email)}
                </div>
              ) : null;
            })
          ) : (
            <div className="panel-card-unassigned">
              <I.user s={14} /> Brak przypisania
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

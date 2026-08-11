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

  const isSuperAdmin = currentUser?.role?.name === "super_admin";
  const subTitle = isSuperAdmin
    ? "Wszystkie zadania przypisane do użytkowników w systemie."
    : "Twoje zadania przypisane bezpośrednio do Ciebie oraz z powiązanych wycen.";

  const greetingLine = "Dobry wieczór, " + (currentUser?.name?.split(" ")[0] || "Super") + "!";

  return (
    <main className="fluent-content panel-page">
      <header className="panel-greeting">
        <h1 className="panel-greeting-title">{greetingLine}</h1>
        <p className="panel-greeting-sub">
          {subTitle}
        </p>
        <div style={{ marginTop: "12px" }}>
          <Link
            href="/admin/panel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: "var(--bg-card-hover)",
              color: "var(--fg-muted)",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "0.85rem",
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
            Brak zarchiwizowanych zadań spełniających kryteria.
          </div>
        </div>
      ) : (
        <div className="archive-list">
          <table className="archive-list-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Zadanie</th>
                <th style={{ width: "25%" }}>Wycena / Klient</th>
                <th style={{ width: "20%" }}>Przypisani</th>
                <th style={{ width: "15%", textAlign: "right" }}>Zakończono</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <ArchivedTaskRow key={task._id} task={task} users={users} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function ArchivedTaskRow({ task, users }: { task: any; users: any[] }) {
  return (
    <tr>
      <td>
        <div className="archive-task-title">{task.title}</div>
        {task.description && (
          <div className="archive-task-desc">
            {task.description}
          </div>
        )}
      </td>
      <td>
        {task.quote ? (
          <Link
            href={`/admin/wyceny/${task.quote.code}`}
            className="panel-task-card-quote"
            title={`${task.quote.code} · ${task.quote.contactName}`}
          >
            <span className="panel-task-card-quote-code">🏷️ {task.quote.code}</span>
            <span className="panel-task-card-quote-sep">•</span>
            <span className="panel-task-card-quote-client">{task.quote.contactName}</span>
          </Link>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Zadanie wewnętrzne</span>
        )}
      </td>
      <td>
        {task.assigneeIds && task.assigneeIds.length > 0 ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {task.assigneeIds.map((aid: string) => {
              const u = users.find((x) => x._id === aid);
              return u ? (
                <div key={aid} className="kanban-card-owner-avatar" title={u.name || u.email}>
                  {ownerInitials(u.name || u.email)}
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Brak przypisania</span>
        )}
      </td>
      <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
        {task.completedAt ? new Date(task.completedAt).toLocaleDateString("pl-PL") : "—"}
      </td>
    </tr>
  );
}

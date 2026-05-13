"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import { usePermissions } from "../_lib/permissions";
import "../users/users.css";

type RoleRow = {
  _id: Id<"roles">;
  name: string;
  displayName: string;
  isSystem: boolean;
  userCount: number;
  createdAt: number;
};

export default function RolesPage() {
  const { has } = usePermissions();
  const canCreate = has("roles", "create");
  const canUpdate = has("roles", "update");
  const canDelete = has("roles", "delete");

  const roles = (useQuery(api.roles.list, {}) as RoleRow[] | undefined) ?? [];
  const [showCreate, setShowCreate] = useState(false);

  return (
    <main className="users-content">
      <div className="users-toolbar">
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Role definiują, jakie operacje może wykonywać użytkownik. Edycja
          uprawnień dotyczy konkretnej roli.
        </div>
        <div style={{ flex: 1 }} />
        {canCreate ? (
          <button
            type="button"
            className="users-btn users-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <I.plus s={14} /> Dodaj rolę
          </button>
        ) : null}
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Identyfikator</th>
              <th>Użytkownicy</th>
              <th>Typ</th>
              <th aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="users-empty">
                  Brak ról
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <RoleRowView
                  key={r._id}
                  role={r}
                  canEdit={canUpdate}
                  canDelete={canDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <CreateRoleModal onClose={() => setShowCreate(false)} />
      ) : null}
    </main>
  );
}

function RoleRowView({
  role,
  canEdit,
  canDelete,
}: {
  role: RoleRow;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const remove = useMutation(api.roles.remove);
  const [working, setWorking] = useState(false);

  async function onDelete() {
    if (role.isSystem) return;
    if (role.userCount > 0) {
      alert("Najpierw przepnij użytkowników na inną rolę");
      return;
    }
    if (!confirm(`Usunąć rolę "${role.displayName}"?`)) return;
    setWorking(true);
    try {
      await remove({ roleId: role._id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setWorking(false);
    }
  }

  return (
    <tr>
      <td>
        <div className="users-cell-name">{role.displayName}</div>
      </td>
      <td>
        <code style={{ fontSize: 12, color: "var(--text-muted)" }}>{role.name}</code>
      </td>
      <td>{role.userCount}</td>
      <td>
        {role.isSystem ? (
          <span className="users-badge">systemowa</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>standardowa</span>
        )}
      </td>
      <td className="users-actions">
        {canEdit ? (
          <Link
            href={`/admin/roles/${role._id}/edit`}
            className="users-btn users-btn-ghost"
            aria-disabled={role.isSystem}
            style={role.isSystem ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <I.edit s={14} /> Edytuj uprawnienia
          </Link>
        ) : null}
        {canDelete && !role.isSystem ? (
          <button
            type="button"
            className="users-btn users-btn-ghost"
            style={{ marginLeft: 6, color: "#ffb4af" }}
            onClick={onDelete}
            disabled={working}
          >
            <I.trash s={14} /> Usuń
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.roles.create);
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await create({ displayName });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="users-modal-backdrop" onClick={onClose}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <div className="users-modal-head">
            <h2>Nowa rola</h2>
            <button type="button" className="icon-btn" onClick={onClose}>
              <I.x s={14} />
            </button>
          </div>
          <div className="users-modal-body">
            <label className="users-field">
              <span>Nazwa wyświetlana</span>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="np. Kierownik produkcji"
                autoFocus
              />
            </label>
            <p className="users-modal-info">
              Identyfikator techniczny zostanie wygenerowany automatycznie.
              Uprawnienia ustawisz na ekranie edycji roli.
            </p>
            {error ? <div className="users-error">{error}</div> : null}
          </div>
          <div className="users-modal-foot">
            <button
              type="button"
              className="users-btn users-btn-ghost"
              onClick={onClose}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="users-btn users-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Tworzenie..." : "Utwórz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

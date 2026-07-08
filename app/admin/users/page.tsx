"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import { usePermissions } from "../_lib/permissions";
import "./users.css";

const PAGE_SIZE = 20;

type UserRow = {
  _id: Id<"users">;
  email: string | null;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  roleId: Id<"roles"> | null;
  role: {
    _id: Id<"roles">;
    name: string;
    displayName: string;
    isSystem: boolean;
  } | null;
  createdAt: number;
};

export default function UsersPage() {
  const { has, isLoading } = usePermissions();
  const canRead = has("users", "read");
  const canCreate = has("users", "create");
  const canUpdate = has("users", "update");
  const canDelete = has("users", "delete");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Id<"roles"> | "all" | "none">(
    "all",
  );
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const stats = useQuery(api.users.stats, canRead ? {} : "skip") ?? null;
  const allRoles = useQuery(api.roles.list, canRead ? {} : "skip") ?? [];
  const allUsers =
    (useQuery(
      api.users.list,
      canRead
        ? {
            search: search.trim() || undefined,
            roleId:
              roleFilter !== "all" && roleFilter !== "none"
                ? (roleFilter as Id<"roles">)
                : undefined,
            isActive:
              activeFilter === "all" ? undefined : activeFilter === "active",
          }
        : "skip",
    ) as UserRow[] | undefined) ?? [];

  const users = useMemo(() => {
    if (roleFilter === "none") return allUsers.filter((u) => !u.roleId);
    return allUsers;
  }, [allUsers, roleFilter]);

  if (!isLoading && !canRead) {
    return (
      <main className="users-content">
        <div className="users-empty-state">
          <I.lock s={28} />
          <div className="users-empty-title">Brak dostępu</div>
          <div className="users-empty-text">
            Nie masz uprawnienia <code>users:read</code>. Skontaktuj się
            z administratorem, aby uzyskać dostęp do listy użytkowników.
          </div>
        </div>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = users.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <main className="users-content">
      <div className="users-kpis">
        <KpiTile label="Wszyscy" value={stats?.total ?? "—"} />
        <KpiTile label="Aktywni" value={stats?.active ?? "—"} tone="ok" />
        <KpiTile label="Nieaktywni" value={stats?.inactive ?? "—"} tone="muted" />
        <KpiTile label="Bez roli" value={stats?.withoutRole ?? "—"} tone="warn" />
      </div>

      <div className="users-toolbar">
        <div className="users-search">
          <I.search s={14} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Szukaj po e-mailu lub imieniu…"
          />
        </div>
        <select
          className="users-select"
          value={roleFilter as string}
          onChange={(e) => {
            setRoleFilter(e.target.value as typeof roleFilter);
            setPage(0);
          }}
        >
          <option value="all">Wszystkie role</option>
          <option value="none">Bez roli</option>
          {allRoles.map((r) => (
            <option key={r._id} value={r._id as unknown as string}>
              {r.displayName}
            </option>
          ))}
        </select>
        <select
          className="users-select"
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as typeof activeFilter);
            setPage(0);
          }}
        >
          <option value="all">Aktywne i nieaktywne</option>
          <option value="active">Tylko aktywne</option>
          <option value="inactive">Tylko nieaktywne</option>
        </select>
        <div style={{ flex: 1 }} />
        {canCreate ? (
          <button
            type="button"
            className="users-btn users-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <I.plus s={14} /> Dodaj użytkownika
          </button>
        ) : null}
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Użytkownik</th>
              <th>Rola</th>
              <th>Status</th>
              <th>Utworzono</th>
              {canUpdate ? <th aria-label="Akcje" /> : null}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={canUpdate || canDelete ? 5 : 4} className="users-empty">
                  Brak wyników
                </td>
              </tr>
            ) : (
              pageItems.map((u) => (
                <UserRowView
                  key={u._id}
                  user={u}
                  roles={allRoles}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="users-pagination">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Poprzednia
          </button>
          <span>
            Strona {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Następna ›
          </button>
        </div>
      ) : null}

      {showCreate ? (
        <CreateUserModal
          roles={allRoles}
          onClose={() => setShowCreate(false)}
        />
      ) : null}
    </main>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "muted" | "warn";
}) {
  return (
    <div className={`users-kpi tone-${tone ?? "default"}`}>
      <div className="users-kpi-value">{value}</div>
      <div className="users-kpi-label">{label}</div>
    </div>
  );
}

function UserRowView({
  user,
  roles,
  canUpdate,
  canDelete,
}: {
  user: UserRow;
  roles: Array<{
    _id: Id<"roles">;
    displayName: string;
    isSystem: boolean;
  }>;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const setActive = useMutation(api.users.setActive);
  const setRole = useMutation(api.users.setRole);
  const removeUser = useMutation(api.users.remove);
  const [working, setWorking] = useState(false);

  async function toggleActive() {
    if (working) return;
    setWorking(true);
    try {
      await setActive({ userId: user._id, isActive: !user.isActive });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setWorking(false);
    }
  }

  async function changeRole(roleId: string) {
    if (working) return;
    setWorking(true);
    try {
      await setRole({
        userId: user._id,
        roleId: roleId === "" ? null : (roleId as Id<"roles">),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setWorking(false);
    }
  }

  async function deleteUser() {
    if (!window.confirm(`Czy na pewno chcesz bezpowrotnie usunąć użytkownika ${user.name || user.email || ""}?`)) return;
    if (working) return;
    setWorking(true);
    try {
      await removeUser({ userId: user._id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setWorking(false);
    }
  }

  return (
    <tr>
      <td>
        <div className="users-cell-user">
          <div className="users-cell-avatar">
            {(user.name ?? user.email ?? "??").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="users-cell-name">{user.name ?? "—"}</div>
            <div className="users-cell-email">{user.email ?? "—"}</div>
          </div>
        </div>
      </td>
      <td>
        {canUpdate ? (
          <select
            className="users-select-inline"
            value={(user.roleId as unknown as string) ?? ""}
            onChange={(e) => changeRole(e.target.value)}
            disabled={working}
          >
            <option value="">— Bez roli —</option>
            {roles.map((r) => (
              <option key={r._id} value={r._id as unknown as string}>
                {r.displayName}
                {r.isSystem ? " (systemowa)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span>{user.role?.displayName ?? "Bez roli"}</span>
        )}
      </td>
      <td>
        <span className={`users-status tone-${user.isActive ? "ok" : "muted"}`}>
          <span className="users-status-dot" />
          {user.isActive ? "Aktywny" : "Nieaktywny"}
        </span>
        {user.mustChangePassword ? (
          <span className="users-badge">wymaga zmiany hasła</span>
        ) : null}
      </td>
      <td>{new Date(user.createdAt).toLocaleDateString("pl-PL")}</td>
      {canUpdate || canDelete ? (
        <td className="users-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          {canUpdate && (
            <button
              type="button"
              className="users-btn users-btn-ghost"
              onClick={toggleActive}
              disabled={working}
            >
              {user.isActive ? "Dezaktywuj" : "Aktywuj"}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="users-btn users-btn-ghost"
              style={{ color: "#ffb4af" }}
              onClick={deleteUser}
              disabled={working}
            >
              <I.trash s={14} /> Usuń
            </button>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function CreateUserModal({
  roles,
  onClose,
}: {
  roles: Array<{
    _id: Id<"roles">;
    displayName: string;
    isSystem: boolean;
  }>;
  onClose: () => void;
}) {
  const adminCreate = useAction(api.users.adminCreate);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ password: string; email: string } | null>(
    null,
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await adminCreate({
        email: email.trim().toLowerCase(),
        name: name.trim() || undefined,
        roleId: roleId ? (roleId as Id<"roles">) : undefined,
      });
      setCreated({ password: result.password, email: email.trim().toLowerCase() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć konta");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="users-modal-backdrop" onClick={onClose}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        {created ? (
          <>
            <div className="users-modal-head">
              <h2>Konto utworzone</h2>
              <button type="button" className="icon-btn" onClick={onClose}>
                <I.x s={14} />
              </button>
            </div>
            <div className="users-modal-body">
              <p className="users-modal-info">
                Hasło tymczasowe dla <strong>{created.email}</strong>. Pokażę je
                tylko raz — przekaż użytkownikowi w bezpiecznym kanale.
                Użytkownik będzie musiał zmienić hasło przy pierwszym logowaniu.
              </p>
              <div className="users-temp-password">
                <code>{created.password}</code>
                <button
                  type="button"
                  className="users-btn users-btn-ghost"
                  onClick={copyPassword}
                >
                  <I.copy s={14} /> Kopiuj
                </button>
              </div>
            </div>
            <div className="users-modal-foot">
              <button
                type="button"
                className="users-btn users-btn-primary"
                onClick={onClose}
              >
                Zamknij
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="users-modal-head">
              <h2>Dodaj użytkownika</h2>
              <button type="button" className="icon-btn" onClick={onClose}>
                <I.x s={14} />
              </button>
            </div>
            <div className="users-modal-body">
              <label className="users-field">
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="imie.nazwisko@firma.pl"
                />
              </label>
              <label className="users-field">
                <span>Imię i nazwisko</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Opcjonalnie"
                />
              </label>
              <label className="users-field">
                <span>Rola</span>
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">— Bez roli —</option>
                  {roles.map((r) => (
                    <option key={r._id} value={r._id as unknown as string}>
                      {r.displayName}
                      {r.isSystem ? " (systemowa)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {error ? <div className="users-error">{error}</div> : null}
              <p className="users-modal-info">
                System wygeneruje 16-znakowe hasło tymczasowe i pokaże je raz po
                utworzeniu konta.
              </p>
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
                {submitting ? "Tworzenie..." : "Utwórz konto"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

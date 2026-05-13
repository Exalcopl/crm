"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../../_lib/icons";
import { usePermissions } from "../../../_lib/permissions";
import "../../../users/users.css";
import "./matrix.css";

const RESOURCE_LABELS: Record<string, string> = {
  wyceny: "Wyceny",
  klienci: "Klienci",
  users: "Użytkownicy",
  roles: "Role",
};
const ACTION_LABELS: Record<string, string> = {
  read: "Odczyt",
  create: "Tworzenie",
  update: "Edycja",
  delete: "Usuwanie",
};
const SCOPE_LABELS: Record<string, string> = {
  own: "Własne",
  team: "Zespół",
  all: "Wszystkie",
};

type Perm = {
  _id: Id<"permissions">;
  resource: string;
  action: string;
  scope: "own" | "team" | "all";
};

export default function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const roleId = id as Id<"roles">;
  const router = useRouter();
  const { has } = usePermissions();
  const canUpdate = has("roles", "update");

  const role = useQuery(api.roles.get, { roleId });
  const allPerms = (useQuery(api.roles.allPermissions, {}) as Perm[] | undefined) ?? [];
  const currentLinks =
    (useQuery(api.roles.permissionsForRole, { roleId }) as
      | Id<"permissions">[]
      | undefined) ?? [];

  const setPermissions = useMutation(api.roles.setPermissions);
  const updateDisplayName = useMutation(api.roles.updateDisplayName);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && currentLinks.length >= 0 && allPerms.length > 0 && role) {
      setSelected(new Set(currentLinks.map((id) => id as unknown as string)));
      setDisplayName(role.displayName);
      setHydrated(true);
    }
  }, [currentLinks, allPerms, role, hydrated]);

  const matrix = useMemo(() => {
    const resources = Array.from(new Set(allPerms.map((p) => p.resource)));
    const actions = Array.from(new Set(allPerms.map((p) => p.action)));
    const scopes: Array<"own" | "team" | "all"> = ["own", "team", "all"];
    const lookup = new Map<string, Perm>();
    for (const p of allPerms) {
      lookup.set(`${p.resource}|${p.action}|${p.scope}`, p);
    }
    return { resources, actions, scopes, lookup };
  }, [allPerms]);

  function togglePerm(permId: string) {
    if (!canUpdate || role?.isSystem) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  async function onSave() {
    if (!canUpdate || !role || role.isSystem || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (displayName.trim() !== role.displayName) {
        await updateDisplayName({ roleId, displayName: displayName.trim() });
      }
      const ids = Array.from(selected).map((s) => s as unknown as Id<"permissions">);
      await setPermissions({ roleId, permissionIds: ids });
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  }

  if (role === null) {
    return (
      <main className="users-content">
        <p>Rola nie istnieje.</p>
        <Link href="/admin/roles" className="users-btn users-btn-ghost">
          <I.arrowLeft s={14} /> Wróć do listy
        </Link>
      </main>
    );
  }

  if (role === undefined || allPerms.length === 0) {
    return <main className="users-content">Ładowanie…</main>;
  }

  const isSystem = role.isSystem;
  const disabled = !canUpdate || isSystem;

  return (
    <main className="users-content">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/admin/roles" className="users-btn users-btn-ghost">
          <I.arrowLeft s={14} /> Role
        </Link>
        <div style={{ flex: 1 }}>
          <input
            className="matrix-name-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={disabled}
            placeholder="Nazwa roli"
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            <code>{role.name}</code>
            {isSystem ? (
              <span className="users-badge" style={{ marginLeft: 8 }}>
                systemowa (tylko do odczytu)
              </span>
            ) : null}
          </div>
        </div>
        {savedAt ? (
          <span style={{ fontSize: 12, color: "#4ade80" }}>Zapisano</span>
        ) : null}
        <button
          type="button"
          className="users-btn users-btn-primary"
          onClick={onSave}
          disabled={disabled || saving}
        >
          {saving ? "Zapisywanie..." : "Zapisz"}
        </button>
      </div>

      {error ? <div className="users-error">{error}</div> : null}

      <div className="matrix-card">
        <div className="matrix-info">
          <I.alert s={14} /> Egzekwowane są tylko uprawnienia w kolumnie{" "}
          <strong>Wszystkie</strong>. Kolumny <em>Własne</em> i <em>Zespół</em>{" "}
          istnieją w UI i będą egzekwowane po dodaniu warstwy zespołów.
        </div>
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-resource-col">Zasób</th>
                <th>Akcja</th>
                {matrix.scopes.map((s) => (
                  <th key={s}>{SCOPE_LABELS[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.resources.map((resource) => (
                <ResourceRows
                  key={resource}
                  resource={resource}
                  actions={matrix.actions}
                  scopes={matrix.scopes}
                  lookup={matrix.lookup}
                  selected={selected}
                  onToggle={togglePerm}
                  disabled={disabled}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function ResourceRows({
  resource,
  actions,
  scopes,
  lookup,
  selected,
  onToggle,
  disabled,
}: {
  resource: string;
  actions: string[];
  scopes: Array<"own" | "team" | "all">;
  lookup: Map<string, Perm>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      {actions.map((action, idx) => (
        <tr key={`${resource}-${action}`}>
          {idx === 0 ? (
            <td
              rowSpan={actions.length}
              className="matrix-resource-col matrix-resource-cell"
            >
              {RESOURCE_LABELS[resource] ?? resource}
            </td>
          ) : null}
          <td className="matrix-action-cell">{ACTION_LABELS[action] ?? action}</td>
          {scopes.map((scope) => {
            const perm = lookup.get(`${resource}|${action}|${scope}`);
            if (!perm) return <td key={scope} />;
            const id = perm._id as unknown as string;
            const checked = selected.has(id);
            return (
              <td key={scope} className="matrix-checkbox-cell">
                <label className={`matrix-check ${disabled ? "is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(id)}
                    disabled={disabled}
                  />
                  <span />
                </label>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

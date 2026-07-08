"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../../../_lib/icons";
import { hexToTypeStyle } from "../../../../_lib/quotes";
import "../../../../users/users.css";

type DefaultTaskDoc = {
  _id: Id<"projectTypeDefaultTasks">;
  projectTypeId: Id<"projectTypes">;
  title: string;
  description?: string;
  order: number;
};

type FormData = {
  title: string;
  description: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
};

function TaskModal({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: DefaultTaskDoc;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          title: initial.title,
          description: initial.description ?? "",
        }
      : EMPTY_FORM,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, saving]);

  const valid = form.title.trim().length > 0;

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div
        className="users-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="users-modal-head">
          <h2>{initial ? "Edytuj szablon zadania" : "Nowy szablon zadania"}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            disabled={saving}
            aria-label="Zamknij"
          >
            <I.x s={14} />
          </button>
        </div>

        <div className="users-modal-body">
          {error && <div className="users-error">{error}</div>}

          <label className="users-field">
            <span>
              Nazwa zadania <span style={{ color: "#f85149" }}>*</span>
            </span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="np. Przygotowanie rysunków technicznych"
              disabled={saving}
              autoFocus
            />
          </label>

          <label className="users-field">
            <span>Opis zadania (szczegóły)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Dodatkowe informacje dla konsultanta wykonującego zadanie"
              disabled={saving}
              rows={3}
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>
        </div>

        <div className="users-modal-foot">
          <button
            type="button"
            className="users-btn users-btn-ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="users-btn users-btn-primary"
            onClick={() => onSave(form)}
            disabled={saving || !valid}
          >
            {saving ? "Zapisywanie…" : initial ? "Zapisz zmiany" : "Dodaj szablon"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  taskTitle,
  onConfirm,
  onCancel,
}: {
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>Usuń szablon zadania</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            aria-label="Zamknij"
          >
            <I.x s={14} />
          </button>
        </div>
        <div className="users-modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)" }}>
            Czy na pewno chcesz usunąć szablon zadania <strong>{taskTitle}</strong>?
          </p>
          <p className="users-modal-info">
            Zadania te nie będą już automatycznie dodawane do nowo tworzonych wycen o tym typie projektu. Istniejące zadania na zapisanych wycenach pozostaną nienaruszone.
          </p>
          <p className="users-modal-info">Tej operacji nie można cofnąć.</p>
        </div>
        <div className="users-modal-foot">
          <button
            type="button"
            className="users-btn users-btn-ghost"
            onClick={onCancel}
            autoFocus
          >
            Nie
          </button>
          <button
            type="button"
            className="users-btn users-btn-ghost"
            onClick={onConfirm}
            style={{ color: "#ffb4af" }}
          >
            <I.trash s={14} /> Tak, usuń
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectTypeDefaultTasksPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const projectTypeId = id as Id<"projectTypes">;

  const projectType = useQuery(api.projectTypes.get, { id: projectTypeId });
  const defaultTasks = (useQuery(api.projectTypeDefaultTasks.list, { projectTypeId }) ?? []) as DefaultTaskDoc[];

  const createMutation = useMutation(api.projectTypeDefaultTasks.create);
  const updateMutation = useMutation(api.projectTypeDefaultTasks.update);
  const removeMutation = useMutation(api.projectTypeDefaultTasks.remove);
  const moveMutation = useMutation(api.projectTypeDefaultTasks.move);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DefaultTaskDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DefaultTaskDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(data: FormData) {
    setSaving(true);
    setModalError("");
    try {
      await createMutation({
        projectTypeId,
        title: data.title,
        description: data.description.trim() || undefined,
      });
      setShowAddModal(false);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: FormData) {
    if (!editTarget) return;
    setSaving(true);
    setModalError("");
    try {
      await updateMutation({
        id: editTarget._id,
        title: data.title,
        description: data.description.trim() || undefined,
      });
      setEditTarget(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: DefaultTaskDoc) {
    try {
      await removeMutation({ id: t._id });
      setDeleteTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nieznany błąd";
      setRowError((prev) => ({ ...prev, [t._id]: msg }));
      setDeleteTarget(null);
    }
  }

  async function handleMove(t: DefaultTaskDoc, direction: "up" | "down") {
    try {
      await moveMutation({ id: t._id, direction });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Błąd zmiany kolejności";
      setRowError((prev) => ({ ...prev, [t._id]: msg }));
    }
  }

  if (projectType === undefined) {
    return (
      <main className="users-content">
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Ładowanie…</div>
      </main>
    );
  }

  if (projectType === null) {
    return (
      <main className="users-content">
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Typ projektu nie istnieje.{" "}
          <Link href="/admin/projekt/typy">← Wróć do listy typów</Link>
        </div>
      </main>
    );
  }

  const style = hexToTypeStyle(projectType.color);

  return (
    <main className="users-content">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/admin/projekt/typy"
          className="users-btn users-btn-ghost"
          style={{ padding: "5px 10px" }}
        >
          ← Typy projektów
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Domyślne zadania
          </h1>
          <span
            className="kanban-chip kanban-chip-type"
            style={{
              background: style.bg,
              color: style.fg,
              borderColor: style.border,
            }}
          >
            <span className="kanban-chip-dot" style={{ background: style.fg }} />
            {projectType.name}
          </span>
        </div>
      </div>

      <div className="users-toolbar">
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Definiuj szablony zadań, które zostaną automatycznie dopisane jako lista TODO przy utworzeniu nowej wyceny tego typu. Użyj strzałek, aby ustalić domyślną kolejność zadań.
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="users-btn users-btn-primary"
          onClick={() => {
            setModalError("");
            setShowAddModal(true);
          }}
        >
          <I.plus s={14} /> Dodaj zadanie
        </button>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: 100, textAlign: "center" }}>Kolejność</th>
              <th>Nazwa zadania</th>
              <th>Opis / Szczegóły</th>
              <th aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {defaultTasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="users-empty">
                  Brak zdefiniowanych domyślnych zadań. Kliknij <strong>Dodaj zadanie</strong>, aby dodać pierwsze.
                </td>
              </tr>
            ) : (
              defaultTasks.map((t, idx) => {
                const err = rowError[t._id];
                return (
                  <tr key={t._id}>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          type="button"
                          className="users-btn users-btn-ghost"
                          style={{ padding: 4 }}
                          disabled={idx === 0}
                          onClick={() => void handleMove(t, "up")}
                          title="Przesuń w górę"
                        >
                          <I.up s={12} />
                        </button>
                        <button
                          type="button"
                          className="users-btn users-btn-ghost"
                          style={{ padding: 4, transform: "rotate(180deg)" }}
                          disabled={idx === defaultTasks.length - 1}
                          onClick={() => void handleMove(t, "down")}
                          title="Przesuń w dół"
                        >
                          {/* We rotate the up icon 180 degrees to get the down icon */}
                          <I.up s={12} />
                        </button>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.title}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {t.description || "—"}
                    </td>
                    <td className="users-actions">
                      <button
                        type="button"
                        className="users-btn users-btn-ghost"
                        onClick={() => {
                          setModalError("");
                          setEditTarget(t);
                        }}
                      >
                        <I.edit s={14} /> Edytuj
                      </button>
                      <button
                        type="button"
                        className="users-btn users-btn-ghost"
                        style={{ marginLeft: 6, color: "#ffb4af" }}
                        onClick={() => {
                          setRowError((prev) => {
                            const copy = { ...prev };
                            delete copy[t._id];
                            return copy;
                          });
                          setDeleteTarget(t);
                        }}
                      >
                        <I.trash s={14} /> Usuń
                      </button>
                      {err && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: "#f85149",
                            textAlign: "right",
                          }}
                        >
                          {err}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <TaskModal
          onSave={handleCreate}
          onCancel={() => setShowAddModal(false)}
          saving={saving}
          error={modalError}
        />
      )}

      {editTarget && (
        <TaskModal
          initial={editTarget}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
          saving={saving}
          error={modalError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          taskTitle={deleteTarget.title}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

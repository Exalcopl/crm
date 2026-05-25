"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { hexToTypeStyle } from "../../_lib/quotes";
import "../../users/users.css";

const COLOR_PALETTE = [
  "#79c0ff",
  "#56d364",
  "#ffa657",
  "#d2a8ff",
  "#56d4c1",
  "#c9d1d9",
  "#f78166",
  "#e3b341",
  "#db61a2",
  "#58a6ff",
  "#3fb950",
  "#ff7b72",
];

type ProjectTypeDoc = {
  _id: Id<"projectTypes">;
  name: string;
  color: string;
  description?: string;
  categoryName: string;
  categoryCode: string;
  isActive: boolean;
  questionsCount: number;
};

type FormData = {
  name: string;
  color: string;
  description: string;
  categoryName: string;
  categoryCode: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  color: COLOR_PALETTE[0],
  description: "",
  categoryName: "",
  categoryCode: "",
};

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: c,
            border: value === c ? "3px solid #fff" : "2px solid transparent",
            outline: value === c ? `2px solid ${c}` : "none",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

function TypeModal({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: ProjectTypeDoc;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          name: initial.name,
          color: initial.color,
          description: initial.description ?? "",
          categoryName: initial.categoryName,
          categoryCode: initial.categoryCode,
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

  const set = (k: keyof FormData) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.name.trim().length > 0 &&
    form.categoryName.trim().length > 0 &&
    form.categoryCode.trim().length > 0;

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div
        className="users-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="users-modal-head">
          <h2>{initial ? "Edytuj typ projektu" : "Nowy typ projektu"}</h2>
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
              Nazwa <span style={{ color: "#f85149" }}>*</span>
            </span>
            <input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="np. Zadaszenia"
              disabled={saving}
              autoFocus
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 12 }}>
            <label className="users-field">
              <span>
                Kategoria <span style={{ color: "#f85149" }}>*</span>
              </span>
              <input
                value={form.categoryName}
                onChange={(e) => set("categoryName")(e.target.value)}
                placeholder="np. Zadaszenia"
                disabled={saving}
              />
            </label>
            <label className="users-field">
              <span>
                Kod <span style={{ color: "#f85149" }}>*</span>
              </span>
              <input
                value={form.categoryCode}
                onChange={(e) =>
                  set("categoryCode")(e.target.value.slice(0, 2).toUpperCase())
                }
                placeholder="ZA"
                maxLength={2}
                disabled={saving}
                style={{ textTransform: "uppercase", textAlign: "center", letterSpacing: 2 }}
              />
            </label>
          </div>

          <label className="users-field">
            <span>Opis</span>
            <input
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Opcjonalny opis typu projektu"
              disabled={saving}
            />
          </label>

          <div className="users-field">
            <span>Kolor</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ColorPicker value={form.color} onChange={set("color")} />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: hexToTypeStyle(form.color).bg,
                  color: hexToTypeStyle(form.color).fg,
                  border: `1px solid ${hexToTypeStyle(form.color).border}`,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: hexToTypeStyle(form.color).fg,
                    flexShrink: 0,
                  }}
                />
                {form.name || "Podgląd"}
              </span>
            </div>
          </div>
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
            {saving ? "Zapisywanie…" : initial ? "Zapisz zmiany" : "Dodaj typ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  typeName,
  questionsCount,
  onConfirm,
  onCancel,
}: {
  typeName: string;
  questionsCount: number;
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
          <h2>Usuń typ projektu</h2>
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
            Czy na pewno chcesz usunąć typ <strong>{typeName}</strong>?
          </p>
          {questionsCount > 0 && (
            <p className="users-modal-info">
              Razem z typem zostan{questionsCount === 1 ? "ie" : "ą"} usunięt
              {questionsCount === 1 ? "e" : "e"}{" "}
              <strong>
                {questionsCount} {questionsCount === 1 ? "pytanie pomocnicze" : "pytań pomocniczych"}
              </strong>{" "}
              wraz z odpowiedziami na wycenach.
            </p>
          )}
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

export default function ProjectTypesPage() {
  const types = (useQuery(api.projectTypes.list) ?? []) as ProjectTypeDoc[];
  const createMutation = useMutation(api.projectTypes.create);
  const updateMutation = useMutation(api.projectTypes.update);
  const toggleActiveMutation = useMutation(api.projectTypes.toggleActive);
  const removeMutation = useMutation(api.projectTypes.remove);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectTypeDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTypeDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(data: FormData) {
    setSaving(true);
    setModalError("");
    try {
      await createMutation({
        name: data.name,
        color: data.color,
        description: data.description.trim() || undefined,
        categoryName: data.categoryName,
        categoryCode: data.categoryCode,
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
        name: data.name,
        color: data.color,
        description: data.description.trim() || undefined,
        categoryName: data.categoryName,
        categoryCode: data.categoryCode,
      });
      setEditTarget(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: Id<"projectTypes">) {
    await toggleActiveMutation({ id });
  }

  async function handleDelete(t: ProjectTypeDoc) {
    try {
      await removeMutation({ id: t._id });
      setDeleteTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nieznany błąd";
      setRowError((prev) => ({ ...prev, [t._id]: msg }));
      setDeleteTarget(null);
    }
  }

  return (
    <main className="users-content">
      <div className="users-toolbar">
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Typy projektów definiują kategorie wycen oraz pytania pomocnicze, które konsultant
          wypełnia podczas rozmowy z klientem.
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
          <I.plus s={14} /> Dodaj typ
        </button>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} aria-label="Kolor" />
              <th>Nazwa</th>
              <th>Kategoria</th>
              <th style={{ width: 60, textAlign: "center" }}>Kod</th>
              <th>Opis</th>
              <th style={{ width: 100, textAlign: "center" }}>Pytania</th>
              <th style={{ width: 110, textAlign: "center" }}>Status</th>
              <th aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {types.length === 0 ? (
              <tr>
                <td colSpan={8} className="users-empty">
                  Brak typów. Dodaj pierwszy, klikając <strong>Dodaj typ</strong>.
                </td>
              </tr>
            ) : (
              types.map((t) => {
                const style = hexToTypeStyle(t.color);
                const err = rowError[t._id];
                return (
                  <tr key={t._id} style={{ opacity: t.isActive ? 1 : 0.55 }}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: t.color,
                          border: `2px solid ${style.border}`,
                        }}
                      />
                    </td>
                    <td>
                      <span
                        className="kanban-chip kanban-chip-type"
                        style={{
                          background: style.bg,
                          color: style.fg,
                          borderColor: style.border,
                        }}
                      >
                        <span className="kanban-chip-dot" style={{ background: style.fg }} />
                        {t.name}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{t.categoryName}</td>
                    <td
                      style={{
                        textAlign: "center",
                        fontFamily: "monospace",
                        fontSize: 11,
                        letterSpacing: 1,
                        color: "var(--text-muted)",
                      }}
                    >
                      {t.categoryCode}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {t.description || "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Link
                        href={`/admin/projekt/typy/${t._id}/pytania`}
                        className="users-btn users-btn-ghost"
                        style={{ padding: "3px 10px", fontSize: 12 }}
                      >
                        {t.questionsCount} <I.edit s={12} />
                      </Link>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(t._id)}
                        style={{
                          fontSize: 11,
                          padding: "2px 10px",
                          borderRadius: 10,
                          border: t.isActive
                            ? "1px solid rgba(63,185,80,0.5)"
                            : "1px solid rgba(139,148,158,0.4)",
                          background: t.isActive
                            ? "rgba(63,185,80,0.15)"
                            : "rgba(139,148,158,0.1)",
                          color: t.isActive ? "#56d364" : "#8b949e",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                        title={t.isActive ? "Kliknij, aby dezaktywować" : "Kliknij, aby aktywować"}
                      >
                        {t.isActive ? "Aktywny" : "Nieaktywny"}
                      </button>
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
                        <I.edit s={14} /> Edytuj typ
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
        <TypeModal
          onSave={handleCreate}
          onCancel={() => setShowAddModal(false)}
          saving={saving}
          error={modalError}
        />
      )}

      {editTarget && (
        <TypeModal
          initial={editTarget}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
          saving={saving}
          error={modalError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          typeName={deleteTarget.name}
          questionsCount={deleteTarget.questionsCount}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

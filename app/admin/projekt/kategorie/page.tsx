"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import "../../users/users.css";

const COLOR_PALETTE = [
  "#3b82f6", // Niebieski (Spotkanie)
  "#10b981", // Zielony (Montaż)
  "#f59e0b", // Pomarańczowy (Pomiary)
  "#8b5cf6", // Fioletowy (Urlop)
  "#9ca3af", // Szary (Inne)
  "#ef4444", // Czerwony
  "#06b6d4", // Turkusowy
  "#ec4899", // Różowy
  "#eab308", // Żółty
  "#14b8a6", // Teal
  "#a855f7", // Fioletowy jasny
  "#6b7280", // Ciemnoszary
];

type CalendarCategoryDoc = {
  _id: Id<"calendarCategories">;
  name: string;
  color: string;
  code: string;
};

type FormData = {
  name: string;
  color: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  color: COLOR_PALETTE[0],
};

function hexToRgba(hex: string, alpha: number): string {
  try {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(156, 163, 175, ${alpha})`;
  }
}

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

function CategoryModal({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: CalendarCategoryDoc;
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

  const valid = form.name.trim().length > 0;

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div
        className="users-modal"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="users-modal-head">
          <h2>{initial ? "Edytuj kategorię wydarzeń" : "Nowa kategoria wydarzeń"}</h2>
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
              Nazwa kategorii <span style={{ color: "#f85149" }}>*</span>
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="np. Serwis, Reklamacja, Szkolenie"
              disabled={saving}
              autoFocus
            />
          </label>

          <div className="users-field">
            <span>Kolor</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ColorPicker
                value={form.color}
                onChange={(c) => setForm((f) => ({ ...f, color: c }))}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Podgląd:</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 8,
                    background: hexToRgba(form.color, 0.12),
                    color: form.color,
                    border: `1px solid ${hexToRgba(form.color, 0.3)}`,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: form.color,
                      flexShrink: 0,
                    }}
                  />
                  {form.name || "Podgląd kategorii"}
                </span>
              </div>
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
            {saving ? "Zapisywanie…" : initial ? "Zapisz zmiany" : "Dodaj kategorię"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  categoryName,
  onConfirm,
  onCancel,
}: {
  categoryName: string;
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
          <h2>Usuń kategorię wydarzeń</h2>
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
            Czy na pewno chcesz usunąć kategorię <strong>{categoryName}</strong>?
          </p>
          <p className="users-modal-info">
            Wydarzenia przypisane do tej kategorii pozostaną w kalendarzu, ale mogą wyświetlać się w domyślnych kolorach.
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

export default function CalendarCategoriesPage() {
  const categories = (useQuery(api.calendarCategories.list) ?? []) as CalendarCategoryDoc[];
  const createMutation = useMutation(api.calendarCategories.create);
  const updateMutation = useMutation(api.calendarCategories.update);
  const removeMutation = useMutation(api.calendarCategories.remove);
  const seedMutation = useMutation(api.calendarCategories.checkAndSeed);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CalendarCategoryDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarCategoryDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    // Automatically seed default categories if list is loaded and empty
    seedMutation().catch((err) => console.error("Failed to seed default categories:", err));
  }, [seedMutation]);

  async function handleCreate(data: FormData) {
    setSaving(true);
    setModalError("");
    try {
      await createMutation({
        name: data.name,
        color: data.color,
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
      });
      setEditTarget(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: CalendarCategoryDoc) {
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
          Zarządzanie kategoriami wydarzeń firmowych w kalendarzu. Administratorzy mogą dodawać nowe kategorie, ustawiać ich kolory oraz je usuwać.
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
          <I.plus s={14} /> Dodaj kategorię
        </button>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Kolor</th>
              <th>Kategoria (Pigułka)</th>
              <th style={{ width: 140 }}>Kod referencyjny</th>
              <th aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="users-empty">
                  Ładowanie kategorii...
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const err = rowError[cat._id];
                return (
                  <tr key={cat._id}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: cat.color,
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 12px",
                          borderRadius: 8,
                          background: hexToRgba(cat.color, 0.12),
                          color: cat.color,
                          border: `1px solid ${hexToRgba(cat.color, 0.3)}`,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: cat.color,
                          }}
                        />
                        {cat.name}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {cat.code}
                    </td>
                    <td className="users-actions">
                      <button
                        type="button"
                        className="users-btn users-btn-ghost"
                        onClick={() => {
                          setModalError("");
                          setEditTarget(cat);
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
                            delete copy[cat._id];
                            return copy;
                          });
                          setDeleteTarget(cat);
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
        <CategoryModal
          onSave={handleCreate}
          onCancel={() => setShowAddModal(false)}
          saving={saving}
          error={modalError}
        />
      )}

      {editTarget && (
        <CategoryModal
          initial={editTarget}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
          saving={saving}
          error={modalError}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          categoryName={deleteTarget.name}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

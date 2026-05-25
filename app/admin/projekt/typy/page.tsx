"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { hexToTypeStyle } from "../../_lib/quotes";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";

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
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <div className="fluent-modal" style={{ maxWidth: 480 }}>
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon">
              <I.layers s={16} />
            </span>
            <span>{initial ? "Edytuj typ projektu" : "Nowy typ projektu"}</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onCancel}
            disabled={saving}
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>

        <div className="fluent-modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                background: "rgba(248,81,73,0.15)",
                border: "1px solid rgba(248,81,73,0.4)",
                borderRadius: 6,
                padding: "8px 12px",
                color: "#f85149",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div className="fluent-field">
            <label className="fluent-label">
              Nazwa <span style={{ color: "#f85149" }}>*</span>
            </label>
            <input
              className="fluent-input"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="np. Zadaszenia"
              disabled={saving}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
            <div className="fluent-field">
              <label className="fluent-label">
                Kategoria <span style={{ color: "#f85149" }}>*</span>
              </label>
              <input
                className="fluent-input"
                value={form.categoryName}
                onChange={(e) => set("categoryName")(e.target.value)}
                placeholder="np. Zadaszenia"
                disabled={saving}
              />
            </div>
            <div className="fluent-field">
              <label className="fluent-label">
                Kod <span style={{ color: "#f85149" }}>*</span>
              </label>
              <input
                className="fluent-input"
                value={form.categoryCode}
                onChange={(e) =>
                  set("categoryCode")(e.target.value.slice(0, 2).toUpperCase())
                }
                placeholder="ZA"
                maxLength={2}
                disabled={saving}
                style={{ textTransform: "uppercase", textAlign: "center", letterSpacing: 2 }}
              />
            </div>
          </div>

          <div className="fluent-field">
            <label className="fluent-label">Opis</label>
            <input
              className="fluent-input"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Opcjonalny opis typu projektu"
              disabled={saving}
            />
          </div>

          <div className="fluent-field">
            <label className="fluent-label">Kolor</label>
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

        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-primary"
            onClick={() => onSave(form)}
            disabled={saving || !valid}
          >
            {saving ? "Zapisywanie…" : initial ? "Zapisz zmiany" : "Dodaj typ"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  typeName,
  onConfirm,
  onCancel,
}: {
  typeName: string;
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
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="fluent-modal fluent-modal-sm">
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon fluent-modal-title-icon-danger">
              <I.trash s={16} sw={2.2} />
            </span>
            <span>Usuń typ projektu</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onCancel}
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>
        <div className="fluent-modal-body">
          <p className="fluent-modal-text">
            Czy na pewno chcesz usunąć typ{" "}
            <strong>{typeName}</strong>?
          </p>
          <p className="fluent-modal-text fluent-modal-text-muted">
            Tej operacji nie można cofnąć.
          </p>
        </div>
        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onCancel}
            autoFocus
          >
            Nie
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-danger"
            onClick={onConfirm}
          >
            <I.trash s={14} sw={2.2} />
            <span>Tak, usuń</span>
          </button>
        </footer>
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
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

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
      setDeleteError((prev) => ({ ...prev, [t._id]: msg }));
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Typy projektów">
          <RibbonBtn
            icon={<I.plus s={22} />}
            label="Dodaj typ"
            primary
            onClick={() => {
              setModalError("");
              setShowAddModal(true);
            }}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content">
        <div style={{ maxWidth: 900 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Typy projektów
            </h1>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {types.length} {types.length === 1 ? "typ" : "typy/ów"}
            </span>
          </div>

          {types.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 0",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              Brak typów projektów. Dodaj pierwszy typ klikając{" "}
              <strong>Dodaj typ</strong>.
            </div>
          ) : (
            <div className="quote-list-wrap">
              <div
                className="quote-list-head"
                style={{ gridTemplateColumns: "36px 180px 140px 48px 1fr 90px 100px" }}
              >
                <div className="quote-list-header-cell">Kolor</div>
                <div className="quote-list-header-cell">Nazwa</div>
                <div className="quote-list-header-cell">Kategoria</div>
                <div className="quote-list-header-cell" style={{ textAlign: "center" }}>Kod</div>
                <div className="quote-list-header-cell">Opis</div>
                <div className="quote-list-header-cell" style={{ textAlign: "center" }}>Status</div>
                <div className="quote-list-header-cell" style={{ textAlign: "right" }}>Akcje</div>
              </div>
              <div className="quote-list-body">
                {types.map((t) => {
                  const style = hexToTypeStyle(t.color);
                  const errMsg = deleteError[t._id];
                  return (
                    <div key={t._id}>
                      <div
                        className="quote-list-row"
                        style={{
                          gridTemplateColumns: "36px 180px 140px 48px 1fr 90px 100px",
                          opacity: t.isActive ? 1 : 0.5,
                        }}
                        role="row"
                      >
                        <div className="quote-list-cell">
                          <span
                            style={{
                              display: "inline-block",
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: t.color,
                              border: `2px solid ${style.border}`,
                              flexShrink: 0,
                            }}
                          />
                        </div>
                        <div className="quote-list-cell" style={{ fontWeight: 500 }}>
                          <span
                            className="kanban-chip kanban-chip-type"
                            style={{
                              background: style.bg,
                              color: style.fg,
                              borderColor: style.border,
                            }}
                          >
                            <span
                              className="kanban-chip-dot"
                              style={{ background: style.fg }}
                            />
                            {t.name}
                          </span>
                        </div>
                        <div className="quote-list-cell" style={{ color: "var(--text-secondary)" }}>
                          {t.categoryName}
                        </div>
                        <div
                          className="quote-list-cell"
                          style={{
                            textAlign: "center",
                            fontFamily: "monospace",
                            fontSize: 11,
                            letterSpacing: 1,
                            color: "var(--text-muted)",
                          }}
                        >
                          {t.categoryCode}
                        </div>
                        <div
                          className="quote-list-cell"
                          style={{ color: "var(--text-muted)", fontSize: 12 }}
                        >
                          {t.description || "—"}
                        </div>
                        <div className="quote-list-cell" style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(t._id)}
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
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
                        </div>
                        <div
                          className="quote-list-cell"
                          style={{
                            display: "flex",
                            gap: 4,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edytuj"
                            onClick={() => {
                              setModalError("");
                              setEditTarget(t);
                            }}
                          >
                            <I.edit s={14} sw={2} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Usuń"
                            onClick={() => {
                              setDeleteError((prev) => {
                                const copy = { ...prev };
                                delete copy[t._id];
                                return copy;
                              });
                              setDeleteTarget(t);
                            }}
                            style={{ color: "var(--danger)" }}
                          >
                            <I.trash s={14} sw={2} />
                          </button>
                        </div>
                      </div>
                      {errMsg && (
                        <div
                          style={{
                            padding: "6px 16px",
                            fontSize: 12,
                            color: "#f85149",
                            background: "rgba(248,81,73,0.08)",
                            borderTop: "1px solid rgba(248,81,73,0.2)",
                          }}
                        >
                          {errMsg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

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
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

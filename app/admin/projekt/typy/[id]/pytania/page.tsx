"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../../../_lib/icons";
import { hexToTypeStyle } from "../../../../_lib/quotes";
import "../../../../users/users.css";

type AnswerType = "text" | "boolean" | "number";

type QuestionDoc = {
  _id: Id<"projectTypeQuestions">;
  text: string;
  answerType: AnswerType;
  units?: string[];
  isRequired: boolean;
  isActive: boolean;
  order: number;
};

type FormData = {
  text: string;
  answerType: AnswerType;
  units: string[];
  isRequired: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormData = {
  text: "",
  answerType: "text",
  units: [],
  isRequired: false,
  isActive: true,
};

const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  text: "Tekst",
  boolean: "TAK / NIE",
  number: "Liczba",
};

function QuestionModal({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: QuestionDoc;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          text: initial.text,
          answerType: initial.answerType,
          units: initial.units ?? [],
          isRequired: initial.isRequired,
          isActive: initial.isActive,
        }
      : EMPTY_FORM,
  );
  const [unitDraft, setUnitDraft] = useState("");

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

  function addUnit() {
    const v = unitDraft.trim();
    if (!v) return;
    if (form.units.includes(v)) {
      setUnitDraft("");
      return;
    }
    setForm((f) => ({ ...f, units: [...f.units, v] }));
    setUnitDraft("");
  }

  function removeUnit(u: string) {
    setForm((f) => ({ ...f, units: f.units.filter((x) => x !== u) }));
  }

  const valid =
    form.text.trim().length > 0 &&
    (form.answerType !== "number" || form.units.length > 0);

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div
        className="users-modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="users-modal-head">
          <h2>{initial ? "Edytuj pytanie" : "Nowe pytanie"}</h2>
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
              Treść pytania <span style={{ color: "#f85149" }}>*</span>
            </span>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="np. Czy jest już projekt budowy?"
              disabled={saving}
              autoFocus
              rows={2}
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

          <div className="users-field">
            <span>Typ odpowiedzi</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["text", "boolean", "number"] as AnswerType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, answerType: t }))}
                  className="users-btn users-btn-ghost"
                  style={{
                    padding: "6px 14px",
                    borderColor:
                      form.answerType === t
                        ? "var(--accent-primary)"
                        : "var(--border-subtle)",
                    background:
                      form.answerType === t
                        ? "rgba(88,166,255,0.12)"
                        : "transparent",
                    color:
                      form.answerType === t
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                  disabled={saving}
                >
                  {ANSWER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {form.answerType === "number" && (
            <div className="users-field">
              <span>
                Dostępne jednostki <span style={{ color: "#f85149" }}>*</span>
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  padding: 6,
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  minHeight: 38,
                  alignItems: "center",
                }}
              >
                {form.units.map((u) => (
                  <span
                    key={u}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                      background: "rgba(88,166,255,0.14)",
                      border: "1px solid rgba(88,166,255,0.35)",
                      color: "#79c0ff",
                    }}
                  >
                    {u}
                    <button
                      type="button"
                      onClick={() => removeUnit(u)}
                      disabled={saving}
                      aria-label={`Usuń jednostkę ${u}`}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                        fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={unitDraft}
                  onChange={(e) => setUnitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addUnit();
                    } else if (
                      e.key === "Backspace" &&
                      unitDraft === "" &&
                      form.units.length > 0
                    ) {
                      removeUnit(form.units[form.units.length - 1]);
                    }
                  }}
                  onBlur={addUnit}
                  placeholder={
                    form.units.length === 0 ? "np. cm, m, m²" : "dodaj kolejną…"
                  }
                  disabled={saving}
                  style={{
                    flex: 1,
                    minWidth: 80,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                    padding: "2px 4px",
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Enter dodaje jednostkę. Konsultant wybierze jedną z listy przy wpisywaniu
                odpowiedzi.
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isRequired: e.target.checked }))
                }
                disabled={saving}
              />
              Wymagane (ostrzeżenie na wycenie, bez blokady zapisu)
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                disabled={saving}
              />
              Aktywne (pokazuj na wycenie)
            </label>
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
            onClick={() => onSave({ ...form, text: form.text.trim() })}
            disabled={saving || !valid}
          >
            {saving ? "Zapisywanie…" : initial ? "Zapisz" : "Dodaj pytanie"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  questionText,
  onConfirm,
  onCancel,
}: {
  questionText: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="users-modal-backdrop" onClick={onCancel}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-modal-head">
          <h2>Usuń pytanie</h2>
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
          <p style={{ margin: 0, fontSize: 13 }}>
            Usunąć pytanie:
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              padding: "8px 10px",
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
            }}
          >
            <strong>{questionText}</strong>
          </p>
          <p className="users-modal-info">
            Wszystkie odpowiedzi konsultantów zapisane na wycenach dla tego pytania
            zostaną skasowane. Tej operacji nie można cofnąć.
          </p>
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

export default function ProjectTypeQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectTypeId = id as Id<"projectTypes">;

  const projectType = useQuery(api.projectTypes.get, { id: projectTypeId });
  const questions =
    (useQuery(api.projectTypeQuestions.listByType, { projectTypeId }) as
      | QuestionDoc[]
      | undefined) ?? [];

  const createQ = useMutation(api.projectTypeQuestions.create);
  const updateQ = useMutation(api.projectTypeQuestions.update);
  const toggleActiveQ = useMutation(api.projectTypeQuestions.toggleActive);
  const moveQ = useMutation(api.projectTypeQuestions.move);
  const removeQ = useMutation(api.projectTypeQuestions.remove);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<QuestionDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(data: FormData) {
    setSaving(true);
    setError("");
    try {
      await createQ({
        projectTypeId,
        text: data.text,
        answerType: data.answerType,
        units: data.answerType === "number" ? data.units : undefined,
        isRequired: data.isRequired,
        isActive: data.isActive,
      });
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: FormData) {
    if (!editTarget) return;
    setSaving(true);
    setError("");
    try {
      await updateQ({
        id: editTarget._id,
        text: data.text,
        answerType: data.answerType,
        units: data.answerType === "number" ? data.units : undefined,
        isRequired: data.isRequired,
        isActive: data.isActive,
      });
      setEditTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q: QuestionDoc) {
    try {
      await removeQ({ id: q._id });
    } finally {
      setDeleteTarget(null);
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
            Pytania pomocnicze
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
          Pytania konsultant zobaczy w widoku wyceny, gdy klient wybierze ten typ. Kolejność
          ustawiasz strzałkami; nieaktywne pytania są ukrywane w wycenach.
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="users-btn users-btn-primary"
          onClick={() => {
            setError("");
            setShowAdd(true);
          }}
        >
          <I.plus s={14} /> Dodaj pytanie
        </button>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: 70 }} aria-label="Kolejność" />
              <th>Pytanie</th>
              <th style={{ width: 110 }}>Typ odpowiedzi</th>
              <th>Jednostki</th>
              <th style={{ width: 100, textAlign: "center" }}>Wymagane</th>
              <th style={{ width: 110, textAlign: "center" }}>Status</th>
              <th aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan={7} className="users-empty">
                  Brak pytań. Dodaj pierwsze klikając <strong>Dodaj pytanie</strong>.
                </td>
              </tr>
            ) : (
              questions.map((q, idx) => (
                <tr key={q._id} style={{ opacity: q.isActive ? 1 : 0.55 }}>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Przesuń w górę"
                        onClick={() => void moveQ({ id: q._id, direction: "up" })}
                        disabled={idx === 0}
                        style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      >
                        <I.up s={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Przesuń w dół"
                        onClick={() => void moveQ({ id: q._id, direction: "down" })}
                        disabled={idx === questions.length - 1}
                        style={{
                          opacity: idx === questions.length - 1 ? 0.3 : 1,
                          transform: "rotate(180deg)",
                        }}
                      >
                        <I.up s={14} />
                      </button>
                    </div>
                  </td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{q.text}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {ANSWER_TYPE_LABELS[q.answerType]}
                  </td>
                  <td>
                    {q.answerType === "number" && q.units && q.units.length > 0 ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {q.units.map((u) => (
                          <span
                            key={u}
                            style={{
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 8,
                              background: "rgba(88,166,255,0.12)",
                              border: "1px solid rgba(88,166,255,0.3)",
                              color: "#79c0ff",
                            }}
                          >
                            {u}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {q.isRequired ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          border: "1px solid rgba(251,191,36,0.4)",
                          background: "rgba(251,191,36,0.12)",
                          color: "#fbbf24",
                        }}
                      >
                        wymagane
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        opcjonalne
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => void toggleActiveQ({ id: q._id })}
                      style={{
                        fontSize: 11,
                        padding: "2px 10px",
                        borderRadius: 10,
                        border: q.isActive
                          ? "1px solid rgba(63,185,80,0.5)"
                          : "1px solid rgba(139,148,158,0.4)",
                        background: q.isActive
                          ? "rgba(63,185,80,0.15)"
                          : "rgba(139,148,158,0.1)",
                        color: q.isActive ? "#56d364" : "#8b949e",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      {q.isActive ? "Aktywne" : "Nieaktywne"}
                    </button>
                  </td>
                  <td className="users-actions">
                    <button
                      type="button"
                      className="users-btn users-btn-ghost"
                      onClick={() => {
                        setError("");
                        setEditTarget(q);
                      }}
                    >
                      <I.edit s={14} /> Edytuj
                    </button>
                    <button
                      type="button"
                      className="users-btn users-btn-ghost"
                      style={{ marginLeft: 6, color: "#ffb4af" }}
                      onClick={() => setDeleteTarget(q)}
                    >
                      <I.trash s={14} /> Usuń
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <QuestionModal
          onSave={handleCreate}
          onCancel={() => setShowAdd(false)}
          saving={saving}
          error={error}
        />
      )}

      {editTarget && (
        <QuestionModal
          initial={editTarget}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
          saving={saving}
          error={error}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          questionText={deleteTarget.text}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

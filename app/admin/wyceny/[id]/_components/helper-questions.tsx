"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hexToTypeStyle } from "../../../_lib/quotes";

type AnswerType = "text" | "boolean" | "number";

type Question = {
  _id: Id<"projectTypeQuestions">;
  text: string;
  answerType: AnswerType;
  units?: string[];
  isRequired: boolean;
  order: number;
};

type Group = {
  projectType: {
    _id: Id<"projectTypes">;
    name: string;
    color: string;
    categoryCode: string;
  };
  questions: Question[];
};

type Answer = {
  _id?: Id<"quoteAnswers">;
  textValue?: string;
  booleanValue?: boolean;
  numberValue?: number;
  numberUnit?: string;
};

const DEBOUNCE_MS = 600;

function AnswerInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (next: Answer) => void;
}) {
  if (question.answerType === "text") {
    return (
      <textarea
        value={answer?.textValue ?? ""}
        onChange={(e) => onChange({ ...answer, textValue: e.target.value })}
        placeholder="Wpisz odpowiedź…"
        rows={2}
        style={{
          width: "100%",
          background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 13,
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    );
  }

  if (question.answerType === "boolean") {
    const val = answer?.booleanValue;
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {([
          { v: true, label: "TAK" },
          { v: false, label: "NIE" },
        ] as const).map((opt) => {
          const active = val === opt.v;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() =>
                onChange({
                  ...answer,
                  booleanValue: active ? undefined : opt.v,
                })
              }
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.4,
                borderRadius: 6,
                cursor: "pointer",
                border: active
                  ? opt.v
                    ? "1px solid rgba(63,185,80,0.6)"
                    : "1px solid rgba(248,81,73,0.6)"
                  : "1px solid var(--border-subtle)",
                background: active
                  ? opt.v
                    ? "rgba(63,185,80,0.15)"
                    : "rgba(248,81,73,0.15)"
                  : "transparent",
                color: active
                  ? opt.v
                    ? "#56d364"
                    : "#ffb4af"
                  : "var(--text-secondary)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // number
  const units = question.units ?? [];
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      <input
        type="number"
        inputMode="decimal"
        value={answer?.numberValue ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const num = raw === "" ? undefined : Number(raw);
          onChange({
            ...answer,
            numberValue: Number.isFinite(num) ? num : undefined,
          });
        }}
        placeholder="0"
        style={{
          width: 120,
          background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 13,
          outline: "none",
        }}
      />
      {units.length === 1 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0 10px",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            background: "var(--bg-base)",
            fontSize: 12,
          }}
        >
          {units[0]}
        </span>
      ) : units.length > 1 ? (
        <select
          value={answer?.numberUnit ?? ""}
          onChange={(e) =>
            onChange({
              ...answer,
              numberUnit: e.target.value || undefined,
            })
          }
          style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">jedn.</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function answerIsEmpty(answerType: AnswerType, a: Answer | undefined) {
  if (!a) return true;
  if (answerType === "text") return !a.textValue || a.textValue.trim() === "";
  if (answerType === "boolean") return a.booleanValue === undefined;
  if (answerType === "number")
    return a.numberValue === undefined || Number.isNaN(a.numberValue);
  return true;
}

export function HelperQuestionsSection({
  quoteId,
}: {
  quoteId: Id<"quotes">;
}) {
  const data = useQuery(api.quoteAnswers.listByQuote, { quoteId });
  const upsert = useMutation(api.quoteAnswers.upsert);

  const [edits, setEdits] = useState<Record<string, Answer>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSentRef = useRef<Record<string, string>>({});

  const drafts = useMemo<Record<string, Answer>>(() => {
    const serverAnswers = (data?.answers ?? {}) as Record<string, Answer>;
    return { ...serverAnswers, ...edits };
  }, [data, edits]);

  const flush = useCallback(
    (question: Question, answer: Answer) => {
      const key = question._id as unknown as string;
      const payload: Parameters<typeof upsert>[0] = {
        quoteId,
        questionId: question._id,
        answerType: question.answerType,
        textValue:
          question.answerType === "text"
            ? answer.textValue?.trim() || undefined
            : undefined,
        booleanValue:
          question.answerType === "boolean" ? answer.booleanValue : undefined,
        numberValue:
          question.answerType === "number" ? answer.numberValue : undefined,
        numberUnit:
          question.answerType === "number" ? answer.numberUnit : undefined,
      };
      const sig = JSON.stringify(payload);
      if (lastSentRef.current[key] === sig) return;
      lastSentRef.current[key] = sig;
      void upsert(payload);
    },
    [quoteId, upsert],
  );

  function handleChange(question: Question, next: Answer) {
    const key = question._id as unknown as string;
    setEdits((prev) => ({ ...prev, [key]: next }));
    const existing = timersRef.current[key];
    if (existing) clearTimeout(existing);
    timersRef.current[key] = setTimeout(() => {
      flush(question, next);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  if (data === undefined) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Ładowanie pytań…</div>
    );
  }

  const groups = data.groups as Group[];
  if (groups.length === 0) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Brak pytań pomocniczych — typy projektów tej wyceny nie mają zdefiniowanych pytań.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => {
        const s = hexToTypeStyle(g.projectType.color);
        return (
          <div key={g.projectType._id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderBottom: `1px solid ${s.border}`,
                paddingBottom: 6,
              }}
            >
              <span
                className="kanban-chip kanban-chip-type"
                style={{
                  background: s.bg,
                  color: s.fg,
                  borderColor: s.border,
                }}
              >
                <span className="kanban-chip-dot" style={{ background: s.fg }} />
                {g.projectType.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {g.questions.length} {g.questions.length === 1 ? "pytanie" : "pytań"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.questions.map((q) => {
                const key = q._id as unknown as string;
                const draft = drafts[key];
                const empty = answerIsEmpty(q.answerType, draft);
                return (
                  <div
                    key={q._id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 320px)",
                      gap: 14,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        paddingTop: 4,
                      }}
                    >
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {q.text}
                      </div>
                      {q.isRequired && empty && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#fbbf24",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          ⚠ wymagane
                        </span>
                      )}
                    </div>
                    <AnswerInput
                      question={q}
                      answer={draft}
                      onChange={(next) => handleChange(q, next)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

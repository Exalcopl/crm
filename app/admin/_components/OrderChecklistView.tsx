"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type Step = Doc<"orderPreProdSteps">;

interface OrderChecklistViewProps {
  orderId: Id<"orders">;
  /** Mapa userId → { name } do wyświetlania nazwisk w historii zaznaczania */
  usersMap?: Map<Id<"users">, { name: string | null }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Single checkbox item ────────────────────────────────────────────────────

interface CheckboxItemProps {
  step: Step;
  level: number;
  usersMap?: Map<Id<"users">, { name: string | null }>;
  onToggle: (id: Id<"orderPreProdSteps">, done: boolean) => Promise<void>;
}

function CheckboxItem({ step, level, usersMap, onToggle }: CheckboxItemProps) {
  const [loading, setLoading] = useState(false);

  const completedByName = step.completedBy
    ? (usersMap?.get(step.completedBy as Id<"users">)?.name ?? "ktoś")
    : null;

  const tooltipText =
    step.done && step.completedAt
      ? `Zaznaczono${completedByName ? ` przez ${completedByName}` : ""} dnia ${formatDateTime(step.completedAt)}`
      : undefined;

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle(step._id, !step.done);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="ocv-checkbox-item"
      style={{ paddingLeft: level === 2 ? 36 : 12 }}
      title={tooltipText}
    >
      <button
        type="button"
        className={`ocv-checkbox-btn${step.done ? " is-done" : ""}${loading ? " is-loading" : ""}`}
        onClick={handleToggle}
        disabled={loading}
        aria-label={step.done ? `Odznacz: ${step.title}` : `Zaznacz: ${step.title}`}
      >
        <span className="ocv-checkbox-box">
          {loading ? (
            <span className="ocv-checkbox-spinner" />
          ) : step.done ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span className={`ocv-checkbox-label${step.done ? " is-done" : ""}`}>{step.title}</span>
      </button>
      {step.done && step.completedAt && (
        <span className="ocv-checkbox-meta">
          {completedByName && <span className="ocv-checkbox-who">{completedByName}</span>}
          <span className="ocv-checkbox-when">{formatDateTime(step.completedAt)}</span>
        </span>
      )}
    </div>
  );
}

// ─── Section (root task) ─────────────────────────────────────────────────────

interface SectionProps {
  rootStep: Step;
  children: Step[];
  grandchildren: Step[];
  usersMap?: Map<Id<"users">, { name: string | null }>;
  onToggle: (id: Id<"orderPreProdSteps">, done: boolean) => Promise<void>;
}

function Section({ rootStep, children, grandchildren, usersMap, onToggle }: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Znajdź dzieci które mają pod-dzieci
  const parentChildIds = new Set(
    grandchildren.map((g) => g.parentId).filter(Boolean) as Id<"orderPreProdSteps">[]
  );

  // Liście: podzadania bez pod-podzadań + pod-podzadania
  const leafChildren = children.filter((c) => !parentChildIds.has(c._id));
  const leaves = [...leafChildren, ...grandchildren];
  const total = leaves.length;
  const doneCount = leaves.filter((s) => s.done).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  return (
    <div className={`ocv-section${allDone ? " is-all-done" : ""}`}>
      {/* Header sekcji */}
      <button
        type="button"
        className="ocv-section-header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span className={`ocv-section-arrow${collapsed ? " is-collapsed" : ""}`} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        {allDone && (
          <span className="ocv-section-done-badge" title="Wszystkie ukończone">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}

        <span className="ocv-section-title">{rootStep.title}</span>

        {total > 0 && (
          <span className="ocv-section-count">{doneCount}/{total}</span>
        )}

        {total > 0 && (
          <span className="ocv-section-pct">{pct}%</span>
        )}
      </button>

      {/* Pasek postępu */}
      {total > 0 && (
        <div className="ocv-progress-wrap" aria-hidden>
          <div
            className="ocv-progress-bar"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Checkboxy */}
      {!collapsed && (
        <div className="ocv-section-body">
          {children.length === 0 && (
            <div className="ocv-empty-hint">Brak podzadań — dodaj je w widoku Gantt</div>
          )}
          {children.map((child) => {
            const gc = grandchildren.filter((g) => g.parentId === child._id);
            if (gc.length > 0) {
              // Ma pod-podzadania → mini-nagłówek
              return (
                <div key={child._id} className="ocv-subgroup">
                  <div className="ocv-subgroup-title">{child.title}</div>
                  {gc.map((g) => (
                    <CheckboxItem
                      key={g._id}
                      step={g}
                      level={2}
                      usersMap={usersMap}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              );
            }
            return (
              <CheckboxItem
                key={child._id}
                step={child}
                level={1}
                usersMap={usersMap}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function OrderChecklistView({ orderId, usersMap }: OrderChecklistViewProps) {
  const steps = useQuery(api.orderPreProdSteps.list, { orderId });
  const setDoneMut = useMutation(api.orderPreProdSteps.setDone);

  const activeSteps = useMemo(
    () => (steps ?? []).filter((s) => !s.archived),
    [steps]
  );

  const sorted = useMemo(
    () => [...activeSteps].sort((a, b) => a.order - b.order),
    [activeSteps]
  );

  const roots = useMemo(() => sorted.filter((s) => !s.parentId), [sorted]);

  // Mapa root._id → dzieci (level 1)
  const level1Map = useMemo(() => {
    const m = new Map<Id<"orderPreProdSteps">, Step[]>();
    for (const r of roots) m.set(r._id, []);
    for (const s of sorted) {
      if (s.parentId && m.has(s.parentId)) {
        m.get(s.parentId)!.push(s);
      }
    }
    return m;
  }, [sorted, roots]);

  // Mapa child._id → wnuki (level 2)
  const level2Map = useMemo(() => {
    const m = new Map<Id<"orderPreProdSteps">, Step[]>();
    const level1Ids = new Set<Id<"orderPreProdSteps">>();
    for (const [, children] of level1Map) {
      for (const c of children) level1Ids.add(c._id);
    }
    for (const id of level1Ids) m.set(id, []);
    for (const s of sorted) {
      if (s.parentId && level1Ids.has(s.parentId)) {
        m.get(s.parentId)!.push(s);
      }
    }
    return m;
  }, [sorted, level1Map]);

  async function handleToggle(id: Id<"orderPreProdSteps">, done: boolean) {
    await setDoneMut({ id, done });
  }

  function getGrandchildren(rootId: Id<"orderPreProdSteps">): Step[] {
    const gc: Step[] = [];
    for (const child of level1Map.get(rootId) ?? []) {
      gc.push(...(level2Map.get(child._id) ?? []));
    }
    return gc;
  }

  if (steps === undefined) {
    return (
      <div className="ocv-loading">
        <span className="ocv-spinner" />
        <span>Ładowanie zadań…</span>
      </div>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="ocv-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 9h10M7 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Brak zadań. Dodaj zadania w widoku Gantt, aby pojawiły się tutaj jako lista kontrolna.</span>
      </div>
    );
  }

  return (
    <div className="ocv-root">
      {roots.map((root) => (
        <Section
          key={root._id}
          rootStep={root}
          children={level1Map.get(root._id) ?? []}
          grandchildren={getGrandchildren(root._id)}
          usersMap={usersMap}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}

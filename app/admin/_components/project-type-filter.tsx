"use client";

import {
  PROJECT_TYPE_STYLES,
  type ProjectType,
} from "../_lib/quotes";

export type ProjectTypeFilter = "Wszystkie" | ProjectType;

export const PROJECT_TYPE_FILTERS: ProjectTypeFilter[] = [
  "Wszystkie",
  "Zadaszenia",
  "Pergola",
  "Stolarka",
  "Ogrodzenie",
  "Osłony okienne",
  "Inne",
];

export function ProjectTypeFilterStrip({
  value,
  counts,
  onChange,
}: {
  value: ProjectTypeFilter;
  counts: Record<ProjectTypeFilter, number>;
  onChange: (v: ProjectTypeFilter) => void;
}) {
  return (
    <div className="kanban-filter-strip">
      {PROJECT_TYPE_FILTERS.map((f) => {
        const active = value === f;
        const isMeta = f === "Wszystkie";
        const style = isMeta ? null : PROJECT_TYPE_STYLES[f];

        const activeStyle = active
          ? {
              background: style ? style.bg : "var(--accent-soft)",
              borderColor: style ? style.border : "var(--accent-line)",
              color: style ? style.fg : "var(--text-accent)",
            }
          : undefined;
        const railColor = style ? style.fg : "var(--accent-primary)";

        return (
          <button
            key={f}
            type="button"
            className={`kanban-filter-tile${active ? " active" : ""}`}
            style={activeStyle}
            onClick={() => onChange(f)}
            aria-pressed={active}
          >
            <span className="kanban-filter-tile-label">{f}</span>
            <span className="kanban-filter-tile-count">{counts[f]}</span>
            {!active && (
              <span
                className="kanban-filter-tile-rail"
                style={{ background: railColor }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function computeProjectTypeCounts(
  quotes: { projectType: ProjectType[] }[],
): Record<ProjectTypeFilter, number> {
  const c: Record<ProjectTypeFilter, number> = {
    Wszystkie: quotes.length,
    Zadaszenia: 0,
    Pergola: 0,
    Stolarka: 0,
    Ogrodzenie: 0,
    "Osłony okienne": 0,
    Inne: 0,
  };
  quotes.forEach((q) => {
    q.projectType.forEach((t) => {
      c[t] += 1;
    });
  });
  return c;
}

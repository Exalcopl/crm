"use client";

import { getProjectTypeStyle } from "../_lib/quotes";

export type ProjectTypeFilter = string;

export function ProjectTypeFilterStrip({
  allTypes,
  value,
  counts,
  onChange,
}: {
  allTypes: Array<{ name: string; color: string }>;
  value: ProjectTypeFilter;
  counts: Record<string, number>;
  onChange: (v: ProjectTypeFilter) => void;
}) {
  const filters: Array<{ label: string; key: string }> = [
    { label: "Wszystkie", key: "Wszystkie" },
    ...allTypes.map((t) => ({ label: t.name, key: t.name })),
  ];

  return (
    <div className="kanban-filter-strip">
      {filters.map((f) => {
        const active = value === f.key;
        const isMeta = f.key === "Wszystkie";
        const style = isMeta ? null : getProjectTypeStyle(allTypes, f.key);

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
            key={f.key}
            type="button"
            className={`kanban-filter-tile${active ? " active" : ""}`}
            style={activeStyle}
            onClick={() => onChange(f.key)}
            aria-pressed={active}
          >
            <span className="kanban-filter-tile-label">{f.label}</span>
            <span className="kanban-filter-tile-count">{counts[f.key] ?? 0}</span>
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
  quotes: { projectType: string[] }[],
  typeNames: string[],
): Record<string, number> {
  const c: Record<string, number> = { Wszystkie: quotes.length };
  for (const name of typeNames) c[name] = 0;
  quotes.forEach((q) => {
    q.projectType.forEach((t) => {
      if (t in c) c[t] += 1;
    });
  });
  return c;
}

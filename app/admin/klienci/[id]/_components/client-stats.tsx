"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatRelativeDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ClientStats({ clientId }: { clientId: Id<"clients"> }) {
  const stats = useQuery(api.clients.getStats, { id: clientId });

  if (stats === undefined) {
    return (
      <div className="client-detail-stats is-loading" aria-busy="true">
        <div className="client-detail-stat-card" />
        <div className="client-detail-stat-card" />
        <div className="client-detail-stat-card" />
        <div className="client-detail-stat-card" />
      </div>
    );
  }

  return (
    <div className="client-detail-stats">
      <StatCard
        icon={<I.doc s={14} />}
        label="Wszystkich wycen"
        value={String(stats.total)}
        sub={stats.archived > 0 ? `${stats.archived} w archiwum` : undefined}
      />
      <StatCard
        icon={<I.refresh s={14} />}
        label="W toku"
        value={String(stats.active)}
        tone="active"
      />
      <StatCard
        icon={<I.check s={14} />}
        label="Zrealizowane"
        value={String(stats.done)}
        tone="done"
        sub={
          stats.total > 0
            ? `${Math.round((stats.done / stats.total) * 100)}% konwersji`
            : undefined
        }
      />
      <StatCard
        icon={<I.pln s={14} />}
        label="Wartość wygranych"
        value={`${formatPLN(stats.wonValue)}`}
        unit="PLN"
        sub={
          stats.lastActivity
            ? `Ostatnia akt.: ${formatRelativeDate(stats.lastActivity)}`
            : undefined
        }
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "active" | "done";
}) {
  return (
    <div className={`client-detail-stat-card${tone ? ` tone-${tone}` : ""}`}>
      <div className="client-detail-stat-head">
        <span className="client-detail-stat-icon" aria-hidden>
          {icon}
        </span>
        <span className="client-detail-stat-label">{label}</span>
      </div>
      <div className="client-detail-stat-value">
        <span>{value}</span>
        {unit && <em>{unit}</em>}
      </div>
      {sub && <div className="client-detail-stat-sub">{sub}</div>}
    </div>
  );
}

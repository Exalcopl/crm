"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { C, Card, fmtDate, fmtNum, inputStyle, Page } from "../_components/ui";
import { LotHistoryDrawer } from "../_components/lot-history-drawer";

type MovementType = "ALL" | "PZ" | "RW" | "KOREKTA" | "MM";
type TimeRange = "today" | "7d" | "30d" | "all";

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  PZ: { label: "PZ", color: C.green, bg: "rgba(63, 185, 80, 0.14)" },
  RW: { label: "RW", color: C.red, bg: "rgba(248, 81, 73, 0.14)" },
  KOREKTA: { label: "Korekta", color: C.amber, bg: "rgba(210, 153, 34, 0.16)" },
  MM: { label: "MM", color: C.accent, bg: "rgba(88, 166, 255, 0.14)" },
  HOLD: { label: "Blokada", color: C.muted, bg: "rgba(139, 148, 158, 0.16)" },
  RELEASE: { label: "Zwoln.", color: C.teal, bg: "rgba(15, 123, 108, 0.18)" },
};

function fmtRelativeTime(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60_000);
  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} godz. temu`;
  return fmtDate(ts);
}

function computeSinceMs(range: TimeRange): number | undefined {
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (range === "7d") return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return undefined;
}

export default function WmsRuchyPage() {
  const [typeFilter, setTypeFilter] = useState<MovementType>("ALL");
  const [range, setRange] = useState<TimeRange>("all");
  const [sinceMs, setSinceMs] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [drawerTarget, setDrawerTarget] = useState<{
    lotId: Id<"wms_lots">;
    materialId?: Id<"materials">;
  } | null>(null);

  function handleRangeChange(next: TimeRange) {
    setRange(next);
    setSinceMs(computeSinceMs(next));
  }

  const data = useQuery(api.wms.listMovements, {
    type: typeFilter === "ALL" ? undefined : typeFilter,
    search: search.trim() || undefined,
    sinceMs,
    limit,
  });

  const items = data?.items ?? [];
  const summary = data?.summary ?? { totalCount: 0, pzCount: 0, rwCount: 0 };

  return (
    <Page
      title="Ruchy magazynowe"
      subtitle="Bieżący dziennik przyjęć (PZ), wydań (RW), korekt i przesunięć w magazynie."
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span style={pillStatStyle(C.text)}>Wszystkie: {summary.totalCount}</span>
          <span style={pillStatStyle(C.green)}>PZ: {summary.pzCount}</span>
          <span style={pillStatStyle(C.red)}>RW: {summary.rwCount}</span>
        </div>
      }
    >
      {/* ─── Pasek filtrów ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <input
          style={{ ...inputStyle, maxWidth: 300 }}
          placeholder="Szukaj: SKU, indeks, dokument, zlecenie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div style={segmentedStyle}>
          {(
            [
              { id: "ALL", label: "Wszystkie" },
              { id: "PZ", label: "PZ" },
              { id: "RW", label: "RW" },
              { id: "KOREKTA", label: "Korekty" },
              { id: "MM", label: "MM" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeFilter(t.id)}
              style={segmentedBtnStyle(typeFilter === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={segmentedStyle}>
          {(
            [
              { id: "today", label: "Dziś" },
              { id: "7d", label: "7 dni" },
              { id: "30d", label: "30 dni" },
              { id: "all", label: "Wszystko" },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRangeChange(r.id)}
              style={segmentedBtnStyle(range === r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tabela ruchów ─────────────────────────────────────────────── */}
      <Card pad={false}>
        {!data ? (
          <div style={{ padding: 24, fontSize: 13, color: C.muted }}>Wczytywanie ruchów…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>
            Brak ruchów magazynowych dla wybranych filtrów.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.head }}>
                  <th style={thStyle}>Kiedy</th>
                  <th style={thStyle}>Typ</th>
                  <th style={thStyle}>Indeks / Materiał</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Zmiana</th>
                  <th style={thStyle}>Dokument / Zlecenie</th>
                  <th style={thStyle}>Operator</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const meta = TYPE_META[m.type] ?? {
                    label: m.type,
                    color: C.muted,
                    bg: "rgba(139, 148, 158, 0.14)",
                  };
                  const isPositive = m.quantityDelta > 0;
                  const deltaColor = isPositive
                    ? C.green
                    : m.quantityDelta < 0
                      ? C.red
                      : C.muted;
                  const deltaPrefix = isPositive ? "+" : "";
                  const docHref =
                    m.documentId && m.documentType === "PZ"
                      ? `/admin/wms/pz/${m.documentId}`
                      : m.documentId && m.documentType === "RW"
                        ? `/admin/wms/rw/${m.documentId}`
                        : null;

                  return (
                    <tr
                      key={m._id}
                      onClick={() =>
                        setDrawerTarget({
                          lotId: m.lotId,
                          materialId: m.materialId ?? undefined,
                        })
                      }
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: C.muted }} title={fmtDate(m.createdAt)}>
                        {fmtRelativeTime(m.createdAt)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            color: meta.color,
                            background: meta.bg,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {m.sku && (
                            <span
                              style={{
                                fontFamily: "ui-monospace, Menlo, monospace",
                                fontSize: 12,
                                fontWeight: 700,
                                color: C.accent,
                              }}
                            >
                              {m.sku}
                            </span>
                          )}
                          <span style={{ color: C.text, fontWeight: 500 }}>{m.materialName}</span>
                        </div>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontWeight: 700,
                          color: deltaColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {deltaPrefix}
                        {fmtNum(m.quantityDelta)} {m.unit}
                      </td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {docHref && m.documentNumber ? (
                              <Link
                                href={docHref}
                                style={{
                                  color: C.accent,
                                  textDecoration: "none",
                                  fontFamily: "ui-monospace, Menlo, monospace",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {m.documentNumber}
                              </Link>
                            ) : m.documentNumber ? (
                              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                                {m.documentNumber}
                              </span>
                            ) : null}

                            {m.customLabel ? (
                              <span style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>
                                {m.customLabel}
                              </span>
                            ) : m.orderNumber ? (
                              <span style={{ color: C.muted, fontSize: 12 }}>{m.orderNumber}</span>
                            ) : null}
                          </div>
                          {(m.fromLocationCode || m.toLocationCode || m.note) && (
                            <div style={{ fontSize: 11, color: C.muted }}>
                              {m.fromLocationCode && m.toLocationCode
                                ? `${m.fromLocationCode} → ${m.toLocationCode}`
                                : m.note}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: C.muted, whiteSpace: "nowrap" }}>
                        {m.operatorName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setLimit((prev) => prev + 50)}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: 6,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Załaduj więcej ({data.totalMatched - items.length} pozostało)
          </button>
        </div>
      )}

      {drawerTarget && (
        <LotHistoryDrawer
          lotId={drawerTarget.lotId}
          materialId={drawerTarget.materialId}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </Page>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};

const segmentedStyle: React.CSSProperties = {
  display: "inline-flex",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: 2,
  gap: 2,
};

function segmentedBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#1f6feb" : "transparent",
    color: active ? "#ffffff" : C.muted,
    border: "none",
    borderRadius: 4,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function pillStatStyle(color: string): React.CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    color,
    borderRadius: 999,
    padding: "4px 10px",
    fontWeight: 600,
  };
}

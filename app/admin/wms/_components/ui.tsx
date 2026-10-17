"use client";

import type { CSSProperties, ReactNode } from "react";

// ─── Paleta (spójna z istniejącymi widokami, np. Materiały) ────────────────
export const C = {
  bg: "#0d1117",
  card: "#161b22",
  head: "#21262d",
  border: "#30363d",
  borderFocus: "#388bfd",
  text: "#f0f6fc",
  muted: "#8b949e",
  accent: "#58a6ff",
  green: "#3fb950",
  red: "#f85149",
  amber: "#d29922",
  teal: "#0f7b6c",
};

export const inputStyle: CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
  fontFamily: "inherit",
};

// ─── Etykiety słownikowe ───────────────────────────────────────────────────
export const ZONE_LABEL: Record<string, string> = {
  MAGAZYN_GLOWNY: "Magazyn główny",
  BUFOR_PRODUKCYJNY: "Bufor produkcyjny",
  STREFA_SPADOW: "Strefa spadów",
};
export const LOC_TYPE_LABEL: Record<string, string> = {
  CANTILEVER: "Regał wspornikowy",
  SHELF: "Regał półkowy",
  FLOOR: "Pole odkładcze",
};
export const KIND_LABEL: Record<string, string> = {
  BAR_BUNDLE: "Wiązka / kosz",
  BAR: "Sztanga",
  REMNANT: "Spad (ręcznie)",
};
export const SURFACE_LABEL: Record<string, string> = {
  MILL: "Surowy",
  RAL: "Lakier RAL",
  ANODA: "Anoda",
  BICOLOR: "Dwukolor",
};
export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Dostępny",
  IN_PROGRESS: "W toku",
  DEPLETED: "Wyczerpany",
  DRAFT: "Szkic",
  ZATWIERDZONY: "Zatwierdzony",
  ANULOWANY: "Anulowany",
  OPEN: "Otwarta",
  CLOSED: "Zamknięta",
};
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: C.green,
  IN_PROGRESS: C.amber,
  DEPLETED: C.muted,
  DRAFT: C.amber,
  ZATWIERDZONY: C.green,
  ANULOWANY: C.muted,
  OPEN: C.amber,
  CLOSED: C.green,
};
export const TRACKING_LABEL: Record<string, string> = {
  STRICT: "Ścisła",
  QUANTITY: "Ilościowa",
  NONE: "Brak ewidencji",
};
export const ATTRIBUTE_LABEL: Record<string, string> = {
  length: "Długość",
  color: "Kolor",
  lot: "Partia / wytop",
  certificate: "Atest",
};
export const MOVEMENT_LABEL: Record<string, string> = {
  PZ: "PZ — przyjęcie",
  RW: "RW — wydanie do bufora",
  MM: "MM — przesunięcie",
  KOREKTA: "Korekta",
};

// ─── Formatery ─────────────────────────────────────────────────────────────
export const fmtNum = (n: number, d = 0) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtMb = (n: number) => `${fmtNum(n, 1)} mb`;
export const fmtKg = (n?: number) => (n === undefined ? "—" : `${fmtNum(n, 0)} kg`);
export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Wyświetlany komunikat błędu z Convex (bez prefiksu technicznego). */
export function errMsg(e: unknown): string {
  const raw = (e as { data?: unknown; message?: string })?.data;
  if (typeof raw === "string") return raw;
  const m = (e as Error)?.message ?? "Wystąpił błąd";
  const match = m.match(/Uncaught Error: (.*?)(\n|$)/);
  return match?.[1] ?? m;
}

// ─── Komponenty ────────────────────────────────────────────────────────────
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="fluent-content" style={{ padding: "20px 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0" }}>{subtitle}</p>
          )}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      </div>
      {children}
    </main>
  );
}

export function Card({
  title,
  right,
  children,
  pad = true,
  style,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  pad?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 16,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: "10px 16px",
            background: C.head,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.text,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {title}
          </span>
          {right && <span style={{ fontSize: 12, color: C.muted }}>{right}</span>}
        </div>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  primary,
  danger,
  small,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={primary ? "fluent-btn fluent-btn-primary" : "fluent-btn"}
      style={{
        fontSize: small ? 12 : 13,
        padding: small ? "3px 10px" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...(danger ? { color: C.red, borderColor: C.red } : null),
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  span,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  span?: number;
}) {
  return (
    <label
      style={{
        fontSize: 12,
        color: C.muted,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        gridColumn: span ? `span ${span}` : undefined,
      }}
    >
      {label}
      {children}
      {hint && <span style={{ fontSize: 11, opacity: 0.8 }}>{hint}</span>}
    </label>
  );
}

export function Grid({ cols = 3, children }: { cols?: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const color = STATUS_COLOR[status] ?? C.muted;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 10,
        color,
        border: `1px solid ${color}`,
        whiteSpace: "nowrap",
      }}
    >
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Empty({ icon = "📦", title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div style={{ padding: 36, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
      {text && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{text}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? C.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Tabela ────────────────────────────────────────────────────────────────
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.bg }}>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  color: C.muted,
                  textAlign: "left",
                  borderBottom: `1px solid ${C.head}`,
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: `1px solid ${C.head}`, cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#1c2128")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  mono,
  muted,
  right,
  nowrap,
  bold,
  style,
}: {
  children?: ReactNode;
  mono?: boolean;
  muted?: boolean;
  right?: boolean;
  nowrap?: boolean;
  bold?: boolean;
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "8px 12px",
        fontSize: 13,
        color: muted ? C.muted : C.text,
        fontFamily: mono ? "monospace" : undefined,
        fontWeight: bold ? 700 : undefined,
        textAlign: right ? "right" : "left",
        whiteSpace: nowrap ? "nowrap" : undefined,
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

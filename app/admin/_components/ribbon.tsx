"use client";

import type { ReactNode } from "react";

export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function RibbonBtn({
  icon,
  label,
  active,
  disabled,
  primary,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`ribbon-btn ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={primary ? { color: "var(--accent-primary)" } : undefined}
    >
      <span className="ribbon-icon">{icon}</span>
      <span className="ribbon-label">{label}</span>
    </button>
  );
}

export function RibbonBtnSm({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ribbon-btn-sm" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function RibbonToggleGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="ribbon-toggle-group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

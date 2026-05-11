"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { I } from "./_lib/icons";
import "./fluent.css";

type TabDef = {
  id: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  badge?: number;
};

const TABS: TabDef[] = [
  {
    id: "wyceny",
    label: "Wyceny",
    href: "/admin",
    match: (p) => p === "/admin" || p.startsWith("/admin/wyceny"),
  },
  {
    id: "klienci",
    label: "Klienci",
    href: "/admin/klienci",
    match: (p) => p.startsWith("/admin/klienci"),
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <div className="fluent-shell" data-theme="carbon" data-density="compact">
      <div className="fluent-titlebar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <span>Exalco CRM</span>
        </div>

        <div className="global-search">
          <I.search s={14} />
          <input placeholder="Wyszukaj zlecenia, klientów, faktury, profile…" />
          <span className="kbd">⌘K</span>
        </div>

        <div className="global-actions">
          <button type="button" className="icon-btn" title="Powiadomienia">
            <I.bell s={15} />
            <span className="dot-indicator" />
          </button>
          <button type="button" className="icon-btn" title="Pomoc">
            <I.help s={15} />
          </button>
          <button type="button" className="icon-btn" title="Ustawienia">
            <I.cog s={15} />
          </button>
          <div className="divider" />
          <button type="button" className="profile">
            <div className="av">LS</div>
            <div className="profile-meta">
              <div className="profile-name">Leszek Sakowski</div>
              <div className="profile-role">Administrator</div>
            </div>
          </button>
        </div>
      </div>

      <div className="fluent-tabs" role="tablist">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.id}
              role="tab"
              aria-selected={active}
              className={`fluent-tab ${active ? "active" : ""}`}
              href={t.href}
            >
              {t.label}
              {t.badge != null && <span className="tab-badge">{t.badge}</span>}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

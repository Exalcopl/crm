"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Toaster } from "sonner";
import { AdministracjaRibbon } from "./_components/administracja-ribbon";
import { CalendarPanel } from "./_components/calendar-panel";
import { I } from "./_lib/icons";
import {
  PermissionGate,
  PermissionsProvider,
  usePermissions,
} from "./_lib/permissions";
import "./fluent.css";

type Has = (resource: string, action: string) => boolean;

type TabDef = {
  id: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  visible?: (has: Has) => boolean;
  resource?: string;
  action?: string;
};

const ADMIN_SECTION_PREFIXES = ["/admin/users", "/admin/roles", "/admin/projekt", "/admin/konfigurator", "/admin/ustawienia", "/admin/partnerzy"] as const;

const isAdminSection = (p: string) =>
  ADMIN_SECTION_PREFIXES.some((prefix) => p.startsWith(prefix));

const TABS: TabDef[] = [
  {
    id: "panel",
    label: "Panel",
    href: "/admin/panel",
    match: (p) => p === "/admin" || p.startsWith("/admin/panel"),
  },
  {
    id: "wyceny",
    label: "Wyceny",
    href: "/admin/wyceny",
    match: (p) => p === "/admin/wyceny" || p.startsWith("/admin/wyceny/"),
    resource: "wyceny",
    action: "read",
  },
  {
    id: "zlecenia",
    label: "Zlecenia",
    href: "/admin/zlecenia",
    match: (p) => p.startsWith("/admin/zlecenia"),
    resource: "wyceny",
    action: "read",
  },
  {
    id: "klienci",
    label: "Klienci",
    href: "/admin/klienci",
    match: (p) => p.startsWith("/admin/klienci"),
    resource: "klienci",
    action: "read",
  },
  {
    id: "materialy",
    label: "Materiały",
    href: "/admin/materialy",
    match: (p) => p.startsWith("/admin/materialy"),
    resource: "wyceny",
    action: "read",
  },
  {
    id: "administracja",
    label: "Administracja",
    href: "/admin/users",
    match: (p) => isAdminSection(p),
    visible: (has) => has("users", "read") || has("roles", "read"),
  },
];

function ownerInitials(name: string | null, email: string | null) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return (email ?? "??").slice(0, 2).toUpperCase();
}

function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { user, isLoading, has } = usePermissions();
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword && !pathname.startsWith("/account")) {
      router.replace("/account/change-password");
    }
  }, [user, pathname, router]);

  async function onSignOut() {
    await signOut();
    router.push("/signin");
    router.refresh();
  }

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
          <Link href="/account" className="icon-btn" title="Ustawienia konta">
            <I.cog s={15} />
          </Link>
          <div className="divider" />
          <Link href="/account" className="profile" title="Twoje konto">
            <div className="av">
              {isLoading
                ? ".."
                : ownerInitials(user?.name ?? null, user?.email ?? null)}
            </div>
            <div className="profile-meta">
              <div className="profile-name">
                {isLoading ? "..." : user?.name ?? user?.email ?? "Nieznany"}
              </div>
              <div className="profile-role">
                {user?.role?.displayName ?? "Brak roli"}
              </div>
            </div>
          </Link>
          <button
            type="button"
            className="icon-btn"
            title="Wyloguj"
            onClick={onSignOut}
          >
            <I.signOut s={15} />
          </button>
        </div>
      </div>

      <div className="fluent-tabs" role="tablist">
        {TABS.map((t) => {
          const visible = t.visible
            ? t.visible(has)
            : !t.resource || !t.action || has(t.resource, t.action);
          if (!visible) return null;
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
            </Link>
          );
        })}
      </div>

      {isAdminSection(pathname) && <AdministracjaRibbon />}

      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider>
      <AdminShell>{children}</AdminShell>
      <CalendarPanel />
      <Toaster position="bottom-right" richColors theme="dark" duration={500} style={{ pointerEvents: "none" }} />
    </PermissionsProvider>
  );
}

export { PermissionGate };

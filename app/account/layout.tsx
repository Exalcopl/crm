"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  PermissionsProvider,
  usePermissions,
} from "../admin/_lib/permissions";
import { I } from "../admin/_lib/icons";
import "../admin/fluent.css";
import "./account.css";

function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/account";
  const router = useRouter();
  const { user, isLoading } = usePermissions();
  const { signOut } = useAuthActions();

  const mustChange = user?.mustChangePassword ?? false;

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
        <div style={{ flex: 1 }} />
        <div className="global-actions">
          {!mustChange ? (
            <Link href="/admin" className="icon-btn" title="Wróć do panelu">
              <I.arrowLeft s={15} />
            </Link>
          ) : null}
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {isLoading ? "..." : user?.email ?? ""}
          </span>
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

      {!mustChange ? (
        <div className="fluent-tabs" role="tablist">
          <Link
            role="tab"
            aria-selected={pathname === "/account"}
            className={`fluent-tab ${pathname === "/account" ? "active" : ""}`}
            href="/account"
          >
            Profil
          </Link>
          <Link
            role="tab"
            aria-selected={pathname === "/account/change-password"}
            className={`fluent-tab ${
              pathname === "/account/change-password" ? "active" : ""
            }`}
            href="/account/change-password"
          >
            Hasło
          </Link>
        </div>
      ) : null}

      {children}
    </div>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider>
      <AccountShell>{children}</AccountShell>
    </PermissionsProvider>
  );
}

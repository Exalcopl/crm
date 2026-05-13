"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "../_lib/icons";
import { usePermissions } from "../_lib/permissions";

export function AdministracjaRibbon() {
  const pathname = usePathname() ?? "";
  const { has } = usePermissions();

  const canUsers = has("users", "read");
  const canRoles = has("roles", "read");

  if (!canUsers && !canRoles) return null;

  const usersActive = pathname.startsWith("/admin/users");
  const rolesActive = pathname.startsWith("/admin/roles");

  return (
    <div className="fluent-ribbon">
      <div className="ribbon-group">
        <div className="ribbon-group-content">
          {canUsers && (
            <Link
              href="/admin/users"
              className={`ribbon-btn ${usersActive ? "active" : ""}`}
            >
              <span className="ribbon-icon">
                <I.users s={22} />
              </span>
              <span className="ribbon-label">Użytkownicy</span>
            </Link>
          )}
          {canRoles && (
            <Link
              href="/admin/roles"
              className={`ribbon-btn ${rolesActive ? "active" : ""}`}
            >
              <span className="ribbon-icon">
                <I.shield s={22} />
              </span>
              <span className="ribbon-label">Role</span>
            </Link>
          )}
        </div>
        <div className="ribbon-group-label">Użytkownicy</div>
      </div>
    </div>
  );
}

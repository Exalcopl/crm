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
  const projectTypesActive = pathname.startsWith("/admin/projekt/typy");
  const calendarCategoriesActive = pathname.startsWith("/admin/projekt/kategorie");
  const configuratorActive = pathname.startsWith("/admin/konfigurator");

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

      <div className="ribbon-group">
        <div className="ribbon-group-content">
          <Link
            href="/admin/projekt/typy"
            className={`ribbon-btn ${projectTypesActive ? "active" : ""}`}
          >
            <span className="ribbon-icon">
              <I.layers s={22} />
            </span>
            <span className="ribbon-label">Typy projektów</span>
          </Link>
          <Link
            href="/admin/projekt/kategorie"
            className={`ribbon-btn ${calendarCategoriesActive ? "active" : ""}`}
          >
            <span className="ribbon-icon">
              <I.cal s={22} />
            </span>
            <span className="ribbon-label">Kategorie kalendarza</span>
          </Link>
        </div>
        <div className="ribbon-group-label">Projekt</div>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-group-content">
          <Link
            href="/admin/konfigurator"
            className={`ribbon-btn ${configuratorActive ? "active" : ""}`}
          >
            <span className="ribbon-icon">
              <I.box s={22} />
            </span>
            <span className="ribbon-label">Konfigurator</span>
          </Link>
        </div>
        <div className="ribbon-group-label">Konfigurator</div>
      </div>
    </div>
  );
}

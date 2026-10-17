"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY_CRM = "exalco:lastCrmPath";
const KEY_WMS = "exalco:lastWmsPath";
const isWmsPath = (p: string) => p === "/admin/wms" || p.startsWith("/admin/wms/");

/**
 * Przełącznik modułów CRM | WMS obok logotypu w titlebarze.
 * Zapamiętuje ostatnią ścieżkę każdego modułu (localStorage), więc powrót
 * do modułu przywraca miejsce, w którym użytkownik skończył.
 */
export function ModuleSwitcher() {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const inWms = isWmsPath(pathname);

  useEffect(() => {
    try {
      localStorage.setItem(inWms ? KEY_WMS : KEY_CRM, pathname);
    } catch {
      /* localStorage niedostępny — pomijamy */
    }
  }, [pathname, inWms]);

  function go(target: "crm" | "wms") {
    if ((target === "wms") === inWms) return;
    let dest = target === "wms" ? "/admin/wms" : "/admin/panel";
    try {
      const saved = localStorage.getItem(target === "wms" ? KEY_WMS : KEY_CRM);
      if (saved && isWmsPath(saved) === (target === "wms")) dest = saved;
    } catch {
      /* ignore */
    }
    router.push(dest);
  }

  const seg = (active: boolean, accent: string): React.CSSProperties => ({
    border: "none",
    cursor: "pointer",
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    borderRadius: 5,
    fontFamily: "inherit",
    color: active ? "#ffffff" : "#8b949e",
    background: active ? accent : "transparent",
    transition: "all 0.15s ease",
  });

  return (
    <div
      role="tablist"
      aria-label="Przełącznik modułu"
      title="Przełącz moduł: CRM / WMS"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 2,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 7,
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={!inWms}
        onClick={() => go("crm")}
        style={seg(!inWms, "#d41d3c")}
      >
        CRM
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={inWms}
        onClick={() => go("wms")}
        style={seg(inWms, "#0f7b6c")}
      >
        WMS
      </button>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../admin/fluent.css";
import "./app.css";

export const metadata: Metadata = {
  title: "Exalco Tasks",
  description: "Mobilna aplikacja do zarządzania zadaniami Exalco CRM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zadania",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * /app layout – standalone PWA shell.
 * No PermissionsProvider – /app manages its own PIN session via sessionStorage,
 * completely independent from /admin Convex Auth.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-app-shell" data-theme="carbon" data-density="compact">
      {children}
    </div>
  );
}

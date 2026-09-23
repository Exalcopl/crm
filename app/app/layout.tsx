import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../admin/fluent.css";
import "./app.css";
import { InstallPWAModal } from "./InstallPWAModal";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Biuro",
  description: "Exalco CRM – Biuro",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Biuro",
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
      <ServiceWorkerRegistrar />
      {children}
      <InstallPWAModal />
    </div>
  );
}

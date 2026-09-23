"use client";

import { useEffect } from "react";

/**
 * Rejestruje Service Workera dla zakresu /app.
 * Musi być komponentem klienckim ("use client"), bo używa navigator API.
 * Renderuje null – brak widocznego UI.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/app/" })
      .then((registration) => {
        console.log("[PWA] Service Worker zarejestrowany:", registration.scope);

        // Wymuszenie natychmiastowej aktywacji nowej wersji SW
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA] Nowa wersja SW dostępna.");
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error("[PWA] Błąd rejestracji Service Workera:", err);
      });
  }, []);

  return null;
}

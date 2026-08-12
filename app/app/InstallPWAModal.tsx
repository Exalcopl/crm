"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export function InstallPWAModal() {
  const [isInstallPromptSupported, setIsInstallPromptSupported] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Sprawdź, czy aplikacja jest już w trybie standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isStandalone) {
      return;
    }

    // Sprawdź, czy użytkownik wcześniej odrzucił modal
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissed === "true") {
      return;
    }

    // Detekcja iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // iOS nie obsługuje beforeinstallprompt, po prostu pokazujemy instrukcję
      // Opóźniamy lekko pokazanie modalu, by nie wyskakiwał agresywnie
      const timer = setTimeout(() => setShowModal(true), 2000);
      return () => clearTimeout(timer);
    }

    // Przechwycenie eventu instalacji w Android/Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallPromptSupported(true);
      setShowModal(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowModal(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showModal) return null;

  return (
    <div className="pwa-install-overlay">
      <div className="pwa-install-modal slide-up">
        <button className="pwa-close-btn" onClick={handleDismiss} aria-label="Zamknij">
          ✕
        </button>
        <div className="pwa-modal-body">
          <Image src="/icon-192.png" alt="App Icon" width={56} height={56} className="pwa-app-icon" />
          <div className="pwa-modal-text">
            <h3>Zainstaluj Zadania Exalco</h3>
            <p>
              {isIOS
                ? "Aby używać jako natywnej aplikacji, dotknij ikony 'Udostępnij' i wybierz 'Do ekranu początkowego'."
                : "Zainstaluj aplikację na ekranie głównym telefonu dla pełnego komfortu i pracy w trybie pełnoekranowym."}
            </p>
          </div>
        </div>
        {!isIOS && isInstallPromptSupported && (
          <button className="pwa-install-btn" onClick={handleInstallClick}>
            Zainstaluj aplikację
          </button>
        )}
      </div>
    </div>
  );
}

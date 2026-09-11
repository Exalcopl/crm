"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../_lib/icons";
import { usePermissions } from "../_lib/permissions";

export default function UstawieniaPage() {
  const { user, isLoading } = usePermissions();
  
  // OCR settings
  const currentProvider = useQuery(api.systemSettings.getOcrProvider) ?? "anthropic";
  const setProvider = useMutation(api.systemSettings.setOcrProvider);
  const [selectedProvider, setSelectedProvider] = useState<"anthropic" | "gemini">("anthropic");
  const [savingOcr, setSavingOcr] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Notification settings
  const notifSettings = useQuery(api.notifications.getSettings);
  const updateNotifSettings = useMutation(api.notifications.updateSettings);

  const [enableNewQuote, setEnableNewQuote] = useState(true);
  const [enableNewOrder, setEnableNewOrder] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync state with db queries
  useEffect(() => {
    if (currentProvider) {
      setSelectedProvider(currentProvider as "anthropic" | "gemini");
    }
  }, [currentProvider]);

  useEffect(() => {
    if (notifSettings) {
      setEnableNewQuote(notifSettings.enabledTypes.includes("new_quote"));
      setEnableNewOrder(notifSettings.enabledTypes.includes("new_order"));
      setSoundEnabled(notifSettings.soundEnabled);
    }
  }, [notifSettings]);

  const isAdmin = user && (user.role?.name === "admin" || user.role?.name === "super_admin");

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "100px", color: "var(--text-muted)" }}>
        Wczytywanie ustawień…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "40px", color: "var(--text-muted)", textAlign: "center" }}>
        Brak uprawnień do przeglądania ustawień systemowych.
      </div>
    );
  }

  async function handleSaveOcr() {
    setSavingOcr(true);
    setOcrMessage(null);
    try {
      await setProvider({ provider: selectedProvider });
      setOcrMessage({ text: "Zapisano ustawienia OCR.", type: "success" });
    } catch (e: any) {
      setOcrMessage({ text: e.message || "Błąd zapisu.", type: "error" });
    } finally {
      setSavingOcr(false);
    }
  }

  async function handleSaveNotif() {
    setSavingNotif(true);
    setNotifMessage(null);

    const enabledTypes: string[] = [];
    if (enableNewQuote) enabledTypes.push("new_quote");
    if (enableNewOrder) enabledTypes.push("new_order");

    try {
      await updateNotifSettings({
        enabledTypes,
        soundEnabled,
      });
      setNotifMessage({ text: "Zapisano konfigurację powiadomień.", type: "success" });
    } catch (e: any) {
      setNotifMessage({ text: e.message || "Błąd zapisu powiadomień.", type: "error" });
    } finally {
      setSavingNotif(false);
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "680px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
        Ustawienia Systemowe
      </h1>

      {/* Card 1: System Powiadomień */}
      <div
        className="fluent-card"
        style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          background: "var(--bg-surface, #141b2d)",
          border: "1px solid var(--border-default, rgba(255,255,255,0.08))",
          borderRadius: "8px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
            🔔 Konfiguracja Elementów Powiadomień
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", marginBottom: 0, lineHeight: 1.5 }}>
            Wybierz typy zdarzeń, dla których generowane będą powiadomienia czasu rzeczywistego w nagłówku.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Option: Nowa Wycena */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px" }}>📄</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                  Powiadomienia o nowej wycenie
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Generuj powiadomienie w nagłówku przy utworzeniu nowej wyceny
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableNewQuote}
              onChange={(e) => setEnableNewQuote(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#d41d3c", cursor: "pointer" }}
            />
          </label>

          {/* Option: Nowe Zlecenie */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px" }}>📦</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                  Powiadomienia o nowym zleceniu
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Generuj powiadomienie w nagłówku przy utworzeniu lub konwersji nowego zlecenia
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableNewOrder}
              onChange={(e) => setEnableNewOrder(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#d41d3c", cursor: "pointer" }}
            />
          </label>

          {/* Option: Audio Chime */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px" }}>🔊</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                  Sygnał dźwiękowy (Audio chime)
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Odtwarzaj subtelny dźwięk systemowy przy odnotowaniu nowego powiadomienia
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#d41d3c", cursor: "pointer" }}
            />
          </label>
        </div>

        {notifMessage && (
          <div
            style={{
              padding: "12px",
              borderRadius: "6px",
              fontSize: "13px",
              background: notifMessage.type === "success" ? "rgba(34, 160, 107, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: notifMessage.type === "success" ? "1px solid rgba(34, 160, 107, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
              color: notifMessage.type === "success" ? "#4ade80" : "#f87171",
            }}
          >
            {notifMessage.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveNotif}
          disabled={savingNotif}
          style={{
            background: "#d41d3c",
            color: "#ffffff",
            padding: "10px 18px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            alignSelf: "flex-end",
            transition: "opacity 150ms ease",
          }}
        >
          {savingNotif ? "Zapisywanie…" : "Zapisz konfigurację powiadomień"}
        </button>
      </div>

      {/* Card 2: OCR */}
      <div
        className="fluent-card"
        style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          background: "var(--bg-surface, #141b2d)",
          border: "1px solid var(--border-default, rgba(255,255,255,0.08))",
          borderRadius: "8px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-secondary)" }}>
            Konfiguracja OCR (Rozpoznawanie Dokumentów)
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", marginBottom: 0, lineHeight: 1.5 }}>
            Wybierz aktywnego dostawcę silnika LLM do analizowania i wyciągania tabel pozycji z plików ofert i wycen.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Anthropic Claude */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "14px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: selectedProvider === "anthropic" ? "1px solid #d41d3c" : "1px solid rgba(255, 255, 255, 0.05)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <input
              type="radio"
              name="ocr_provider"
              checked={selectedProvider === "anthropic"}
              onChange={() => setSelectedProvider("anthropic")}
              style={{ accentColor: "#d41d3c", marginTop: "3px" }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                Anthropic Claude API (Domyślne)
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Logika wyszukiwania modeli (Sonnet 3.5 / Haiku). Wymaga zdefiniowanego klucza <code style={{ color: "#d41d3c" }}>ANTHROPIC_API_KEY</code> w Convex.
              </div>
            </div>
          </label>

          {/* Google Gemini */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "14px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: selectedProvider === "gemini" ? "1px solid #d41d3c" : "1px solid rgba(255, 255, 255, 0.05)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <input
              type="radio"
              name="ocr_provider"
              checked={selectedProvider === "gemini"}
              onChange={() => setSelectedProvider("gemini")}
              style={{ accentColor: "#d41d3c", marginTop: "3px" }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
                Google Gemini API (AI Studio - Free Tier)
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Wykorzystuje model <code style={{ color: "#3b82f6" }}>gemini-1.5-flash</code> z obsługą formatu JSON. Wymaga zdefiniowanego klucza <code style={{ color: "#3b82f6" }}>GEMINI_API_KEY</code> w Convex.
              </div>
            </div>
          </label>
        </div>

        {ocrMessage && (
          <div
            style={{
              padding: "12px",
              borderRadius: "6px",
              fontSize: "13px",
              background: ocrMessage.type === "success" ? "rgba(34, 160, 107, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: ocrMessage.type === "success" ? "1px solid rgba(34, 160, 107, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
              color: ocrMessage.type === "success" ? "#4ade80" : "#f87171",
            }}
          >
            {ocrMessage.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveOcr}
          disabled={savingOcr}
          style={{
            background: "#d41d3c",
            color: "#ffffff",
            padding: "10px 18px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            alignSelf: "flex-end",
            transition: "opacity 150ms ease",
          }}
        >
          {savingOcr ? "Zapisywanie…" : "Zapisz ustawienia OCR"}
        </button>
      </div>
    </div>
  );
}

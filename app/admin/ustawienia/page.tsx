"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../_lib/icons";
import { usePermissions } from "../_lib/permissions";

export default function UstawieniaPage() {
  const { user, isLoading } = usePermissions();
  const currentProvider = useQuery(api.systemSettings.getOcrProvider) ?? "anthropic";
  const setProvider = useMutation(api.systemSettings.setOcrProvider);

  const [selectedProvider, setSelectedProvider] = useState<"anthropic" | "gemini">("anthropic");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync state with db query
  useEffect(() => {
    if (currentProvider) {
      setSelectedProvider(currentProvider as "anthropic" | "gemini");
    }
  }, [currentProvider]);

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

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await setProvider({ provider: selectedProvider });
      setMessage({ text: "Zapisano ustawienia systemowe.", type: "success" });
    } catch (e: any) {
      setMessage({ text: e.message || "Błąd zapisu.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)" }}>
        Ustawienia Systemowe
      </h1>

      <div className="fluent-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", background: "var(--bg-surface, #141b2d)", border: "1px solid var(--border-default, rgba(255,255,255,0.08))", borderRadius: "8px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-secondary)" }}>
          Konfiguracja OCR (Rozpoznawanie Dokumentów)
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Wybierz aktywnego dostawcę silnika LLM do analizowania i wyciągania tabel pozycji z plików ofert i wycen.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
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
              transition: "all 150ms ease"
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
              transition: "all 150ms ease"
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

        {message && (
          <div
            style={{
              padding: "12px",
              borderRadius: "6px",
              fontSize: "13px",
              background: message.type === "success" ? "rgba(34, 160, 107, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: message.type === "success" ? "1px solid rgba(34, 160, 107, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
              color: message.type === "success" ? "#4ade80" : "#f87171"
            }}
          >
            {message.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "#d41d3c",
            color: "#ffffff",
            padding: "12px 20px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            alignSelf: "flex-end",
            transition: "opacity 150ms ease"
          }}
        >
          {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
        </button>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

export function QuoteSimpleNotes({
  quoteId,
  initialNotes,
  archived,
}: {
  quoteId: Id<"quotes">;
  initialNotes: string;
  archived?: boolean;
}) {
  const updateNotes = useMutation(api.quotes.updateNotes);
  const [value, setValue] = useState(initialNotes || "");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!isDirty && (initialNotes || "") !== value) {
      setValue(initialNotes || "");
    }
  }, [initialNotes, isDirty, value]);

  const handleSave = useCallback(async () => {
    if (archived || !isDirty || saving) return;
    setSaving(true);
    try {
      await updateNotes({ id: quoteId, notes: valueRef.current });
      setIsDirty(false);
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2500);
    } catch (e) {
      console.error("Błąd zapisywania notatek:", e);
    } finally {
      setSaving(false);
    }
  }, [archived, isDirty, saving, quoteId, updateNotes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${Math.max(120, el.scrollHeight)}px`;
          }
        }}
        className="fluent-input"
        style={{
          width: "100%",
          minHeight: "120px",
          resize: "none",
          overflow: "hidden",
          fontSize: "13.5px",
          lineHeight: "1.5",
          padding: "10px 12px",
          borderRadius: "6px",
          fontFamily: "inherit",
          background: archived ? "var(--surface-secondary)" : undefined,
        }}
        placeholder={archived ? "Brak notatek (archiwum)" : "Wpisz zwykłe notatki do tej wyceny (bez dat i historii)..."}
        value={value}
        disabled={archived}
        onChange={(e) => {
          setValue(e.target.value);
          setIsDirty(true);
          setSavedRecently(false);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.max(120, e.target.scrollHeight)}px`;
        }}
        onBlur={() => {
          if (isDirty) {
            void handleSave();
          }
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "28px",
        }}
      >
        <span style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>
          {isDirty
            ? "Niezapisane zmiany — kliknij poza pole lub przycisk Zapisz"
            : "Zapisuje się automatycznie po wyjściu z pola lub przyciskiem"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && (
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Zapisywanie...
            </span>
          )}
          {!saving && savedRecently && !isDirty && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--accent, #107c41)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 500,
              }}
            >
              <I.check s={14} /> Zapisano
            </span>
          )}
          {!saving && isDirty && (
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              onClick={handleSave}
            >
              Zapisz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

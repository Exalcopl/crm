"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { TemplateEditorModal } from "./_components/TemplateEditorModal";
import { type CustomList } from "../_components/CustomChecklistsHeader";
import { CheckSquare, Plus, Edit3, Trash2, Star, Search, Sliders, AlertTriangle, FileText, ListTodo } from "lucide-react";
import { toast } from "sonner";

type SubTab = "szablony-checklist" | "domyslne-zadania" | "szybkie-notatki";

export default function KonfiguracjePage() {
  const [activeTab, setActiveTab] = useState<SubTab>("szablony-checklist");
  const [searchQuery, setSearchQuery] = useState("");

  // Editor modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{
    id: Id<"checklistTemplates">;
    name: string;
    lists: CustomList[];
  } | null>(null);

  // Potykacz (Confirmation modal for deletion)
  const [deletingTemplate, setDeletingTemplate] = useState<{
    id: Id<"checklistTemplates">;
    name: string;
  } | null>(null);

  const templates = useQuery(api.checklistTemplates.list) ?? [];
  const setDefaultMut = useMutation(api.checklistTemplates.setDefaultTemplate);
  const removeTemplateMut = useMutation(api.checklistTemplates.removeTemplate);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  async function handleToggleDefault(id: Id<"checklistTemplates">, type: "quote" | "order", currentValue: boolean) {
    try {
      await setDefaultMut({
        id,
        type,
        isDefault: !currentValue,
      });
      const typeLabel = type === "quote" ? "Wycen" : "Zleceń";
      if (!currentValue) {
        toast.success(`Ustawiono szablon jako domyślny dla ${typeLabel}`);
      } else {
        toast.info(`Odznaczono domyślny szablon dla ${typeLabel}`);
      }
    } catch {
      toast.error("Błąd zmiany domyślnego szablonu");
    }
  }

  async function confirmDeleteTemplate() {
    if (!deletingTemplate) return;
    try {
      await removeTemplateMut({ id: deletingTemplate.id });
      toast.success(`Usunięto szablon „${deletingTemplate.name}”`);
    } catch {
      toast.error("Nie udało się usunąć szablonu");
    } finally {
      setDeletingTemplate(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#c9d1d9", padding: "16px 24px" }}>
      {/* Header Title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <Sliders size={22} style={{ color: "#3b82f6" }} />
            <span>Konfiguracje Operacyjne</span>
          </h1>
          <p style={{ fontSize: 12, color: "#8b949e", margin: "4px 0 0 0" }}>
            Zarządzanie szablonami i ustawieniami roboczymi pracowników (szablony checklist, wzorce zadań, notatki).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingTemplate(null);
            setIsEditorOpen(true);
          }}
          style={{
            background: "#238636",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 16px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 8px rgba(35, 134, 54, 0.4)",
          }}
        >
          <Plus size={15} />
          <span>+ Nowy Szablon</span>
        </button>
      </div>

      {/* Sub-tabs Navigation Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid #30363d",
          marginBottom: 20,
          paddingBottom: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("szablony-checklist")}
          style={{
            background: activeTab === "szablony-checklist" ? "rgba(59, 130, 246, 0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === "szablony-checklist" ? "2px solid #3b82f6" : "2px solid transparent",
            borderRadius: "6px 6px 0 0",
            color: activeTab === "szablony-checklist" ? "#60a5fa" : "#8b949e",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CheckSquare size={14} />
          <span>Szablony Checklist ({templates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("domyslne-zadania")}
          style={{
            background: activeTab === "domyslne-zadania" ? "rgba(59, 130, 246, 0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === "domyslne-zadania" ? "2px solid #3b82f6" : "2px solid transparent",
            borderRadius: "6px 6px 0 0",
            color: activeTab === "domyslne-zadania" ? "#60a5fa" : "#8b949e",
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 14px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ListTodo size={14} />
          <span>Domyślne Zadania</span>
          <span style={{ fontSize: 9, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, color: "#8b949e" }}>wkrótce</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("szybkie-notatki")}
          style={{
            background: activeTab === "szybkie-notatki" ? "rgba(59, 130, 246, 0.15)" : "transparent",
            border: "none",
            borderBottom: activeTab === "szybkie-notatki" ? "2px solid #3b82f6" : "2px solid transparent",
            borderRadius: "6px 6px 0 0",
            color: activeTab === "szybkie-notatki" ? "#60a5fa" : "#8b949e",
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 14px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileText size={14} />
          <span>Szybkie Notatki</span>
          <span style={{ fontSize: 9, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, color: "#8b949e" }}>wkrótce</span>
        </button>
      </div>

      {/* Tab Content: Szablony Checklist */}
      {activeTab === "szablony-checklist" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Action & Filter Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ position: "relative", width: 280 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8b949e" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj szablonu..."
                style={{
                  width: "100%",
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "6px 10px 6px 32px",
                  fontSize: 12,
                  color: "#f0f6fc",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 12 }}>
              <span>Znaleziono: <strong style={{ color: "#f0f6fc" }}>{filteredTemplates.length}</strong></span>
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {filteredTemplates.map((t) => {
              const listsCount = t.lists.length;
              const totalItemsCount = t.lists.reduce((acc, l) => acc + l.items.length, 0);

              return (
                <div
                  key={t._id}
                  style={{
                    background: "#161b22",
                    border: t.isDefaultQuote || t.isDefaultOrder ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid #30363d",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    position: "relative",
                  }}
                >
                  {/* Card Header */}
                  <div>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {t.name}
                      </h2>

                      {/* Action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate({ id: t._id, name: t.name, lists: t.lists as CustomList[] });
                            setIsEditorOpen(true);
                          }}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #30363d", borderRadius: 4, color: "#c9d1d9", cursor: "pointer", padding: "3px 6px" }}
                          title="Edytuj szablon"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTemplate({ id: t._id, name: t.name })}
                          style={{ background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.3)", borderRadius: 4, color: "#f85149", cursor: "pointer", padding: "3px 6px" }}
                          title="Usuń szablon"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Default Badges & Toggles */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={() => void handleToggleDefault(t._id, "quote", Boolean(t.isDefaultQuote))}
                        style={{
                          background: t.isDefaultQuote ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.03)",
                          border: t.isDefaultQuote ? "1px solid rgba(245, 158, 11, 0.4)" : "1px dashed rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          color: t.isDefaultQuote ? "#fbbf24" : "#8b949e",
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Kliknij, aby zmienić domyślność dla Wycen"
                      >
                        <Star size={11} fill={t.isDefaultQuote ? "#fbbf24" : "none"} />
                        <span>Domyślny Wyceny</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleDefault(t._id, "order", Boolean(t.isDefaultOrder))}
                        style={{
                          background: t.isDefaultOrder ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.03)",
                          border: t.isDefaultOrder ? "1px solid rgba(16, 185, 129, 0.4)" : "1px dashed rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          color: t.isDefaultOrder ? "#34d399" : "#8b949e",
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Kliknij, aby zmienić domyślność dla Zleceń"
                      >
                        <Star size={11} fill={t.isDefaultOrder ? "#34d399" : "none"} />
                        <span>Domyślny Zlecenia</span>
                      </button>
                    </div>

                    {/* Lists structure preview */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, background: "#0d1117", padding: 8, borderRadius: 6, border: "1px solid #21262d" }}>
                      {t.lists.map((l: any, lIdx: number) => (
                        <div key={l.id || lIdx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color ?? "#3b82f6", flexShrink: 0 }} />
                            <span>{l.title}</span>
                          </div>
                          <div style={{ fontSize: 9, color: "#8b949e" }}>
                            {l.items?.length ?? 0} punkty
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer Meta */}
                  <div style={{ fontSize: 10, color: "#8b949e", borderTop: "1px solid #21262d", paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Łącznie: <strong>{totalItemsCount}</strong> punktów w <strong>{listsCount}</strong> listach</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#161b22", borderRadius: 8, border: "1px solid #30363d" }}>
              <CheckSquare size={32} style={{ color: "#484f58", marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>Brak szablonów spełniających kryteria</div>
              <p style={{ fontSize: 12, color: "#8b949e", margin: "4px 0 12px 0" }}>Stwórz nowy szablon przyciskiem poniżej.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setIsEditorOpen(true);
                }}
                style={{
                  background: "#238636",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                + Stwórz Nowy Szablon
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Placeholder for Future Operational Settings */}
      {activeTab !== "szablony-checklist" && (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#161b22", borderRadius: 8, border: "1px solid #30363d" }}>
          <Sliders size={36} style={{ color: "#3b82f6", marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc" }}>Sekcja w przygotowaniu</div>
          <p style={{ fontSize: 12, color: "#8b949e", maxWidth: 400, margin: "6px auto 0 auto" }}>
            Ta zakładka pomieści w przyszłości dodatkowe konfiguracje pracownicze (np. szablonowe wzorce zadań, słowniki i notatki).
          </p>
        </div>
      )}

      {/* Template Visual Editor Modal */}
      {isEditorOpen && (
        <TemplateEditorModal
          initialData={editingTemplate}
          onClose={() => setIsEditorOpen(false)}
          onSuccess={() => setIsEditorOpen(false)}
        />
      )}

      {/* Potykacz: Confirmation modal for template deletion */}
      {deletingTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setDeletingTemplate(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid rgba(248, 81, 73, 0.4)",
              borderRadius: 8,
              padding: 20,
              width: 380,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f85149", fontSize: 14, fontWeight: 700 }}>
              <AlertTriangle size={18} />
              <span>Usunięcie szablonu</span>
            </div>
            <div style={{ fontSize: 12, color: "#c9d1d9", lineHeight: 1.5 }}>
              Czy na pewno chcesz usunąć szablon <strong style={{ color: "#f0f6fc" }}>„{deletingTemplate.name}”</strong>? Operacji tej nie można cofnąć.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setDeletingTemplate(null)}
                style={{
                  background: "transparent",
                  border: "1px solid #30363d",
                  borderRadius: 5,
                  color: "#8b949e",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTemplate()}
                style={{
                  background: "#da3633",
                  border: "none",
                  borderRadius: 5,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                Tak, usuń szablon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

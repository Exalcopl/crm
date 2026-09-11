"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckSquare, Square, Plus, Trash2, Edit2, Palette, BookmarkPlus, Check, X, FolderOpen, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type CustomList = {
  id: string;
  title: string;
  color: string;
  items: ChecklistItem[];
};

export const COLOR_PALETTE = [
  { hex: "#3b82f6", name: "Niebieski" },
  { hex: "#8b5cf6", name: "Fioletowy" },
  { hex: "#10b981", name: "Zielony" },
  { hex: "#f59e0b", name: "Bursztynowy" },
  { hex: "#ec4899", name: "Różowy" },
  { hex: "#06b6d4", name: "Cyjan" },
];

export function normalizeChecklists(raw: any): CustomList[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CustomList[];
  
  // Backwards compatibility for legacy col1, col2, col3
  const result: CustomList[] = [];
  if (raw.col1 && Array.isArray(raw.col1) && raw.col1.length > 0) {
    result.push({
      id: "col1",
      title: "Dokumentacja & Wymagania",
      color: "#3b82f6",
      items: raw.col1,
    });
  }
  if (raw.col2 && Array.isArray(raw.col2) && raw.col2.length > 0) {
    result.push({
      id: "col2",
      title: "Kalkulacja & Produkcja",
      color: "#8b5cf6",
      items: raw.col2,
    });
  }
  if (raw.col3 && Array.isArray(raw.col3) && raw.col3.length > 0) {
    result.push({
      id: "col3",
      title: "Logistyka & Montaż",
      color: "#10b981",
      items: raw.col3,
    });
  }
  return result;
}

interface CustomChecklistsHeaderProps {
  initialChecklists: any;
  onSave: (updatedLists: CustomList[]) => Promise<void>;
  disabled?: boolean;
}

export function CustomChecklistsHeader({
  initialChecklists,
  onSave,
  disabled = false,
}: CustomChecklistsHeaderProps) {
  const normalized = useMemo(() => normalizeChecklists(initialChecklists), [initialChecklists]);
  const [lists, setLists] = useState<CustomList[]>(normalized);
  const [newItemText, setNewItemText] = useState<{ [listId: string]: string }>({});
  
  // New list creation state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListColor, setNewListColor] = useState("#3b82f6");

  // Inline title editing state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  // Color picker state
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);

  // Template saving modal state
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  // Potykacze (Confirmation Modals)
  const [deletingTemplate, setDeletingTemplate] = useState<{ id: any; name: string } | null>(null);
  const [deletingList, setDeletingList] = useState<{ id: string; title: string } | null>(null);

  // Convex query & mutations for templates
  const userTemplates = useQuery(api.checklistTemplates.list) ?? [];
  const saveTemplateMut = useMutation(api.checklistTemplates.saveTemplate);
  const removeTemplateMut = useMutation(api.checklistTemplates.removeTemplate);
  const seedDefaultsMut = useMutation(api.checklistTemplates.seedDefaults);

  useEffect(() => {
    setLists(normalized);
  }, [normalized]);

  async function updateAndSave(nextLists: CustomList[]) {
    setLists(nextLists);
    try {
      await onSave(nextLists);
    } catch {
      toast.error("Nie udało się zapisać zmian w checklistach");
    }
  }

  // --- Handlers ---
  function handleToggleItem(listId: string, itemId: string) {
    if (disabled) return;
    const next = lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
      };
    });
    void updateAndSave(next);
  }

  function handleAddItem(listId: string) {
    if (disabled) return;
    const text = newItemText[listId]?.trim();
    if (!text) return;
    const next = lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: [...l.items, { id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, label: text, checked: false }],
      };
    });
    setNewItemText((prev) => ({ ...prev, [listId]: "" }));
    void updateAndSave(next);
  }

  function handleRemoveItem(listId: string, itemId: string) {
    if (disabled) return;
    const next = lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.filter((i) => i.id !== itemId),
      };
    });
    void updateAndSave(next);
  }

  function handleCreateList() {
    if (disabled) return;
    const title = newListTitle.trim() || `Lista ${lists.length + 1}`;
    if (lists.length >= 3) {
      toast.error("Maksymalnie możesz utworzyć 3 listy");
      return;
    }
    const newList: CustomList = {
      id: `list_${Date.now()}`,
      title,
      color: newListColor,
      items: [],
    };
    const next = [...lists, newList];
    setIsAddingList(false);
    setNewListTitle("");
    void updateAndSave(next);
    toast.success(`Utworzono listę: „${title}”`);
  }

  function confirmRemoveList() {
    if (!deletingList) return;
    const next = lists.filter((l) => l.id !== deletingList.id);
    void updateAndSave(next);
    toast.success(`Usunięto listę „${deletingList.title}”`);
    setDeletingList(null);
  }

  function handleSaveTitle(listId: string) {
    if (disabled) return;
    const cleaned = editingTitleText.trim();
    if (cleaned) {
      const next = lists.map((l) => (l.id === listId ? { ...l, title: cleaned } : l));
      void updateAndSave(next);
    }
    setEditingTitleId(null);
  }

  function handleChangeColor(listId: string, color: string) {
    if (disabled) return;
    const next = lists.map((l) => (l.id === listId ? { ...l, color } : l));
    setOpenColorPickerId(null);
    void updateAndSave(next);
  }

  function handleApplyPreset(presetLists: CustomList[]) {
    if (disabled) return;
    const freshLists: CustomList[] = presetLists.map((l, idx) => ({
      id: `list_${Date.now()}_${idx}`,
      title: l.title,
      color: l.color,
      items: l.items.map((i, iIdx) => ({
        id: `item_${Date.now()}_${idx}_${iIdx}`,
        label: i.label,
        checked: false,
      })),
    }));
    setIsPresetDropdownOpen(false);
    void updateAndSave(freshLists);
    toast.success("Wczytano zestaw list z szablonu");
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) {
      toast.error("Wpisz nazwę szablonu");
      return;
    }
    try {
      await saveTemplateMut({
        name: templateName.trim(),
        lists,
      });
      setIsSaveTemplateModalOpen(false);
      setTemplateName("");
      toast.success("Szablon został pomyślnie zapisany!");
    } catch {
      toast.error("Błąd zapisywania szablonu");
    }
  }

  async function confirmDeleteTemplate() {
    if (!deletingTemplate) return;
    try {
      if (deletingTemplate.id) {
        await removeTemplateMut({ id: deletingTemplate.id });
        toast.success(`Usunięto szablon „${deletingTemplate.name}”`);
      } else {
        toast.error("Brak identyfikatora szablonu do usunięcia");
      }
    } catch {
      toast.error("Nie udało się usunąć szablonu");
    } finally {
      setDeletingTemplate(null);
    }
  }

  const remainingSlots = Math.max(0, 3 - lists.length);

  return (
    <div style={{ background: "rgba(13, 17, 23, 0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginTop: 4 }}>
      {/* Bar top control: Header title & Presets */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CheckSquare size={13} style={{ color: "#3b82f6" }} />
            <span>Listy zadań i weryfikacji ({lists.length}/3)</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {lists.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => setIsSaveTemplateModalOpen(true)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 5,
                color: "var(--text-main)",
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
              }}
              title="Zapisz obecny zestaw list jako szablon"
            >
              <BookmarkPlus size={12} style={{ color: "#f59e0b" }} />
              <span>Zapisz jako szablon</span>
            </button>
          )}

          {/* Load template dropdown */}
          {!disabled && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                style={{
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 5,
                  color: "#60a5fa",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 8px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <FolderOpen size={12} />
                <span>Wczytaj szablon</span>
              </button>

              {isPresetDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    width: 250,
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: 6,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    zIndex: 100,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#8b949e", padding: "3px 6px", marginBottom: 4 }}>
                    Dostępne szablony
                  </div>

                  {userTemplates.length > 0 ? (
                    userTemplates.map((t: any) => (
                      <div
                        key={t._id}
                        onClick={() => handleApplyPreset(t.lists)}
                        style={{
                          width: "100%",
                          borderRadius: 4,
                          padding: "5px 8px",
                          fontSize: 11,
                          color: "#c9d1d9",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTemplate({ id: t._id, name: t.name });
                          }}
                          style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", padding: "2px 4px", borderRadius: 3 }}
                          title="Usuń ten szablon"
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248, 81, 73, 0.15)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "8px 6px", fontStyle: "italic", fontSize: 11, color: "#8b949e", textAlign: "center" }}>
                      Brak szablonów
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid of 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {/* Render Existing Custom Lists */}
        {lists.map((list) => {
          const doneCount = list.items.filter((i) => i.checked).length;
          const totalCount = list.items.length;
          const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

          return (
            <div
              key={list.id}
              style={{
                background: "#161b22",
                border: `1px solid ${list.color}35`,
                borderRadius: 6,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: list.color,
                      boxShadow: `0 0 8px ${list.color}88`,
                      flexShrink: 0,
                    }}
                  />

                  {editingTitleId === list.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <input
                        type="text"
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle(list.id);
                          if (e.key === "Escape") setEditingTitleId(null);
                        }}
                        autoFocus
                        style={{
                          background: "#0d1117",
                          border: `1px solid ${list.color}`,
                          borderRadius: 4,
                          color: "#f0f6fc",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "1px 5px",
                          width: "100%",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTitle(list.id)}
                        style={{ background: "none", border: "none", color: "#3fb950", cursor: "pointer", padding: 1 }}
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => {
                        if (disabled) return;
                        setEditingTitleId(list.id);
                        setEditingTitleText(list.title);
                      }}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#f0f6fc",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: disabled ? "default" : "pointer",
                      }}
                      title={disabled ? undefined : "Kliknij, aby zmienić nazwę listy"}
                    >
                      {list.title}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: list.color, background: `${list.color}15`, border: `1px solid ${list.color}33`, padding: "1px 6px", borderRadius: 10 }}>
                    {doneCount}/{totalCount} · {pct}%
                  </span>

                  {!disabled && (
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setOpenColorPickerId(openColorPickerId === list.id ? null : list.id)}
                        style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 2, display: "flex" }}
                        title="Zmień kolor akcentu"
                      >
                        <Palette size={12} />
                      </button>

                      {openColorPickerId === list.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: 4,
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            borderRadius: 6,
                            padding: 6,
                            display: "flex",
                            gap: 4,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
                            zIndex: 20,
                          }}
                        >
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => handleChangeColor(list.id, c.hex)}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: c.hex,
                                border: list.color === c.hex ? "2px solid #fff" : "none",
                                cursor: "pointer",
                              }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => setDeletingList({ id: list.id, title: list.title })}
                      style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", padding: 2, display: "flex" }}
                      title="Usuń całą listę"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f85149")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ width: "100%", height: 3, background: "#21262d", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: list.color, transition: "width 0.2s ease" }} />
              </div>

              {/* Items list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2, flex: 1 }}>
                {list.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "2px 4px",
                      borderRadius: 4,
                      background: item.checked ? "rgba(63,185,80,0.05)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleItem(list.id, item.id)}
                      disabled={disabled}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: disabled ? "default" : "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: item.checked ? "#3fb950" : "#8b949e",
                        textAlign: "left",
                        flex: 1,
                      }}
                    >
                      {item.checked ? <CheckSquare size={13} style={{ flexShrink: 0 }} /> : <Square size={13} style={{ flexShrink: 0 }} />}
                      <span
                        style={{
                          fontSize: 11,
                          color: item.checked ? "#8b949e" : "#c9d1d9",
                          textDecoration: item.checked ? "line-through" : "none",
                        }}
                      >
                        {item.label}
                      </span>
                    </button>

                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(list.id, item.id)}
                        style={{ background: "none", border: "none", color: "#30363d", cursor: "pointer", padding: 2, display: "flex" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f85149")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#30363d")}
                        title="Usuń punkt"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add item input */}
              {!disabled && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <input
                    type="text"
                    value={newItemText[list.id] || ""}
                    onChange={(e) => setNewItemText({ ...newItemText, [list.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddItem(list.id);
                    }}
                    placeholder="+ Dodaj punkt…"
                    style={{
                      background: "#0d1117",
                      border: "1px solid #30363d",
                      borderRadius: 4,
                      padding: "3px 6px",
                      fontSize: 10,
                      color: "#c9d1d9",
                      flex: 1,
                      outline: "none",
                    }}
                  />
                  {newItemText[list.id]?.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddItem(list.id)}
                      style={{
                        background: list.color,
                        border: "none",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        cursor: "pointer",
                      }}
                    >
                      Dodaj
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Render Placeholders for remaining slots up to 3 */}
        {Array.from({ length: remainingSlots }).map((_, idx) => {
          const slotIndex = lists.length + idx;

          if (isAddingList && idx === 0) {
            return (
              <div
                key={`adding_slot_${idx}`}
                style={{
                  background: "#161b22",
                  border: "1px solid #3b82f6",
                  borderRadius: 6,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f0f6fc" }}>Nowa lista checkboxów</div>
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateList();
                    if (e.key === "Escape") setIsAddingList(false);
                  }}
                  placeholder="Nazwa listy (np. Pomiary, Dokumentacja)…"
                  autoFocus
                  style={{
                    background: "#0d1117",
                    border: "1px solid #30363d",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 11,
                    color: "#f0f6fc",
                    outline: "none",
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#8b949e" }}>Kolor:</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setNewListColor(c.hex)}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: c.hex,
                          border: newListColor === c.hex ? "2px solid #fff" : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleCreateList}
                    style={{
                      background: "#3b82f6",
                      border: "none",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Stwórz listę
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingList(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#8b949e",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`empty_slot_${slotIndex}`}
              onClick={() => {
                if (disabled) return;
                setIsAddingList(true);
                setNewListTitle("");
              }}
              style={{
                background: "rgba(22, 27, 34, 0.4)",
                border: "1.5px dashed rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "20px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: disabled ? "default" : "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = "rgba(22, 27, 34, 0.4)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                }}
              >
                <Plus size={14} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#8b949e" }}>
                + Dodaj nową listę (slot {slotIndex + 1}/3)
              </span>
            </div>
          );
        })}
      </div>

      {/* Save Template Modal */}
      {isSaveTemplateModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setIsSaveTemplateModalOpen(false)}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              padding: 16,
              width: 320,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>Zapisz obecne listy jako szablon</div>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Wpisz nazwę szablonu (np. Montaż Rolet)..."
              autoFocus
              style={{
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: 4,
                padding: "6px 10px",
                fontSize: 12,
                color: "#f0f6fc",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsSaveTemplateModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 11, cursor: "pointer" }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAsTemplate()}
                style={{
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Potykacz: Confirmation modal for deleting a template */}
      {deletingTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
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
              padding: 18,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
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

      {/* Potykacz: Confirmation modal for deleting a custom list */}
      {deletingList && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setDeletingList(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid rgba(248, 81, 73, 0.4)",
              borderRadius: 8,
              padding: 18,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f85149", fontSize: 14, fontWeight: 700 }}>
              <AlertTriangle size={18} />
              <span>Usunięcie listy</span>
            </div>
            <div style={{ fontSize: 12, color: "#c9d1d9", lineHeight: 1.5 }}>
              Czy na pewno chcesz usunąć całą listę <strong style={{ color: "#f0f6fc" }}>„{deletingList.title}”</strong> wraz ze wszystkimi punktami?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setDeletingList(null)}
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
                onClick={confirmRemoveList}
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
                Tak, usuń listę
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { COLOR_PALETTE, type CustomList } from "../../_components/CustomChecklistsHeader";
import { CheckSquare, Plus, Trash2, X, Palette, Check } from "lucide-react";
import { toast } from "sonner";

interface TemplateEditorModalProps {
  initialData?: {
    id: Id<"checklistTemplates">;
    name: string;
    lists: CustomList[];
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TemplateEditorModal({
  initialData,
  onClose,
  onSuccess,
}: TemplateEditorModalProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [lists, setLists] = useState<CustomList[]>(initialData?.lists ?? []);

  // Inline state for adding lists / items
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");
  const [newItemText, setNewItemText] = useState<{ [listId: string]: string }>({});
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);

  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListColor, setNewListColor] = useState("#3b82f6");

  const saveTemplateMut = useMutation(api.checklistTemplates.saveTemplate);
  const updateTemplateMut = useMutation(api.checklistTemplates.updateTemplate);

  function handleCreateList() {
    const title = newListTitle.trim() || `Lista ${lists.length + 1}`;
    if (lists.length >= 3) {
      toast.error("Maksymalnie możesz utworzyć 3 listy w szablonie");
      return;
    }
    const newList: CustomList = {
      id: `list_${Date.now()}`,
      title,
      color: newListColor,
      items: [],
    };
    setLists((prev) => [...prev, newList]);
    setIsAddingList(false);
    setNewListTitle("");
  }

  function handleRemoveList(listId: string) {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }

  function handleSaveTitle(listId: string) {
    const cleaned = editingTitleText.trim();
    if (cleaned) {
      setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title: cleaned } : l)));
    }
    setEditingTitleId(null);
  }

  function handleChangeColor(listId: string, color: string) {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, color } : l)));
    setOpenColorPickerId(null);
  }

  function handleAddItem(listId: string) {
    const text = newItemText[listId]?.trim();
    if (!text) return;
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          items: [...l.items, { id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, label: text, checked: false }],
        };
      })
    );
    setNewItemText((prev) => ({ ...prev, [listId]: "" }));
  }

  function handleRemoveItem(listId: string, itemId: string) {
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          items: l.items.filter((i) => i.id !== itemId),
        };
      })
    );
  }

  async function handleSave() {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Podaj nazwę szablonu");
      return;
    }
    if (lists.length === 0) {
      toast.error("Dodaj przynajmniej jedną listę do szablonu");
      return;
    }

    try {
      if (initialData?.id) {
        await updateTemplateMut({
          id: initialData.id,
          name: cleanName,
          lists,
        });
        toast.success(`Zaktualizowano szablon „${cleanName}”`);
      } else {
        await saveTemplateMut({
          name: cleanName,
          lists,
        });
        toast.success(`Utworzono szablon „${cleanName}”`);
      }
      onSuccess();
    } catch {
      toast.error("Błąd podczas zapisywania szablonu");
    }
  }

  const remainingSlots = Math.max(0, 3 - lists.length);

  return (
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
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 10,
          width: 820,
          maxWidth: "95vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0d1117",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>
            <CheckSquare size={16} style={{ color: "#3b82f6" }} />
            <span>{initialData ? `Edycja szablonu: ${initialData.name}` : "Nowy szablon checklist"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Template Name Input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6 }}>
              NAZWA SZABLONU
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Wycena Okien PVC, Standardowy Montaż..."
              style={{
                width: "100%",
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                color: "#f0f6fc",
                outline: "none",
              }}
            />
          </div>

          {/* 3 Columns Editor */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 8 }}>
              STRUKTURA LIST I PUNKTÓW (MAX 3 LISTY)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {lists.map((list) => (
                <div
                  key={list.id}
                  style={{
                    background: "#0d1117",
                    border: `1px solid ${list.color}44`,
                    borderRadius: 6,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 220,
                  }}
                >
                  {/* List Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: list.color,
                          boxShadow: `0 0 6px ${list.color}`,
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
                              background: "#161b22",
                              border: `1px solid ${list.color}`,
                              borderRadius: 4,
                              color: "#f0f6fc",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 4px",
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
                            setEditingTitleId(list.id);
                            setEditingTitleText(list.title);
                          }}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#f0f6fc",
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title="Kliknij, aby edytować tytuł"
                        >
                          {list.title}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setOpenColorPickerId(openColorPickerId === list.id ? null : list.id)}
                          style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 2, display: "flex" }}
                          title="Zmień kolor"
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
                              background: "#161b22",
                              border: "1px solid #30363d",
                              borderRadius: 6,
                              padding: 6,
                              display: "flex",
                              gap: 4,
                              boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
                              zIndex: 30,
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

                      <button
                        type="button"
                        onClick={() => handleRemoveList(list.id)}
                        style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", padding: 2, display: "flex" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f85149")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
                        title="Usuń listę"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div style={{ height: 2, background: list.color, opacity: 0.6, borderRadius: 1 }} />

                  {/* Items List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflowY: "auto" }}>
                    {list.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          background: "#161b22",
                          padding: "3px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          color: "#c9d1d9",
                        }}
                      >
                        <span>{item.label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(list.id, item.id)}
                          style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", padding: 1 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#f85149")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add item input */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <input
                      type="text"
                      value={newItemText[list.id] || ""}
                      onChange={(e) => setNewItemText({ ...newItemText, [list.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddItem(list.id);
                      }}
                      placeholder="+ Dodaj punkt..."
                      style={{
                        background: "#161b22",
                        border: "1px solid #30363d",
                        borderRadius: 4,
                        padding: "3px 6px",
                        fontSize: 10,
                        color: "#f0f6fc",
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
                          padding: "3px 7px",
                          cursor: "pointer",
                        }}
                      >
                        Dodaj
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Slot Placeholders for up to 3 lists */}
              {Array.from({ length: remainingSlots }).map((_, idx) => {
                if (isAddingList && idx === 0) {
                  return (
                    <div
                      key={`add_slot_${idx}`}
                      style={{
                        background: "#0d1117",
                        border: "1px solid #3b82f6",
                        borderRadius: 6,
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#f0f6fc" }}>Nowa lista</div>
                      <input
                        type="text"
                        value={newListTitle}
                        onChange={(e) => setNewListTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateList();
                          if (e.key === "Escape") setIsAddingList(false);
                        }}
                        placeholder="Nazwa listy..."
                        autoFocus
                        style={{
                          background: "#161b22",
                          border: "1px solid #30363d",
                          borderRadius: 4,
                          padding: "4px 6px",
                          fontSize: 11,
                          color: "#f0f6fc",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setNewListColor(c.hex)}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: c.hex,
                              border: newListColor === c.hex ? "2px solid #fff" : "none",
                              cursor: "pointer",
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={handleCreateList}
                          style={{ background: "#3b82f6", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", cursor: "pointer" }}
                        >
                          Dodaj
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingList(false)}
                          style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 10, cursor: "pointer" }}
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty_slot_${idx}`}
                    onClick={() => {
                      setIsAddingList(true);
                      setNewListTitle("");
                    }}
                    style={{
                      background: "rgba(13, 17, 23, 0.4)",
                      border: "1.5px dashed rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      minHeight: 220,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                      e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(13, 17, 23, 0.4)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                    }}
                  >
                    <Plus size={16} style={{ color: "#60a5fa" }} />
                    <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 600 }}>+ Dodaj listę</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            background: "#0d1117",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #30363d",
              borderRadius: 6,
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            style={{
              background: "#238636",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 18px",
              cursor: "pointer",
            }}
          >
            {initialData ? "Zapisz zmiany" : "Utwórz szablon"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { COLOR_PALETTE, type CustomList, type ChecklistItem } from "../../_components/CustomChecklistsHeader";
import { CheckSquare, Plus, Trash2, X, Palette, Check } from "lucide-react";
import { toast } from "sonner";

interface SingleTemplateEditorModalProps {
  initialData?: {
    id: Id<"checklistTemplates">;
    name: string;
    singleList?: CustomList | null;
    lists?: CustomList[];
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SingleTemplateEditorModal({
  initialData,
  onClose,
  onSuccess,
}: SingleTemplateEditorModalProps) {
  const existingList = initialData?.singleList ?? initialData?.lists?.[0] ?? {
    id: `list_${Date.now()}`,
    title: "Lista weryfikacyjna",
    color: "#3b82f6",
    items: [],
  };

  const [name, setName] = useState(initialData?.name ?? "");
  const [listTitle, setListTitle] = useState(existingList.title);
  const [listColor, setListColor] = useState(existingList.color || "#3b82f6");
  const [items, setItems] = useState<ChecklistItem[]>(existingList.items ?? []);

  const [newItemText, setNewItemText] = useState("");
  const [openColorPicker, setOpenColorPicker] = useState(false);

  const saveSingleMut = useMutation(api.checklistTemplates.saveSingleTemplate);
  const updateSingleMut = useMutation(api.checklistTemplates.updateSingleTemplate);

  function handleAddItem() {
    const text = newItemText.trim();
    if (!text) return;
    const newItem: ChecklistItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: text,
      checked: false,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemText("");
  }

  function handleRemoveItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function handleToggleItem(itemId: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i))
    );
  }

  function handleItemLabelChange(itemId: string, newLabel: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, label: newLabel } : i))
    );
  }

  async function handleSave() {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Podaj nazwę szablonu");
      return;
    }

    const cleanTitle = listTitle.trim() || "Lista weryfikacyjna";

    const singleList: CustomList = {
      id: existingList.id || `list_${Date.now()}`,
      title: cleanTitle,
      color: listColor,
      items,
    };

    try {
      if (initialData?.id) {
        await updateSingleMut({
          id: initialData.id,
          name: cleanName,
          singleList,
        });
        toast.success(`Zaktualizowano szablon pojedynczej listy „${cleanName}”`);
      } else {
        await saveSingleMut({
          name: cleanName,
          singleList,
        });
        toast.success(`Utworzono szablon pojedynczej listy „${cleanName}”`);
      }
      onSuccess();
    } catch {
      toast.error("Błąd podczas zapisywania szablonu");
    }
  }

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
          width: 520,
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
            <span>{initialData ? `Edycja szablonu listy: ${initialData.name}` : "Nowy szablon pojedynczej listy"}</span>
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
              NAZWA SZABLONU (WIDOCZNA W KONFIGURACJI I DROP-DOWNIE)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Kontrola Jakości Profilu, Odbiór Montażu"
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

          {/* List Title & Color Picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6 }}>
              TYTUŁ I KOLOR LISTY (NAGŁÓWEK KOLUMNY)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="np. Wymagania Techniczne"
                style={{
                  flex: 1,
                  background: "#0d1117",
                  border: `1px solid ${listColor}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#f0f6fc",
                  outline: "none",
                }}
              />
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setOpenColorPicker(!openColorPicker)}
                  style={{
                    background: listColor,
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Zmień kolor listy"
                >
                  <Palette size={16} style={{ color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                </button>
                {openColorPicker && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 42,
                      background: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: 6,
                      padding: 8,
                      display: "flex",
                      gap: 6,
                      zIndex: 10,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    }}
                  >
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          setListColor(c.hex);
                          setOpenColorPicker(false);
                        }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: c.hex,
                          border: listColor === c.hex ? "2px solid #fff" : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* List Items Editor */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e" }}>
                PUNKTY CHECKLISTY ({items.length})
              </label>
            </div>

            {/* Add new item field */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder="Wpisz treść punktu i naciśnij Enter..."
                style={{
                  flex: 1,
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontSize: 12,
                  color: "#f0f6fc",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                  borderRadius: 6,
                  color: "#60a5fa",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "0 12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Plus size={14} />
                <span>Dodaj</span>
              </button>
            </div>

            {/* Items List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 280,
                overflowY: "auto",
                background: "#0d1117",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #21262d",
              }}
            >
              {items.length === 0 ? (
                <div style={{ fontSize: 11, color: "#8b949e", textAlign: "center", padding: "16px 0" }}>
                  Brak punktów w tej liście. Wpisz treść wyżej i kliknij Dodaj.
                </div>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: 4,
                      padding: "6px 8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleItem(item.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleItemLabelChange(item.id, e.target.value)}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        fontSize: 12,
                        color: "#f0f6fc",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#8b949e",
                        cursor: "pointer",
                        padding: 2,
                      }}
                      title="Usuń punkt"
                    >
                      <Trash2 size={13} style={{ color: "#f85149" }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid #30363d",
            background: "#0d1117",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
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
              padding: "7px 14px",
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
              padding: "7px 16px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Check size={14} />
            <span>Zapisz Szablon</span>
          </button>
        </div>
      </div>
    </div>
  );
}

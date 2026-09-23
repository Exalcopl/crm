"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Plus, Trash2, Layers, Tag, DollarSign, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

interface ParameterItem {
  key: string;
  value: string;
  unit?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: {
    _id: Id<"products">;
    name: string;
    code?: string;
    type: "product" | "service" | "outsourcing";
    description?: string;
    unit: string;
    supplierId?: Id<"suppliers">;
    supplierCode?: string;
    priceNetto?: number;
    priceBrutto?: number;
    vatRate?: number;
    currency?: string;
    leadTimeDays?: number;
    category?: string;
    parameters?: ParameterItem[];
    notes?: string;
    isActive: boolean;
  } | null;
  defaultSupplierId?: Id<"suppliers">;
}

const COMMON_UNITS = ["szt.", "mb.", "m²", "kg", "kpl.", "godz.", "usł."];
const CATEGORIES = [
  "Obróbka CNC",
  "Lakierowanie proszkowe",
  "Cięcie profili",
  "Spawanie",
  "Grawerowanie / Cechowanie",
  "Transport / Logistyka",
  "Profil aluminiowy",
  "Akcesoria i Okucia",
  "Wypełnienie / Szkło",
  "Inne",
];

export function ProductFormModal({
  isOpen,
  onClose,
  productToEdit,
  defaultSupplierId,
}: ProductFormModalProps) {
  const suppliers = useQuery(api.suppliers.list, { onlyActive: true });
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"product" | "service" | "outsourcing">("outsourcing");
  const [unit, setUnit] = useState("szt.");
  const [customUnit, setCustomUnit] = useState("");
  const [category, setCategory] = useState("Obróbka CNC");
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierCode, setSupplierCode] = useState("");
  const [priceNetto, setPriceNetto] = useState<string>("");
  const [vatRate, setVatRate] = useState<number>(23);
  const [currency, setCurrency] = useState("PLN");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCode(productToEdit.code ?? "");
      setType(productToEdit.type);
      if (COMMON_UNITS.includes(productToEdit.unit)) {
        setUnit(productToEdit.unit);
        setCustomUnit("");
      } else {
        setUnit("custom");
        setCustomUnit(productToEdit.unit);
      }
      setCategory(productToEdit.category ?? "Obróbka CNC");
      setSupplierId(productToEdit.supplierId ?? "");
      setSupplierCode(productToEdit.supplierCode ?? "");
      setPriceNetto(productToEdit.priceNetto !== undefined ? String(productToEdit.priceNetto) : "");
      setVatRate(productToEdit.vatRate ?? 23);
      setCurrency(productToEdit.currency ?? "PLN");
      setLeadTimeDays(productToEdit.leadTimeDays !== undefined ? String(productToEdit.leadTimeDays) : "");
      setDescription(productToEdit.description ?? "");
      setNotes(productToEdit.notes ?? "");
      setIsActive(productToEdit.isActive);
      setParameters(productToEdit.parameters ?? []);
    } else {
      setName("");
      setCode("");
      setType("outsourcing");
      setUnit("szt.");
      setCustomUnit("");
      setCategory("Obróbka CNC");
      setSupplierId(defaultSupplierId ?? "");
      setSupplierCode("");
      setPriceNetto("");
      setVatRate(23);
      setCurrency("PLN");
      setLeadTimeDays("");
      setDescription("");
      setNotes("");
      setIsActive(true);
      setParameters([]);
    }
  }, [productToEdit, defaultSupplierId, isOpen]);

  if (!isOpen) return null;

  const finalUnit = unit === "custom" ? customUnit.trim() : unit;
  const numNetto = priceNetto !== "" ? parseFloat(priceNetto) : undefined;
  const calculatedBrutto =
    numNetto !== undefined
      ? Math.round(numNetto * (1 + vatRate / 100) * 100) / 100
      : undefined;

  const handleAddParameter = () => {
    setParameters([...parameters, { key: "", value: "", unit: "" }]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleParameterChange = (
    index: number,
    field: keyof ParameterItem,
    val: string
  ) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: val };
    setParameters(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nazwa produktu/usługi jest wymagana.");
      return;
    }
    if (!finalUnit) {
      toast.error("Wybierz lub podaj jednostkę miary.");
      return;
    }

    setIsSubmitting(true);

    try {
      const validParameters = parameters.filter((p) => p.key.trim() !== "");
      const numLeadTime = leadTimeDays !== "" ? parseInt(leadTimeDays, 10) : undefined;

      if (productToEdit) {
        await updateProduct({
          id: productToEdit._id,
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          unit: finalUnit,
          category,
          supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
          supplierCode: supplierCode.trim() || undefined,
          priceNetto: numNetto,
          priceBrutto: calculatedBrutto,
          vatRate,
          currency,
          leadTimeDays: numLeadTime,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          parameters: validParameters.length > 0 ? validParameters : undefined,
        });
        toast.success("Produkt/Usługa została zaktualizowana!");
      } else {
        await createProduct({
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          unit: finalUnit,
          category,
          supplierId: supplierId ? (supplierId as Id<"suppliers">) : undefined,
          supplierCode: supplierCode.trim() || undefined,
          priceNetto: numNetto,
          priceBrutto: calculatedBrutto,
          vatRate,
          currency,
          leadTimeDays: numLeadTime,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          parameters: validParameters.length > 0 ? validParameters : undefined,
        });
        toast.success("Produkt/Usługa została dodana!");
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Wystąpił błąd podczas zapisu."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#0d1117",
    border: "1px solid #30363d",
    color: "#f0f6fc",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#8b949e",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 10,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
          color: "#f0f6fc",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            background: "#0d1117",
            borderBottom: "1px solid #30363d",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
              }}
            >
              <Layers size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>
                {productToEdit ? "Edycja Pozycji Obróbki / Produktu" : "Nowy Produkt / Usługa Obróbki"}
              </div>
              <div style={{ fontSize: 11, color: "#8b949e" }}>
                Zarządzaj właściwościami, dostawcą i parametrami technicznymi
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Typ i Aktywność */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 8,
              padding: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 120px",
              gap: 12,
              alignItems: "center",
            }}
          >
            <label style={labelStyle}>
              Typ Pozycji *
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "product" | "service" | "outsourcing")}
                style={inputStyle}
              >
                <option value="outsourcing">Obróbka Zewnętrzna (Outsourcing)</option>
                <option value="service">Usługa Zewnętrzna / Dojazd</option>
                <option value="product">Produkt / Komponent</option>
              </select>
            </label>

            <label style={labelStyle}>
              Kategoria
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={inputStyle}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "#3b82f6" }}
              />
              <span style={{ fontSize: 12, color: "#f0f6fc", fontWeight: 600 }}>Aktywny</span>
            </label>
          </div>

          {/* Nazwa i SKU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Nazwa Produktu / Usługi *
              <input
                type="text"
                required
                placeholder="np. Lakierowanie proszkowe RAL 9016 MAT"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Kod / SKU (wewnętrzny)
              <input
                type="text"
                placeholder="np. OBR-LAK-9016"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          {/* Jednostka miary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Jednostka Miary *
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={inputStyle}
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="custom">Własna jednostka...</option>
              </select>
            </label>

            {unit === "custom" && (
              <label style={labelStyle}>
                Wpisz Własną Jednostkę *
                <input
                  type="text"
                  placeholder="np. komplet, m3, paleta"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  style={inputStyle}
                />
              </label>
            )}
          </div>

          {/* Dostawca */}
          <div style={{ borderTop: "1px solid #21262d", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Tag size={12} style={{ color: "#3b82f6" }} />
              Przypisany Dostawca / Wykonawca
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Dostawca
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Brak / Wybierz dostawcę --</option>
                  {suppliers?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (NIP: {s.nip})
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Kod / SKU u Dostawcy
                <input
                  type="text"
                  placeholder="np. SUP-9016-MAT"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          {/* Ceny i Czas realizacji */}
          <div style={{ borderTop: "1px solid #21262d", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <DollarSign size={12} style={{ color: "#4ade80" }} />
              Cena Zakupu i Czas Realizacji
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <label style={labelStyle}>
                Cena Netto
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={priceNetto}
                  onChange={(e) => setPriceNetto(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Stawka VAT (%)
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={23}>23%</option>
                  <option value={8}>8%</option>
                  <option value={5}>5%</option>
                  <option value={0}>0%</option>
                </select>
              </label>

              <label style={labelStyle}>
                Cena Brutto
                <input
                  type="text"
                  disabled
                  value={calculatedBrutto !== undefined ? `${calculatedBrutto.toFixed(2)} ${currency}` : "—"}
                  style={{ ...inputStyle, background: "#161b22", color: "#8b949e" }}
                />
              </label>

              <label style={labelStyle}>
                Czas (dni)
                <input
                  type="number"
                  min="0"
                  placeholder="np. 5"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          {/* Parametry techniczne */}
          <div style={{ borderTop: "1px solid #21262d", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={12} style={{ color: "#c084fc" }} />
                Parametry Techniczne
              </div>
              <button
                type="button"
                onClick={handleAddParameter}
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 4,
                  color: "#60a5fa",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Plus size={11} /> Dodaj parametr
              </button>
            </div>

            {parameters.length === 0 ? (
              <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", background: "#0d1117", padding: "8px 10px", borderRadius: 6, textAlign: "center", border: "1px solid #21262d" }}>
                Brak zdefiniowanych parametrów technicznych (np. Kolor RAL, Grubość).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parameters.map((param, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nazwa (np. Kolor RAL)"
                      value={param.key}
                      onChange={(e) =>
                        handleParameterChange(index, "key", e.target.value)
                      }
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="text"
                      placeholder="Wartość (np. 9016)"
                      value={param.value}
                      onChange={(e) =>
                        handleParameterChange(index, "value", e.target.value)
                      }
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="text"
                      placeholder="Jednostka (np. μm)"
                      value={param.unit ?? ""}
                      onChange={(e) =>
                        handleParameterChange(index, "unit", e.target.value)
                      }
                      style={{ ...inputStyle, width: 90 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveParameter(index)}
                      style={{
                        background: "rgba(248, 81, 73, 0.1)",
                        border: "1px solid rgba(248, 81, 73, 0.3)",
                        color: "#f85149",
                        borderRadius: 4,
                        padding: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opis i Notatki */}
          <div style={{ borderTop: "1px solid #21262d", paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Opis Techniczny / Zakres Obróbki
              <textarea
                rows={2}
                placeholder="Opis usługi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <label style={labelStyle}>
              Notatki Wewnętrzne
              <textarea
                rows={2}
                placeholder="Prywatne uwagi..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              borderTop: "1px solid #21262d",
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: "transparent",
                border: "1px solid #30363d",
                borderRadius: 6,
                color: "#c9d1d9",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "#238636",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 16px",
                cursor: "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Zapisywanie..." : productToEdit ? "Zapisz Zmiany" : "Utwórz Pozycję"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

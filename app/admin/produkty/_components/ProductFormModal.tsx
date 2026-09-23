"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  X,
  Plus,
  Trash2,
  Tag,
  DollarSign,
  Clock,
  FileText,
  Wrench,
  Layers,
  Package,
  Sliders,
  Sparkles,
  Info,
} from "lucide-react";
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

const DEFAULT_CATEGORIES = [
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

const QUICK_PARAM_SUGGESTIONS = [
  { key: "Kolor RAL", unit: "" },
  { key: "Grubość powłoki", unit: "μm" },
  { key: "Wymiary (dł × szer)", unit: "mm" },
  { key: "Gatunek stopu", unit: "" },
  { key: "Waga jednostkowa", unit: "kg" },
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
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
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

      if (productToEdit.category && !DEFAULT_CATEGORIES.includes(productToEdit.category)) {
        setIsCustomCategory(true);
        setCustomCategory(productToEdit.category);
        setCategory("custom");
      } else {
        setIsCustomCategory(false);
        setCustomCategory("");
        setCategory(productToEdit.category ?? "Obróbka CNC");
      }

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
      setIsCustomCategory(false);
      setCustomCategory("");
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
  const finalCategory = isCustomCategory ? customCategory.trim() : category;

  const numNetto = priceNetto !== "" ? parseFloat(priceNetto) : undefined;
  const calculatedBrutto =
    numNetto !== undefined
      ? Math.round(numNetto * (1 + vatRate / 100) * 100) / 100
      : undefined;

  const handleAddParameter = (suggestedKey?: string, suggestedUnit?: string) => {
    setParameters([
      ...parameters,
      { key: suggestedKey ?? "", value: "", unit: suggestedUnit ?? "" },
    ]);
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
    if (isCustomCategory && !customCategory.trim()) {
      toast.error("Podaj nazwę własnej kategorii.");
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
          category: finalCategory || undefined,
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
        toast.success("Pozycja została zaktualizowana!");
      } else {
        await createProduct({
          name: name.trim(),
          code: code.trim() || undefined,
          type,
          unit: finalUnit,
          category: finalCategory || undefined,
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
        toast.success("Nowa pozycja została utworzona!");
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
    padding: "7px 11px",
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
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(5px)",
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
          borderRadius: 12,
          width: "100%",
          maxWidth: 780,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.7)",
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
            padding: "16px 20px",
            background: "#0d1117",
            borderBottom: "1px solid #30363d",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                display: "grid",
                placeItems: "center",
                color: "#60a5fa",
              }}
            >
              <Package size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc" }}>
                {productToEdit ? "Edycja Pozycji Obróbki / Produktu" : "Nowa Pozycja Katalogowa (Obróbka / Produkt)"}
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                Skonfiguruj typ, wykonawcę, cennik oraz warianty techniczne
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
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: 20,
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Section 1: Wybór Typu Pozycji */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#8b949e",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={13} style={{ color: "#60a5fa" }} />
              1. Wybór Typu Pozycji Katalogowej *
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {/* Card 1: Outsourcing */}
              <div
                onClick={() => setType("outsourcing")}
                style={{
                  background: type === "outsourcing" ? "rgba(168, 85, 247, 0.12)" : "#0d1117",
                  border: type === "outsourcing" ? "1px solid #c084fc" : "1px solid #21262d",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: type === "outsourcing" ? "#c084fc" : "#f0f6fc" }}>
                    <Wrench size={15} /> Obróbka Zewnętrzna
                  </div>
                  <input
                    type="radio"
                    name="productType"
                    checked={type === "outsourcing"}
                    onChange={() => setType("outsourcing")}
                    style={{ accentColor: "#c084fc" }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#8b949e", lineHeight: 1.4 }}>
                  Lakierowanie, cięcie CNC, spawanie, gięcie profili u podwykonawcy.
                </div>
              </div>

              {/* Card 2: Service */}
              <div
                onClick={() => setType("service")}
                style={{
                  background: type === "service" ? "rgba(59, 130, 246, 0.12)" : "#0d1117",
                  border: type === "service" ? "1px solid #60a5fa" : "1px solid #21262d",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: type === "service" ? "#60a5fa" : "#f0f6fc" }}>
                    <Layers size={15} /> Usługa Zewnętrzna
                  </div>
                  <input
                    type="radio"
                    name="productType"
                    checked={type === "service"}
                    onChange={() => setType("service")}
                    style={{ accentColor: "#60a5fa" }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#8b949e", lineHeight: 1.4 }}>
                  Usługi dojazdu, montażu, pomiarów, audytów i projektowania.
                </div>
              </div>

              {/* Card 3: Product */}
              <div
                onClick={() => setType("product")}
                style={{
                  background: type === "product" ? "rgba(34, 197, 94, 0.12)" : "#0d1117",
                  border: type === "product" ? "1px solid #4ade80" : "1px solid #21262d",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: type === "product" ? "#4ade80" : "#f0f6fc" }}>
                    <Package size={15} /> Produkt / Komponent
                  </div>
                  <input
                    type="radio"
                    name="productType"
                    checked={type === "product"}
                    onChange={() => setType("product")}
                    style={{ accentColor: "#4ade80" }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#8b949e", lineHeight: 1.4 }}>
                  Fizyczny materiał, profil aluminiowy, okucie, akcesorium.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Nazwa, SKU, Kategoria */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Nazwa Pozycji *
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
                Kod Wewnętrzny / SKU
                <input
                  type="text"
                  placeholder="np. OBR-LAK-9016"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 12, alignItems: "flex-end" }}>
              <label style={labelStyle}>
                Kategoria Obróbki / Produktu
                {!isCustomCategory ? (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setIsCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    style={inputStyle}
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="custom">+ Inna / Dodaj własną kategorię...</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Wpisz nazwę własnej kategorii..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCategory(DEFAULT_CATEGORIES[0]!);
                      }}
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid #30363d",
                        borderRadius: 6,
                        color: "#8b949e",
                        fontSize: 11,
                        padding: "0 8px",
                        cursor: "pointer",
                      }}
                      title="Wróć do listy domyślnych"
                    >
                      Anuluj
                    </button>
                  </div>
                )}
              </label>

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

              <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, height: 34, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: 12, color: "#f0f6fc", fontWeight: 600 }}>Pozycja Aktywna</span>
              </label>
            </div>

            {unit === "custom" && (
              <label style={labelStyle}>
                Wpisz Własną Jednostkę *
                <input
                  type="text"
                  placeholder="np. m3, paleta, zestaw"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  style={inputStyle}
                />
              </label>
            )}
          </div>

          {/* Section 3: Dostawca i Cennik */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#8b949e",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Tag size={13} style={{ color: "#3b82f6" }} />
              2. Wykonawca Obróbki & Warunki Handlowe
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Przypisany Dostawca / Podwykonawca
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
                Kod / SKU u Wykonawcy
                <input
                  type="text"
                  placeholder="np. SUP-9016-MAT"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <label style={labelStyle}>
                Cena Zakupu Netto
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
                Cena Brutto (wyliczana)
                <input
                  type="text"
                  disabled
                  value={calculatedBrutto !== undefined ? `${calculatedBrutto.toFixed(2)} ${currency}` : "—"}
                  style={{ ...inputStyle, background: "#161b22", color: "#8b949e", fontWeight: 700 }}
                />
              </label>

              <label style={labelStyle}>
                Czas Realizacji (dni)
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

          {/* Section 4: Parametry techniczne */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#8b949e",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sliders size={13} style={{ color: "#c084fc" }} />
                3. Parametry Techniczne & Warianty
              </div>

              <button
                type="button"
                onClick={() => handleAddParameter()}
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 4,
                  color: "#60a5fa",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Plus size={12} /> Dodaj własny parametr
              </button>
            </div>

            {/* Szybkie sugestie */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "#8b949e", display: "flex", alignItems: "center", gap: 3 }}>
                <Info size={11} /> Szybkie sugestie:
              </span>
              {QUICK_PARAM_SUGGESTIONS.map((sug) => (
                <button
                  key={sug.key}
                  type="button"
                  onClick={() => handleAddParameter(sug.key, sug.unit)}
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px border rgba(255, 255, 255, 0.1)",
                    borderRadius: 4,
                    color: "#c9d1d9",
                    fontSize: 10,
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
                >
                  + {sug.key}
                </button>
              ))}
            </div>

            {parameters.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "#8b949e",
                  fontStyle: "italic",
                  background: "#161b22",
                  padding: "10px 12px",
                  borderRadius: 6,
                  textAlign: "center",
                  border: "1px dashed #30363d",
                }}
              >
                Brak przypisanych parametrów technicznych. Kliknij przycisk powyżej lub wybierz sugestię.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parameters.map((param, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nazwa cechy (np. Kolor RAL)"
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
                      style={{ ...inputStyle, width: 95 }}
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

          {/* Section 5: Opisy i Notatki */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Opis Techniczny / Zakres Usługi
              <textarea
                rows={2}
                placeholder="Dodatkowy opis techniczny pozycji..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <label style={labelStyle}>
              Notatki Wewnętrzne
              <textarea
                rows={2}
                placeholder="Prywatne uwagi zespołu..."
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
              gap: 10,
              borderTop: "1px solid #21262d",
              paddingTop: 14,
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
                padding: "8px 16px",
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
                padding: "8px 20px",
                cursor: "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Zapisywanie..." : productToEdit ? "Zapisz Zmiany" : "Utwórz Pozycję Katalogową"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

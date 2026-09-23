"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Tag,
  DollarSign,
  FileText,
  Wrench,
  Layers,
  Package,
  Sliders,
  Sparkles,
  Info,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { I } from "../../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";

interface ParameterItem {
  key: string;
  value: string;
  unit?: string;
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

export default function NewProductPage() {
  const router = useRouter();
  const suppliers = useQuery(api.suppliers.list, { onlyActive: true });
  const createProduct = useMutation(api.products.create);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);

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

  // Image Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalUnit = unit === "custom" ? customUnit.trim() : unit;
  const finalCategory = isCustomCategory ? customCategory.trim() : category;

  const numNetto = priceNetto !== "" ? parseFloat(priceNetto) : undefined;
  const calculatedBrutto =
    numNetto !== undefined
      ? Math.round(numNetto * (1 + vatRate / 100) * 100) / 100
      : undefined;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (JPG, PNG, WEBP, SVG).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar pliku to 10 MB.");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
  };

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
      let uploadedStorageId: Id<"_storage"> | undefined = undefined;

      // Upload image if selected
      if (selectedFile) {
        setIsUploadingImage(true);
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });

        if (!result.ok) {
          throw new Error("Wgrywanie zdjęcia nie powiodło się.");
        }

        const { storageId } = await result.json();
        uploadedStorageId = storageId as Id<"_storage">;
        setIsUploadingImage(false);
      }

      const validParameters = parameters.filter((p) => p.key.trim() !== "");
      const numLeadTime = leadTimeDays !== "" ? parseInt(leadTimeDays, 10) : undefined;

      const newId = await createProduct({
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
        imageId: uploadedStorageId,
        isActive,
        parameters: validParameters.length > 0 ? validParameters : undefined,
      });

      toast.success("Nowa pozycja została utworzona!");
      router.push(`/admin/produkty/${newId}`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Wystąpił błąd podczas zapisu."
      );
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: 18,
    color: "#f0f6fc",
  };

  const inputStyle: React.CSSProperties = {
    background: "#0d1117",
    border: "1px solid #30363d",
    color: "#f0f6fc",
    borderRadius: 6,
    padding: "8px 12px",
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
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn
            icon={<I.arrow s={22} direction="left" />}
            label="Powrót"
            onClick={() => router.push("/admin/produkty")}
          />
        </RibbonGroup>
        <RibbonGroup label="Akcje">
          <RibbonBtn
            icon={<I.save s={22} />}
            label="Zapisz"
            primary
            onClick={() => {
              const form = document.getElementById("create-product-form") as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={isSubmitting}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content">
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header Description */}
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0f6fc", margin: 0 }}>
                Nowa Pozycja Katalogowa (Obróbka / Produkt)
              </h1>
            </div>
          </div>


      {/* Main Form */}
      <form id="create-product-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Section 1: Wybór Typu Pozycji */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} style={{ color: "#60a5fa" }} />
            1. Wybór Typu Pozycji Katalogowej *
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div
              onClick={() => setType("outsourcing")}
              style={{
                background: type === "outsourcing" ? "rgba(168, 85, 247, 0.12)" : "#0d1117",
                border: type === "outsourcing" ? "1px solid #c084fc" : "1px solid #21262d",
                borderRadius: 8,
                padding: 14,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "outsourcing" ? "#c084fc" : "#f0f6fc" }}>
                  <Wrench size={16} /> Obróbka Zewnętrzna
                </div>
                <input type="radio" name="productType" checked={type === "outsourcing"} onChange={() => setType("outsourcing")} style={{ accentColor: "#c084fc" }} />
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.4 }}>
                Lakierowanie, cięcie CNC, spawanie, gięcie profili wykonywane przez podwykonawców.
              </div>
            </div>

            <div
              onClick={() => setType("service")}
              style={{
                background: type === "service" ? "rgba(59, 130, 246, 0.12)" : "#0d1117",
                border: type === "service" ? "1px solid #60a5fa" : "1px solid #21262d",
                borderRadius: 8,
                padding: 14,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "service" ? "#60a5fa" : "#f0f6fc" }}>
                  <Layers size={16} /> Usługa Zewnętrzna
                </div>
                <input type="radio" name="productType" checked={type === "service"} onChange={() => setType("service")} style={{ accentColor: "#60a5fa" }} />
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.4 }}>
                Usługi dojazdu, montażu, pomiarów na inwestycji, audytów i projektowania.
              </div>
            </div>

            <div
              onClick={() => setType("product")}
              style={{
                background: type === "product" ? "rgba(34, 197, 94, 0.12)" : "#0d1117",
                border: type === "product" ? "1px solid #4ade80" : "1px solid #21262d",
                borderRadius: 8,
                padding: 14,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "product" ? "#4ade80" : "#f0f6fc" }}>
                  <Package size={16} /> Produkt / Komponent
                </div>
                <input type="radio" name="productType" checked={type === "product"} onChange={() => setType("product")} style={{ accentColor: "#4ade80" }} />
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.4 }}>
                Fizyczny materiał, profil aluminiowy, okucie, łącznik, wypełnienie.
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Grid Nazwa + Wgrywanie Obrazu */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
          {/* Main Attributes Card */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
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
                    <option value="custom">+ Dodaj własną kategorię...</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Nazwa własnej kategorii..."
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
                      style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", fontSize: 11, padding: "0 8px", cursor: "pointer" }}
                    >
                      X
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
                  <option value="custom">Własna...</option>
                </select>
              </label>

              <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: 12, color: "#f0f6fc", fontWeight: 600 }}>Aktywny</span>
              </label>
            </div>

            {unit === "custom" && (
              <label style={labelStyle}>
                Wpisz Własną Jednostkę *
                <input
                  type="text"
                  placeholder="np. m3, paleta"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  style={inputStyle}
                />
              </label>
            )}
          </div>

          {/* Image Upload Box */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
              <ImageIcon size={13} style={{ color: "#60a5fa" }} /> Obraz / Miniatura Pozycji
            </div>

            {imagePreview ? (
              <div style={{ position: "relative", width: "100%", height: 150, borderRadius: 6, overflow: "hidden", border: "1px solid #30363d" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Podgląd zdjęcia"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(248,81,73,0.9)", color: "#fff", border: "none", borderRadius: 4, padding: 4, cursor: "pointer" }}
                  title="Usuń zdjęcie"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  border: "2px dashed #30363d",
                  borderRadius: 6,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  background: "#0d1117",
                  transition: "border 150ms",
                }}
              >
                <Upload size={24} style={{ color: "#8b949e" }} />
                <span style={{ fontSize: 11, color: "#c9d1d9", fontWeight: 600 }}>Przeciągnij lub kliknij, aby wgrać zdjęcie</span>
                <span style={{ fontSize: 9, color: "#8b949e" }}>JPG, PNG, WEBP (max 10MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Section 3: Dostawca i Cennik */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Tag size={14} style={{ color: "#3b82f6" }} />
            2. Wykonawca Obróbki & Warunki Handlowe
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
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
                style={{ ...inputStyle, background: "#0d1117", color: "#4ade80", fontWeight: 700 }}
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

        {/* Section 4: Parametry Techniczne */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
              <Sliders size={14} style={{ color: "#c084fc" }} />
              3. Specyfikacja & Parametry Techniczne
            </div>

            <button
              type="button"
              onClick={() => handleAddParameter()}
              style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 6, color: "#60a5fa", fontSize: 11, fontWeight: 600, padding: "5px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={12} /> Dodaj parametr
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={11} /> Szybkie sugestie:
            </span>
            {QUICK_PARAM_SUGGESTIONS.map((sug) => (
              <button
                key={sug.key}
                type="button"
                onClick={() => handleAddParameter(sug.key, sug.unit)}
                style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 4, color: "#c9d1d9", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
              >
                + {sug.key}
              </button>
            ))}
          </div>

          {parameters.length === 0 ? (
            <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", background: "#0d1117", padding: 14, borderRadius: 6, textAlign: "center", border: "1px dashed #30363d" }}>
              Brak zdefiniowanych parametrów technicznych. Kliknij przycisk powyżej lub dodaj sugestię.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {parameters.map((param, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Nazwa cechy (np. Kolor RAL)"
                    value={param.key}
                    onChange={(e) => handleParameterChange(index, "key", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="Wartość (np. 9016)"
                    value={param.value}
                    onChange={(e) => handleParameterChange(index, "value", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="Jednostka (np. μm)"
                    value={param.unit ?? ""}
                    onChange={(e) => handleParameterChange(index, "unit", e.target.value)}
                    style={{ ...inputStyle, width: 100 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParameter(index)}
                    style={{ background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.3)", color: "#f85149", borderRadius: 6, padding: 7, cursor: "pointer" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 5: Opisy i Notatki */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={cardStyle}>
            <label style={labelStyle}>
              Opis Techniczny / Zakres Obróbki
              <textarea
                rows={3}
                placeholder="Dodatkowy opis techniczny..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>
              Notatki Wewnętrzne
              <textarea
                rows={3}
                placeholder="Prywatne uwagi zespołu..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          </div>
        </div>

      </form>
      </div>
      </main>
    </>
  );
}

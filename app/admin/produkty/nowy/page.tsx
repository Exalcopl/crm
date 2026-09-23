"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Wrench,
  Layers,
  Package,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Trash2,
  ArrowLeft,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { I } from "../../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";
import { PaintEditor } from "../_components/PaintEditor";

const COMMON_UNITS = ["szt.", "mb.", "m²", "kg", "kpl.", "godz.", "usł."];

export default function NewProductPage() {
  const router = useRouter();
  const createProduct = useMutation(api.products.create);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);

  const [name, setName] = useState("");
  const [type, setType] = useState<"product" | "service" | "outsourcing">("outsourcing");
  const [unit, setUnit] = useState("szt.");
  const [customUnit, setCustomUnit] = useState("");
  const [description, setDescription] = useState("");

  const [imageSourceMode, setImageSourceMode] = useState<"upload" | "draw">("upload");

  // Image Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalUnit = unit === "custom" ? customUnit.trim() : unit;

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

  const handleApplyDrawing = (file: File) => {
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageSourceMode("upload");
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
      let uploadedStorageId: Id<"_storage"> | undefined = undefined;

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

      const newId = await createProduct({
        name: name.trim(),
        type,
        unit: finalUnit,
        description: description.trim() || undefined,
        imageId: uploadedStorageId,
        isActive: true,
        vatRate: 23,
        currency: "PLN",
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
            icon={<ArrowLeft size={22} />}
            label="Wróć"
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
        <div style={{ padding: 20 }}>
          <form id="create-product-form" onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Lewa kolumna: Pola formularza */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Wybór typu */}
              <div style={cardStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} style={{ color: "#60a5fa" }} />
                  Wybór Typu Pozycji *
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <div
                    onClick={() => setType("outsourcing")}
                    style={{
                      background: type === "outsourcing" ? "rgba(168, 85, 247, 0.12)" : "#0d1117",
                      border: type === "outsourcing" ? "1px solid #c084fc" : "1px solid #21262d",
                      borderRadius: 8,
                      padding: "14px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 120ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "outsourcing" ? "#c084fc" : "#f0f6fc" }}>
                      <Wrench size={16} /> Obróbka
                    </div>
                    <input type="radio" name="productType" checked={type === "outsourcing"} readOnly style={{ accentColor: "#c084fc" }} />
                  </div>

                  <div
                    onClick={() => setType("service")}
                    style={{
                      background: type === "service" ? "rgba(59, 130, 246, 0.12)" : "#0d1117",
                      border: type === "service" ? "1px solid #60a5fa" : "1px solid #21262d",
                      borderRadius: 8,
                      padding: "14px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 120ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "service" ? "#60a5fa" : "#f0f6fc" }}>
                      <Layers size={16} /> Usługa
                    </div>
                    <input type="radio" name="productType" checked={type === "service"} readOnly style={{ accentColor: "#60a5fa" }} />
                  </div>

                  <div
                    onClick={() => setType("product")}
                    style={{
                      background: type === "product" ? "rgba(34, 197, 94, 0.12)" : "#0d1117",
                      border: type === "product" ? "1px solid #4ade80" : "1px solid #21262d",
                      borderRadius: 8,
                      padding: "14px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 120ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: type === "product" ? "#4ade80" : "#f0f6fc" }}>
                      <Package size={16} /> Produkt
                    </div>
                    <input type="radio" name="productType" checked={type === "product"} readOnly style={{ accentColor: "#4ade80" }} />
                  </div>
                </div>
              </div>

              {/* Pola */}
              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 12 }}>
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
                    Jednostka *
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
                </div>
                {unit === "custom" && (
                  <div style={{ marginBottom: 12 }}>
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
                  </div>
                )}
                
                <label style={labelStyle}>
                  Opis Techniczny / Zakres
                  <textarea
                    rows={4}
                    placeholder="Dodatkowy opis techniczny..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>
              </div>
            </div>

            {/* Prawa kolumna: Zdjęcie */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ ...cardStyle, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <ImageIcon size={13} style={{ color: "#60a5fa" }} /> Grafika Pozycji
                  </div>
                  
                  <div style={{ display: "flex", background: "#0d1117", borderRadius: 6, border: "1px solid #30363d", padding: 2 }}>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode("upload")}
                      style={{
                        background: imageSourceMode === "upload" ? "#21262d" : "transparent",
                        color: imageSourceMode === "upload" ? "#c9d1d9" : "#8b949e",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Upload size={12} /> Wgraj plik
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode("draw")}
                      style={{
                        background: imageSourceMode === "draw" ? "#21262d" : "transparent",
                        color: imageSourceMode === "draw" ? "#c9d1d9" : "#8b949e",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <PenTool size={12} /> Stwórz szkic
                    </button>
                  </div>
                </div>

                {imageSourceMode === "draw" ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 400 }}>
                    <PaintEditor onApply={handleApplyDrawing} />
                  </div>
                ) : (
                  <>
                    {imagePreview ? (
                      <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 250, borderRadius: 6, overflow: "hidden", border: "1px solid #30363d" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="Podgląd zdjęcia"
                          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0d1117" }}
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          style={{ position: "absolute", top: 6, right: 6, background: "rgba(248,81,73,0.9)", color: "#fff", border: "none", borderRadius: 4, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Usuń zdjęcie"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          border: "2px dashed #30363d",
                          borderRadius: 6,
                          flex: 1,
                          minHeight: 250,
                          padding: 20,
                          textAlign: "center",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: "#0d1117",
                          transition: "border 150ms",
                        }}
                      >
                        <Upload size={32} style={{ color: "#8b949e" }} />
                        <span style={{ fontSize: 12, color: "#c9d1d9", fontWeight: 600 }}>Przeciągnij lub kliknij, aby wgrać zdjęcie</span>
                        <span style={{ fontSize: 10, color: "#8b949e" }}>JPG, PNG, WEBP (max 10MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          style={{ display: "none" }}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

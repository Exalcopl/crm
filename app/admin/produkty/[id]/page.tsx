"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Truck,
  Clock,
  DollarSign,
  FileText,
  Wrench,
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { I } from "../../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as Id<"products">;

  const product = useQuery(api.products.get, { id: productId });
  const removeProduct = useMutation(api.products.remove);

  if (product === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", padding: 40, color: "#8b949e", textAlign: "center", fontSize: 13 }}>
        Ładowanie szczegółów pozycji...
      </div>
    );
  }

  if (product === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", padding: 40, color: "#8b949e", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 14, color: "#f0f6fc", fontWeight: 700 }}>Nie znaleziono pozycji w katalogu.</div>
        <Link
          href="/admin/produkty"
          style={{ background: "#3b82f6", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Powrót do Katalogu
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`Czy na pewno chcesz usunąć tę pozycję: "${product.name}"?`)) return;
    try {
      await removeProduct({ id: productId });
      toast.success("Pozycja została usunięta.");
      router.push("/admin/produkty");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas usuwania.");
    }
  };

  const getTypeBadge = (type: "product" | "service" | "outsourcing") => {
    switch (type) {
      case "outsourcing":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(168, 85, 247, 0.12)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#c084fc" }}>
            <Wrench size={13} /> Obróbka Zewnętrzna (Outsourcing)
          </span>
        );
      case "service":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>
            <Layers size={13} /> Usługa Zewnętrzna
          </span>
        );
      case "product":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#4ade80" }}>
            <Package size={13} /> Produkt / Komponent
          </span>
        );
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: 18,
    color: "#f0f6fc",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #21262d",
    paddingBottom: 8,
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
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
            icon={<I.edit s={22} />}
            label="Edytuj"
            onClick={() => router.push(`/admin/produkty/${productId}/edytuj`)}
          />
          <RibbonBtn
            icon={<I.trash s={22} />}
            label="Usuń"
            onClick={handleDelete}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content">
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header Bar */}
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0f6fc", margin: 0 }}>{product.name}</h1>
                {getTypeBadge(product.type)}
                {product.isActive ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#4ade80" }}>
                    <CheckCircle2 size={11} /> Aktywny
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(139, 148, 158, 0.1)", border: "1px solid rgba(139, 148, 158, 0.3)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#8b949e" }}>
                    <XCircle size={11} /> Nieaktywny
                  </span>
                )}
              </div>
            </div>
          </div>

      {/* Main Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Base Info Card */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <FileText size={15} style={{ color: "#60a5fa" }} /> Podstawowe Informacje i Klasyfikacja
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#8b949e" }}>Kod / SKU Wewnętrzny</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc", marginTop: 2 }}>{product.code ?? "—"}</div>
              </div>

              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#8b949e" }}>Jednostka Miary</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc", marginTop: 2 }}>{product.unit}</div>
              </div>

              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 10, color: "#8b949e" }}>Kategoria</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc", marginTop: 2 }}>{product.category ?? "Główna"}</div>
              </div>
            </div>

            {/* Price Box */}
            <div style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={14} /> Warunki Cenowe Obróbki
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#8b949e" }}>Cena Netto</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6fc" }}>
                    {product.priceNetto !== undefined ? `${product.priceNetto.toFixed(2)} ${product.currency ?? "PLN"}` : "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: "#8b949e" }}>Stawka VAT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#c9d1d9" }}>{product.vatRate ?? 23}%</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: "#8b949e" }}>Wyliczona Cena Brutto</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>
                    {product.priceBrutto !== undefined ? `${product.priceBrutto.toFixed(2)} ${product.currency ?? "PLN"}` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specs */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <Sliders size={15} style={{ color: "#c084fc" }} /> Specyfikacja i Warianty Techniczne
            </div>

            {!product.parameters || product.parameters.length === 0 ? (
              <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", background: "#0d1117", padding: 12, borderRadius: 6, textAlign: "center" }}>
                Brak zdefiniowanych parametrów technicznych (np. Kolor RAL, Grubość, Typ powłoki).
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0d1117", borderBottom: "1px solid #21262d", color: "#8b949e", fontSize: 10, textTransform: "uppercase" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Parametr</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Wartość</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Jednostka</th>
                  </tr>
                </thead>
                <tbody>
                  {product.parameters.map((param, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f0f6fc" }}>{param.key}</td>
                      <td style={{ padding: "8px 10px", color: "#c9d1d9" }}>{param.value}</td>
                      <td style={{ padding: "8px 10px", color: "#8b949e" }}>{param.unit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Description & Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", marginBottom: 6 }}>Opis Techniczny / Zakres Obróbki</div>
              <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {product.description || "Brak opisu."}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", marginBottom: 6 }}>Notatki Wewnętrzne</div>
              <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {product.notes || "Brak notatek."}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Image Display Card */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <ImageIcon size={15} style={{ color: "#60a5fa" }} /> Zdjęcie / Podgląd Pozycji
            </div>

            {product.imageUrl ? (
              <div style={{ width: "100%", height: 220, borderRadius: 6, overflow: "hidden", border: "1px solid #30363d", background: "#0d1117" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            ) : (
              <div style={{ padding: 30, textAlign: "center", background: "#0d1117", borderRadius: 6, border: "1px dashed #30363d", color: "#484f58" }}>
                <ImageIcon size={32} style={{ margin: "0 auto 8px auto" }} />
                <div style={{ fontSize: 11, color: "#8b949e" }}>Brak wgranego zdjęcia.</div>
                <Link
                  href={`/admin/produkty/${productId}/edytuj`}
                  style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, textDecoration: "none", marginTop: 4, display: "inline-block" }}
                >
                  + Dodaj zdjęcie w edycji
                </Link>
              </div>
            )}
          </div>

          {/* Supplier Card */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <Truck size={15} style={{ color: "#60a5fa" }} /> Wykonawca Obróbki
            </div>

            {product.supplier ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>{product.supplier.name}</div>
                    <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace", marginTop: 2 }}>NIP: {product.supplier.nip}</div>
                  </div>
                  <Link
                    href="/admin/konfiguracje"
                    style={{ padding: 6, background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: 6, color: "#60a5fa" }}
                    title="Przejdź do dostawców"
                  >
                    <Building2 size={15} />
                  </Link>
                </div>

                {product.supplierCode && (
                  <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 8, fontSize: 11 }}>
                    <div style={{ fontSize: 10, color: "#8b949e" }}>Kod SKU u Wykonawcy</div>
                    <div style={{ fontWeight: 700, color: "#60a5fa" }}>{product.supplierCode}</div>
                  </div>
                )}

                <div style={{ borderTop: "1px solid #21262d", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#c9d1d9" }}>
                  {product.supplier.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={12} style={{ color: "#8b949e" }} /> {product.supplier.phone}
                    </div>
                  )}
                  {product.supplier.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mail size={12} style={{ color: "#8b949e" }} /> {product.supplier.email}
                    </div>
                  )}
                  {product.supplier.city && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={12} style={{ color: "#8b949e" }} /> {product.supplier.city}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", background: "#0d1117", borderRadius: 6, border: "1px dashed #30363d", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Building2 size={24} style={{ color: "#484f58" }} />
                <div style={{ fontSize: 11, color: "#8b949e" }}>Brak przypisanego dostawcy.</div>
                <Link
                  href={`/admin/produkty/${productId}/edytuj`}
                  style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, textDecoration: "none" }}
                >
                  + Przypisz dostawcę
                </Link>
              </div>
            )}
          </div>

          {/* Lead Time Card */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>
              <Clock size={15} style={{ color: "#fbbf24" }} /> Czas Realizacji
            </div>

            {product.leadTimeDays !== undefined ? (
              <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 6, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "#fbbf24", color: "#000", display: "grid", placeItems: "center" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fbbf24" }}>{product.leadTimeDays}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#c9d1d9" }}>
                    {product.leadTimeDays === 1 ? "Dzień roboczy" : "Dni robocze"}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic" }}>Nie określono czasu realizacji.</div>
            )}
          </div>

          {/* Dates Card */}
          <div style={{ ...cardStyle, fontSize: 11, color: "#8b949e", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} /> Utworzono: <strong style={{ color: "#c9d1d9" }}>{new Date(product.createdAt).toLocaleDateString("pl-PL")}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} /> Modyfikacja: <strong style={{ color: "#c9d1d9" }}>{new Date(product.updatedAt).toLocaleDateString("pl-PL")}</strong>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>
    </>
  );
}

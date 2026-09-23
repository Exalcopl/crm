"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Search,
  Plus,
  Filter,
  Layers,
  Truck,
  ExternalLink,
  Clock,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Wrench,
  Package,
  Boxes,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";

type ProductType = "product" | "service" | "outsourcing";

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [onlyActive, setOnlyActive] = useState(false);

  const suppliers = useQuery(api.suppliers.list, { onlyActive: true });
  const products = useQuery(api.products.list, {
    search: search.trim() || undefined,
    type: selectedType !== "all" ? (selectedType as ProductType) : undefined,
    supplierId: selectedSupplierId !== "all" ? (selectedSupplierId as Id<"suppliers">) : undefined,
    onlyActive: onlyActive || undefined,
  });

  const removeProduct = useMutation(api.products.remove);

  const handleDelete = async (id: Id<"products">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć pozycję: "${name}"?`)) return;
    try {
      await removeProduct({ id });
      toast.success("Pozycja została usunięta.");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas usuwania pozycji.");
    }
  };

  const getTypeBadge = (type: ProductType) => {
    switch (type) {
      case "outsourcing":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(168, 85, 247, 0.12)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: 4,
              padding: "2px 7px",
              fontSize: 10,
              fontWeight: 700,
              color: "#c084fc",
            }}
          >
            <Wrench size={11} /> Obróbka Zewnętrzna
          </span>
        );
      case "service":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 4,
              padding: "2px 7px",
              fontSize: 10,
              fontWeight: 700,
              color: "#60a5fa",
            }}
          >
            <Layers size={11} /> Usługa
          </span>
        );
      case "product":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: 4,
              padding: "2px 7px",
              fontSize: 10,
              fontWeight: 700,
              color: "#4ade80",
            }}
          >
            <Package size={11} /> Produkt / Materiał
          </span>
        );
    }
  };

  const totalCount = products?.length ?? 0;
  const outsourcingCount = products?.filter((p) => p.type === "outsourcing").length ?? 0;
  const withSupplierCount = products?.filter((p) => p.supplierId).length ?? 0;

  const inputStyle: React.CSSProperties = {
    background: "#0d1117",
    border: "1px solid #30363d",
    color: "#f0f6fc",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
  };

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Główna">
          <RibbonBtn
            icon={<I.plus s={22} />}
            label="Dodaj pozycję"
            primary
            onClick={() => router.push("/admin/produkty/nowy")}
          />
        </RibbonGroup>
      </div>
      <main className="fluent-content">
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: 8, background: "rgba(59,130,246,0.12)", color: "#60a5fa", borderRadius: 6 }}>
            <Boxes size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>Wszystkie Pozycje</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f6fc" }}>{totalCount}</div>
          </div>
        </div>

        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: 8, background: "rgba(168,85,247,0.12)", color: "#c084fc", borderRadius: 6 }}>
            <Wrench size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>Obróbka Zewnętrzna</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f6fc" }}>{outsourcingCount}</div>
          </div>
        </div>

        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: 8, background: "rgba(34,197,94,0.12)", color: "#4ade80", borderRadius: 6 }}>
            <Truck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 600 }}>Z Przypisanym Dostawcą</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f6fc" }}>{withSupplierCount}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8b949e" }} />
          <input
            type="text"
            placeholder="Szukaj po nazwie, SKU, kodzie dostawcy, kategorii..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
            <Filter size={12} /> Filtry:
          </span>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={inputStyle}
          >
            <option value="all">Wszystkie typy</option>
            <option value="outsourcing">Obróbka Zewnętrzna</option>
            <option value="service">Usługi</option>
            <option value="product">Produkty</option>
          </select>

          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            style={inputStyle}
          >
            <option value="all">Wszyscy Dostawcy</option>
            {suppliers?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c9d1d9", cursor: "pointer", marginLeft: 4 }}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              style={{ accentColor: "#3b82f6" }}
            />
            Tylko aktywne
          </label>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
        {products === undefined ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8b949e", fontSize: 12 }}>Ładowanie katalogu...</div>
        ) : products.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8b949e", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Boxes size={32} style={{ color: "#484f58", margin: "0 auto" }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>Brak pozycji w katalogu.</div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>Nie znaleziono pozycji spełniających podane kryteria.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0d1117", borderBottom: "1px solid #30363d", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <th style={{ padding: "10px 14px", width: 44 }}>Obraz</th>
                  <th style={{ padding: "10px 14px" }}>Nazwa & SKU</th>
                  <th style={{ padding: "10px 14px" }}>Typ & Kategoria</th>
                  <th style={{ padding: "10px 14px" }}>Dostawca / Wykonawca</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Cena Netto</th>
                  <th style={{ padding: "10px 14px" }}>Czas Realizacji</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => (
                  <tr
                    key={item._id}
                    style={{ borderBottom: "1px solid #21262d", transition: "background 100ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1c2128")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      {item.imageUrl ? (
                        <div style={{ width: 36, height: 36, borderRadius: 6, overflow: "hidden", border: "1px solid #30363d", background: "#0d1117" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "#0d1117", border: "1px solid #21262d", display: "grid", placeItems: "center", color: "#484f58" }}>
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <Link
                        href={`/admin/produkty/${item._id}`}
                        style={{ fontWeight: 700, color: "#f0f6fc", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {item.name}
                        <ExternalLink size={11} style={{ color: "#8b949e" }} />
                      </Link>
                      <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>
                        {item.code ? `SKU: ${item.code} • ` : ""}Jednostka: {item.unit}
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <div>{getTypeBadge(item.type)}</div>
                      {item.category && (
                        <div style={{ fontSize: 10, color: "#8b949e", marginTop: 3 }}>
                          {item.category}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      {item.supplier ? (
                        <div>
                          <Link
                            href="/admin/konfiguracje"
                            style={{ fontWeight: 600, color: "#60a5fa", textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Truck size={11} />
                            {item.supplier.name}
                          </Link>
                          {item.supplierCode && (
                            <div style={{ fontSize: 10, color: "#8b949e" }}>
                              Kod dostawcy: {item.supplierCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#6e7681", fontStyle: "italic" }}>Brak dostawcy</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {item.priceNetto !== undefined ? (
                        <div>
                          <div style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {item.priceNetto.toFixed(2)} {item.currency ?? "PLN"}
                          </div>
                          <div style={{ fontSize: 10, color: "#8b949e" }}>
                            +{item.vatRate}% VAT
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#6e7681" }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      {item.leadTimeDays !== undefined ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>
                          <Clock size={11} />
                          {item.leadTimeDays} {item.leadTimeDays === 1 ? "dzień" : "dni"}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#6e7681" }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      {item.isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "#4ade80" }}>
                          <CheckCircle2 size={11} /> Aktywny
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(139, 148, 158, 0.1)", border: "1px solid rgba(139, 148, 158, 0.3)", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "#8b949e" }}>
                          <XCircle size={11} /> Nieaktywny
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <Link
                          href={`/admin/produkty/${item._id}`}
                          style={{ padding: 4, color: "#60a5fa", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 4 }}
                          title="Widok szczegółów"
                        >
                          <ExternalLink size={13} />
                        </Link>

                        <Link
                          href={`/admin/produkty/${item._id}/edytuj`}
                          style={{ padding: 4, color: "#c9d1d9", background: "rgba(255, 255, 255, 0.05)", border: "1px solid #30363d", borderRadius: 4, textDecoration: "none" }}
                          title="Edytuj"
                        >
                          <Edit3 size={13} />
                        </Link>

                        <button
                          onClick={() => handleDelete(item._id, item.name)}
                          style={{ padding: 4, color: "#f85149", background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.2)", borderRadius: 4, cursor: "pointer" }}
                          title="Usuń"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </main>
    </>
  );
}

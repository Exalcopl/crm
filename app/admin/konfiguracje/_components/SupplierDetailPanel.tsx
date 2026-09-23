"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Clock,
  Tag,
  FileText,
  Link2,
  Edit3,
  Trash2,
  ExternalLink,
  Calendar,
} from "lucide-react";

interface Props {
  supplierId: Id<"suppliers">;
  onClose: () => void;
  onEdit: (id: Id<"suppliers">) => void;
  onDelete: (id: Id<"suppliers">, name: string) => void;
}

function Row({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #21262d",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 28,
          display: "flex",
          justifyContent: "center",
          paddingTop: 1,
          color: "#8b949e",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 1 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#f0f6fc",
            fontWeight: 500,
            wordBreak: "break-word",
            fontFamily: mono ? "monospace" : undefined,
            letterSpacing: mono ? "0.03em" : undefined,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function SupplierDetailPanel({
  supplierId,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const supplier = useQuery(api.suppliers.get, { id: supplierId });
  const client = useQuery(
    api.clients.get,
    supplier?.clientId ? { id: supplier.clientId } : "skip"
  );

  if (!supplier) {
    return (
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 10,
          padding: 24,
          textAlign: "center",
          color: "#8b949e",
        }}
      >
        Ładowanie…
      </div>
    );
  }

  const fullAddress = [supplier.street, supplier.postalCode, supplier.city]
    .filter(Boolean)
    .join(", ");

  const createdDate = new Date(supplier.createdAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const updatedDate = new Date(supplier.updatedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Panel header */}
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
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={17} style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc", lineHeight: 1.2 }}
            >
              {supplier.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#8b949e",
                  fontFamily: "monospace",
                }}
              >
                NIP: {supplier.nip}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  background: supplier.isActive
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(248,81,73,0.1)",
                  border: `1px solid ${supplier.isActive ? "rgba(34,197,94,0.3)" : "rgba(248,81,73,0.3)"}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontSize: 9,
                  fontWeight: 700,
                  color: supplier.isActive ? "#4ade80" : "#f85149",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: supplier.isActive ? "#4ade80" : "#f85149",
                  }}
                />
                {supplier.isActive ? "Aktywny" : "Nieaktywny"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            id="supplier-detail-edit"
            onClick={() => onEdit(supplierId)}
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: 6,
              color: "#60a5fa",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Edit3 size={12} />
            Edytuj
          </button>
          <button
            type="button"
            id="supplier-detail-delete"
            onClick={() => onDelete(supplierId, supplier.name)}
            style={{
              background: "rgba(248,81,73,0.08)",
              border: "1px solid rgba(248,81,73,0.3)",
              borderRadius: 6,
              color: "#f85149",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Trash2 size={12} />
            Usuń
          </button>
          <button
            type="button"
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
      </div>

      {/* Panel body */}
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Sekcja: Dane kontaktowe */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#484f58",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 4,
          }}
        >
          Dane kontaktowe
        </div>

        <Row icon={<Phone size={13} />} label="Telefon" value={supplier.phone} />
        <Row icon={<Mail size={13} />} label="Email" value={supplier.email} />
        <Row
          icon={<MapPin size={13} />}
          label="Adres"
          value={fullAddress || undefined}
        />

        {/* Sekcja: Dane finansowe */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#484f58",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 12,
            marginBottom: 4,
          }}
        >
          Dane finansowe
        </div>

        <Row
          icon={<CreditCard size={13} />}
          label="Numer konta IBAN"
          value={supplier.iban}
          mono
        />
        <Row
          icon={<Clock size={13} />}
          label="Termin płatności"
          value={
            supplier.paymentDays !== undefined
              ? `${supplier.paymentDays} dni`
              : undefined
          }
        />

        {/* Sekcja: Dodatkowe */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#484f58",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 12,
            marginBottom: 4,
          }}
        >
          Dodatkowe
        </div>

        <Row icon={<Tag size={13} />} label="Kategoria / branża" value={supplier.category} />
        <Row icon={<FileText size={13} />} label="Notatki" value={supplier.notes} />

        {/* Powiązany klient */}
        {client && (
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid #21262d",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 28,
                display: "flex",
                justifyContent: "center",
                color: "#8b949e",
                flexShrink: 0,
              }}
            >
              <Link2 size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 1 }}>
                Powiązany klient CRM
              </div>
              <a
                href={`/admin/klienci/${client._id}`}
                style={{
                  fontSize: 13,
                  color: "#60a5fa",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {client.name}
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
        {/* Powiązane produkty i usługi */}
        <SupplierProductsSection supplierId={supplierId} />

        {/* Daty */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid #21262d",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#484f58",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Calendar size={10} />
              Dodano
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
              {createdDate}
            </div>
          </div>
          {supplier.updatedAt !== supplier.createdAt && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "#484f58",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Calendar size={10} />
                Zaktualizowano
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                {updatedDate}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierProductsSection({ supplierId }: { supplierId: Id<"suppliers"> }) {
  const products = useQuery(api.products.listBySupplier, { supplierId });

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#484f58",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Oferowane produkty i obróbka ({products?.length ?? 0})</span>
        <a
          href="/admin/produkty"
          style={{ color: "#60a5fa", textTransform: "none", fontSize: 11, fontWeight: 500 }}
        >
          + Katalog produktów
        </a>
      </div>

      {!products ? (
        <div style={{ fontSize: 11, color: "#8b949e" }}>Ładowanie produktów...</div>
      ) : products.length === 0 ? (
        <div style={{ fontSize: 11, color: "#6e7681", fontStyle: "italic", padding: "6px 0" }}>
          Brak przypisanych produktów/usług.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {products.map((p) => (
            <a
              key={p._id}
              href={`/admin/produkty/${p._id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 6,
                padding: "8px 10px",
                textDecoration: "none",
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f0f6fc" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 10, color: "#8b949e" }}>
                  {p.code ? `SKU: ${p.code} • ` : ""}{p.category ?? p.type}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>
                  {p.priceNetto !== undefined ? `${p.priceNetto.toFixed(2)} ${p.currency ?? "PLN"}` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#8b949e" }}>
                  {p.leadTimeDays !== undefined ? `${p.leadTimeDays} dni` : ""}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

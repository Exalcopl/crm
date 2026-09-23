"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Building2,
} from "lucide-react";
import { SupplierFormModal } from "./SupplierFormModal";
import { SupplierDetailPanel } from "./SupplierDetailPanel";

type SortField = "name" | "nip" | "city" | "createdAt";
type SortDir = "asc" | "desc";

export function SuppliersTab() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [onlyActive, setOnlyActive] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"suppliers"> | null>(null);
  const [detailId, setDetailId] = useState<Id<"suppliers"> | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<{
    id: Id<"suppliers">;
    name: string;
  } | null>(null);

  const suppliers = useQuery(api.suppliers.list, { search, onlyActive }) ?? [];
  const removeMut = useMutation(api.suppliers.remove);

  // Lokalne sortowanie
  const sorted = [...suppliers].sort((a, b) => {
    let va: string | number = "";
    let vb: string | number = "";
    if (sortField === "name") { va = a.name; vb = b.name; }
    else if (sortField === "nip") { va = a.nip; vb = b.nip; }
    else if (sortField === "city") { va = a.city ?? ""; vb = b.city ?? ""; }
    else if (sortField === "createdAt") { va = a.createdAt; vb = b.createdAt; }
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "asc" ? va - vb : vb - va;
    }
    return sortDir === "asc"
      ? String(va).localeCompare(String(vb), "pl")
      : String(vb).localeCompare(String(va), "pl");
  });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  async function confirmDelete() {
    if (!deletingSupplier) return;
    try {
      await removeMut({ id: deletingSupplier.id });
      toast.success(`Usunięto dostawcę „${deletingSupplier.name}"`);
      if (detailId === deletingSupplier.id) setDetailId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd usuwania dostawcy");
    } finally {
      setDeletingSupplier(null);
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={11} style={{ opacity: 0.3 }} />;
    return sortDir === "asc"
      ? <ChevronUp size={11} style={{ color: "#3b82f6" }} />
      : <ChevronDown size={11} style={{ color: "#3b82f6" }} />;
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#8b949e",
    borderBottom: "1px solid #30363d",
    whiteSpace: "nowrap",
    background: "#0d1117",
    cursor: "pointer",
    userSelect: "none",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "#c9d1d9",
    borderBottom: "1px solid #21262d",
    verticalAlign: "middle",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 340 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#8b949e",
            }}
          />
          <input
            id="suppliers-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po nazwie, NIP, mieście…"
            style={{
              width: "100%",
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 6,
              padding: "6px 10px 6px 32px",
              fontSize: 12,
              color: "#f0f6fc",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Filtr aktywny */}
          <button
            type="button"
            id="suppliers-toggle-active"
            onClick={() => setOnlyActive((v) => !v)}
            style={{
              background: onlyActive ? "rgba(34,197,94,0.12)" : "transparent",
              border: `1px solid ${onlyActive ? "rgba(34,197,94,0.4)" : "#30363d"}`,
              borderRadius: 6,
              color: onlyActive ? "#4ade80" : "#8b949e",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {onlyActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            Tylko aktywni
          </button>

          {/* Add button */}
          <button
            type="button"
            id="suppliers-add-btn"
            onClick={() => {
              setEditingId(null);
              setIsFormOpen(true);
            }}
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
              boxShadow: "0 2px 8px rgba(35,134,54,0.4)",
            }}
          >
            <Plus size={14} />
            Dodaj dostawcę
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 11,
          color: "#8b949e",
        }}
      >
        <span>
          <strong style={{ color: "#f0f6fc" }}>{sorted.length}</strong> dostawców
        </span>
        <span>
          <strong style={{ color: "#4ade80" }}>
            {sorted.filter((s) => s.isActive).length}
          </strong>{" "}
          aktywnych
        </span>
        <span>
          <strong style={{ color: "#f85149" }}>
            {sorted.filter((s) => !s.isActive).length}
          </strong>{" "}
          nieaktywnych
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {sorted.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#484f58",
            }}
          >
            <Truck size={36} style={{ marginBottom: 12 }} />
            <div
              style={{ fontSize: 14, fontWeight: 700, color: "#8b949e" }}
            >
              {search
                ? "Brak dostawców pasujących do wyszukiwania"
                : "Brak dostawców — dodaj pierwszego"}
            </div>
            {!search && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setIsFormOpen(true);
                }}
                style={{
                  marginTop: 16,
                  background: "#238636",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "8px 20px",
                  cursor: "pointer",
                }}
              >
                + Dodaj dostawcę
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={thStyle}
                    onClick={() => handleSort("name")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Nazwa firmy <SortIcon field="name" />
                    </span>
                  </th>
                  <th style={thStyle} onClick={() => handleSort("nip")}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      NIP <SortIcon field="nip" />
                    </span>
                  </th>
                  <th style={thStyle} onClick={() => handleSort("city")}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Miasto <SortIcon field="city" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, cursor: "default" }}>Kategoria</th>
                  <th style={{ ...thStyle, cursor: "default" }}>Płatność</th>
                  <th style={{ ...thStyle, cursor: "default" }}>Status</th>
                  <th style={{ ...thStyle, textAlign: "right", cursor: "default" }}>
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr
                    key={s._id}
                    style={{
                      background:
                        detailId === s._id
                          ? "rgba(59,130,246,0.06)"
                          : "transparent",
                      transition: "background 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (detailId !== s._id)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      if (detailId !== s._id)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                    onClick={() =>
                      setDetailId(detailId === s._id ? null : s._id)
                    }
                  >
                    {/* Nazwa */}
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Building2 size={13} style={{ color: "#60a5fa" }} />
                        </div>
                        <span
                          style={{
                            color: "#f0f6fc",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                    </td>

                    {/* NIP */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "#8b949e",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {s.nip}
                      </span>
                    </td>

                    {/* Miasto */}
                    <td style={{ ...tdStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.city
                        ? `${s.postalCode ? s.postalCode + " " : ""}${s.city}`
                        : <span style={{ color: "#484f58" }}>—</span>}
                    </td>

                    {/* Kategoria */}
                    <td style={tdStyle}>
                      {s.category ? (
                        <span
                          style={{
                            background: "rgba(139,92,246,0.12)",
                            border: "1px solid rgba(139,92,246,0.25)",
                            borderRadius: 4,
                            padding: "2px 7px",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#a78bfa",
                          }}
                        >
                          {s.category}
                        </span>
                      ) : (
                        <span style={{ color: "#484f58" }}>—</span>
                      )}
                    </td>

                    {/* Płatność */}
                    <td style={tdStyle}>
                      {s.paymentDays !== undefined ? (
                        <span style={{ color: "#f0f6fc", fontWeight: 600 }}>
                          {s.paymentDays} dni
                        </span>
                      ) : (
                        <span style={{ color: "#484f58" }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: s.isActive
                            ? "rgba(34,197,94,0.1)"
                            : "rgba(248,81,73,0.1)",
                          border: `1px solid ${s.isActive ? "rgba(34,197,94,0.3)" : "rgba(248,81,73,0.3)"}`,
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: s.isActive ? "#4ade80" : "#f85149",
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: s.isActive ? "#4ade80" : "#f85149",
                          }}
                        />
                        {s.isActive ? "Aktywny" : "Nieaktywny"}
                      </span>
                    </td>

                    {/* Akcje */}
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Podgląd"
                          onClick={() =>
                            setDetailId(detailId === s._id ? null : s._id)
                          }
                          style={{
                            background: "transparent",
                            border: "1px solid #30363d",
                            borderRadius: 5,
                            color: "#8b949e",
                            padding: "4px 6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          title="Edytuj"
                          onClick={() => {
                            setEditingId(s._id);
                            setIsFormOpen(true);
                          }}
                          style={{
                            background: "transparent",
                            border: "1px solid #30363d",
                            borderRadius: 5,
                            color: "#8b949e",
                            padding: "4px 6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          title="Usuń"
                          onClick={() =>
                            setDeletingSupplier({ id: s._id, name: s.name })
                          }
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(248,81,73,0.3)",
                            borderRadius: 5,
                            color: "#f85149",
                            padding: "4px 6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Trash2 size={12} />
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

      {/* Detail panel */}
      {detailId && (
        <SupplierDetailPanel
          supplierId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(id) => {
            setEditingId(id);
            setIsFormOpen(true);
          }}
          onDelete={(id, name) => setDeletingSupplier({ id, name })}
        />
      )}

      {/* Form modal */}
      {isFormOpen && (
        <SupplierFormModal
          editingId={editingId}
          onClose={() => {
            setIsFormOpen(false);
            setEditingId(null);
          }}
          onSuccess={(id) => {
            setIsFormOpen(false);
            setEditingId(null);
            setDetailId(id);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deletingSupplier && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setDeletingSupplier(null)}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid rgba(248,81,73,0.4)",
              borderRadius: 10,
              padding: 24,
              width: 400,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#f85149",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <AlertTriangle size={18} />
              <span>Usunięcie dostawcy</span>
            </div>
            <div style={{ fontSize: 13, color: "#c9d1d9", lineHeight: 1.6 }}>
              Czy na pewno chcesz usunąć dostawcę{" "}
              <strong style={{ color: "#f0f6fc" }}>
                „{deletingSupplier.name}"
              </strong>
              ? Operacji tej nie można cofnąć.
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                id="supplier-delete-cancel"
                onClick={() => setDeletingSupplier(null)}
                style={{
                  background: "transparent",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 16px",
                  cursor: "pointer",
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                id="supplier-delete-confirm"
                onClick={() => void confirmDelete()}
                style={{
                  background: "#da3633",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 18px",
                  cursor: "pointer",
                }}
              >
                Usuń dostawcę
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

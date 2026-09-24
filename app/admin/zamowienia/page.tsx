"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Package,
  Search,
  Plus,
  Building2,
  Home,
  ChevronDown,
  ChevronRight,
  Eye,
  ArrowRight,
  X,
  Filter,
  Calendar,
} from "lucide-react";

type SubOrderStatus = "utworzono" | "do_zamowienia" | "zamowiono" | "odbior" | "zamkniete";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  utworzono:     { label: "Utworzono",     color: "#8b949e", bg: "rgba(139,148,158,0.15)" },
  do_zamowienia: { label: "Do zamówienia", color: "#f0883e", bg: "rgba(240,136,62,0.15)"  },
  zamowiono:     { label: "Zamówiono",     color: "#58a6ff", bg: "rgba(88,166,255,0.15)"  },
  odbior:        { label: "Odbiór",        color: "#d29922", bg: "rgba(210,153,34,0.15)"  },
  zamkniete:     { label: "Zamknięte",     color: "#3fb950", bg: "rgba(63,185,80,0.15)"   },
};

const STATUS_ORDER: SubOrderStatus[] = ["utworzono", "do_zamowienia", "zamowiono", "odbior", "zamkniete"];

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ZamowieniaPage() {
  const router = useRouter();

  // Sub-orders list
  const subOrders = useQuery(api.subOrders.listAllWithDetails, {}) ?? [];
  const allOrders = useQuery(api.orders.list, {}) ?? [];
  const allSuppliers = useQuery(api.suppliers.list, {}) ?? [];
  const allClients = useQuery(api.clients.list, {}) ?? [];

  const createSubOrder = useMutation(api.subOrders.create);
  const updateStatus = useMutation(api.subOrders.updateStatus);
  const updatePickupDate = useMutation(api.subOrders.updatePickupDate);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");

  // Accordion collapsed state for order groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Drawer & Modal state
  const [previewSubOrder, setPreviewSubOrder] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrderId, setNewOrderId] = useState<string>("");
  const [newSupplierId, setNewSupplierId] = useState<string>("");

  // Filtering logic
  const filteredSubOrders = useMemo(() => {
    return subOrders.filter((so) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = so.orderNumber.toLowerCase().includes(q);
        const matchesExtNumber = so.externalOrderNumber?.toLowerCase().includes(q) ?? false;
        const matchesClient = so.client?.name.toLowerCase().includes(q) ?? false;
        const matchesOrderNum = so.order?.orderNumber.toLowerCase().includes(q) ?? false;
        const matchesSupplier = so.supplier?.name.toLowerCase().includes(q) ?? false;

        if (!matchesNumber && !matchesExtNumber && !matchesClient && !matchesOrderNum && !matchesSupplier) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== "all" && so.status !== selectedStatus) {
        return false;
      }

      // Client filter
      if (selectedClientId !== "all") {
        if (so.order?.clientId !== selectedClientId && so.client?._id !== selectedClientId) {
          return false;
        }
      }

      // Main Order filter
      if (selectedOrderId !== "all" && so.orderId !== selectedOrderId) {
        return false;
      }

      // Supplier filter
      if (selectedSupplierId !== "all") {
        if (selectedSupplierId === "internal") {
          if (so.supplierId) return false;
        } else if (so.supplierId !== selectedSupplierId) {
          return false;
        }
      }

      return true;
    });
  }, [subOrders, searchQuery, selectedStatus, selectedClientId, selectedOrderId, selectedSupplierId]);

  // Grouping by Main Order
  const groupedSubOrders = useMemo(() => {
    const groups: Record<string, { order: any; clientName: string; subOrders: any[] }> = {};

    filteredSubOrders.forEach((so) => {
      const orderKey = so.orderId || "unknown";
      if (!groups[orderKey]) {
        groups[orderKey] = {
          order: so.order,
          clientName: so.client?.name || so.order?.clientName || "Brak klienta",
          subOrders: [],
        };
      }
      groups[orderKey].subOrders.push(so);
    });

    return Object.values(groups);
  }, [filteredSubOrders]);

  const toggleGroup = (orderKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [orderKey]: !prev[orderKey] }));
  };

  const handleCreateSubOrder = async () => {
    if (!newOrderId) {
      toast.error("Wybierz zlecenie główne");
      return;
    }

    try {
      const createdId = await createSubOrder({
        orderId: newOrderId as Id<"orders">,
        supplierId: newSupplierId ? (newSupplierId as Id<"suppliers">) : undefined,
      });

      toast.success("Utworzono nowe zamówienie podwykonawcze");
      setShowCreateModal(false);
      router.push(`/admin/zlecenia/${newOrderId}/zamowienia/${createdId}`);
    } catch (e: any) {
      toast.error(e.message || "Nie udało się utworzyć zamówienia");
    }
  };

  return (
    <div className="fluent-layout" style={{ minHeight: "100vh", background: "#0d1117", color: "#c9d1d9" }}>
      {/* NAGŁÓWEK */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #30363d", background: "#161b22", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <Package size={26} color="#58a6ff" /> Zamówienia podwykonawcze
          </h1>
          <p style={{ color: "#8b949e", fontSize: 13, marginTop: 4, margin: 0 }}>
            Zarządzaj wszystkimi zamówieniami przypisanymi do zleceń. Filtruj po kliencie, zleceniu oraz dostawcy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "#238636",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 8px rgba(35,134,54,0.3)"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2ea043")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#238636")}
        >
          <Plus size={16} /> Nowe zamówienie podwykonawcze
        </button>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* PASEK FILTRÓW */}
        <div style={{ background: "#161b22", padding: 18, borderRadius: 12, border: "1px solid #30363d", marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Wiersz 1: Wyszukiwarka i Status Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            {/* Wyszukiwarka */}
            <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 12px", width: 340, flexShrink: 0 }}>
              <Search size={16} color="#8b949e" style={{ marginRight: 8, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Szukaj po nr zamówienia, kliencie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: "#c9d1d9", fontSize: 13, padding: "9px 0", width: "100%" }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setSelectedStatus("all")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: selectedStatus === "all" ? "#1f6feb" : "#0d1117",
                  color: selectedStatus === "all" ? "#fff" : "#8b949e",
                  borderStyle: "solid",
                  borderWidth: 1,
                  borderColor: selectedStatus === "all" ? "#1f6feb" : "#30363d",
                }}
              >
                Wszystkie ({subOrders.length})
              </button>
              {STATUS_ORDER.map((st) => {
                const cfg = STATUS_CONFIG[st];
                const count = subOrders.filter((s) => s.status === st).length;
                const isSelected = selectedStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: isSelected ? cfg.color : "#0d1117",
                      color: isSelected ? "#fff" : cfg.color,
                      border: `1px solid ${isSelected ? cfg.color : "#30363d"}`,
                    }}
                  >
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wiersz 2: Dropdown filters (Klient, Zlecenie, Dostawca) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", paddingTop: 12, borderTop: "1px solid #21262d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e", fontSize: 12, fontWeight: 600 }}>
              <Filter size={14} /> Filtry:
            </div>

            {/* Filter: Klient */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e" }}>Klient:</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                style={{ background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}
              >
                <option value="all">Wszyscy klienci</option>
                {allClients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Zlecenie */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e" }}>Zlecenie:</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                style={{ background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}
              >
                <option value="all">Wszystkie zlecenia</option>
                {allOrders.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.orderNumber} ({o.clientName})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter: Dostawca */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#8b949e" }}>Dostawca:</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                style={{ background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}
              >
                <option value="all">Wszyscy dostawcy</option>
                <option value="internal">Realizacja wewnętrzna</option>
                {allSuppliers.map((sup) => (
                  <option key={sup._id} value={sup._id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset filters button if active */}
            {(selectedStatus !== "all" || selectedClientId !== "all" || selectedOrderId !== "all" || selectedSupplierId !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus("all");
                  setSelectedClientId("all");
                  setSelectedOrderId("all");
                  setSelectedSupplierId("all");
                  setSearchQuery("");
                }}
                style={{ background: "transparent", color: "#f85149", border: "none", fontSize: 12, cursor: "pointer", padding: "4px 8px" }}
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        </div>

        {/* GŁÓWNA TABELA Z GRUPOWANIEM */}
        {groupedSubOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groupedSubOrders.map((group) => {
              const orderIdKey = group.order?._id || "unknown";
              const isCollapsed = collapsedGroups[orderIdKey] ?? false;
              const totalNetto = group.subOrders.reduce((sum, item) => sum + (item.valueNetto || 0), 0);

              return (
                <div key={orderIdKey} style={{ background: "#161b22", borderRadius: 10, border: "1px solid #30363d", overflow: "hidden" }}>
                  {/* NAGŁÓWEK GRUPY ZLECENIA */}
                  <div
                    onClick={() => toggleGroup(orderIdKey)}
                    style={{
                      background: "#1c2129",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      borderBottom: isCollapsed ? "none" : "1px solid #30363d",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {isCollapsed ? <ChevronRight size={18} color="#8b949e" /> : <ChevronDown size={18} color="#58a6ff" />}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 8 }}>
                          <span>Zlecenie: {group.order?.orderNumber || "Inne / Bez zlecenia"}</span>
                          <span style={{ fontSize: 12, color: "#8b949e", fontWeight: 400 }}>• Klient: {group.clientName}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ background: "#0d1117", border: "1px solid #30363d", padding: "2px 8px", borderRadius: 12, fontSize: 11, color: "#8b949e" }}>
                        {group.subOrders.length} {group.subOrders.length === 1 ? "zamówienie" : "zamówienia"}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#3fb950" }}>
                        Suma: {formatPLN(totalNetto)} PLN
                      </span>
                    </div>
                  </div>

                  {/* TABELA SUBORDERS W GRUPIE */}
                  {!isCollapsed && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#0d1117", borderBottom: "1px solid #30363d" }}>
                          <th style={{ padding: "10px 16px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>NR ZAMÓWIENIA</th>
                          <th style={{ padding: "10px 16px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>DOSTAWCA</th>
                          <th style={{ padding: "10px 16px", textAlign: "center", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>POZYCJE</th>
                          <th style={{ padding: "10px 16px", textAlign: "right", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>WARTOŚĆ NETTO</th>
                          <th style={{ padding: "10px 16px", textAlign: "center", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>STATUS</th>
                          <th style={{ padding: "10px 16px", textAlign: "right", color: "#8b949e", fontSize: 11, fontWeight: 600 }}>AKCJE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.subOrders.map((so) => {
                          const statusCfg = STATUS_CONFIG[so.status] || { label: so.status, color: "#8b949e", bg: "rgba(139,148,158,0.15)" };

                          return (
                            <tr
                              key={so._id}
                              style={{ borderBottom: "1px solid #21262d", transition: "background 0.12s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#1c2128")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              {/* NR ZAMÓWIENIA */}
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 600, color: "#58a6ff", fontSize: 13 }}>{so.orderNumber}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                                  {so.externalOrderNumber && (
                                    <span style={{ background: "#21262d", padding: "1px 5px", borderRadius: 3, color: "#c9d1d9", fontSize: 11 }}>
                                      Dostawca: #{so.externalOrderNumber}
                                    </span>
                                  )}
                                  {so.pickupDate && (
                                    <span style={{ background: "rgba(210,153,34,0.15)", border: "1px solid rgba(210,153,34,0.4)", padding: "1px 6px", borderRadius: 3, color: "#d29922", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                      <Calendar size={11} /> Odbiór: {so.pickupDate}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* DOSTAWCA */}
                              <td style={{ padding: "12px 16px" }}>
                                {so.supplier ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#c9d1d9", fontSize: 13 }}>
                                    <Building2 size={14} color="#58a6ff" />
                                    <span>{so.supplier.name}</span>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e", fontSize: 12 }}>
                                    <Home size={14} />
                                    <span>Realizacja wewnętrzna</span>
                                  </div>
                                )}
                              </td>

                              {/* LICZBA POZYCJI */}
                              <td style={{ padding: "12px 16px", textAlign: "center", color: "#c9d1d9", fontSize: 13 }}>
                                {so.itemsCount} {so.itemsCount === 1 ? "pozycja" : "pozycji"}
                              </td>

                              {/* WARTOŚĆ NETTO */}
                              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#f0f6fc", fontSize: 13 }}>
                                {formatPLN(so.valueNetto)} PLN
                              </td>

                              {/* STATUS */}
                              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 10px",
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: statusCfg.color,
                                    background: statusCfg.bg,
                                    border: `1px solid ${statusCfg.color}33`,
                                  }}
                                >
                                  {statusCfg.label}
                                </span>
                              </td>

                              {/* AKCJE */}
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewSubOrder(so)}
                                    style={{
                                      background: "#21262d",
                                      color: "#c9d1d9",
                                      border: "1px solid #30363d",
                                      padding: "5px 10px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                    title="Podgląd pozycji w panelu bocznym"
                                  >
                                    <Eye size={14} /> Podgląd
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => router.push(`/admin/zlecenia/${so.orderId}/zamowienia/${so._id}`)}
                                    style={{
                                      background: "#1f6feb",
                                      color: "#fff",
                                      border: "none",
                                      padding: "5px 10px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      cursor: "pointer",
                                      fontWeight: 600,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    Szczegóły <ArrowRight size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: "#161b22", padding: 48, borderRadius: 12, border: "1px solid #30363d", textAlign: "center" }}>
            <Package size={48} color="#8b949e" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ color: "#c9d1d9", fontSize: 16, marginBottom: 6 }}>Brak zamówień spełniających kryteria</h3>
            <p style={{ color: "#8b949e", fontSize: 13 }}>Spróbuj zmienić parametry wyszukiwania lub filtry.</p>
          </div>
        )}
      </div>

      {/* SIDE DRAWER - PODGLĄD ZAMÓWIENIA */}
      {previewSubOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.6)" }}>
          <div
            style={{
              width: 460,
              maxWidth: "100%",
              background: "#161b22",
              height: "100%",
              borderLeft: "1px solid #30363d",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 24px rgba(0,0,0,0.5)",
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: 20, borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#8b949e" }}>Podgląd zamówienia</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6fc", marginTop: 2 }}>{previewSubOrder.orderNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSubOrder(null)}
                style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: 20, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Metadane */}
              <div style={{ background: "#0d1117", padding: 14, borderRadius: 8, border: "1px solid #30363d", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#8b949e" }}>Zlecenie główne:</span>
                  <span style={{ color: "#58a6ff", fontWeight: 600 }}>{previewSubOrder.order?.orderNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#8b949e" }}>Klient:</span>
                  <span style={{ color: "#c9d1d9", fontWeight: 500 }}>{previewSubOrder.client?.name || previewSubOrder.order?.clientName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#8b949e" }}>Dostawca / Podwykonawca:</span>
                  <span style={{ color: "#c9d1d9", fontWeight: 500 }}>{previewSubOrder.supplier?.name || "Realizacja wewnętrzna"}</span>
                </div>
                {previewSubOrder.externalOrderNumber && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#8b949e" }}>Nr u dostawcy:</span>
                    <span style={{ color: "#3fb950", fontWeight: 600 }}>{previewSubOrder.externalOrderNumber}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, paddingTop: 6, borderTop: "1px solid #21262d" }}>
                  <span style={{ color: "#8b949e" }}>Termin odbioru:</span>
                  <div
                    onClick={(e) => {
                      const inputEl = e.currentTarget.querySelector("input");
                      if (inputEl && "showPicker" in inputEl) {
                        try { (inputEl as any).showPicker(); } catch (_) {}
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#161b22",
                      border: "1px solid #30363d",
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                  >
                    <Calendar size={15} color="#58a6ff" />
                    <input
                      type="date"
                      value={previewSubOrder.pickupDate || ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await updatePickupDate({ subOrderId: previewSubOrder._id, pickupDate: val || undefined });
                        setPreviewSubOrder({ ...previewSubOrder, pickupDate: val || undefined });
                        toast.success(val ? `Ustawiono termin odbioru: ${val}` : "Usunięto termin odbioru");
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: previewSubOrder.pickupDate ? "#f0f6fc" : "#8b949e",
                        fontSize: 12,
                        outline: "none",
                        cursor: "pointer",
                        colorScheme: "dark"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Status Change Pipeline */}
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 8, fontWeight: 600 }}>Zmiana statusu:</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {STATUS_ORDER.map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isCurrent = previewSubOrder.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={async () => {
                          await updateStatus({ subOrderId: previewSubOrder._id, status: st });
                          setPreviewSubOrder({ ...previewSubOrder, status: st });
                          toast.success(`Zmieniono status na ${cfg.label}`);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          cursor: isCurrent ? "default" : "pointer",
                          background: isCurrent ? cfg.color : "#0d1117",
                          color: isCurrent ? "#fff" : cfg.color,
                          border: `1px solid ${isCurrent ? cfg.color : "#30363d"}`,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista pozycji w drawerze */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#c9d1d9" }}>Pozycje w zamówieniu ({previewSubOrder.items.length}):</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#3fb950" }}>{formatPLN(previewSubOrder.valueNetto)} PLN</span>
                </div>

                {previewSubOrder.items.length > 0 ? (
                  <div style={{ background: "#0d1117", borderRadius: 8, border: "1px solid #30363d", overflow: "hidden" }}>
                    {previewSubOrder.items.map((item: any, idx: number) => (
                      <div
                        key={item._id}
                        style={{
                          padding: "10px 12px",
                          borderBottom: idx < previewSubOrder.items.length - 1 ? "1px solid #21262d" : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12
                        }}
                      >
                        <div style={{ color: "#c9d1d9", fontWeight: 500 }}>
                          <span style={{ color: "#8b949e", marginRight: 6 }}>{idx + 1}.</span>
                          {item.name}
                        </div>
                        <div style={{ color: "#f0f6fc", fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                          {formatPLN(item.priceNetto || 0)} PLN
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 20, textAlign: "center", color: "#8b949e", fontSize: 12, border: "1px dashed #30363d", borderRadius: 8 }}>
                    Brak pozycji w tym zamówieniu.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: 20, borderTop: "1px solid #30363d", background: "#1c2129" }}>
              <button
                type="button"
                onClick={() => {
                  const targetUrl = `/admin/zlecenia/${previewSubOrder.orderId}/zamowienia/${previewSubOrder._id}`;
                  setPreviewSubOrder(null);
                  router.push(targetUrl);
                }}
                style={{
                  width: "100%",
                  background: "#1f6feb",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                Otwórz pełne szczegóły <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - NOWE ZAMÓWIENIE PODWYKONAWCZE */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#161b22", width: 440, borderRadius: 12, border: "1px solid #30363d", padding: 24, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#f0f6fc", fontSize: 16 }}>Nowe zamówienie podwykonawcze</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Wybór Zlecenia */}
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6 }}>Wybierz zlecenie główne *</label>
                <select
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  style={{ width: "100%", background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}
                >
                  <option value="">-- Wybierz zlecenie --</option>
                  {allOrders.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.orderNumber} ({o.clientName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Wybór Dostawcy */}
              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6 }}>Wybierz dostawcę / podwykonawcę (opcjonalnie)</label>
                <select
                  value={newSupplierId}
                  onChange={(e) => setNewSupplierId(e.target.value)}
                  style={{ width: "100%", background: "#0d1117", color: "#c9d1d9", border: "1px solid #30363d", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}
                >
                  <option value="">Realizacja wewnętrzna (brak dostawcy)</option>
                  {allSuppliers.map((sup) => (
                    <option key={sup._id} value={sup._id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", color: "#c9d1d9", border: "1px solid #30363d", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleCreateSubOrder}
                style={{ background: "#238636", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                Utwórz zamówienie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

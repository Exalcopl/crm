"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  CheckCircle2,
  Clock,
  Check,
} from "lucide-react";

type SubOrderStatus = "utworzono" | "do_zamowienia" | "zamowiono" | "do_odbioru" | "odbior" | "zamkniete";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  utworzono:     { label: "Utworzono",     color: "#8b949e", bg: "rgba(139,148,158,0.15)" },
  do_zamowienia: { label: "Do zamówienia", color: "#f0883e", bg: "rgba(240,136,62,0.15)"  },
  zamowiono:     { label: "Zamówiono",     color: "#58a6ff", bg: "rgba(88,166,255,0.15)"  },
  do_odbioru:    { label: "Do odbioru",    color: "#a371f7", bg: "rgba(163,113,247,0.15)" },
  odbior:        { label: "Odbiór",        color: "#d29922", bg: "rgba(210,153,34,0.15)"  },
  zamkniete:     { label: "Zamknięte",     color: "#3fb950", bg: "rgba(63,185,80,0.15)"   },
};

const STATUS_ORDER: SubOrderStatus[] = ["utworzono", "do_zamowienia", "zamowiono", "do_odbioru", "odbior", "zamkniete"];

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ItemReceiptControl({
  item,
  onUpdate,
}: {
  item: any;
  onUpdate: (itemId: Id<"subOrderItems">, qty: number) => Promise<void>;
}) {
  const targetQty = item.quantity || 1;
  const initialRecQty = item.receivedQuantity ?? 0;
  const [val, setVal] = React.useState<number>(initialRecQty);

  React.useEffect(() => {
    setVal(item.receivedQuantity ?? 0);
  }, [item.receivedQuantity]);

  const handleSave = async (newQty: number) => {
    const clamped = Math.max(0, newQty);
    setVal(clamped);
    if (clamped !== (item.receivedQuantity ?? 0)) {
      try {
        await onUpdate(item._id, clamped);
        toast.success(
          clamped > 0 ? `Zapisano odbiór: ${clamped}/${targetQty} szt.` : "Cofnięto odbiór pozycji"
        );
      } catch (e: any) {
        toast.error("Błąd zapisu ilości");
      }
    }
  };

  const isFull = val >= targetQty;
  const isPartial = val > 0 && val < targetQty;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
      {/* Badge statusu */}
      {isFull ? (
        <span
          style={{
            background: "rgba(46, 160, 67, 0.15)",
            border: "1px solid rgba(46, 160, 67, 0.4)",
            color: "#3fb950",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
        >
          <CheckCircle2 size={12} /> Odebrano ({val}/{targetQty})
        </span>
      ) : isPartial ? (
        <span
          style={{
            background: "rgba(210, 153, 34, 0.15)",
            border: "1px solid rgba(210, 153, 34, 0.4)",
            color: "#d29922",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
        >
          <Clock size={12} /> Częściowo ({val}/{targetQty})
        </span>
      ) : (
        <span
          style={{
            background: "rgba(139, 148, 158, 0.1)",
            border: "1px solid #30363d",
            color: "#8b949e",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Oczekuje (0/{targetQty})
        </span>
      )}

      {/* Natywny Input Ilości i Przyciski Krokowe (- / +) */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 6,
          padding: "2px 4px",
          gap: 2,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (val > 0) handleSave(val - 1);
          }}
          disabled={val <= 0}
          style={{
            background: "transparent",
            color: val > 0 ? "#c9d1d9" : "#484f58",
            border: "none",
            width: 20,
            height: 20,
            borderRadius: 4,
            cursor: val > 0 ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Odejmij 1 szt."
        >
          -
        </button>

        <input
          type="number"
          min={0}
          max={targetQty * 2}
          value={val}
          onChange={(e) => setVal(parseInt(e.target.value, 10) || 0)}
          onBlur={() => handleSave(val)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSave(val);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 44,
            textAlign: "center",
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#f0f6fc",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 0",
            outline: "none",
          }}
          title="Wpisz bezpośrednio odebraną ilość"
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSave(val + 1);
          }}
          style={{
            background: "transparent",
            color: "#c9d1d9",
            border: "none",
            width: 20,
            height: 20,
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Dodaj 1 szt."
        >
          +
        </button>
      </div>

      {/* Przycisk Całość / Cofnij */}
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          const target = isFull ? 0 : targetQty;
          setVal(target);
          await onUpdate(item._id, target);
        }}
        style={{
          background: isFull ? "#21262d" : "#238636",
          color: "#fff",
          border: "none",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
        }}
        title={isFull ? "Cofnij odbiór" : "Odbierz 100% całości"}
      >
        <Check size={12} /> {isFull ? "Cofnij" : "Całość"}
      </button>
    </div>
  );
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
  const updateItemReceipt = useMutation(api.subOrders.updateItemReceipt);
  const markAllItemsReceived = useMutation(api.subOrders.markAllItemsReceived);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("utworzono");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");

  // Accordion collapsed state for order groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Drawer & Modal state
  const [selectedModalImage, setSelectedModalImage] = useState<{ url: string; name: string } | null>(null);
  const [previewSubOrder, setPreviewSubOrder] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [newSupplierId, setNewSupplierId] = useState<string>("");
  const [newExtOrderNum, setNewExtOrderNum] = useState<string>("");
  const [newPickupDate, setNewPickupDate] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");

  // Przefiltrowana lista zleceń w modalu tworzenia
  const filteredModalOrders = useMemo(() => {
    if (!orderSearchTerm.trim()) return allOrders;
    const q = orderSearchTerm.toLowerCase();
    return allOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        (o.clientEmail && o.clientEmail.toLowerCase().includes(q))
    );
  }, [allOrders, orderSearchTerm]);

  // Przefiltrowana lista dostawców w modalu
  const filteredModalSuppliers = useMemo(() => {
    if (!supplierSearchTerm.trim()) return allSuppliers;
    const q = supplierSearchTerm.toLowerCase();
    return allSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nip && s.nip.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q))
    );
  }, [allSuppliers, supplierSearchTerm]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleCreateSubOrder = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error("Wybierz przynajmniej jedno zlecenie główne");
      return;
    }

    try {
      const createdId = await createSubOrder({
        orderId: selectedOrderIds[0] as Id<"orders">,
        orderIds: selectedOrderIds as Id<"orders">[],
        supplierId: newSupplierId ? (newSupplierId as Id<"suppliers">) : undefined,
        externalOrderNumber: newExtOrderNum.trim() || undefined,
        pickupDate: newPickupDate || undefined,
        notes: newNotes.trim() || undefined,
      });

      toast.success(`Utworzono nowe zamówienie podwykonawcze dla ${selectedOrderIds.length} zleceń!`);
      setShowCreateModal(false);
      // Reset
      setSelectedOrderIds([]);
      setNewSupplierId("");
      setNewExtOrderNum("");
      setNewPickupDate("");
      setNewNotes("");
      router.push(`/admin/zlecenia/${selectedOrderIds[0]}/zamowienia/${createdId}`);
    } catch (e: any) {
      toast.error(e.message || "Nie udało się utworzyć zamówienia");
    }
  };

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

  // Expand state for sub-orders
  const [expandedSubOrders, setExpandedSubOrders] = useState<Record<string, boolean>>({});

  const toggleExpand = (subOrderId: string) => {
    setExpandedSubOrders((prev) => ({ ...prev, [subOrderId]: !prev[subOrderId] }));
  };

  return (
    <div className="fluent-layout" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", background: "#0d1117", color: "#c9d1d9" }}>
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

        {/* GŁÓWNA TABELA ZAMÓWIEŃ PODWYKONAWCZYCH (GRUPOWANE PO ZAMÓWIENIU) */}
        {filteredSubOrders.length > 0 ? (
          <div style={{ background: "#161b22", borderRadius: 10, border: "1px solid #30363d", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0d1117", borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "12px 10px", width: 32 }} />
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>NR ZAMÓWIENIA</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#f0f6fc", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>STATUS ZAMÓWIENIA</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#3fb950", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>POSTĘP ODBIORU</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#a371f7", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>TERMIN ODBIORU</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>DOSTAWCA / PODWYKONAWCA</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>WARTOŚĆ NETTO</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#6e7681", fontSize: 10, fontWeight: 500, textTransform: "uppercase" }}>Zlecenia główne</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>AKCJE</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubOrders.map((so) => {
                  const isExpanded = expandedSubOrders[so._id] ?? false;
                  const statusCfg = STATUS_CONFIG[so.status] || { label: so.status, color: "#8b949e", bg: "rgba(139,148,158,0.15)" };
                  const assignedOrders = so.orders && so.orders.length > 0 ? so.orders : (so.order ? [so.order] : []);

                  // Obliczenia postępu odbioru zamówienia
                  const totalOrdered = (so.items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
                  const totalReceived = (so.items || []).reduce((acc: number, item: any) => acc + (item.receivedQuantity || 0), 0);
                  const isCompletedStatus = so.status === "odbior" || so.status === "zamkniete";
                  const progressPct = isCompletedStatus ? 100 : totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                  const barColor = progressPct === 100 ? "#238636" : progressPct > 0 ? "#d29922" : "#30363d";
                  const textColor = progressPct === 100 ? "#3fb950" : progressPct > 0 ? "#e3b341" : "#8b949e";

                  return (
                    <React.Fragment key={so._id}>
                      <tr
                        style={{ borderBottom: "1px solid #21262d", background: isExpanded ? "#1c2129" : "transparent", transition: "background 0.12s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1c2129")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "#1c2129" : "transparent")}
                      >
                        {/* Expand toggle icon */}
                        <td style={{ padding: "12px 8px 12px 14px", cursor: "pointer", color: "#8b949e" }} onClick={() => toggleExpand(so._id)}>
                          {isExpanded ? <ChevronDown size={16} color="#58a6ff" /> : <ChevronRight size={16} />}
                        </td>

                        {/* NR ZAMÓWIENIA */}
                        <td style={{ padding: "12px 16px" }}>
                          <div
                            onClick={() => toggleExpand(so._id)}
                            style={{ fontWeight: 700, color: "#58a6ff", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <Package size={15} color="#58a6ff" />
                            {so.orderNumber}
                          </div>
                          {so.externalOrderNumber && (
                            <div style={{ marginTop: 2 }}>
                              <span style={{ background: "#21262d", border: "1px solid #30363d", padding: "1px 6px", borderRadius: 4, color: "#c9d1d9", fontSize: 11 }}>
                                Nr u dostawcy: #{so.externalOrderNumber}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* STATUS ZAMÓWIENIA (WYRÓŻNIONY) */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 14px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 800,
                              color: statusCfg.color,
                              background: statusCfg.bg,
                              border: `1px solid ${statusCfg.color}50`,
                              boxShadow: `0 2px 8px ${statusCfg.color}20`,
                              whiteSpace: "nowrap",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* POSTĘP ODBIORU (PROGRESSBAR W WIERSZU) */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: 120 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 11, fontWeight: 700, color: textColor, marginBottom: 4 }}>
                              <span>{totalReceived}/{totalOrdered} szt.</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div style={{ width: "100%", height: 7, background: "#0d1117", borderRadius: 4, overflow: "hidden", border: "1px solid #30363d" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${progressPct}%`,
                                  background: barColor,
                                  borderRadius: 4,
                                  transition: "width 0.4s ease"
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* TERMIN ODBIORU (WYRÓŻNIONY) */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {so.pickupDate ? (
                            <span
                              style={{
                                background: "rgba(163, 113, 247, 0.18)",
                                border: "1px solid rgba(163, 113, 247, 0.5)",
                                color: "#d8b4fe",
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                boxShadow: "0 2px 8px rgba(163,113,247,0.2)",
                              }}
                              title="Planowany termin odbioru od podwykonawcy"
                            >
                              <Calendar size={13} color="#c084fc" />
                              {so.pickupDate}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#6e7681", fontStyle: "italic" }}>—</span>
                          )}
                        </td>

                        {/* PODWYKONAWCA / DOSTAWCA */}
                        <td style={{ padding: "12px 16px" }}>
                          {so.supplier ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f0f6fc", fontSize: 13, fontWeight: 600 }}>
                              <Building2 size={15} color="#60a5fa" />
                              <span>{so.supplier.name}</span>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e", fontSize: 12 }}>
                              <Home size={14} />
                              <span>Realizacja wewnętrzna</span>
                            </div>
                          )}
                        </td>

                        {/* WARTOŚĆ NETTO */}
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#3fb950", fontSize: 14 }}>
                          {formatPLN(so.valueNetto)} PLN
                          <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 400 }}>{so.itemsCount} {so.itemsCount === 1 ? "pozycja" : "pozycji"}</div>
                        </td>

                        {/* PODPIĘTE ZLECENIA GŁÓWNE (STONOWANE) */}
                        <td style={{ padding: "12px 16px" }}>
                          {assignedOrders.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {assignedOrders.map((ord: any) => (
                                <Link
                                  key={ord._id}
                                  href={`/admin/zlecenia/${ord._id}`}
                                  style={{
                                    background: "#0d1117",
                                    border: "1px solid #30363d",
                                    color: "#8b949e",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 400,
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    transition: "all 0.1s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = "#58a6ff";
                                    e.currentTarget.style.color = "#58a6ff";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "#30363d";
                                    e.currentTarget.style.color = "#8b949e";
                                  }}
                                  title={`Zlecenie ${ord.orderNumber} (${ord.clientName})`}
                                >
                                  <span>{ord.orderNumber}</span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#484f58" }}>—</span>
                          )}
                        </td>

                        {/* AKCJE */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setPreviewSubOrder(so)}
                              style={{
                                background: "#21262d",
                                color: "#c9d1d9",
                                border: "1px solid #30363d",
                                padding: "5px 10px",
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontWeight: 600,
                              }}
                              title="Szybki podgląd w panelu bocznym"
                            >
                              <Eye size={13} /> Podgląd
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const targetOrderId = so.orderId || (so.orderIds && so.orderIds[0]);
                                if (targetOrderId) {
                                  router.push(`/admin/zlecenia/${targetOrderId}/zamowienia/${so._id}`);
                                } else {
                                  toast.error("Brak przypisanego zlecenia głównego");
                                }
                              }}
                              style={{
                                background: "#1f6feb",
                                color: "#fff",
                                border: "none",
                                padding: "5px 10px",
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                boxShadow: "0 2px 6px rgba(31,111,235,0.3)",
                              }}
                            >
                              Szczegóły <ArrowRight size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ROZWIJANA LISTA POZYCJI W ZAMÓWIENIU (INLINE ACCORDION) */}
                      {isExpanded && (
                        <tr style={{ background: "#0d1117" }}>
                          <td colSpan={9} style={{ padding: "12px 20px 16px 48px", borderBottom: "1px solid #30363d" }}>
                            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f6fc", display: "flex", alignItems: "center", gap: 8 }}>
                                  <Package size={15} color="#58a6ff" /> Pozycje zamówienia {so.orderNumber} ({so.items ? so.items.length : 0})
                                </div>
                                {so.status === "do_odbioru" && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await markAllItemsReceived({ subOrderId: so._id });
                                        toast.success("Odebrano wszystkie pozycje w zamówieniu!");
                                      } catch (e: any) {
                                        toast.error(e.message || "Błąd podczas odnotowywania odbioru");
                                      }
                                    }}
                                    style={{
                                      background: "rgba(46, 160, 67, 0.15)",
                                      border: "1px solid rgba(46, 160, 67, 0.4)",
                                      color: "#3fb950",
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      transition: "all 0.15s ease",
                                    }}
                                    title="Potwierdź odbiór wszystkich pozycji naraz"
                                  >
                                    <CheckCircle2 size={13} /> Potwierdź odbiór wszystkich pozycji
                                  </button>
                                )}
                              </div>

                              {so.items && so.items.length > 0 ? (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ background: "#0d1117", color: "#8b949e", fontSize: 11, borderBottom: "1px solid #21262d" }}>
                                      <th style={{ padding: "6px 10px", textAlign: "left" }}>Pozycja</th>
                                      <th style={{ padding: "6px 10px", textAlign: "center" }}>Ilość zamówiona</th>
                                      {(so.status === "do_odbioru" || so.status === "odbior" || so.status === "zamkniete") && (
                                        <th style={{ padding: "6px 10px", textAlign: "center" }}>Potwierdzenie Odbioru</th>
                                      )}
                                      <th style={{ padding: "6px 10px", textAlign: "right" }}>Cena Netto</th>
                                      <th style={{ padding: "6px 10px", textAlign: "right" }}>Wartość Netto</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {so.items.map((it: any, idx: number) => {
                                      const isReceiptActive = so.status === "do_odbioru" || so.status === "odbior" || so.status === "zamkniete";

                                      return (
                                        <tr key={it._id || idx} style={{ borderBottom: "1px solid #21262d" }}>
                                          <td style={{ padding: "8px 10px", color: "#f0f6fc", fontWeight: 600 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                              {it.imageUrl && (
                                                <div
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedModalImage({ url: it.imageUrl, name: it.name });
                                                  }}
                                                  title="Kliknij, aby powiększyć zdjęcie"
                                                  style={{ cursor: "pointer", flexShrink: 0, display: "inline-flex", transition: "transform 0.15s ease" }}
                                                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.12)")}
                                                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                                >
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img src={it.imageUrl} alt={it.name} style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", border: "1px solid #30363d" }} />
                                                </div>
                                              )}
                                              <span>{it.name}</span>
                                            </div>
                                          </td>
                                          <td style={{ padding: "8px 10px", textAlign: "center", color: "#c9d1d9" }}>
                                            {it.quantity} szt.
                                          </td>

                                          {/* STATUS I NATYWNA EDYCJA ODBIORU POZYCJI (TYLKO DLA STATUSÓW DO ODBIORU+) */}
                                          {isReceiptActive && (
                                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                              <div style={{ display: "flex", justifyContent: "center" }}>
                                                <ItemReceiptControl
                                                  item={it}
                                                  onUpdate={async (itemId, qty) => {
                                                    await updateItemReceipt({ itemId, receivedQuantity: qty });
                                                  }}
                                                />
                                              </div>
                                            </td>
                                          )}

                                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b949e" }}>
                                            {formatPLN(it.priceNetto || 0)} PLN
                                          </td>
                                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#3fb950", fontWeight: 700 }}>
                                            {formatPLN((it.priceNetto || 0) * (it.quantity || 1))} PLN
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ color: "#8b949e", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: 8 }}>
                                  Brak pozycji przypisanych do tego zamówienia.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
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
                    {previewSubOrder.items.map((item: any, idx: number) => {
                      const qty = item.quantity || 1;
                      const recQty = item.receivedQuantity ?? 0;
                      const isFull = recQty >= qty;
                      const isPartial = recQty > 0 && recQty < qty;

                      return (
                        <div
                          key={item._id}
                          style={{
                            padding: "10px 12px",
                            borderBottom: idx < previewSubOrder.items.length - 1 ? "1px solid #21262d" : "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "#c9d1d9", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#8b949e", flexShrink: 0 }}>{idx + 1}.</span>
                              {item.imageUrl && (
                                <div
                                  onClick={() => setSelectedModalImage({ url: item.imageUrl, name: item.name })}
                                  title="Kliknij, aby powiększyć zdjęcie"
                                  style={{ cursor: "pointer", flexShrink: 0, display: "inline-flex", transition: "transform 0.15s ease" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.12)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={item.imageUrl} alt={item.name} style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", border: "1px solid #30363d" }} />
                                </div>
                              )}
                              <span>{item.name}</span>
                            </div>
                            <div style={{ color: "#f0f6fc", fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                              {qty} szt. | {formatPLN(item.priceNetto || 0)} PLN
                            </div>
                          </div>

                          {/* Pasek statusu i natywny komponent odbioru w drawerze (TYLKO DLA STATUSÓW DO ODBIORU+) */}
                          {(previewSubOrder.status === "do_odbioru" || previewSubOrder.status === "odbior" || previewSubOrder.status === "zamkniete") && (
                            <div style={{ background: "#161b22", padding: "6px 10px", borderRadius: 6, border: "1px solid #21262d", display: "flex", justifyContent: "center" }}>
                              <ItemReceiptControl
                                item={item}
                                onUpdate={async (itemId, newQty) => {
                                  await updateItemReceipt({ itemId, receivedQuantity: newQty });
                                  setPreviewSubOrder({
                                    ...previewSubOrder,
                                    items: previewSubOrder.items.map((i: any) =>
                                      i._id === item._id
                                        ? {
                                            ...i,
                                            receivedQuantity: newQty,
                                            receivedStatus: newQty >= (i.quantity || 1) ? "received" : newQty > 0 ? "partial" : "pending",
                                          }
                                        : i
                                    ),
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
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

      {/* MODAL - NOWE ZAMÓWIENIE PODWYKONAWCZE (WIELOKROTNE ZLECENIA + SEARCH) */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div
            style={{
              background: "#161b22",
              width: 650,
              maxWidth: "100%",
              maxHeight: "90vh",
              borderRadius: 12,
              border: "1px solid #30363d",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            {/* Nagłówek Modala */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1c2129" }}>
              <div>
                <h3 style={{ margin: 0, color: "#f0f6fc", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Package size={20} color="#58a6ff" /> Nowe zamówienie podwykonawcze
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#8b949e", marginTop: 2 }}>
                  Możesz połączyć jedno zamówienie podwykonawcze z <b>wieloma zleceniami</b> naraz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Treść Modala z sekcjami */}
            <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
              
              {/* SEKACJA 1: WYBÓR ZLECEŃ (MULTI-SELECT Z WYSZUKIWARKĄ) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 700 }}>
                    1. Wybierz Zlecenia Główne ({selectedOrderIds.length} wybranych) *
                  </label>
                  {selectedOrderIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderIds([])}
                      style={{ background: "none", border: "none", color: "#f85149", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    >
                      Wyczyść wybór
                    </button>
                  )}
                </div>

                {/* Tagi wybranych zleceń */}
                {selectedOrderIds.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, background: "#0d1117", padding: 10, borderRadius: 8, border: "1px solid #30363d" }}>
                    {selectedOrderIds.map((id) => {
                      const ord = allOrders.find((o) => o._id === id);
                      return (
                        <span
                          key={id}
                          style={{
                            background: "rgba(88,166,255,0.15)",
                            border: "1px solid rgba(88,166,255,0.4)",
                            color: "#58a6ff",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {ord ? `${ord.orderNumber} (${ord.clientName})` : id}
                          <X
                            size={13}
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleOrderSelection(id)}
                          />
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Wyszukiwarka Zleceń */}
                <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 10px", marginBottom: 8 }}>
                  <Search size={15} color="#8b949e" style={{ marginRight: 6 }} />
                  <input
                    type="text"
                    placeholder="Szukaj zlecenia po numerze, kliencie..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#f0f6fc", fontSize: 12, padding: "8px 0", width: "100%", outline: "none" }}
                  />
                  {orderSearchTerm && (
                    <X size={14} color="#8b949e" style={{ cursor: "pointer" }} onClick={() => setOrderSearchTerm("")} />
                  )}
                </div>

                {/* Lista Zleceń do wyboru */}
                <div style={{ maxHeight: 160, overflowY: "auto", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredModalOrders.length > 0 ? (
                    filteredModalOrders.map((ord) => {
                      const isChecked = selectedOrderIds.includes(ord._id);
                      return (
                        <label
                          key={ord._id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: isChecked ? "rgba(88,166,255,0.1)" : "transparent",
                            border: isChecked ? "1px solid rgba(88,166,255,0.3)" : "1px solid transparent",
                            cursor: "pointer",
                            fontSize: 12,
                            color: "#c9d1d9",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOrderSelection(ord._id)}
                              style={{ accentColor: "#1f6feb", width: 15, height: 15, cursor: "pointer" }}
                            />
                            <div>
                              <span style={{ fontWeight: 700, color: "#f0f6fc", marginRight: 8 }}>{ord.orderNumber}</span>
                              <span style={{ color: "#8b949e" }}>• {ord.clientName}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: "#3fb950", fontWeight: 600 }}>{formatPLN(ord.valueNetto)} PLN</span>
                        </label>
                      );
                    })
                  ) : (
                    <div style={{ padding: 12, textAlign: "center", color: "#8b949e", fontSize: 12 }}>
                      Brak zleceń pasujących do frazy &quot;{orderSearchTerm}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* SEKCJA 2: WYBÓR DOSTAWCY / PODWYKONAWCY (NATYWNE PODPOWIEDZI DATALIST + INTERAKTYWNA WYSZUKIWARKA) */}
              <div>
                <label style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 700, display: "block", marginBottom: 8 }}>
                  2. Wybierz Dostawcę / Podwykonawcę
                </label>

                {/* Jeśli wybrano dostawcę */}
                {newSupplierId ? (
                  <div style={{ background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.4)", padding: "10px 14px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Building2 size={18} color="#60a5fa" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>
                          {allSuppliers.find((s) => s._id === newSupplierId)?.name || "Wybrany podwykonawca"}
                        </div>
                        <div style={{ fontSize: 11, color: "#93c5fd" }}>
                          {allSuppliers.find((s) => s._id === newSupplierId)?.nip ? `NIP: ${allSuppliers.find((s) => s._id === newSupplierId)?.nip}` : ''}
                          {allSuppliers.find((s) => s._id === newSupplierId)?.category ? ` • Kat: ${allSuppliers.find((s) => s._id === newSupplierId)?.category}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNewSupplierId(""); setSupplierSearchTerm(""); }}
                      style={{ background: "#21262d", border: "1px solid #30363d", color: "#f85149", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <X size={13} /> Zmień / Wyczyść
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Input z natywną listą podpowiedzi (HTML5 Datalist) */}
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "0 12px" }}>
                        <Search size={16} color="#60a5fa" style={{ marginRight: 8, flexShrink: 0 }} />
                        <input
                          type="text"
                          list="modal-suppliers-datalist"
                          placeholder="Wpisz lub wybierz podwykonawcę (np. Lakiernia, NIP, nazwa)..."
                          value={supplierSearchTerm}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSupplierSearchTerm(val);
                            // Sprawdź czy podano exact match z datalist lub nazwą
                            const matched = allSuppliers.find(
                              (s) => s.name.toLowerCase() === val.toLowerCase() || (s.nip && s.nip === val)
                            );
                            if (matched) {
                              setNewSupplierId(matched._id);
                            }
                          }}
                          style={{ background: "transparent", border: "none", color: "#f0f6fc", fontSize: 13, padding: "10px 0", width: "100%", outline: "none" }}
                        />
                        {supplierSearchTerm && (
                          <X size={14} color="#8b949e" style={{ cursor: "pointer" }} onClick={() => setSupplierSearchTerm("")} />
                        )}
                      </div>

                      {/* NATYWNY HTML5 DATALIST PREZENTUJĄCY PODPOWIEDZI BROWSERA */}
                      <datalist id="modal-suppliers-datalist">
                        <option value="Realizacja wewnętrzna (Brak podwykonawcy)" />
                        {allSuppliers.map((s) => (
                          <option key={s._id} value={s.name}>
                            {s.nip ? `NIP: ${s.nip}` : ''} {s.category ? `[${s.category}]` : ''} {s.email ? `(${s.email})` : ''}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    {/* INTERAKTYWNA LISTA KART DOSTAWCÓW DO KLIKNIĘCIA */}
                    <div style={{ maxHeight: 150, overflowY: "auto", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div
                        onClick={() => { setNewSupplierId(""); setSupplierSearchTerm(""); }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: newSupplierId === "" ? "rgba(96,165,250,0.1)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "#8b949e",
                          fontWeight: 600,
                        }}
                      >
                        🏠 Realizacja wewnętrzna (Brak podwykonawcy)
                      </div>

                      {filteredModalSuppliers.map((sup) => (
                        <div
                          key={sup._id}
                          onClick={() => {
                            setNewSupplierId(sup._id);
                            setSupplierSearchTerm(sup.name);
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: newSupplierId === sup._id ? "rgba(96,165,250,0.15)" : "#161b22",
                            border: "1px solid #30363d",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 12,
                            transition: "all 0.12s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Building2 size={15} color="#60a5fa" />
                            <div>
                              <span style={{ fontWeight: 700, color: "#f0f6fc", marginRight: 8 }}>{sup.name}</span>
                              {sup.nip && <span style={{ fontSize: 11, color: "#8b949e" }}>NIP: {sup.nip}</span>}
                            </div>
                          </div>
                          {sup.category && (
                            <span style={{ fontSize: 10, background: "#21262d", padding: "2px 6px", borderRadius: 4, color: "#93c5fd" }}>
                              {sup.category}
                            </span>
                          )}
                        </div>
                      ))}

                      {filteredModalSuppliers.length === 0 && supplierSearchTerm && (
                        <div style={{ padding: 10, textAlign: "center", color: "#8b949e", fontSize: 12 }}>
                          Nie znaleziono podwykonawcy dla &quot;{supplierSearchTerm}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SEKCJA 3: DANE ZAMÓWIENIA (NR U DOSTAWCY, ODBIÓR, UWAGI) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6 }}>Nr u dostawcy (opcjonalnie)</label>
                  <input
                    type="text"
                    placeholder="np. DOST/2026/102"
                    value={newExtOrderNum}
                    onChange={(e) => setNewExtOrderNum(e.target.value)}
                    style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6 }}>Planowany termin odbioru</label>
                  <input
                    type="date"
                    value={newPickupDate}
                    onChange={(e) => setNewPickupDate(e.target.value)}
                    style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none", colorScheme: "dark" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#8b949e", display: "block", marginBottom: 6 }}>Uwagi i wytyczne dla podwykonawcy</label>
                <textarea
                  rows={2}
                  placeholder="Uwagi do zlecenia, specyfikacja malowania / obróbki..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc", padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none", resize: "vertical" }}
                />
              </div>

            </div>

            {/* Stopka Modala */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #30363d", background: "#1c2129", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#8b949e" }}>
                Zaznaczono zleceń: <b style={{ color: "#58a6ff" }}>{selectedOrderIds.length}</b>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "transparent", color: "#c9d1d9", border: "1px solid #30363d", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubOrder}
                  disabled={selectedOrderIds.length === 0}
                  style={{
                    background: selectedOrderIds.length > 0 ? "#238636" : "#21262d",
                    color: selectedOrderIds.length > 0 ? "#fff" : "#8b949e",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: 6,
                    cursor: selectedOrderIds.length > 0 ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: 13,
                    boxShadow: selectedOrderIds.length > 0 ? "0 2px 8px rgba(35,134,54,0.3)" : "none",
                  }}
                >
                  Utwórz zamówienie ({selectedOrderIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PODGLĄDU ZDJĘCIA POZYCJI */}
      {selectedModalImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            animation: "fadeIn 0.15s ease",
          }}
          onClick={() => setSelectedModalImage(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 16, borderBottom: "1px solid #21262d", paddingBottom: 12 }}>
              <span style={{ fontWeight: 700, color: "#f0f6fc", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={18} color="#58a6ff" /> {selectedModalImage.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedModalImage(null)}
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f6fc")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#c9d1d9")}
              >
                <X size={16} /> Zamknij
              </button>
            </div>
            <div style={{ background: "#0d1117", borderRadius: 8, padding: 8, border: "1px solid #21262d", display: "grid", placeItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedModalImage.url}
                alt={selectedModalImage.name}
                style={{ maxWidth: "82vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 6 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


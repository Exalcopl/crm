"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { C, inputStyle } from "../../_components/ui";
import { Search, CheckCircle2, Building, RefreshCw, X } from "lucide-react";

interface OrderPickerProps {
  orderId?: Id<"orders">;
  orderNumber?: string;
  onChange: (order: { _id: Id<"orders">; orderNumber: string; clientName: string; status?: string } | null) => void;
  autoFocus?: boolean;
}

const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  nowe: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", label: "Nowe" },
  akceptacja: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", label: "Akceptacja" },
  kompletacja: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", label: "Kompletacja" },
  produkcja: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", label: "W produkcji" },
  montaz: { bg: "rgba(236, 72, 153, 0.15)", text: "#f472b6", label: "Montaż" },
  gotowe: { bg: "rgba(52, 211, 153, 0.2)", text: "#10b981", label: "Gotowe" },
  wstrzymane: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", label: "Wstrzymane" },
};

export function RwOrderPicker({
  orderId,
  orderNumber,
  onChange,
  autoFocus = false,
}: OrderPickerProps) {
  const [query, setQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawOrders = useQuery(api.orders.list, {}) ?? [];

  // Automatycznie dopasuj wybrane zlecenie z bazy lub po podanym ID/numerze
  const selectedOrder = useMemo(() => {
    if (!rawOrders.length) return null;
    if (orderId) {
      const found = rawOrders.find((o) => o._id === orderId);
      if (found) return found;
    }
    if (orderNumber) {
      const cleanNum = orderNumber.replace(/^#/, "").trim().toLowerCase();
      const found = rawOrders.find((o) => o.orderNumber.replace(/^#/, "").trim().toLowerCase() === cleanNum);
      if (found) return found;
    }
    return null;
  }, [rawOrders, orderId, orderNumber]);

  // Kiedy orderId jest ustawione z zewnątrz (np. URL param), ale onChange nie zostało jeszcze wywołane
  useEffect(() => {
    if (selectedOrder && (!orderId || !orderNumber)) {
      onChange({
        _id: selectedOrder._id,
        orderNumber: selectedOrder.orderNumber,
        clientName: selectedOrder.clientName,
        status: selectedOrder.status,
      });
    }
  }, [selectedOrder, orderId, orderNumber, onChange]);

  useEffect(() => {
    if (autoFocus && !selectedOrder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, selectedOrder]);

  // Filtrowanie listy zleceń
  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    if (!q) {
      // Domyślnie na górze zlecenia w toku (produkcja, kompletacja, nowe)
      return [...rawOrders].sort((a, b) => {
        const priorityOrder: Record<string, number> = { produkcja: 1, kompletacja: 2, nowe: 3, akceptacja: 4, montaz: 5 };
        const pA = priorityOrder[a.status] ?? 99;
        const pB = priorityOrder[b.status] ?? 99;
        return pA - pB;
      }).slice(0, 30);
    }

    return rawOrders
      .filter((o) => {
        const num = o.orderNumber.toLowerCase().replace(/^#/, "");
        const client = (o.clientName ?? "").toLowerCase();
        return num.includes(q) || client.includes(q);
      })
      .slice(0, 30);
  }, [rawOrders, query]);

  // Jeśli zlecenie jest wybrane i nie jesteśmy w trybie zmiany zlecenia
  if (selectedOrder && !isEditing) {
    const st = ORDER_STATUS_COLORS[selectedOrder.status] ?? {
      bg: "rgba(255,255,255,0.08)",
      text: "#c9d1d9",
      label: selectedOrder.status,
    };

    return (
      <div
        style={{
          background: "rgba(59, 130, 246, 0.08)",
          border: "1px solid #3b82f6",
          borderRadius: 8,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(59, 130, 246, 0.2)",
              color: "#60a5fa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            #
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#60a5fa",
                }}
              >
                {selectedOrder.orderNumber}
              </span>
              <span
                style={{
                  background: st.bg,
                  color: st.text,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {st.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.text,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
              <Building size={13} color={C.muted} />
              <span style={{ fontWeight: 500 }}>{selectedOrder.clientName}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            setQuery("");
          }}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: `1px solid ${C.border}`,
            color: C.text,
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={13} />
          <span>Zmień zlecenie</span>
        </button>
      </div>
    );
  }

  // Widok wyboru / wyszukiwania zlecenia
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <Search
          size={16}
          color={C.muted}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          ref={inputRef}
          style={{
            ...inputStyle,
            paddingLeft: 36,
            paddingRight: isEditing ? 32 : 12,
            height: 40,
            fontSize: 13,
          }}
          placeholder="Wyszukaj zlecenie: wpisz nr zlecenia (np. ST-) lub nazwę klienta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredOrders.length > 0) {
              e.preventDefault();
              const pick = filteredOrders[0];
              onChange({
                _id: pick._id,
                orderNumber: pick.orderNumber,
                clientName: pick.clientName,
                status: pick.status,
              });
              setIsEditing(false);
              setQuery("");
            } else if (e.key === "Escape" && selectedOrder) {
              setIsEditing(false);
            }
          }}
        />
        {isEditing && selectedOrder && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              padding: 4,
            }}
            title="Anuluj zmianę"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          background: "#12161c",
          maxHeight: 240,
          overflowY: "auto",
        }}
      >
        {filteredOrders.length === 0 ? (
          <div style={{ padding: "16px 20px", color: C.muted, fontSize: 13, textAlign: "center" }}>
            {query.trim()
              ? `Nie znaleziono zlecenia pasującego do „${query}”`
              : "Brak aktywnych zleceń produkcyjnych w systemie"}
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isCurrent = selectedOrder?._id === ord._id;
            const st = ORDER_STATUS_COLORS[ord.status] ?? {
              bg: "rgba(255,255,255,0.08)",
              text: "#c9d1d9",
              label: ord.status,
            };

            return (
              <div
                key={ord._id}
                onClick={() => {
                  onChange({
                    _id: ord._id,
                    orderNumber: ord.orderNumber,
                    clientName: ord.clientName,
                    status: ord.status,
                  });
                  setIsEditing(false);
                  setQuery("");
                }}
                style={{
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: isCurrent ? "rgba(59, 130, 246, 0.12)" : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: isCurrent ? "#60a5fa" : C.text,
                      fontSize: 13,
                    }}
                  >
                    {ord.orderNumber}
                  </span>
                  <span style={{ color: C.muted, fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 13, color: isCurrent ? "#ffffff" : C.text, fontWeight: 500 }}>
                    {ord.clientName}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      background: st.bg,
                      color: st.text,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {st.label}
                  </span>
                  {isCurrent && <CheckCircle2 size={16} color="#3b82f6" />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

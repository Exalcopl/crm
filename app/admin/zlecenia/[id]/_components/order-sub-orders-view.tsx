"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { Package, Plus, ChevronDown, ChevronRight, Building2, Home, FileText } from "lucide-react";
import Link from "next/link";

type SubOrderStatus = "utworzono" | "do_zamowienia" | "zamowiono" | "odbior" | "zamkniete";

const STATUS_CONFIG: Record<SubOrderStatus, { label: string; color: string; bg: string }> = {
  utworzono:     { label: "Utworzono",     color: "#8b949e", bg: "rgba(139,148,158,0.15)" },
  do_zamowienia: { label: "Do zamówienia", color: "#f0883e", bg: "rgba(240,136,62,0.15)" },
  zamowiono:     { label: "Zamówiono",     color: "#58a6ff", bg: "rgba(88,166,255,0.15)"  },
  odbior:        { label: "Odbiór",        color: "#d29922", bg: "rgba(210,153,34,0.15)"  },
  zamkniete:     { label: "Zamknięte",     color: "#3fb950", bg: "rgba(63,185,80,0.15)"   },
};

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  todo:        { label: "Do zrobienia", color: "#8b949e" },
  in_progress: { label: "W trakcie",    color: "#d29922"  },
  done:        { label: "Zrobione",     color: "#3fb950"  },
};

function StatusBadge({ status }: { status: SubOrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.utworzono;
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 600,
      padding: "2px 10px",
      borderRadius: 12,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function ExpandableRow({ so, orderId }: { so: Doc<"subOrders"> & { items?: any[]; supplier?: any }, orderId: Id<"orders"> }) {
  const [expanded, setExpanded] = useState(false);
  const fullData = useQuery(api.subOrders.get, expanded ? { subOrderId: so._id } : "skip");
  const supplierData = useQuery(api.suppliers.get, so.supplierId ? { id: so.supplierId } : "skip");

  const items = fullData?.items ?? [];
  const supplier = fullData?.supplier || supplierData;
  // Fallback dla starych statusów które mogą być jeszcze w bazie
  const status: SubOrderStatus = (STATUS_CONFIG[so.status as SubOrderStatus] ? so.status : "utworzono") as SubOrderStatus;
  const cfg = STATUS_CONFIG[status];

  return (
    <>
      {/* Główny wiersz */}
      <tr
        onClick={() => setExpanded(v => !v)}
        style={{
          cursor: "pointer",
          borderBottom: "1px solid #21262d",
          background: expanded ? "#1c2028" : "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#1c2028")}
        onMouseLeave={e => (e.currentTarget.style.background = expanded ? "#1c2028" : "transparent")}
      >
        {/* Expand toggle */}
        <td style={{ padding: "10px 8px 10px 16px", width: 32, color: "#8b949e" }}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </td>

        {/* Numer zamówienia */}
        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#58a6ff", fontSize: 14 }}>
          {so.orderNumber}
        </td>

        {/* Status pipeline */}
        <td style={{ padding: "10px 12px" }}>
          <StatusPipeline status={status} />
        </td>

        {/* Dostawca badge */}
        <td style={{ padding: "10px 12px" }}>
          {so.supplierId ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(88,166,255,0.1)", color: "#58a6ff",
              border: "1px solid rgba(88,166,255,0.25)", borderRadius: 8,
              padding: "3px 10px", fontSize: 13, fontWeight: 500,
            }}>
              <Building2 size={13} />
              {supplier?.name || "Ładowanie..."}
            </span>
          ) : (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(139,148,158,0.1)", color: "#8b949e",
              border: "1px solid rgba(139,148,158,0.2)", borderRadius: 8,
              padding: "3px 10px", fontSize: 13, fontWeight: 500,
            }}>
              <Home size={13} />
              Realizacja wewnętrzna
            </span>
          )}
        </td>

        {/* Data utworzenia */}
        <td style={{ padding: "10px 12px", color: "#8b949e", fontSize: 13 }}>
          {new Date(so.createdAt).toLocaleDateString("pl-PL")}
        </td>

        {/* Liczba pozycji */}
        <td style={{ padding: "10px 12px", textAlign: "center" }}>
          <span style={{ fontSize: 13, color: "#c9d1d9" }}>
            {expanded ? items.length : "—"}
          </span>
        </td>

        {/* Link do szczegółów */}
        <td style={{ padding: "10px 16px 10px 12px", textAlign: "right" }}>
          <Link
            href={`/admin/zlecenia/${orderId}/zamowienia/${so._id}`}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 12, color: "#8b949e", textDecoration: "none",
              border: "1px solid #30363d", borderRadius: 6, padding: "4px 10px",
              background: "transparent", display: "inline-flex", alignItems: "center", gap: 6,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "#c9d1d9";
              (e.currentTarget as HTMLElement).style.borderColor = "#58a6ff";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "#8b949e";
              (e.currentTarget as HTMLElement).style.borderColor = "#30363d";
            }}
          >
            <FileText size={14} />
            Szczegóły
          </Link>
        </td>
      </tr>

      {/* Rozwinięte pozycje */}
      {expanded && (
        <tr style={{ background: "#0d1117" }}>
          <td colSpan={7} style={{ padding: 0 }}>
            {fullData === undefined ? (
              <div style={{ padding: "12px 48px", color: "#8b949e", fontSize: 13 }}>Ładowanie pozycji...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: "12px 48px", color: "#8b949e", fontSize: 13 }}>Brak pozycji w tym zamówieniu.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#161b22" }}>
                    <th style={{ width: 32 }} />
                    <th style={{ padding: "6px 12px 6px 48px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Usługa / Produkt</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Start</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Koniec</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Powiązanie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => {
                    const itemCfg = ITEM_STATUS[item.status] ?? ITEM_STATUS.todo;
                    const parent = items.find((i: any) => i._id === item.dependsOn);
                    return (
                      <tr key={item._id} style={{ borderBottom: "1px solid #21262d" }}>
                        <td style={{ width: 32 }} />
                        <td style={{ padding: "8px 12px 8px 48px", color: "#c9d1d9", fontSize: 13 }}>{item.name}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 12, color: itemCfg.color, fontWeight: 600 }}>● {itemCfg.label}</span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#8b949e", fontSize: 12 }}>{item.startDate}</td>
                        <td style={{ padding: "8px 12px", color: "#8b949e", fontSize: 12 }}>{item.endDate}</td>
                        <td style={{ padding: "8px 12px", color: "#8b949e", fontSize: 12 }}>
                          {parent ? <span style={{ color: "#f0883e" }}>→ po: {parent.name}</span> : "—"}
                        </td>
                        <td />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusPipeline({ status }: { status: SubOrderStatus }) {
  const statuses = Object.keys(STATUS_CONFIG) as SubOrderStatus[];
  const currentIdx = statuses.indexOf(status);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {statuses.map((s, idx) => {
        const cfg = STATUS_CONFIG[s];
        const done = idx < currentIdx;
        const current = idx === currentIdx;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: current ? cfg.color : done ? cfg.color : "#21262d",
              border: `2px solid ${current || done ? cfg.color : "#30363d"}`,
              boxShadow: current ? `0 0 6px ${cfg.color}` : "none",
              transition: "all 0.2s",
            }} title={cfg.label} />
            {idx < statuses.length - 1 && (
              <div style={{
                width: 18, height: 2,
                background: done ? STATUS_CONFIG[statuses[idx + 1]].color : "#21262d",
                transition: "background 0.2s",
              }} />
            )}
          </div>
        );
      })}
      <span style={{ marginLeft: 8, fontSize: 12, color: (STATUS_CONFIG[status] ?? STATUS_CONFIG.utworzono).color, fontWeight: 600 }}>
        {(STATUS_CONFIG[status] ?? STATUS_CONFIG.utworzono).label}
      </span>
    </div>
  );
}

export function OrderSubOrdersView({ orderId }: { orderId: Id<"orders"> }) {
  const subOrders = useQuery(api.subOrders.listForOrder, { orderId });

  if (subOrders === undefined) {
    return <div style={{ color: "#8b949e" }}>Ładowanie zamówień...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, color: "#c9d1d9", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <Package size={20} />
          Zamówienia Podwykonawcze / Outsourcing
        </h2>
        <Link
          href={`/admin/zlecenia/${orderId}/zamowienia/nowe`}
          style={{
            background: "#238636", color: "#fff",
            padding: "7px 14px", borderRadius: 6,
            fontSize: 13, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 6,
            textDecoration: "none",
          }}
        >
          <Plus size={15} /> Utwórz zamówienie
        </Link>
      </div>

      {subOrders.length === 0 ? (
        <div style={{ background: "#161b22", padding: 32, borderRadius: 8, border: "1px solid #30363d", textAlign: "center" }}>
          <Package size={32} style={{ color: "#8b949e", margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#8b949e", fontSize: 14, margin: 0 }}>
            Brak zamówień przypisanych do tego zlecenia.
          </p>
        </div>
      ) : (
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1f242c", borderBottom: "1px solid #30363d" }}>
                <th style={{ width: 32 }} />
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Nr zamówienia</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Dostawca</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Data</th>
                <th style={{ padding: "10px 12px", textAlign: "center", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Pozycji</th>
                <th style={{ padding: "10px 16px", textAlign: "right", color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {subOrders.map(so => (
                <ExpandableRow key={so._id} so={so as any} orderId={orderId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

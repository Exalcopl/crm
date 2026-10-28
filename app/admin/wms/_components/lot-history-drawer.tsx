"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtDate, fmtNum } from "./ui";
import { X, ExternalLink } from "lucide-react";

export interface SiblingLotDef {
  _id: Id<"wms_lots">;
  locationCode: string;
  zone?: string;
  quantityPieces: number;
  status: string;
  unit?: string;
}

interface LotHistoryDrawerProps {
  materialId?: Id<"materials">;
  lotId?: Id<"wms_lots">;
  onClose: () => void;
  siblingLots?: SiblingLotDef[];
}

export function LotHistoryDrawer({ materialId, lotId, onClose }: LotHistoryDrawerProps) {
  const [activeLotFilter, setActiveLotFilter] = useState<Id<"wms_lots"> | "ALL">("ALL");

  const data = useQuery(api.wms.lotHistory, {
    materialId,
    lotId,
  });

  // Zamknięcie po naciśnięciu Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Blokowanie scrollowania tła
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const lot = data?.lot;
  const allLots = data?.lots ?? [];
  const rawMovements = data?.movements ?? [];

  const movements = useMemo(() => {
    if (activeLotFilter === "ALL") return rawMovements;
    return rawMovements.filter((m) => m.lotId === activeLotFilter);
  }, [rawMovements, activeLotFilter]);

  const totalStock = data?.totalAvailablePieces ?? lot?.quantityPieces ?? 0;
  const unit = lot?.unit || "szt.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        animation: "lotDrawerFadeIn 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes lotDrawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lotDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div
        style={{
          width: 540,
          maxWidth: "100%",
          background: "#0d1117",
          height: "100%",
          borderLeft: "1px solid #21262d",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.4)",
          animation: "lotDrawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── HEADER ──────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #21262d",
            background: "#0d1117",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#f0f6fc",
                  letterSpacing: "-0.01em",
                }}
              >
                {lot?.materialName ?? "Wczytywanie…"}
              </h2>
              {lot?.materialSku && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "#8b949e",
                  }}
                >
                  {lot.materialSku}
                </span>
              )}
            </div>

            <div style={{ marginTop: 4, fontSize: 12, color: "#8b949e" }}>
              {lot?.categoryName && <span>{lot.categoryName}</span>}
              {lot?.objectName && <span> • {lot.objectName}</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              borderRadius: 6,
              padding: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f0f6fc";
              e.currentTarget.style.background = "#21262d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#8b949e";
              e.currentTarget.style.background = "transparent";
            }}
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── SUMMARY BAR ─────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #21262d",
            background: "#161b22",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Stan magazynowy
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f6fc", marginTop: 2 }}>
              {fmtNum(totalStock)} <span style={{ fontSize: 14, fontWeight: 400, color: "#8b949e" }}>{unit}</span>
            </div>
          </div>

          {allLots.length > 1 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#8b949e" }}>Dostawy / partie</div>
              <div style={{ fontSize: 13, color: "#c9d1d9", marginTop: 2, fontWeight: 500 }}>
                {allLots.length} {allLots.length < 5 ? "dostawy" : "dostaw"}
              </div>
            </div>
          )}
        </div>

        {/* ─── FILTER TABS (TYLKO JEŚLI JEST WIĘCEJ NIŻ 1 PARTIA) ───────────── */}
        {allLots.length > 1 && (
          <div
            style={{
              padding: "10px 24px",
              borderBottom: "1px solid #21262d",
              background: "#0d1117",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveLotFilter("ALL")}
              style={{
                background: activeLotFilter === "ALL" ? "#21262d" : "transparent",
                color: activeLotFilter === "ALL" ? "#f0f6fc" : "#8b949e",
                border: "1px solid",
                borderColor: activeLotFilter === "ALL" ? "#30363d" : "transparent",
                borderRadius: 5,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              Wszystkie ({rawMovements.length})
            </button>
            {allLots.map((l, i) => (
              <button
                key={l._id}
                type="button"
                onClick={() => setActiveLotFilter(l._id)}
                style={{
                  background: activeLotFilter === l._id ? "#21262d" : "transparent",
                  color: activeLotFilter === l._id ? "#f0f6fc" : "#8b949e",
                  border: "1px solid",
                  borderColor: activeLotFilter === l._id ? "#30363d" : "transparent",
                  borderRadius: 5,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                Partia {i + 1} ({fmtNum(l.quantityPieces)} {unit})
              </button>
            ))}
          </div>
        )}

        {/* ─── TIMELINE / MOVEMENTS FEED ───────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 24px",
          }}
        >
          {!data ? (
            <div style={{ padding: 32, textAlign: "center", color: "#8b949e", fontSize: 13 }}>
              Ładowanie historii…
            </div>
          ) : movements.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b949e", fontSize: 13 }}>
              Brak zarejestrowanych operacji dla tej pozycji.
            </div>
          ) : (
            <div>
              {movements.map((m) => {
                const isPositive = m.quantityDelta > 0;
                const isNegative = m.quantityDelta < 0;

                return (
                  <div
                    key={m._id}
                    style={{
                      padding: "16px 0",
                      borderBottom: "1px solid #1c2128",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    {/* LEWA KOLUMNA: Typ, Dokument, Szczegóły */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: m.type === "PZ" ? "#1b2d23" : "#1f242c",
                            color: m.type === "PZ" ? "#3fb950" : "#c9d1d9",
                            border: `1px solid ${m.type === "PZ" ? "#23422e" : "#30363d"}`,
                          }}
                        >
                          {m.type}
                        </span>

                        {m.documentNumber && (
                          m.documentId ? (
                            <Link
                              href={`/admin/wms/${(m.documentType ?? m.type).toLowerCase()}/${m.documentId}`}
                              style={{
                                fontSize: 12,
                                fontFamily: "monospace",
                                color: "#c9d1d9",
                                fontWeight: 500,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#58a6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#c9d1d9")}
                            >
                              <span>{m.documentNumber}</span>
                              <ExternalLink size={10} style={{ opacity: 0.6 }} />
                            </Link>
                          ) : (
                            <span style={{ fontSize: 12, fontFamily: "monospace", color: "#8b949e" }}>
                              {m.documentNumber}
                            </span>
                          )
                        )}
                      </div>

                      {/* Zlecenie CRM powiązane z RW */}
                      {(m.orderId || m.orderNumber) && (
                        <div style={{ marginTop: 2 }}>
                          <Link
                            href={m.orderId ? `/admin/zlecenia/${m.orderId}` : `/admin/zlecenia`}
                            style={{
                              fontSize: 12,
                              color: "#58a6ff",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >
                            <span>
                              Zlecenie {m.orderNumber}
                              {m.clientName ? ` • ${m.clientName}` : ""}
                            </span>
                            <ExternalLink size={11} />
                          </Link>
                        </div>
                      )}

                      {/* Data i operator */}
                      <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                        {fmtDate(m.createdAt)}
                        {m.operatorName ? ` • ${m.operatorName}` : ""}
                      </div>

                      {/* Opcjonalna uwaga */}
                      {m.note && !((m.orderId || m.orderNumber) && m.note.startsWith("Zlecenie:")) && (
                        <div style={{ fontSize: 11, color: "#8b949e", fontStyle: "italic", marginTop: 2 }}>
                          {m.note}
                        </div>
                      )}
                    </div>

                    {/* PRAWA KOLUMNA: Ilość */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: "monospace",
                          color: isPositive ? "#3fb950" : isNegative ? "#f85149" : "#c9d1d9",
                        }}
                      >
                        {isPositive ? `+${fmtNum(m.quantityDelta)}` : fmtNum(m.quantityDelta)} {unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

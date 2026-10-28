"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  C,
  fmtDate,
  fmtMb,
  fmtKg,
  fmtNum,
  MOVEMENT_LABEL,
  SURFACE_LABEL,
  ZONE_LABEL,
  Badge,
} from "./ui";
import {
  X,
  ArrowRight,
  Clock,
  User,
  FileText,
  MapPin,
  Layers,
  Box,
  History,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(3px)",
        animation: "lotDrawerFadeIn 0.2s ease-out",
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
          width: 580,
          maxWidth: "100%",
          background: "#111419",
          height: "100%",
          borderLeft: "1px solid #282e37",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
          animation: "lotDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── DRAWER HEADER ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 20px 14px",
            borderBottom: "1px solid #21262d",
            background: "#14181f",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History size={17} color="#60a5fa" />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#8b949e",
                }}
              >
                Dziennik ruchów magazynowych
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #30363d",
                color: "#c9d1d9",
                borderRadius: 6,
                padding: "4px 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#21262d";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#c9d1d9";
              }}
              aria-label="Zamknij podgląd historii"
            >
              <X size={15} />
              <span>Zamknij</span>
            </button>
          </div>

          {lot ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f0f6fc" }}>
                  {lot.materialName}
                </h2>
                {lot.materialSku && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#c9d1d9",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    SKU: {lot.materialSku}
                  </span>
                )}
                <Badge status={lot.status} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12 }}>
                <span style={{ color: "#8b949e" }}>Grupa:</span>
                <span style={{ color: "#c9d1d9", fontWeight: 600 }}>{lot.categoryName ?? "—"}</span>
                {lot.objectName && (
                  <>
                    <span style={{ color: "#484f58" }}>•</span>
                    <span
                      style={{
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "#60a5fa",
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {lot.objectName}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: "#8b949e", fontSize: 13 }}>Wczytywanie pozycji…</div>
          )}
        </div>

        {/* ─── DRAWER BODY ────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {!data ? (
            <div style={{ padding: 24, textAlign: "center", color: "#8b949e", fontSize: 13 }}>
              Ładowanie pełnej historii ruchów…
            </div>
          ) : (
            <>
              {/* Karta bieżącego stanu pozycji */}
              <div
                style={{
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#8b949e",
                    marginBottom: 10,
                  }}
                >
                  Bieżący stan magazynowy
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: allLots.length > 1 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "#8b949e" }}>Łączna dostępna ilość</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#58a6ff", marginTop: 2 }}>
                      {fmtNum(data?.totalAvailablePieces ?? lot?.quantityPieces ?? 0)} {lot?.unit || "szt."}
                    </div>
                    {Boolean(lot?.totalMb && lot.totalMb > 0) && (
                      <div style={{ fontSize: 11, color: "#8b949e" }}>{fmtMb(lot!.totalMb)}</div>
                    )}
                    {Boolean(lot?.weightKg && lot.weightKg > 0) && (
                      <div style={{ fontSize: 11, color: "#8b949e" }}>{fmtKg(lot!.weightKg)}</div>
                    )}
                  </div>

                  {allLots.length > 1 && (
                    <div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>Partie w magazynie</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#c9d1d9", marginTop: 4 }}>
                        {allLots.length} {allLots.length === 1 ? "partia" : allLots.length < 5 ? "partie" : "partii"}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, color: "#8b949e" }}>Status</div>
                    <div style={{ marginTop: 4 }}>
                      <Badge status={lot?.status ?? "AVAILABLE"} />
                    </div>
                  </div>
                </div>

                {/* Parametry i cechy partii */}
                {(lot?.surfaceType || lot?.colorCode || lot?.heatNumber || lot?.ssccCode) && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid #21262d",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    {lot.surfaceType && (
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#c9d1d9",
                        }}
                      >
                        <span style={{ color: "#8b949e" }}>Powierzchnia:</span>{" "}
                        <b>{SURFACE_LABEL[lot.surfaceType] ?? lot.surfaceType}</b>
                      </span>
                    )}
                    {lot.colorCode && (
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#c9d1d9",
                        }}
                      >
                        <span style={{ color: "#8b949e" }}>Kolor:</span> <b>{lot.colorCode}</b>
                      </span>
                    )}
                    {lot.heatNumber && (
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#c9d1d9",
                        }}
                      >
                        <span style={{ color: "#8b949e" }}>Partia / Wytop:</span> <b>{lot.heatNumber}</b>
                      </span>
                    )}
                    {lot.ssccCode && (
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#c9d1d9",
                        }}
                      >
                        <span style={{ color: "#8b949e" }}>SSCC:</span> <b>{lot.ssccCode}</b>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Dziennik ruchów (Traceability) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f6fc" }}>
                    Dziennik zdarzeń i wydań ({movements.length})
                  </div>
                  <div style={{ fontSize: 11, color: "#8b949e" }}>
                    Traceability przyjęć i rozchodów
                  </div>
                </div>

                {/* Filtr partii jeśli jest ich więcej niż jedna */}
                {allLots.length > 1 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setActiveLotFilter("ALL")}
                      style={{
                        background: activeLotFilter === "ALL" ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        color: activeLotFilter === "ALL" ? "#60a5fa" : "#8b949e",
                        border: `1px solid ${activeLotFilter === "ALL" ? "#3b82f6" : "#30363d"}`,
                        borderRadius: 4,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Wszystkie operacje ({rawMovements.length})
                    </button>
                    {allLots.map((l, i) => (
                      <button
                        key={l._id}
                        type="button"
                        onClick={() => setActiveLotFilter(l._id)}
                        style={{
                          background: activeLotFilter === l._id ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          color: activeLotFilter === l._id ? "#60a5fa" : "#8b949e",
                          border: `1px solid ${activeLotFilter === l._id ? "#3b82f6" : "#30363d"}`,
                          borderRadius: 4,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Partia {i + 1} ({l.quantityPieces} {l.unit})
                      </button>
                    ))}
                  </div>
                )}

                {movements.length === 0 ? (
                  <div
                    style={{
                      background: "#161b22",
                      border: "1px dashed #30363d",
                      borderRadius: 8,
                      padding: 24,
                      textAlign: "center",
                      color: "#8b949e",
                      fontSize: 13,
                    }}
                  >
                    Brak zarejestrowanych ruchów dla tej pozycji.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {movements.map((m, idx) => {
                      const isPZ = m.type === "PZ";
                      const isRW = m.type === "RW";
                      const isMM = m.type === "MM";
                      const isKorekta = m.type === "KOREKTA";

                      const typeColor = isPZ
                        ? "#3fb950"
                        : isRW
                        ? "#58a6ff"
                        : isMM
                        ? "#d29922"
                        : isKorekta
                        ? "#bc8cff"
                        : "#8b949e";

                      const typeBg = isPZ
                        ? "rgba(63, 185, 80, 0.12)"
                        : isRW
                        ? "rgba(88, 166, 255, 0.12)"
                        : isMM
                        ? "rgba(210, 153, 34, 0.12)"
                        : isKorekta
                        ? "rgba(188, 140, 255, 0.12)"
                        : "rgba(255, 255, 255, 0.06)";

                      return (
                        <div
                          key={m._id}
                          style={{
                            background: "#161b22",
                            border: "1px solid #30363d",
                            borderRadius: 8,
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            position: "relative",
                          }}
                        >
                          {/* Górny pasek ruchu: Typ operacji, data, zmiana ilości */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  background: typeBg,
                                  color: typeColor,
                                  border: `1px solid ${typeColor}33`,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                {MOVEMENT_LABEL[m.type] ?? m.type}
                              </span>

                              {m.documentNumber && (
                                m.documentId ? (
                                  <Link
                                    href={`/admin/wms/${(m.documentType ?? m.type).toLowerCase()}/${m.documentId}`}
                                    style={{
                                      fontSize: 12,
                                      fontFamily: "monospace",
                                      color: "#58a6ff",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      textDecoration: "underline",
                                    }}
                                  >
                                    <FileText size={13} />
                                    <span>{m.documentNumber}</span>
                                    <ExternalLink size={11} />
                                  </Link>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontFamily: "monospace",
                                      color: "#58a6ff",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <FileText size={13} />
                                    {m.documentNumber}
                                  </span>
                                )
                              )}
                            </div>

                            {/* Zmiana ilości */}
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {m.quantityDelta === 0 ? (
                                <span style={{ color: "#d29922" }}>przesunięcie</span>
                              ) : m.quantityDelta > 0 ? (
                                <span style={{ color: "#3fb950" }}>
                                  +{m.quantityDelta} {lot?.unit || "szt."}
                                </span>
                              ) : (
                                <span style={{ color: "#f85149" }}>
                                  {m.quantityDelta} {lot?.unit || "szt."}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* CTA do powiązanego zlecenia CRM */}
                          {(m.orderId || m.orderNumber) && (
                            <Link
                              href={m.orderId ? `/admin/zlecenia/${m.orderId}` : `/admin/zlecenia`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "rgba(59, 130, 246, 0.12)",
                                border: "1px solid rgba(59, 130, 246, 0.35)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                color: "#60a5fa",
                                textDecoration: "none",
                                fontSize: 12,
                                fontWeight: 600,
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    background: "#1f6feb",
                                    color: "#ffffff",
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  Zlecenie: {m.orderNumber}
                                </span>
                                {m.clientName && (
                                  <span style={{ color: "#c9d1d9", fontWeight: 400 }}>
                                    {m.clientName}
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#60a5fa",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span>Przejdź do zlecenia w CRM</span>
                                <ExternalLink size={12} />
                              </span>
                            </Link>
                          )}

                          {/* Przepływ lokalizacji (Z -> Do) - opcjonalne w MVP */}
                          {Boolean(m.fromCode || m.toCode) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                background: "rgba(0, 0, 0, 0.25)",
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: "1px solid #21262d",
                              }}
                            >
                              <span style={{ color: "#8b949e" }}>Trasa:</span>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  color: m.fromCode ? "#c9d1d9" : "#484f58",
                                  fontWeight: 500,
                                }}
                              >
                                {m.fromCode || "—"}
                              </span>
                              <ArrowRight size={13} color="#8b949e" />
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  color: m.toCode ? "#3fb950" : "#484f58",
                                  fontWeight: 700,
                                }}
                              >
                                {m.toCode || "—"}
                              </span>
                            </div>
                          )}

                          {/* Stopka wpisu: Data, Operator, Uwagi */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: 11,
                              color: "#8b949e",
                              paddingTop: 4,
                              borderTop: "1px solid #21262d",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={12} />
                              <span>{fmtDate(m.createdAt)}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <User size={12} />
                              <span>{m.operatorName}</span>
                            </div>
                          </div>

                          {m.note && !((m.orderId || m.orderNumber) && m.note.startsWith("Zlecenie:")) && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#8b949e",
                                fontStyle: "italic",
                                background: "rgba(255, 255, 255, 0.02)",
                                padding: "4px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Uwaga: {m.note}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

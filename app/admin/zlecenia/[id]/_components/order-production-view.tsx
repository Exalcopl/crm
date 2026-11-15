"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function formatPLN(val: number): string {
  return val.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface OrderProductionViewProps {
  orderId: Id<"orders">;
  orderNumber: string;
  orderValueNetto: number;
  customLabel?: string;
}

export function OrderProductionView({
  orderId,
  orderNumber,
  orderValueNetto,
  customLabel,
}: OrderProductionViewProps) {
  const data = useQuery(api.wms.listOrderWmsRw, { orderId });

  const approvedDocuments = useMemo(() => {
    if (!data) return [];
    return data.documents.filter((d) => d.status === "ZATWIERDZONY");
  }, [data]);

  const materialCosts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        sku: string | null;
        objectName: string | null;
        unit: string;
        unitPrice: number;
        totalPieces: number;
        totalCost: number;
        issuesCount: number;
      }
    >();

    for (const doc of approvedDocuments) {
      for (const line of doc.lines) {
        const key = line.materialSku || line.materialName;
        const ex = map.get(key);
        if (ex) {
          ex.totalPieces += line.quantityPieces;
          ex.totalCost = Math.round((ex.totalCost + line.totalCost) * 100) / 100;
          ex.issuesCount += 1;
        } else {
          map.set(key, {
            key,
            name: line.materialName,
            sku: line.materialSku,
            objectName: line.objectName,
            unit: line.unit,
            unitPrice: line.unitPrice,
            totalPieces: line.quantityPieces,
            totalCost: line.totalCost,
            issuesCount: 1,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost || b.totalPieces - a.totalPieces);
  }, [approvedDocuments]);

  if (data === undefined) {
    return (
      <div style={{ padding: 40, color: "#8b949e", textAlign: "center", fontSize: 13 }}>
        Wczytywanie kosztów produkcji z dokumentów RW…
      </div>
    );
  }

  const totalCostIssued = data.totalCostIssued ?? 0;
  const totalPiecesIssued = data.totalPiecesIssued ?? 0;
  const unpricedLinesCount = data.unpricedLinesCount ?? 0;
  const marginNetto = Math.round((orderValueNetto - totalCostIssued) * 100) / 100;
  const marginPercent =
    orderValueNetto > 0 ? Math.round(((orderValueNetto - totalCostIssued) / orderValueNetto) * 1000) / 10 : null;
  const costSharePercent =
    orderValueNetto > 0 ? Math.round((totalCostIssued / orderValueNetto) * 1000) / 10 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Nagłówek sekcji */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f0f6fc" }}>
              Koszty produkcji (RW z magazynu WMS)
            </h2>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "#8b949e",
                background: "#161b22",
                border: "1px solid #21262d",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {orderNumber}
            </span>
            {customLabel && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ffd33d",
                  background: "rgba(210, 153, 34, 0.14)",
                  border: "1px solid rgba(210, 153, 34, 0.35)",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {customLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>
            Rzeczywiste koszty materiałów pobranych na produkcję z zatwierdzonych dokumentów RW (wg cen katalogowych w Indeksach WMS).
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/admin/wms/indeksy"
            className="fluent-btn"
            style={{ textDecoration: "none", fontSize: 12, padding: "6px 12px" }}
          >
            Cennik indeksów WMS ↗
          </Link>
          <Link
            href={`/admin/wms/rw?orderId=${orderId}`}
            className="fluent-btn fluent-btn-primary"
            style={{ textDecoration: "none", fontSize: 12, padding: "6px 12px" }}
          >
            + Wystaw RW w WMS
          </Link>
        </div>
      </div>

      {/* Karty KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Koszt materiałów z RW (netto)
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#f85149",
              fontFamily: "monospace",
              marginTop: 6,
            }}
          >
            {formatPLN(totalCostIssued)} PLN
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
            {approvedDocuments.length}{" "}
            {approvedDocuments.length === 1
              ? "dokument RW"
              : approvedDocuments.length < 5
                ? "dokumenty RW"
                : "dokumentów RW"}{" "}
            • łącznie {totalPiecesIssued} jedn.
          </div>
        </div>

        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Wartość zlecenia (netto)
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#f0f6fc",
              fontFamily: "monospace",
              marginTop: 6,
            }}
          >
            {formatPLN(orderValueNetto)} PLN
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
            Przychód ze zlecenia w CRM
          </div>
        </div>

        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Pozostało po kosztach RW (Marża)
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: marginNetto >= 0 ? "#3fb950" : "#f85149",
              fontFamily: "monospace",
              marginTop: 6,
            }}
          >
            {formatPLN(marginNetto)} PLN
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
            {marginPercent !== null ? `Marża materiałowa: ${marginPercent}%` : "Brak wpisanej wartości zlecenia"}
          </div>
        </div>

        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Udział kosztów RW w zleceniu
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#58a6ff",
              fontFamily: "monospace",
              marginTop: 6,
            }}
          >
            {costSharePercent !== null ? `${costSharePercent}%` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
            {materialCosts.length} {materialCosts.length === 1 ? "unikalny indeks" : "unikalnych indeksów"}
          </div>
        </div>
      </div>

      {/* Ostrzeżenie o brakujących cenach katalogowych */}
      {unpricedLinesCount > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            padding: "10px 14px",
            background: "rgba(210, 153, 34, 0.1)",
            border: "1px solid rgba(210, 153, 34, 0.35)",
            borderRadius: 8,
            fontSize: 12,
            color: "#e3b341",
          }}
        >
          <span>
            Uwaga: <strong>{unpricedLinesCount}</strong>{" "}
            {unpricedLinesCount === 1 ? "wydana pozycja RW nie ma" : "wydane pozycje RW nie mają"} uzupełnionej ceny
            katalogowej netto (0,00 PLN) w kartotece indeksów.
          </span>
          <Link
            href="/admin/wms/indeksy"
            style={{
              color: "#ffd33d",
              fontWeight: 600,
              textDecoration: "underline",
              whiteSpace: "nowrap",
            }}
          >
            Uzupełnij ceny w /admin/wms/indeksy →
          </Link>
        </div>
      )}

      {approvedDocuments.length === 0 ? (
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc" }}>
            Brak zatwierdzonych wydań RW dla tego zlecenia
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", marginTop: 6, marginBottom: 16 }}>
            Gdy magazyn wyda materiały na to zlecenie (skanerem lub w panelu WMS), koszty pojawią się tutaj automatycznie.
          </div>
          <Link
            href={`/admin/wms/rw?orderId=${orderId}`}
            className="fluent-btn fluent-btn-primary"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            + Wystaw pierwsze RW w WMS
          </Link>
        </div>
      ) : (
        <>
          {/* Tabela 1: Zestawienie kosztów wg indeksu */}
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #21262d",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f6fc" }}>
                Zestawienie kosztów zużytych materiałów ({materialCosts.length})
              </span>
              <span style={{ fontSize: 12, color: "#8b949e" }}>
                Ceny wg kartoteki indeksów WMS
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      background: "#0d1117",
                      borderBottom: "1px solid #21262d",
                      color: "#8b949e",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      Indeks / Materiał
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      System / Podgrupa
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      Wydania
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      Zużyta ilość
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      Cena katalogowa netto
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      Koszt netto
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        textAlign: "right",
                        width: 110,
                      }}
                    >
                      Udział
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materialCosts.map((m) => {
                    const share =
                      totalCostIssued > 0 ? Math.round((m.totalCost / totalCostIssued) * 1000) / 10 : 0;
                    return (
                      <tr key={m.key} style={{ borderBottom: "1px solid #1c2128", color: "#f0f6fc" }}>
                        <td style={{ padding: "11px 16px" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            {m.sku && (
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#58a6ff",
                                }}
                              >
                                {m.sku}
                              </span>
                            )}
                            <span style={{ fontWeight: 600 }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 16px", color: "#8b949e", fontSize: 12 }}>
                          {m.objectName ?? "—"}
                        </td>
                        <td style={{ padding: "11px 16px", color: "#8b949e", fontSize: 12 }}>
                          {m.issuesCount}×
                        </td>
                        <td
                          style={{
                            padding: "11px 16px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontWeight: 600,
                          }}
                        >
                          {m.totalPieces} {m.unit}
                        </td>
                        <td
                          style={{
                            padding: "11px 16px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {m.unitPrice > 0 ? (
                            <span style={{ color: "#c9d1d9" }}>
                              {formatPLN(m.unitPrice)} PLN / {m.unit}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "#e3b341",
                                background: "rgba(210, 153, 34, 0.12)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              0,00 PLN (brak ceny)
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "11px 16px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: m.totalCost > 0 ? "#f85149" : "#8b949e",
                          }}
                        >
                          {formatPLN(m.totalCost)} PLN
                        </td>
                        <td
                          style={{
                            padding: "11px 16px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#8b949e",
                          }}
                        >
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#0d1117", borderTop: "1px solid #21262d", fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: "12px 16px", color: "#f0f6fc" }}>
                      RAZEM KOSZT MATERIAŁÓW (RW)
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#f0f6fc",
                      }}
                    >
                      {totalPiecesIssued} jedn.
                    </td>
                    <td style={{ padding: "12px 16px" }} />
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontSize: 14,
                        color: "#f85149",
                      }}
                    >
                      {formatPLN(totalCostIssued)} PLN
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#8b949e",
                      }}
                    >
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabela 2: Dokumenty RW z wyceną pozycji */}
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #21262d",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f6fc" }}>
                Dokumenty wydania RW przypisane do zlecenia ({approvedDocuments.length})
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      background: "#0d1117",
                      borderBottom: "1px solid #21262d",
                      color: "#8b949e",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      Dokument RW
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      Data i operator
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                      Pozycje i wycena
                    </th>
                    <th
                      style={{
                        padding: "10px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      Koszt dokumentu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDocuments.map((doc) => (
                    <tr key={doc._id} style={{ borderBottom: "1px solid #1c2128", color: "#f0f6fc" }}>
                      <td style={{ padding: "12px 16px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                        <Link
                          href={`/admin/wms/rw/${doc._id}`}
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#58a6ff",
                            textDecoration: "none",
                          }}
                        >
                          {doc.number}
                        </Link>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          verticalAlign: "top",
                          color: "#8b949e",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div>
                          {new Date(doc.approvedAt ?? doc.createdAt).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: "#6e7681", marginTop: 2 }}>{doc.createdByName}</div>
                      </td>
                      <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {doc.lines.map((l, i) => (
                            <div
                              key={l._id || i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: 12,
                                fontSize: 12,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                                {l.materialSku && (
                                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#58a6ff" }}>
                                    {l.materialSku}
                                  </span>
                                )}
                                <span style={{ color: "#f0f6fc", fontWeight: 500 }}>{l.materialName}</span>
                                {l.objectName && <span style={{ color: "#8b949e" }}>• {l.objectName}</span>}
                              </div>
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  color: "#8b949e",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {l.quantityPieces} {l.unit} × {formatPLN(l.unitPrice)} PLN ={" "}
                                <strong style={{ color: "#f0f6fc" }}>{formatPLN(l.totalCost)} PLN</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          verticalAlign: "top",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: "#f85149",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPLN(doc.totalCost)} PLN
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

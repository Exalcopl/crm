"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Card, Empty, fmtKg, fmtMb, fmtNum, inputStyle, Page, Table, Td, Tr, C, ZONE_LABEL } from "../_components/ui";
import { LotHistory } from "../_components/lot-history";

/**
 * Komponent paska postępu dostępności dla danego indeksu lub pozycji magazynowej.
 * Wizualizuje stosunek ilości dostępnej (na magazynie głównym) do ilości w toku (w buforze) oraz stan wyczerpania.
 */
function AvailabilityProgressBar({
  available,
  inProgress,
  total,
  unit = "szt.",
}: {
  available: number;
  inProgress: number;
  total: number;
  unit?: string;
}) {
  const availPct = total > 0 ? Math.min(100, Math.round((available / total) * 100)) : 0;
  const inProgPct = total > 0 ? Math.min(100 - availPct, Math.round((inProgress / total) * 100)) : 0;

  const isAllAvailable = availPct === 100;
  const isDepleted = total === 0 || (available === 0 && inProgress === 0);
  const isPartiallyAvailable = availPct > 0 && availPct < 100;

  const barColor = isDepleted
    ? C.muted
    : isAllAvailable
    ? C.green
    : isPartiallyAvailable
    ? C.accent
    : C.amber;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 150, maxWidth: 210 }}>
      {/* Licznik i procent dostępności */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: barColor, letterSpacing: "0.01em" }}>
          {isDepleted ? "0% brak" : `${availPct}% dostępne`}
        </span>
        <span style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>
          {fmtNum(available)} / {fmtNum(total)} {unit}
        </span>
      </div>

      {/* Wizualny pasek postępu (dwukolorowy dla magazynu i bufora) */}
      <div
        style={{
          height: 6,
          background: "rgba(255, 255, 255, 0.08)",
          borderRadius: 3,
          overflow: "hidden",
          display: "flex",
          width: "100%",
        }}
        title={`Dostępne na magazynie: ${available} ${unit} (${availPct}%)\nW toku w buforze: ${inProgress} ${unit} (${inProgPct}%)`}
      >
        {availPct > 0 && (
          <div
            style={{
              width: `${availPct}%`,
              background: "linear-gradient(90deg, #10b981, #059669)",
              height: "100%",
              borderRadius: inProgPct === 0 ? 3 : "3px 0 0 3px",
              transition: "width 0.3s ease",
            }}
          />
        )}
        {inProgPct > 0 && (
          <div
            style={{
              width: `${inProgPct}%`,
              background: "linear-gradient(90deg, #3b82f6, #2563eb)",
              height: "100%",
              borderRadius: availPct === 0 ? 3 : "0 3px 3px 0",
              transition: "width 0.3s ease",
            }}
          />
        )}
      </div>

      {/* Legenda stref */}
      <div style={{ display: "flex", gap: 8, fontSize: 10, color: C.muted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
          Magazyn: <b style={{ color: C.text, fontWeight: 500 }}>{fmtNum(available)}</b>
        </span>
        {inProgress > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
            Bufor: <b style={{ color: "#93c5fd", fontWeight: 500 }}>{fmtNum(inProgress)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

export default function StanyPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [includeDepleted, setIncludeDepleted] = useState(false);
  const [groupByIndex, setGroupByIndex] = useState(true);
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const lots = useQuery(api.wms.listLots, {
    locationId: locationId ? (locationId as Id<"wms_locations">) : undefined,
    status: status || undefined,
    includeDepleted,
  });
  const locations = useQuery(api.wms.listLocations, {});
  const categories = useQuery(api.wms.listCategories, {});

  // Filtrowanie bazowych pozycji
  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (lots ?? []).filter((l) => {
      const matchesQ =
        !q ||
        l.materialName.toLowerCase().includes(q) ||
        (l.materialSku ?? "").toLowerCase().includes(q) ||
        (l.categoryName ?? "").toLowerCase().includes(q) ||
        (l.objectName ?? "").toLowerCase().includes(q) ||
        (l.colorCode ?? "").toLowerCase().includes(q) ||
        (l.locationName ?? "").toLowerCase().includes(q) ||
        (l.locationCode ?? "").toLowerCase().includes(q);

      const matchesCat =
        !categoryId ||
        l.categoryId === categoryId ||
        l.categoryCode === categoryId;

      return matchesQ && matchesCat;
    });
  }, [lots, search, categoryId]);

  // Agregacja wg indeksów (artykułów towarowych)
  const groupedIndexRows = useMemo(() => {
    if (!groupByIndex) return [];

    const map = new Map<string, {
      key: string;
      materialId: Id<"materials">;
      materialName: string;
      materialSku?: string;
      categoryName: string;
      objectName: string;
      unit: string;
      dimensionsSummary: string;
      colorCode?: string;
      surfaceType?: string;
      totalPieces: number;
      availablePieces: number;
      inProgressPieces: number;
      totalMb: number;
      totalWeightKg: number;
      locations: Array<{
        locationId: Id<"wms_locations">;
        locationCode: string;
        locationName: string;
        zone?: string;
        quantity: number;
        status: string;
      }>;
      lots: NonNullable<typeof lots>;
    }>();

    for (const l of filteredLots) {
      // Klucz unikalnego indeksu wraz z ewentualnym wariantem wymiarowym/kolorystycznym
      const key = `${l.materialId}_${l.dimensionsSummary}_${l.colorCode ?? ""}_${l.surfaceType ?? ""}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          materialId: l.materialId,
          materialName: l.materialName,
          materialSku: l.materialSku,
          categoryName: l.categoryName,
          objectName: l.objectName,
          unit: l.unit,
          dimensionsSummary: l.dimensionsSummary,
          colorCode: l.colorCode,
          surfaceType: l.surfaceType,
          totalPieces: 0,
          availablePieces: 0,
          inProgressPieces: 0,
          totalMb: 0,
          totalWeightKg: 0,
          locations: [],
          lots: [],
        };
        map.set(key, group);
      }

      group.totalPieces += l.quantityPieces;
      if (l.status === "AVAILABLE") {
        group.availablePieces += l.quantityPieces;
      } else if (l.status === "IN_PROGRESS") {
        group.inProgressPieces += l.quantityPieces;
      }
      group.totalMb += l.totalMb ?? 0;
      group.totalWeightKg += l.weightKg ?? 0;

      // Zapis lokalizacji
      const existingLoc = group.locations.find((loc) => loc.locationId === l.locationId && loc.status === l.status);
      if (existingLoc) {
        existingLoc.quantity += l.quantityPieces;
      } else {
        group.locations.push({
          locationId: l.locationId,
          locationCode: l.locationCode,
          locationName: l.locationName,
          zone: l.zone,
          quantity: l.quantityPieces,
          status: l.status,
        });
      }

      group.lots.push(l);
    }

    return Array.from(map.values());
  }, [filteredLots, groupByIndex]);

  // Statystyki sumaryczne
  const totals = useMemo(() => {
    const totalP = filteredLots.reduce((s, l) => s + l.quantityPieces, 0);
    const availP = filteredLots.filter((l) => l.status === "AVAILABLE").reduce((s, l) => s + l.quantityPieces, 0);
    const inProgP = filteredLots.filter((l) => l.status === "IN_PROGRESS").reduce((s, l) => s + l.quantityPieces, 0);
    const totalMb = filteredLots.reduce((s, l) => s + (l.totalMb ?? 0), 0);
    const totalKg = filteredLots.reduce((s, l) => s + (l.weightKg ?? 0), 0);

    const uniqueMats = new Set(filteredLots.map((l) => l.materialId)).size;

    return {
      totalPieces: totalP,
      availablePieces: availP,
      inProgressPieces: inProgP,
      mb: totalMb,
      kg: totalKg,
      uniqueMaterials: uniqueMats,
      totalPositions: filteredLots.length,
    };
  }, [filteredLots]);

  return (
    <Page
      title="Stany magazynowe"
      subtitle={`${totals.uniqueMaterials} indeksów · ${fmtNum(totals.totalPieces)} szt.${totals.mb > 0 ? ` · ${fmtMb(totals.mb)}` : ""}`}
    >
      {/* Pasek wyszukiwania i filtrów */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 240, width: "auto" }}
          placeholder="Szukaj: indeks, SKU, grupa towarowa, system/podgrupa, kolor, lokalizacja…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, width: "auto" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Wszystkie grupy towarowe</option>
          {(categories ?? []).map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Wszystkie lokalizacje</option>
          {(locations ?? []).map((l) => (
            <option key={l._id} value={l._id}>{l.name}</option>
          ))}
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Wszystkie statusy</option>
          <option value="AVAILABLE">Tylko dostępne</option>
          <option value="IN_PROGRESS">W toku (bufor)</option>
        </select>

        {/* Przełącznik widoku: Wg indeksów vs Szczegółowy */}
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
          <button
            type="button"
            onClick={() => setGroupByIndex(true)}
            style={{
              background: groupByIndex ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: groupByIndex ? "#60a5fa" : C.muted,
              border: "none",
              borderRadius: 4,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: groupByIndex ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Widok indeksów
          </button>
          <button
            type="button"
            onClick={() => setGroupByIndex(false)}
            style={{
              background: !groupByIndex ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: !groupByIndex ? "#60a5fa" : C.muted,
              border: "none",
              borderRadius: 4,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: !groupByIndex ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Wszystkie pozycje
          </button>
        </div>

        <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={includeDepleted} onChange={(e) => setIncludeDepleted(e.target.checked)} />
          pokaż wyczerpane
        </label>
      </div>

      {/* Główna tabela stanów magazynowych */}
      <Card pad={false}>
        {!lots ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Ładowanie stanów magazynowych…</div>
        ) : filteredLots.length === 0 ? (
          <Empty title="Brak pozycji na stanie" text="Przyjmij towar dokumentem PZ, aby pojawił się na stanie magazynu." />
        ) : groupByIndex ? (
          /* Widok zagregowany per INDEKS TOWAROWY */
          <Table headers={["Indeks towarowy", "Grupa / System", "Parametry i Cechy", "Lokalizacja", "Dostępność", "Ilość na stanie", "Status"]}>
            {groupedIndexRows.map((row) => {
              const isOpen = openRowKey === row.key;
              const hasDimensions = row.dimensionsSummary && row.dimensionsSummary !== "—";
              const hasColor = Boolean(row.colorCode || row.surfaceType);

              const statusBadge =
                row.totalPieces === 0
                  ? "DEPLETED"
                  : row.availablePieces === row.totalPieces
                  ? "AVAILABLE"
                  : row.inProgressPieces === row.totalPieces
                  ? "IN_PROGRESS"
                  : "AVAILABLE";

              return (
                <Fragment key={row.key}>
                  <Tr onClick={() => setOpenRowKey(isOpen ? null : row.key)}>
                    {/* 1. Indeks towarowy */}
                    <Td>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{row.materialName}</div>
                      {row.materialSku && (
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
                          SKU: {row.materialSku}
                        </div>
                      )}
                    </Td>

                    {/* 2. Grupa / System */}
                    <Td>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{row.categoryName}</div>
                      <span
                        style={{
                          fontSize: 10,
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "#60a5fa",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontWeight: 600,
                          display: "inline-block",
                          marginTop: 2,
                        }}
                      >
                        {row.objectName}
                      </span>
                    </Td>

                    {/* 3. Parametry i Cechy (uniwersalna kolumna dla wszystkich indeksów) */}
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {hasDimensions && (
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: C.text }}>
                            📏 {row.dimensionsSummary}
                          </span>
                        )}
                        {hasColor && (
                          <span style={{ fontSize: 11, color: C.muted }}>
                            🎨 {row.colorCode ?? ""} {row.surfaceType ? `(${row.surfaceType})` : ""}
                          </span>
                        )}
                        {!hasDimensions && !hasColor && (
                          <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                            Standard
                          </span>
                        )}
                      </div>
                    </Td>

                    {/* 4. Lokalizacja */}
                    <Td>
                      {row.locations.length === 1 ? (
                        <div>
                          <span style={{ fontFamily: "monospace", fontWeight: 500, color: C.text }}>
                            {row.locations[0].locationCode}
                          </span>
                          {row.locations[0].zone && (
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {ZONE_LABEL[row.locations[0].zone] ?? row.locations[0].zone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>
                            {row.locations.length} lokalizacje:
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                            {row.locations.map((loc, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 10,
                                  fontFamily: "monospace",
                                  background: "rgba(255,255,255,0.06)",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  color: C.muted,
                                }}
                              >
                                {loc.locationCode} ({loc.quantity})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Td>

                    {/* 5. Progress bar dostępności */}
                    <Td>
                      <AvailabilityProgressBar
                        available={row.availablePieces}
                        inProgress={row.inProgressPieces}
                        total={row.totalPieces}
                        unit={row.unit}
                      />
                    </Td>

                    {/* 6. Łączna ilość na stanie */}
                    <Td nowrap>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        {fmtNum(row.totalPieces)} {row.unit}
                      </div>
                      {row.totalMb > 0 && (
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {fmtMb(row.totalMb)}
                        </div>
                      )}
                      {row.totalWeightKg > 0 && (
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {fmtKg(row.totalWeightKg)}
                        </div>
                      )}
                    </Td>

                    {/* 7. Status */}
                    <Td>
                      <Badge
                        status={statusBadge}
                        label={
                          row.totalPieces === 0
                            ? "Wyczerpany"
                            : row.availablePieces === row.totalPieces
                            ? "Dostępny"
                            : row.inProgressPieces === row.totalPieces
                            ? "W realizacji"
                            : "Częściowo w toku"
                        }
                      />
                    </Td>
                  </Tr>

                  {/* Rozwinięcie szczegółów indeksu i historii */}
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div style={{ padding: "16px 20px", background: "rgba(255, 255, 255, 0.02)", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                              Szczegółowe rozmieszczenie pozycji w magazynie: {row.materialName}
                            </div>
                            <div style={{ fontSize: 11, color: C.muted }}>
                              Kliknij w daną pozycję, aby zobaczyć pełną historię przesunięć (traceability)
                            </div>
                          </div>

                          <Table headers={["Lokalizacja", "Strefa", "Ilość", "Stan / Dostępność", "Akcja"]}>
                            {row.lots.map((lot) => (
                              <Tr key={lot._id}>
                                <Td mono style={{ fontWeight: 600, color: C.text }}>
                                  {lot.locationCode}
                                </Td>
                                <Td muted>
                                  {lot.zone ? ZONE_LABEL[lot.zone] ?? lot.zone : "—"}
                                </Td>
                                <Td style={{ fontWeight: 600 }}>
                                  {fmtNum(lot.quantityPieces)} {row.unit}
                                  {lot.totalMb > 0 && <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>({fmtMb(lot.totalMb)})</span>}
                                </Td>
                                <Td>
                                  <Badge status={lot.status} />
                                </Td>
                                <Td>
                                  <span style={{ fontSize: 11, color: C.accent, textDecoration: "underline" }}>
                                    Pokaż dziennik ruchów
                                  </span>
                                </Td>
                              </Tr>
                            ))}
                          </Table>

                          {row.lots.length > 0 && (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                                Historia ruchów pierwszej pozycji magazynowej:
                              </div>
                              <LotHistory lotId={row.lots[0]._id} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        ) : (
          /* Widok szczegółowy per pojedyncza pozycja magazynowa */
          <Table headers={["Indeks towarowy", "Grupa / System", "Parametry i Cechy", "Lokalizacja", "Dostępność", "Ilość", "Status"]}>
            {filteredLots.map((l) => {
              const isOpen = openRowKey === l._id;
              const hasDimensions = l.dimensionsSummary && l.dimensionsSummary !== "—";
              const hasColor = Boolean(l.colorCode || l.surfaceType);

              const availableQty = l.status === "AVAILABLE" ? l.quantityPieces : 0;
              const inProgressQty = l.status === "IN_PROGRESS" ? l.quantityPieces : 0;

              return (
                <Fragment key={l._id}>
                  <Tr onClick={() => setOpenRowKey(isOpen ? null : l._id)}>
                    <Td>
                      <div style={{ fontWeight: 600, color: C.text }}>{l.materialName}</div>
                      {l.materialSku && <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>SKU: {l.materialSku}</div>}
                    </Td>
                    <Td>
                      <div style={{ fontSize: 12, color: C.text }}>{l.categoryName}</div>
                      <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", padding: "1px 6px", borderRadius: 3, fontWeight: 600, display: "inline-block", marginTop: 2 }}>
                        {l.objectName}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {hasDimensions && (
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: C.text }}>
                            📏 {l.dimensionsSummary}
                          </span>
                        )}
                        {hasColor && (
                          <span style={{ fontSize: 11, color: C.muted }}>
                            🎨 {l.colorCode ?? ""} {l.surfaceType ? `(${l.surfaceType})` : ""}
                          </span>
                        )}
                        {!hasDimensions && !hasColor && (
                          <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                            Standard
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: C.text }}>{l.locationCode}</span>
                      {l.zone && <div style={{ fontSize: 11, color: C.muted }}>{ZONE_LABEL[l.zone]}</div>}
                    </Td>
                    <Td>
                      <AvailabilityProgressBar
                        available={availableQty}
                        inProgress={inProgressQty}
                        total={l.quantityPieces}
                        unit={l.unit}
                      />
                    </Td>
                    <Td nowrap>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        {fmtNum(l.quantityPieces)} {l.unit}
                      </div>
                      {l.totalMb > 0 && <div style={{ fontSize: 11, color: C.muted }}>{fmtMb(l.totalMb)}</div>}
                      {l.weightKg !== undefined && <div style={{ fontSize: 11, color: C.muted }}>{fmtKg(l.weightKg)}</div>}
                    </Td>
                    <Td><Badge status={l.status} /></Td>
                  </Tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <LotHistory lotId={l._id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        )}
      </Card>
    </Page>
  );
}

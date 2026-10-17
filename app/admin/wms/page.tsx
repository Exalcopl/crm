"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  Empty,
  fmtDate,
  fmtKg,
  fmtMb,
  fmtNum,
  MOVEMENT_LABEL,
  Page,
  Stat,
  Table,
  Td,
  Tr,
  C,
} from "./_components/ui";

export default function WmsOverviewPage() {
  const data = useQuery(api.wms.overview, {});

  return (
    <Page
      title="Magazyn WMS — Przegląd"
      subtitle="Ewidencja magazynu: kategorie, jednostki obiektów, stany wielowymiarowe, dokumenty PZ/RW i ruchy."
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/wms/ustawienia" className="fluent-btn">
            ⚙️ Ustawienia (Kategorie)
          </Link>
          <Link href="/admin/wms/pz" className="fluent-btn fluent-btn-primary">
            + Przyjęcie (PZ)
          </Link>
          <Link href="/admin/wms/rw" className="fluent-btn">
            − Wydanie (RW)
          </Link>
        </div>
      }
    >
      {!data ? (
        <div style={{ color: C.muted, fontSize: 13 }}>Wczytywanie pulpitu magazynu…</div>
      ) : (
        <>
          {/* Główne statystyki KPI */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <Stat
              label="Partie na stanie"
              value={fmtNum(data.lotCount)}
              sub={`${fmtNum(data.totalPieces)} szt. łącznie`}
            />
            <Stat
              label="Szacowana masa"
              value={fmtKg(data.totalKg || undefined)}
              sub="ze wszystkich kategorii"
            />
            <Stat
              label="Kategorie obiektów"
              value={fmtNum(data.categoryCount)}
              sub="zdefiniowanych grup"
            />
            <Stat
              label="W toku (bufor)"
              value={fmtNum(data.inProgressCount)}
              color={data.inProgressCount ? C.amber : undefined}
              sub="wydanych do produkcji"
            />
          </div>

          {/* Ostrzeżenie o braku lokalizacji */}
          {data.locationCount === 0 && (
            <div style={{ marginBottom: 20 }}>
              <Card>
                <Empty
                  icon="🧭"
                  title="Rozpocznij od dodania lokalizacji"
                  text="Aby móc przyjmować towary (PZ), zdefiniuj przynajmniej jedną lokalizację lub regał magazynowy."
                />
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <Link href="/admin/wms/ustawienia?tab=locations" className="fluent-btn fluent-btn-primary">
                    Przejdź do Ustawień (Lokalizacje)
                  </Link>
                </div>
              </Card>
            </div>
          )}

          {/* Podsumowanie stanów wg Kategorii i Obiektów */}
          <div style={{ marginBottom: 20 }}>
            <Card
              title="Stany magazynowe wg kategorii i obiektów"
              pad={false}
            >
              {data.categoriesBreakdown.length === 0 ? (
                <Empty
                  icon="📦"
                  title="Brak stanów magazynowych"
                  text="Przyjmij pierwszy towar dokumentem PZ lub skonfiguruj kategorie w zakładce 'Ustawienia'."
                />
              ) : (
                <Table
                  headers={[
                    "Kategoria magazynowa",
                    "Nazwa obiektu",
                    "Domyślna jednostka",
                    "Partie na stanie",
                    "Łączna ilość",
                    "Metry bieżące",
                    "Masa (kg)",
                    "Akcje",
                  ]}
                >
                  {data.categoriesBreakdown.map((cat) => (
                    <Tr key={cat.categoryId ?? cat.categoryName}>
                      <Td bold>
                        {cat.categoryName}
                      </Td>
                      <Td>
                        <span
                          style={{
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#60a5fa",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {cat.objectName}
                        </span>
                      </Td>
                      <Td mono>{cat.unit}</Td>
                      <Td nowrap style={{ fontWeight: 600 }}>{fmtNum(cat.lotCount)} partii</Td>
                      <Td nowrap style={{ fontWeight: 600 }}>
                        {fmtNum(cat.totalPieces)} {cat.unit}
                      </Td>
                      <Td nowrap muted>
                        {cat.totalMb > 0 ? fmtMb(cat.totalMb) : "—"}
                      </Td>
                      <Td nowrap muted>
                        {cat.totalKg > 0 ? fmtKg(cat.totalKg) : "—"}
                      </Td>
                      <Td>
                        <Link
                          href="/admin/wms/stany"
                          style={{ color: C.accent, fontSize: 12, textDecoration: "none", fontWeight: 600 }}
                        >
                          Zobacz stany →
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>

          {/* Ostatnie ruchy magazynowe */}
          <Card title="Ostatnie ruchy magazynowe" pad={false}>
            {data.recent.length === 0 ? (
              <Empty
                title="Brak zarejestrowanych ruchów"
                text="Ruchy magazynowe pojawią się automatycznie po zatwierdzeniu dokumentu PZ, RW lub korekty."
              />
            ) : (
              <Table
                headers={[
                  "Data",
                  "Ruch",
                  "Produkt / Indeks",
                  "Obiekt magazynowy",
                  "Wymiary / Parametry",
                  "Ilość",
                  "Lokalizacja",
                  "Dokument",
                ]}
              >
                {data.recent.map((m) => (
                  <Tr key={m._id}>
                    <Td muted nowrap>{fmtDate(m.createdAt)}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background:
                            m.type === "PZ"
                              ? "rgba(63, 185, 80, 0.15)"
                              : m.type === "RW"
                              ? "rgba(210, 153, 34, 0.15)"
                              : "rgba(255, 255, 255, 0.08)",
                          color:
                            m.type === "PZ"
                              ? C.green
                              : m.type === "RW"
                              ? C.amber
                              : C.text,
                        }}
                      >
                        {MOVEMENT_LABEL[m.type] ?? m.type}
                      </span>
                    </Td>
                    <Td bold>{m.materialName}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11,
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#60a5fa",
                          padding: "1px 6px",
                          borderRadius: 3,
                        }}
                      >
                        {m.objectName}
                      </span>
                    </Td>
                    <Td nowrap style={{ fontFamily: "monospace" }}>
                      {m.dimensionsSummary}
                    </Td>
                    <Td nowrap style={{ fontWeight: 600 }}>
                      {fmtNum(m.quantityPieces)} {m.unit}
                    </Td>
                    <Td mono muted>{m.toCode ?? "—"}</Td>
                    <Td mono>
                      {m.documentNumber ? (
                        <span style={{ color: C.accent, fontSize: 12 }}>{m.documentNumber}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}

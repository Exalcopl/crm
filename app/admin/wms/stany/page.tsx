"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Card, Empty, fmtKg, fmtMb, fmtNum, inputStyle, Page, Table, Td, Tr, C, ZONE_LABEL } from "../_components/ui";
import { LotHistory } from "../_components/lot-history";

export default function StanyPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [includeDepleted, setIncludeDepleted] = useState(false);
  const [openId, setOpenId] = useState<Id<"wms_lots"> | null>(null);

  const lots = useQuery(api.wms.listLots, {
    locationId: locationId ? (locationId as Id<"wms_locations">) : undefined,
    status: status || undefined,
    includeDepleted,
  });
  const locations = useQuery(api.wms.listLocations, {});
  const categories = useQuery(api.wms.listCategories, {});

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (lots ?? []).filter((l) => {
      const matchesQ =
        !q ||
        l.materialName.toLowerCase().includes(q) ||
        (l.materialSku ?? "").toLowerCase().includes(q) ||
        (l.categoryName ?? "").toLowerCase().includes(q) ||
        (l.objectName ?? "").toLowerCase().includes(q) ||
        (l.colorCode ?? "").toLowerCase().includes(q) ||
        (l.heatNumber ?? "").toLowerCase().includes(q) ||
        (l.ssccCode ?? "").toLowerCase().includes(q);

      const matchesCat =
        !categoryId ||
        l.categoryId === categoryId ||
        l.categoryCode === categoryId;

      return matchesQ && matchesCat;
    });
  }, [lots, search, categoryId]);

  const totals = useMemo(
    () => ({
      pieces: rows.reduce((s, l) => s + l.quantityPieces, 0),
      mb: rows.reduce((s, l) => s + l.totalMb, 0),
      kg: rows.reduce((s, l) => s + (l.weightKg ?? 0), 0),
    }),
    [rows],
  );

  return (
    <Page
      title="Stany magazynowe"
      subtitle={`${rows.length} partii · ${fmtNum(totals.pieces)} szt. · ${fmtMb(totals.mb)} · ${fmtKg(totals.kg || undefined)}`}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 220, width: "auto" }}
          placeholder="Szukaj: indeks, SKU, grupa towarowa, system/podgrupa, kolor, partia…"
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
          <option value="AVAILABLE">Dostępne</option>
          <option value="IN_PROGRESS">W toku</option>
        </select>
        <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={includeDepleted} onChange={(e) => setIncludeDepleted(e.target.checked)} />
          pokaż wyczerpane
        </label>
      </div>

      <Card pad={false}>
        {!lots ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Ładowanie…</div>
        ) : rows.length === 0 ? (
          <Empty title="Brak partii" text="Przyjmij towar dokumentem PZ, aby pojawił się na stanie." />
        ) : (
          <Table headers={["Indeks towarowy", "Grupa / System", "Wymiary / Parametry", "Cechy", "Partia / Wytop", "Ilość", "Masa", "Lokalizacja", "Status"]}>
            {rows.map((l) => (
              <Fragment key={l._id}>
                <Tr onClick={() => setOpenId(openId === l._id ? null : l._id)}>
                  <Td>
                    <div style={{ fontWeight: 600, color: C.text }}>{l.materialName}</div>
                    {l.materialSku && <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>SKU: {l.materialSku}</div>}
                  </Td>
                  <Td>
                    <div style={{ fontSize: 12, color: C.text }}>{l.categoryName}</div>
                    <span style={{ fontSize: 10, background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>
                      {l.objectName}
                    </span>
                  </Td>
                  <Td nowrap style={{ fontFamily: "monospace" }}>
                    {l.dimensionsSummary}
                  </Td>
                  <Td>
                    {l.colorCode ?? "—"}
                    {l.surfaceType && <div style={{ fontSize: 11, color: C.muted }}>{l.surfaceType}</div>}
                  </Td>
                  <Td mono muted>
                    {l.heatNumber ?? "—"}
                  </Td>
                  <Td nowrap style={{ fontWeight: 600 }}>{fmtNum(l.quantityPieces)} {l.unit}</Td>
                  <Td nowrap muted>{fmtKg(l.weightKg)}</Td>
                  <Td>
                    <span style={{ fontFamily: "monospace" }}>{l.locationCode}</span>
                    {l.zone && <div style={{ fontSize: 11, color: C.muted }}>{ZONE_LABEL[l.zone]}</div>}
                  </Td>
                  <Td><Badge status={l.status} /></Td>
                </Tr>
                {openId === l._id && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <LotHistory lotId={l._id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}

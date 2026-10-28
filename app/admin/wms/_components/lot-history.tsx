"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { C, fmtDate, fmtMb, fmtNum, KIND_LABEL, MOVEMENT_LABEL, SURFACE_LABEL, Table, Td, Tr, Badge } from "./ui";

/** Historia partii: dane, atest oraz pełny dziennik ruchów (traceability). */
export function LotHistory({ lotId }: { lotId: Id<"wms_lots"> }) {
  const data = useQuery(api.wms.lotHistory, { lotId });
  if (!data) return <div style={{ padding: 12, color: C.muted, fontSize: 12 }}>Ładowanie historii…</div>;
  const { lot, movements } = data;
  return (
    <div style={{ padding: "12px 16px", background: C.bg, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12, color: C.muted, marginBottom: 10 }}>
        {lot.surfaceType && (
          <span>Powierzchnia: <b style={{ color: C.text }}>{SURFACE_LABEL[lot.surfaceType] ?? lot.surfaceType}</b></span>
        )}
        {lot.heatNumber && (
          <span>Nr partii / wytopu: <b style={{ color: C.text }}>{lot.heatNumber}</b></span>
        )}
        <span>Razem: <b style={{ color: C.text }}>{fmtNum(lot.quantityPieces)} szt.{lot.totalMb > 0 ? ` (${fmtMb(lot.totalMb)})` : ""}</b></span>
      </div>
      <Table headers={["Data", "Ruch", "Zmiana", "Z", "Do", "Dokument", "Operator", "Uwagi"]}>
        {movements.map((m) => (
          <Tr key={m._id}>
            <Td muted nowrap>{fmtDate(m.createdAt)}</Td>
            <Td>{MOVEMENT_LABEL[m.type] ?? m.type}</Td>
            <Td nowrap>
              {m.quantityDelta === 0 ? <Badge status="IN_PROGRESS" label="przesunięcie" /> : `${m.quantityDelta > 0 ? "+" : ""}${m.quantityDelta} szt.`}
            </Td>
            <Td mono muted>{m.fromCode ?? "—"}</Td>
            <Td mono muted>{m.toCode ?? "—"}</Td>
            <Td mono muted>{m.documentNumber ?? "—"}</Td>
            <Td muted>{m.operatorName}</Td>
            <Td muted>{m.note ?? ""}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}

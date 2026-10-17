"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Badge,
  Btn,
  Card,
  Empty,
  errMsg,
  Field,
  fmtDate,
  Grid,
  inputStyle,
  Page,
  Table,
  Td,
  Tr,
  C,
} from "../_components/ui";

export default function InwentaryzacjaListPage() {
  const router = useRouter();
  const sessions = useQuery(api.wms.listSessions, {});
  const locations = useQuery(api.wms.listLocations, { onlyActive: true });
  const openSession = useMutation(api.wms.openSession);

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [locId, setLocId] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Podaj nazwę inwentaryzacji");
      return;
    }
    setBusy(true);
    try {
      const sessionId = await openSession({
        name: name.trim(),
        locationId: locId ? (locId as Id<"wms_locations">) : undefined,
      });
      toast.success("Otwarto nową sesję inwentaryzacji");
      setShowNew(false);
      setName("");
      setLocId("");
      router.push(`/admin/wms/inwentaryzacja/${sessionId}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Inwentaryzacja ciągła i okresowa"
      subtitle="Zliczanie stanów fizycznych regałów. Zamknięcie sesji z różnicami automatycznie generuje i zatwierdza dokument KOREKTA."
      actions={
        <Btn primary onClick={() => setShowNew(true)}>
          + Rozpocznij inwentaryzację
        </Btn>
      }
    >
      {showNew && (
        <Card title="Nowa sesja inwentaryzacji">
          <Grid cols={3}>
            <Field label="Nazwa sesji *" span={2}>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Inwentaryzacja Regału A — Październik 2026"
              />
            </Field>
            <Field label="Zakres lokalizacji">
              <select style={inputStyle} value={locId} onChange={(e) => setLocId(e.target.value)}>
                <option value="">Cały magazyn (wszystkie regały)</option>
                {(locations ?? []).map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          </Grid>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn primary onClick={handleCreate} disabled={busy}>
              {busy ? "Tworzenie sesji…" : "Rozpocznij zliczanie"}
            </Btn>
            <Btn onClick={() => setShowNew(false)}>Anuluj</Btn>
          </div>
        </Card>
      )}

      <Card pad={false}>
        {!sessions ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Ładowanie sesji…</div>
        ) : sessions.length === 0 ? (
          <Empty
            icon="📋"
            title="Brak sesji inwentaryzacyjnych"
            text="Użyj przycisku „+ Rozpocznij inwentaryzację”, aby zliczyć wybrane regały."
          />
        ) : (
          <Table headers={["Nazwa sesji", "Data otwarcia", "Zakres", "Postęp zliczania", "Status", "Dokument korekty", ""]}>
            {sessions.map((s) => (
              <Tr key={s._id} onClick={() => router.push(`/admin/wms/inwentaryzacja/${s._id}`)}>
                <Td style={{ fontWeight: 700 }}>{s.name}</Td>
                <Td muted nowrap>{fmtDate(s.createdAt)}</Td>
                <Td mono>{s.locationCode}</Td>
                <Td>
                  {s.counted} / {s.total} partii ({Math.round((s.counted / (s.total || 1)) * 100)}%)
                </Td>
                <Td><Badge status={s.status} /></Td>
                <Td mono muted>{s.correctionNumber ?? "brak różnic"}</Td>
                <Td>
                  <Link
                    href={`/admin/wms/inwentaryzacja/${s._id}`}
                    className="fluent-btn"
                    style={{ fontSize: 12, padding: "3px 10px" }}
                  >
                    Otwórz →
                  </Link>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}

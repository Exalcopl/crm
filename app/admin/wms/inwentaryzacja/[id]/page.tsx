"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Badge,
  Btn,
  Card,
  ConfirmModal,
  Empty,
  errMsg,
  fmtDate,
  fmtNum,
  Grid,
  inputStyle,
  Page,
  Table,
  Td,
  Tr,
  C,
} from "../../_components/ui";

export default function InwentaryzacjaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sessionId = id as Id<"wms_inventory_sessions">;

  const data = useQuery(api.wms.getSession, { id: sessionId });
  const setCount = useMutation(api.wms.setCount);
  const closeSession = useMutation(api.wms.closeSession);

  const [busy, setBusy] = useState(false);
  const [localCounts, setLocalCounts] = useState<Record<string, string>>({});
  const [showCloseModal, setShowCloseModal] = useState(false);

  if (!data) {
    return (
      <Page title="Inwentaryzacja" subtitle="Wczytywanie szczegółów sesji…">
        <div style={{ color: C.muted, fontSize: 13 }}>Ładowanie…</div>
      </Page>
    );
  }

  const { session, rows } = data;
  const isOpen = session.status === "OPEN";

  async function handleSaveCount(countId: Id<"wms_inventory_counts">) {
    const raw = localCounts[countId];
    if (raw === undefined || raw === "") return;
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Wpisz prawidłową liczbę sztuk (≥ 0)");
      return;
    }
    try {
      await setCount({ countId, countedPieces: val });
      toast.success("Zapisano stan");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function handleSetMatch(countId: Id<"wms_inventory_counts">, expected: number) {
    try {
      await setCount({ countId, countedPieces: expected });
      setLocalCounts((prev) => ({ ...prev, [countId]: expected.toString() }));
      toast.success("Potwierdzono stan zgodny");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  function handleClose() {
    setShowCloseModal(true);
  }

  async function handleCloseConfirm() {
    setBusy(true);
    try {
      const res = await closeSession({ id: sessionId });
      if (res.differences > 0) {
        toast.success(`Inwentaryzacja zamknięta. Wykryto i skorygowano ${res.differences} różnic.`);
      } else {
        toast.success("Inwentaryzacja zamknięta. Wszystkie stany były w 100% zgodne.");
      }
      setShowCloseModal(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Obliczenia podsumowujące
  const totalPositions = rows.length;
  const countedPositions = rows.filter((r) => r.countedPieces !== undefined).length;
  const diffPositions = rows.filter((r) => r.countedPieces !== undefined && r.countedPieces !== r.currentPieces).length;

  return (
    <Page
      title={`Inwentaryzacja: ${session.name}`}
      subtitle={`Status: ${session.status} · Utworzono: ${fmtDate(session.createdAt)}${session.closedAt ? ` · Zamknięto: ${fmtDate(session.closedAt)}` : ""}`}
      actions={
        <>
          <Link href="/admin/wms/inwentaryzacja" className="fluent-btn">
            ← Powrót do listy
          </Link>
          {isOpen && (
            <Btn primary onClick={handleClose} disabled={busy || countedPositions === 0}>
              {busy ? "Zamykanie…" : "✓ Zamknij i zatwierdź korekty"}
            </Btn>
          )}
        </>
      }
    >
      <Card title="Podsumowanie sesji">
        <Grid cols={4}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Wszystkich pozycji</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{totalPositions}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Policzone</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.teal }}>
              {countedPositions} / {totalPositions}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Wykryte różnice</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: diffPositions > 0 ? C.amber : C.green }}>
              {diffPositions} pozycji
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>Status sesji</div>
            <div style={{ marginTop: 2 }}>
              <Badge status={session.status} />
            </div>
          </div>
        </Grid>
      </Card>

      <Card title={`Arkusz spisowy (${rows.length} partii)`} pad={false}>
        {rows.length === 0 ? (
          <Empty
            icon="📋"
            title="Brak partii w tej sesji"
            text="W wybranym zakresie lokalizacji nie zarejestrowano jeszcze żadnych partii magazynowych."
          />
        ) : (
          <Table headers={["Lokalizacja", "Produkt / Obiekt", "Wymiary", "Cechy", "Stan systemowy", "Stan policzony (fizyczny)", "Różnica", ""]}>
            {rows.map((row) => {
              const currentVal = localCounts[row._id] !== undefined ? localCounts[row._id] : (row.countedPieces !== undefined ? row.countedPieces.toString() : "");
              const diff = row.countedPieces !== undefined ? row.countedPieces - row.currentPieces : null;

              return (
                <Tr key={row._id}>
                  <Td mono style={{ fontWeight: 700 }}>{row.locationCode}</Td>
                  <Td>{row.materialName}</Td>
                  <Td nowrap>{fmtNum(row.lengthMm)} mm</Td>
                  <Td>
                    {row.colorCode ?? "—"}
                    {row.heatNumber && <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>Partia: {row.heatNumber}</div>}
                  </Td>
                  <Td nowrap style={{ fontWeight: 600 }}>{fmtNum(row.currentPieces)} szt.</Td>
                  <Td nowrap>
                    {isOpen ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          style={{ ...inputStyle, width: 80, padding: "4px 8px", fontWeight: 700, textAlign: "center" }}
                          type="number"
                          min="0"
                          value={currentVal}
                          onChange={(e) => setLocalCounts({ ...localCounts, [row._id]: e.target.value })}
                          onBlur={() => handleSaveCount(row._id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCount(row._id);
                          }}
                          placeholder="wpisz…"
                        />
                        <button
                          type="button"
                          onClick={() => handleSetMatch(row._id, row.currentPieces)}
                          title="Zgodny ze stanem systemowym"
                          style={{
                            background: "transparent",
                            border: `1px solid ${C.border}`,
                            color: C.muted,
                            borderRadius: 4,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          = {row.currentPieces}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700 }}>
                        {row.countedPieces !== undefined ? `${fmtNum(row.countedPieces)} szt.` : "—"}
                      </span>
                    )}
                  </Td>
                  <Td nowrap>
                    {diff === null ? (
                      <span style={{ color: C.muted, fontSize: 12 }}>brak wpisu</span>
                    ) : diff === 0 ? (
                      <span style={{ color: C.green, fontWeight: 700 }}>✓ Zgodne (0)</span>
                    ) : (
                      <span style={{ color: diff > 0 ? C.teal : C.red, fontWeight: 700 }}>
                        {diff > 0 ? `+${diff}` : diff} szt.
                      </span>
                    )}
                  </Td>
                  <Td>
                    {isOpen && currentVal !== "" && (
                      <Btn small onClick={() => handleSaveCount(row._id)}>
                        Zapisz
                      </Btn>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ─── NATYWNY MODAL ZAMKNIĘCIA SESJI INWENTARYZACJI ─────────── */}
      <ConfirmModal
        isOpen={showCloseModal}
        title="Zamknięcie sesji inwentaryzacji"
        message={
          <>
            <div>
              Czy na pewno chcesz zamknąć tę sesję inwentaryzacji? Wszelkie wykryte różnice wygenerują zatwierdzony dokument <strong>KOREKTA</strong> korygujący stany magazynowe.
            </div>
            {rows.filter((r) => r.countedPieces === undefined).length > 0 && (
              <div style={{ marginTop: 10, padding: 10, background: "rgba(210, 153, 34, 0.15)", border: `1px solid ${C.amber}`, borderRadius: 6, color: C.amber, fontSize: 12 }}>
                ⚠️ <strong>Uwaga:</strong> {rows.filter((r) => r.countedPieces === undefined).length} pozycji nie zostało jeszcze policzonych. Pozycje bez wpisanej ilości zostaną pominięte w korekcie.
              </div>
            )}
          </>
        }
        confirmLabel="Tak, zamknij inwentaryzację"
        cancelLabel="Anuluj"
        danger={false}
        busy={busy}
        onConfirm={handleCloseConfirm}
        onCancel={() => !busy && setShowCloseModal(false)}
      />
    </Page>
  );
}

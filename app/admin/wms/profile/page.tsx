"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Btn, Card, Empty, errMsg, Field, fmtNum, Grid, inputStyle, Page, Table, Td, Tr, C, TRACKING_LABEL } from "../_components/ui";

type Mode = "STRICT" | "QUANTITY" | "NONE";

export default function ProfilePage() {
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const rows = useQuery(api.wms.listProfiles, { allCategories: all });
  const upsert = useMutation(api.wms.upsertProfile);

  const [editId, setEditId] = useState<Id<"materials"> | null>(null);
  const [form, setForm] = useState({
    isTracked: true,
    systemSeries: "",
    kgPerMb: "",
    standardLengthMm: "",
    trackingMode: "STRICT" as Mode,
    requiresCertificate: false,
    requiresColor: false,
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  function startEdit(r: NonNullable<typeof rows>[number]) {
    setEditId(r.material._id);
    const p = r.profile;
    setForm({
      isTracked: p?.isTracked ?? true,
      systemSeries: p?.systemSeries ?? "",
      kgPerMb: p?.kgPerMb?.toString() ?? "",
      standardLengthMm: p?.standardLengthMm?.toString() ?? "",
      trackingMode: p?.trackingMode ?? "STRICT",
      requiresCertificate: p?.requiresCertificate ?? false,
      requiresColor: p?.requiresColor ?? false,
      notes: p?.notes ?? "",
    });
  }

  async function save() {
    if (!editId) return;
    setBusy(true);
    try {
      await upsert({
        materialId: editId,
        isTracked: form.isTracked,
        systemSeries: form.systemSeries || undefined,
        kgPerMb: form.kgPerMb ? Number(form.kgPerMb) : undefined,
        standardLengthMm: form.standardLengthMm ? Number(form.standardLengthMm) : undefined,
        trackingMode: form.trackingMode,
        requiresCertificate: form.requiresCertificate,
        requiresColor: form.requiresColor,
        notes: form.notes || undefined,
      });
      toast.success("Zapisano ustawienia profilu");
      setEditId(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter(
    (r) => !q || r.material.name.toLowerCase().includes(q) || (r.material.sku ?? "").toLowerCase().includes(q),
  );
  const editing = rows?.find((r) => r.material._id === editId);

  return (
    <Page
      title="Profile — cechy magazynowe indeksów"
      subtitle={
        <>
          Indeksy pochodzą z bazy materiałów (<Link href="/admin/materialy" style={{ color: C.accent }}>Materiały / Cennik</Link>).
          Tutaj ustawiasz ich parametry magazynowe: masę, tryb ewidencji i wymagane atrybuty.
        </>
      }
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input style={{ ...inputStyle, flex: 1, width: "auto" }} placeholder="Szukaj po nazwie lub SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label style={{ fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          wszystkie kategorie (nie tylko PROFILE)
        </label>
      </div>

      {editing && (
        <Card title={`Ustawienia: ${editing.material.name}`}>
          <Grid cols={4}>
            <Field label="Ewidencjonowany w WMS">
              <select style={inputStyle} value={form.isTracked ? "1" : "0"} onChange={(e) => setForm({ ...form, isTracked: e.target.value === "1" })}>
                <option value="1">Tak</option>
                <option value="0">Nie</option>
              </select>
            </Field>
            <Field label="Tryb ewidencji">
              <select style={inputStyle} value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value as Mode })}>
                {Object.entries(TRACKING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Seria systemowa"><input style={inputStyle} value={form.systemSeries} onChange={(e) => setForm({ ...form, systemSeries: e.target.value })} placeholder="np. MB-86N" /></Field>
            <Field label="Masa (kg / mb)" hint="Do wyliczania wagi i obciążenia regałów"><input style={inputStyle} type="number" min="0" step="0.001" value={form.kgPerMb} onChange={(e) => setForm({ ...form, kgPerMb: e.target.value })} /></Field>
            <Field label="Długość handlowa (mm)"><input style={inputStyle} type="number" min="0" value={form.standardLengthMm} onChange={(e) => setForm({ ...form, standardLengthMm: e.target.value })} placeholder="np. 6500" /></Field>
            <Field label="Wymagaj atestu 3.1 przy PZ">
              <select style={inputStyle} value={form.requiresCertificate ? "1" : "0"} onChange={(e) => setForm({ ...form, requiresCertificate: e.target.value === "1" })}>
                <option value="0">Nie</option>
                <option value="1">Tak</option>
              </select>
            </Field>
            <Field label="Wymagaj koloru przy PZ">
              <select style={inputStyle} value={form.requiresColor ? "1" : "0"} onChange={(e) => setForm({ ...form, requiresColor: e.target.value === "1" })}>
                <option value="0">Nie</option>
                <option value="1">Tak</option>
              </select>
            </Field>
            <Field label="Uwagi"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </Grid>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn primary onClick={save} disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz"}</Btn>
            <Btn onClick={() => setEditId(null)}>Anuluj</Btn>
          </div>
        </Card>
      )}

      <Card pad={false}>
        {!rows ? (
          <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Ładowanie…</div>
        ) : filtered.length === 0 ? (
          <Empty
            title={all ? "Brak materiałów" : "Brak materiałów w kategorii PROFILE"}
            text="Dodaj profile w Materiały / Cennik (kategoria „Profile”, jednostka mb.) albo zaznacz „wszystkie kategorie”."
          />
        ) : (
          <Table headers={["Indeks", "SKU", "Kat.", "Seria", "kg/mb", "Tryb", "Wymagania PZ", "Na stanie", ""]}>
            {filtered.map((r) => (
              <Tr key={r.material._id}>
                <Td>
                  {r.material.name}
                  {!r.profile && <div style={{ fontSize: 11, color: C.amber }}>domyślne ustawienia</div>}
                </Td>
                <Td mono muted>{r.material.sku ?? "—"}</Td>
                <Td muted>{r.material.category}</Td>
                <Td muted>{r.profile?.systemSeries ?? "—"}</Td>
                <Td muted>{r.profile?.kgPerMb ?? "—"}</Td>
                <Td>
                  {r.profile && !r.profile.isTracked ? (
                    <Badge status="DEPLETED" label="nieśledzony" />
                  ) : (
                    TRACKING_LABEL[r.profile?.trackingMode ?? "STRICT"]
                  )}
                </Td>
                <Td muted>
                  {[r.profile?.requiresCertificate && "atest", r.profile?.requiresColor && "kolor"].filter(Boolean).join(", ") || "—"}
                </Td>
                <Td>{fmtNum(r.stockPieces)} szt.</Td>
                <Td><Btn small onClick={() => startEdit(r)}>Ustawienia</Btn></Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}

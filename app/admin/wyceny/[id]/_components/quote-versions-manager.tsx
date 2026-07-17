"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuoteVersion = {
  _id: Id<"quoteVersions">;
  _creationTime: number;
  quoteId: Id<"quotes">;
  versionNumber: number;
  source: "ocr" | "manual";
  fileItemId?: string;
  fileName?: string;
  title: string;
  valueNetto: number;
  valueVat: number;
  valueBrutto: number;
  vatRate: number;
  items: Array<{
    lp: number;
    description: string;
    quantity: number | null;
    unit?: string;
    priceNetto: number | null;
    valueNetto: number | null;
  }>;
  additionalData?: Record<string, unknown>;
  notes?: string;
  status: "draft" | "accepted" | "rejected";
  createdAt: number;
};

type Quote = {
  _id: Id<"quotes">;
  sharepoint?: {
    status: "pending" | "created" | "failed";
    subfolderItemId?: string;
    driveId?: string;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return arr;
}

const STATUS_LABELS: Record<QuoteVersion["status"], string> = {
  draft: "Szkic",
  accepted: "Zaakceptowana",
  rejected: "Odrzucona",
};

const STATUS_COLORS: Record<QuoteVersion["status"], string> = {
  draft: "oklch(0.6 0.05 220)",
  accepted: "oklch(0.72 0.18 145)",
  rejected: "oklch(0.55 0.18 25)",
};

// ─── Scanning indicator ───────────────────────────────────────────────────────

function ScanningIndicator() {
  return (
    <div className="qvm-scanning">
      <span className="qvm-scanning-dot" />
      <span className="qvm-scanning-dot" />
      <span className="qvm-scanning-dot" />
      <span className="qvm-scanning-text">Skanowanie nowych plików PDF…</span>
    </div>
  );
}

// ─── Version list item ────────────────────────────────────────────────────────

function VersionListItem({
  version,
  isActive,
  onClick,
}: {
  version: QuoteVersion;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`qvm-version-item${isActive ? " qvm-version-item--active" : ""}`}
      onClick={onClick}
    >
      <div className="qvm-version-item-header">
        <span className="qvm-version-item-num">Wersja {version.versionNumber}</span>
        <span
          className="qvm-version-item-status"
          style={{ color: STATUS_COLORS[version.status] }}
        >
          {STATUS_LABELS[version.status]}
        </span>
      </div>
      <div className="qvm-version-item-title">{version.title}</div>
      <div className="qvm-version-item-meta">
        <span>{formatDate(version.createdAt)}</span>
        <span className="qvm-version-item-value">
          {formatCurrency(version.valueNetto)} PLN netto
        </span>
      </div>
    </button>
  );
}

// ─── Items table ──────────────────────────────────────────────────────────────

type EditableItem = {
  lp: number;
  description: string;
  quantity: number | null;
  unit: string;
  priceNetto: number | null;
  valueNetto: number | null;
};

function ItemsTable({
  items,
  editable,
  vatRate,
  onItemsChange,
}: {
  items: QuoteVersion["items"];
  editable: boolean;
  vatRate: number;
  onItemsChange?: (items: EditableItem[], netto: number, vat: number, brutto: number) => void;
}) {
  const [rows, setRows] = useState<EditableItem[]>(() =>
    items.map((it) => ({
      lp: it.lp,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit ?? "szt.",
      priceNetto: it.priceNetto,
      valueNetto: it.valueNetto,
    })),
  );

  // sync when items prop changes (e.g. after re-fetch)
  useEffect(() => {
    setRows(
      items.map((it) => ({
        lp: it.lp,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit ?? "szt.",
        priceNetto: it.priceNetto,
        valueNetto: it.valueNetto,
      })),
    );
  }, [items]);

  function calcValueNetto(qty: number | null, price: number | null): number | null {
    if (qty != null && price != null) return Math.round(qty * price * 100) / 100;
    return null;
  }

  function recalcTotals(newRows: EditableItem[]) {
    const netto = newRows.reduce((s, r) => s + (r.valueNetto ?? 0), 0);
    const vat = Math.round(netto * (vatRate / 100) * 100) / 100;
    const brutto = Math.round((netto + vat) * 100) / 100;
    onItemsChange?.(newRows, netto, vat, brutto);
  }

  function handleCellChange(
    idx: number,
    field: keyof EditableItem,
    value: string,
  ) {
    const updated = rows.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row };
      if (field === "description" || field === "unit") {
        (next as Record<string, unknown>)[field] = value;
      } else if (field === "quantity" || field === "priceNetto") {
        const num = value === "" ? null : parseFloat(value.replace(",", "."));
        (next as Record<string, unknown>)[field] = isNaN(num as number) ? null : num;
        next.valueNetto = calcValueNetto(
          field === "quantity" ? (next.quantity) : next.quantity,
          field === "priceNetto" ? (isNaN(num as number) ? null : num as number) : next.priceNetto,
        );
      }
      return next;
    });
    setRows(updated);
    recalcTotals(updated);
  }

  if (rows.length === 0) {
    return (
      <div className="qvm-items-empty">Brak pozycji do wyświetlenia.</div>
    );
  }

  return (
    <div className="qvm-items-wrap">
      <table className="qvm-items-table">
        <thead>
          <tr>
            <th className="qvm-th qvm-th-lp">Lp.</th>
            <th className="qvm-th qvm-th-desc">Opis</th>
            <th className="qvm-th qvm-th-qty">Ilość</th>
            <th className="qvm-th qvm-th-unit">Jedn.</th>
            <th className="qvm-th qvm-th-price">Cena netto</th>
            <th className="qvm-th qvm-th-total">Wartość netto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="qvm-tr">
              <td className="qvm-td qvm-td-lp">{row.lp}</td>
              <td className="qvm-td qvm-td-desc">
                {editable ? (
                  <input
                    className="qvm-cell-input qvm-cell-input--desc"
                    value={row.description}
                    onChange={(e) => handleCellChange(idx, "description", e.target.value)}
                  />
                ) : (
                  row.description || "—"
                )}
              </td>
              <td className="qvm-td qvm-td-qty">
                {editable ? (
                  <input
                    className="qvm-cell-input qvm-cell-input--num"
                    type="number"
                    value={row.quantity ?? ""}
                    onChange={(e) => handleCellChange(idx, "quantity", e.target.value)}
                  />
                ) : (
                  row.quantity != null ? String(row.quantity) : "—"
                )}
              </td>
              <td className="qvm-td qvm-td-unit">
                {editable ? (
                  <input
                    className="qvm-cell-input qvm-cell-input--unit"
                    value={row.unit}
                    onChange={(e) => handleCellChange(idx, "unit", e.target.value)}
                  />
                ) : (
                  row.unit || "—"
                )}
              </td>
              <td className="qvm-td qvm-td-price">
                {editable ? (
                  <input
                    className="qvm-cell-input qvm-cell-input--num"
                    type="number"
                    step="0.01"
                    value={row.priceNetto ?? ""}
                    onChange={(e) => handleCellChange(idx, "priceNetto", e.target.value)}
                  />
                ) : (
                  row.priceNetto != null ? formatCurrency(row.priceNetto) : "—"
                )}
              </td>
              <td className="qvm-td qvm-td-total">
                {row.valueNetto != null ? formatCurrency(row.valueNetto) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Version detail panel ─────────────────────────────────────────────────────

function VersionDetail({
  version,
  archived,
  onAccept,
  onReject,
  onDelete,
  onSaveItems,
  onSaveNotes,
  onPreview,
}: {
  version: QuoteVersion;
  archived: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSaveItems: (
    items: EditableItem[],
    netto: number,
    vat: number,
    brutto: number,
  ) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onPreview?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pendingItems, setPendingItems] = useState<EditableItem[] | null>(null);
  const [pendingTotals, setPendingTotals] = useState<{ netto: number; vat: number; brutto: number } | null>(null);
  const [notes, setNotes] = useState(version.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // sync notes if version changes
  useEffect(() => {
    setNotes(version.notes ?? "");
    setEditing(false);
    setPendingItems(null);
    setPendingTotals(null);
  }, [version._id]);

  const displayNetto = pendingTotals?.netto ?? version.valueNetto;
  const displayVat = pendingTotals?.vat ?? version.valueVat;
  const displayBrutto = pendingTotals?.brutto ?? version.valueBrutto;

  async function handleSave() {
    setSaving(true);
    try {
      if (pendingItems) {
        await onSaveItems(
          pendingItems,
          pendingTotals!.netto,
          pendingTotals!.vat,
          pendingTotals!.brutto,
        );
      }
      await onSaveNotes(notes);
      setEditing(false);
      setPendingItems(null);
      setPendingTotals(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(fn: () => Promise<void>) {
    setActionBusy(true);
    try { await fn(); } finally { setActionBusy(false); }
  }

  const canEdit = !archived && version.status !== "accepted";
  const canAccept = !archived && version.status !== "accepted";
  const canReject = !archived && version.status === "accepted";
  const canDelete = !archived && version.status !== "accepted";

  return (
    <div className="qvm-detail">
      {/* Header */}
      <div className="qvm-detail-header">
        <div className="qvm-detail-header-left">
          <div className="qvm-detail-title">{version.title}</div>
          <div className="qvm-detail-meta">
            <span
              className="qvm-detail-badge"
              style={{
                background: `${STATUS_COLORS[version.status]}22`,
                color: STATUS_COLORS[version.status],
                border: `1px solid ${STATUS_COLORS[version.status]}55`,
              }}
            >
              {STATUS_LABELS[version.status]}
            </span>
            <span className="qvm-detail-date">{formatDate(version.createdAt)}</span>
          </div>
        </div>
        <div className="qvm-detail-actions">
          {version.fileItemId && onPreview && !editing && (
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost"
              onClick={onPreview}
              disabled={actionBusy}
              title="Podgląd pliku PDF"
            >
              <I.doc s={13} /> Podgląd PDF
            </button>
          )}
          {canEdit && !editing && (
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost"
              onClick={() => setEditing(true)}
              disabled={actionBusy}
            >
              <I.edit s={13} /> Edytuj
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                className="fluent-btn fluent-btn-ghost"
                onClick={() => { setEditing(false); setPendingItems(null); setPendingTotals(null); }}
                disabled={saving}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="fluent-btn fluent-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </>
          )}
          {!editing && canAccept && (
            <button
              type="button"
              className="fluent-btn fluent-btn-primary qvm-btn-accept"
              onClick={() => handleAction(onAccept)}
              disabled={actionBusy}
            >
              <I.check s={13} /> Akceptuj wycenę
            </button>
          )}
          {!editing && canReject && (
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost"
              onClick={() => handleAction(onReject)}
              disabled={actionBusy}
            >
              Cofnij akceptację
            </button>
          )}
          {!editing && canDelete && (
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost qvm-btn-delete"
              onClick={() => setConfirmDelete(true)}
              disabled={actionBusy}
            >
              <I.trash s={13} />
            </button>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="qvm-confirm">
          <span>Usunąć tę wersję wyceny?</span>
          <button
            className="fluent-btn fluent-btn-ghost"
            onClick={() => setConfirmDelete(false)}
          >
            Anuluj
          </button>
          <button
            className="fluent-btn fluent-btn-primary qvm-btn-delete"
            onClick={() => { setConfirmDelete(false); void handleAction(onDelete); }}
          >
            Usuń
          </button>
        </div>
      )}

      {/* Financial summary cards */}
      <div className="qvm-summary">
        <div className="qvm-summary-card qvm-summary-card--netto">
          <div className="qvm-summary-label">Wartość netto</div>
          <div className="qvm-summary-value">
            {formatCurrency(displayNetto)}
            <span className="qvm-summary-currency">PLN</span>
          </div>
        </div>
        <div className="qvm-summary-card">
          <div className="qvm-summary-label">VAT ({version.vatRate}%)</div>
          <div className="qvm-summary-value qvm-summary-value--vat">
            {formatCurrency(displayVat)}
            <span className="qvm-summary-currency">PLN</span>
          </div>
        </div>
        <div className="qvm-summary-card qvm-summary-card--brutto">
          <div className="qvm-summary-label">Wartość brutto</div>
          <div className="qvm-summary-value">
            {formatCurrency(displayBrutto)}
            <span className="qvm-summary-currency">PLN</span>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="qvm-section">
        <div className="qvm-section-title">Pozycje wyceny</div>
        <ItemsTable
          items={version.items}
          editable={editing}
          vatRate={version.vatRate}
          onItemsChange={(its, netto, vat, brutto) => {
            setPendingItems(its);
            setPendingTotals({ netto, vat, brutto });
          }}
        />
      </div>

      {/* Notes */}
      <div className="qvm-section">
        <div className="qvm-section-title">Notatki do tej wersji</div>
        {editing ? (
          <textarea
            className="qvm-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dodaj uwagi, np. warunki płatności, gwarancja, zakres prac…"
            rows={4}
          />
        ) : (
          <div className="qvm-notes-text">
            {version.notes || <span className="qvm-notes-empty">— brak notatek —</span>}
          </div>
        )}
      </div>

      {/* Additional data from OCR */}
      {version.additionalData && Object.keys(version.additionalData).length > 0 && (
        <AdditionalData data={version.additionalData} />
      )}
    </div>
  );
}

// ─── Additional OCR data (supplier, scope etc.) ────────────────────────────────

// True jeśli wartość zawiera cokolwiek sensownego do pokazania.
function hasVal(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim().toLowerCase() !== "null";
  if (Array.isArray(v)) return v.some(hasVal);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(hasVal);
  return true;
}

function asText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

// Wiersz etykieta → wartość
function InfoRow({ label, value }: { label: string; value: unknown }) {
  if (!hasVal(value)) return null;
  return (
    <div className="qvm-additional-row">
      <span className="qvm-additional-key">{label}</span>
      <span className="qvm-additional-val">{asText(value)}</span>
    </div>
  );
}

// Karta kontrahenta (dostawca / odbiorca)
function PartyCard({ title, party }: { title: string; party: Record<string, unknown> | undefined }) {
  if (!party || !hasVal(party)) return null;
  return (
    <div className="qvm-scan-card">
      <div className="qvm-scan-card-title">{title}</div>
      {hasVal(party.nazwa) && <div className="qvm-scan-card-name">{asText(party.nazwa)}</div>}
      {hasVal(party.adres) && <div className="qvm-scan-card-line">{asText(party.adres)}</div>}
      {hasVal(party.nip) && <div className="qvm-scan-card-line">NIP: {asText(party.nip)}</div>}
    </div>
  );
}

// Kafelek z liczbą (powierzchnia, obwód, ilości)
function StatTile({ value, unit, label }: { value: unknown; unit?: string; label: string }) {
  if (!hasVal(value)) return null;
  return (
    <div className="qvm-scan-stat">
      <div className="qvm-scan-stat-val">
        {asText(value)}
        {unit && <span className="qvm-scan-stat-unit"> {unit}</span>}
      </div>
      <div className="qvm-scan-stat-label">{label}</div>
    </div>
  );
}

function AdditionalData({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(true);

  const d = data as Record<string, any>;
  const dokument = d.dokument as Record<string, any> | undefined;
  const dostawca = d.dostawca as Record<string, any> | undefined;
  const odbiorca = d.odbiorca as Record<string, any> | undefined;
  const zakres = (d.zakres_oferty ?? {}) as Record<string, any>;
  const dodatkowe = d.dodatkowe as Record<string, any> | undefined;

  const zawiera: unknown[] = Array.isArray(zakres.zawiera)
    ? zakres.zawiera.filter(hasVal)
    : hasVal(zakres.zawiera) ? [zakres.zawiera] : [];
  const systemy: Array<Record<string, any>> = Array.isArray(zakres.systemy_aluminiowe)
    ? zakres.systemy_aluminiowe.filter(hasVal)
    : [];
  const szyby: unknown[] = Array.isArray(zakres.szyby_rodzaje)
    ? zakres.szyby_rodzaje.filter(hasVal)
    : hasVal(zakres.szyby_rodzaje) ? [zakres.szyby_rodzaje] : [];

  const hasStats = hasVal(zakres.calkowita_powierzchnia_m2) || hasVal(zakres.calkowity_obwod_m)
    || hasVal(zakres.ilosc_konstrukcji) || hasVal(zakres.ilosc_pozycji);
  const hasKolory = hasVal(zakres.kolor_profili) || hasVal(zakres.kolor_okuc);

  return (
    <div className="qvm-section">
      <button
        type="button"
        className="qvm-section-title qvm-section-title--toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        Dane ze skanowania
        <span style={{ display: "inline-flex", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><I.up s={12} /></span>
      </button>

      {expanded && (
        <div className="qvm-scan">
          {/* Nagłówek dokumentu */}
          {dokument && hasVal(dokument) && (
            <div className="qvm-scan-doc">
              {hasVal(dokument.tytul) && <span className="qvm-scan-doc-title">{asText(dokument.tytul)}</span>}
              {hasVal(dokument.numer) && <span className="qvm-scan-doc-chip">{asText(dokument.numer)}</span>}
              {hasVal(dokument.data) && <span className="qvm-scan-doc-chip"><I.cal s={11} /> {asText(dokument.data)}</span>}
            </div>
          )}

          {/* Kontrahenci */}
          {(hasVal(dostawca) || hasVal(odbiorca)) && (
            <div className="qvm-scan-cards">
              <PartyCard title="Dostawca" party={dostawca} />
              <PartyCard title="Odbiorca" party={odbiorca} />
            </div>
          )}

          {/* Co zawiera oferta */}
          {zawiera.length > 0 && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.check s={12} /> Zakres oferty</div>
              <div className="qvm-scan-chips">
                {zawiera.map((z, i) => (
                  <span key={i} className="qvm-scan-chip">{asText(z)}</span>
                ))}
              </div>
            </div>
          )}

          {/* Kluczowe liczby */}
          {hasStats && (
            <div className="qvm-scan-stats">
              <StatTile value={zakres.calkowita_powierzchnia_m2} unit="m²" label="Powierzchnia" />
              <StatTile value={zakres.calkowity_obwod_m} unit="mb" label="Obwód" />
              <StatTile value={zakres.ilosc_konstrukcji} label="Konstrukcje" />
              <StatTile value={zakres.ilosc_pozycji} label="Pozycje" />
            </div>
          )}

          {/* Kolorystyka */}
          {hasKolory && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.box s={12} /> Kolorystyka</div>
              <InfoRow label="Profile" value={zakres.kolor_profili} />
              <InfoRow label="Okucia" value={zakres.kolor_okuc} />
            </div>
          )}

          {/* Systemy aluminiowe */}
          {systemy.length > 0 && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.layers s={12} /> Systemy aluminiowe</div>
              <div className="qvm-scan-list">
                {systemy.map((s, i) => (
                  <div key={i} className="qvm-scan-list-item">
                    <span className="qvm-scan-list-main">{asText(s.system)}</span>
                    {hasVal(s.producent) && <span className="qvm-scan-list-sub">{asText(s.producent)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Szyby */}
          {szyby.length > 0 && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.glass s={12} /> Szyby</div>
              <div className="qvm-scan-list">
                {szyby.map((s, i) => (
                  <div key={i} className="qvm-scan-list-item">
                    <span className="qvm-scan-list-main">{asText(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uwagi */}
          {hasVal(d.uwagi) && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.doc s={12} /> Uwagi</div>
              <div className="qvm-scan-note">{asText(d.uwagi)}</div>
            </div>
          )}

          {/* Dodatkowe informacje z dokumentu */}
          {dodatkowe && hasVal(dodatkowe) && (
            <div className="qvm-scan-block">
              <div className="qvm-scan-block-title"><I.doc s={12} /> Dodatkowe informacje</div>
              {Object.entries(dodatkowe).map(([k, v]) => (
                <InfoRow key={k} label={k.replace(/_/g, " ")} value={v} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PDF viewer (pdf.js → canvas) ──────────────────────────────────────────────
// Renderujemy PDF na <canvas> przez pdf.js. Dzięki temu podgląd działa niezależnie
// od ustawień przeglądarki (np. "Pobieraj pliki PDF") i nigdy nie pobiera pliku.

function PdfViewer({ data }: { data: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: { numPages: number; getPage: (n: number) => Promise<any>; destroy?: () => void } | null = null;

    void (async () => {
      try {
        setRendering(true);
        setError(null);

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        // pdf.js może przejąć (detach) bufor — pracujemy na kopii.
        const bytes = data.slice();
        pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled || !pdfDoc) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const dpr = window.devicePixelRatio || 1;
        const scale = 1.5;

        for (let n = 1; n <= pdfDoc.numPages; n++) {
          const page = await pdfDoc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.className = "pdf-viewer-page";
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          container.appendChild(canvas);
          await page.render({
            canvas,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
          }).promise;
          if (cancelled) return;
        }

        if (!cancelled) setRendering(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Błąd renderowania PDF");
          setRendering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { pdfDoc?.destroy?.(); } catch { /* noop */ }
    };
  }, [data]);

  return (
    <div className="pdf-viewer">
      {rendering && <div className="pdf-drawer-state">Renderowanie PDF…</div>}
      {error && <div className="pdf-drawer-state pdf-drawer-error">{error}</div>}
      <div ref={containerRef} className="pdf-viewer-pages" />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function QuoteVersionsManager({ quote, archived }: { quote: Quote; archived: boolean }) {
  const versions = (useQuery(api.quoteVersions.listByQuote, { quoteId: quote._id }) ?? []) as QuoteVersion[];
  const [activeId, setActiveId] = useState<Id<"quoteVersions"> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    { fileName: string; data: Uint8Array | null; error: string | null; loading: boolean } | null
  >(null);
  const scannedRef = useRef(false);

  const acceptVersion = useMutation(api.quoteVersions.acceptVersion);
  const rejectVersion = useMutation(api.quoteVersions.rejectVersion);
  const deleteVersion = useMutation(api.quoteVersions.deleteVersion);
  const updateItems = useMutation(api.quoteVersions.updateItems);
  const updateNotes = useMutation(api.quoteVersions.updateNotes);
  const listFiles = useAction(api.sharepoint.listWycenaSubfolderFiles);
  const runOcr = useAction(api.sharepoint.runOcrForFile);
  const getFileContent = useAction(api.sharepoint.getFileForPreview);

  async function openPreview(fileItemId: string, fileName: string) {
    setPreview({ fileName, data: null, error: null, loading: true });
    try {
      const { base64 } = await getFileContent({ quoteId: quote._id, fileId: fileItemId });
      setPreview({ fileName, data: base64ToBytes(base64), error: null, loading: false });
    } catch (e) {
      setPreview({
        fileName,
        data: null,
        error: e instanceof Error ? e.message : "Błąd podglądu",
        loading: false,
      });
    }
  }

  function closePreview() {
    setPreview(null);
  }

  // Select first version by default
  useEffect(() => {
    if (versions.length > 0 && !activeId) {
      setActiveId(versions[0]._id);
    }
  }, [versions.length]);

  // Auto-scan for new PDFs when the component mounts (only once)
  useEffect(() => {
    if (scannedRef.current) return;
    if (quote.sharepoint?.status !== "created") return;
    scannedRef.current = true;

    void (async () => {
      setScanning(true);
      setScanError(null);
      try {
        const files = await listFiles({ quoteId: quote._id });
        const pdfFiles = files.filter((f: any) => f.name.toLowerCase().endsWith(".pdf"));
        if (pdfFiles.length === 0) { setScanning(false); return; }

        const processedIds = new Set(versions.map((v) => v.fileItemId).filter(Boolean));
        const newFiles = pdfFiles.filter((f: any) => !processedIds.has(f.id));

        for (const file of newFiles) {
          try {
            await runOcr({ quoteId: quote._id, fileItemId: file.id, fileName: file.name });
          } catch (ocrErr: any) {
            console.error("Błąd OCR podczas auto-skanowania:", ocrErr);
            setScanError(ocrErr instanceof Error ? ocrErr.message : String(ocrErr));
          }
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Błąd skanowania");
      } finally {
        setScanning(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote._id, quote.sharepoint?.status]);

  const activeVersion = versions.find((v) => v._id === activeId) ?? null;

  if (quote.sharepoint?.status !== "created") {
    return (
      <div className="quote-detail-stack">
        <section className="quote-detail-section">
          <header className="quote-detail-section-head">
            <div className="quote-detail-section-title">
              <span className="quote-detail-section-icon"><I.doc s={14} /></span>
              <span>Wyceny</span>
            </div>
          </header>
          <div className="quote-detail-section-body">
            <div className="quote-detail-empty">
              <div className="quote-detail-empty-text">
                Folder SharePoint nie jest jeszcze gotowy. Poczekaj na jego utworzenie.
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="qvm-root">
      {/* Left panel: version list */}
      <div className="qvm-sidebar">
        <div className="qvm-sidebar-header">
          <span className="qvm-sidebar-title">Historia wycen</span>
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost qvm-sidebar-refresh"
            title="Sprawdź nowe pliki"
            onClick={() => {
              scannedRef.current = false;
              setScanning(true);
              setScanError(null);
              void listFiles({ quoteId: quote._id })
                .then(async (files) => {
                  const pdfFiles = files.filter((f: any) => f.name.toLowerCase().endsWith(".pdf"));
                  const processedIds = new Set(versions.map((v) => v.fileItemId).filter(Boolean));
                  const newFiles = pdfFiles.filter((f: any) => !processedIds.has(f.id));
                  if (newFiles.length === 0) {
                    if (pdfFiles.length === 0) {
                      setScanError("Brak plików PDF w folderze Wycena w SharePoint.");
                    } else {
                      setScanError("Wszystkie pliki PDF w folderze Wycena zostały już przeanalizowane.");
                    }
                    return;
                  }
                  for (const file of newFiles) {
                    try {
                      await runOcr({ quoteId: quote._id, fileItemId: file.id, fileName: file.name });
                    } catch (ocrErr: any) {
                      console.error("Błąd OCR:", ocrErr);
                      setScanError(ocrErr instanceof Error ? ocrErr.message : String(ocrErr));
                    }
                  }
                })
                .catch((e) => setScanError(e instanceof Error ? e.message : "Błąd skanowania"))
                .finally(() => setScanning(false));
            }}
            disabled={scanning}
          >
            <I.refresh s={13} />
          </button>
        </div>

        {scanning && <ScanningIndicator />}
        {scanError && (
          <div className="qvm-scan-error">{scanError}</div>
        )}

        {versions.length === 0 && !scanning && (
          <div className="qvm-sidebar-empty">
            <div className="qvm-sidebar-empty-icon"><I.doc s={24} /></div>
            <div className="qvm-sidebar-empty-title">Brak wycen</div>
            <div className="qvm-sidebar-empty-text">
              Dodaj plik PDF do folderu <strong>Wycena</strong> w SharePoint.
              System automatycznie wykryje go i uruchomi skanowanie.
            </div>
          </div>
        )}

        <div className="qvm-version-list">
          {versions.map((v) => (
            <VersionListItem
              key={v._id}
              version={v}
              isActive={v._id === activeId}
              onClick={() => setActiveId(v._id)}
            />
          ))}
        </div>
      </div>

      {/* Right panel: version detail */}
      <div className="qvm-main">
        {activeVersion ? (
          <VersionDetail
            version={activeVersion}
            archived={archived}
            onAccept={async () => { await acceptVersion({ id: activeVersion._id }); }}
            onReject={async () => { await rejectVersion({ id: activeVersion._id }); }}
            onDelete={async () => {
              await deleteVersion({ id: activeVersion._id });
              setActiveId(versions.find((v) => v._id !== activeVersion._id)?._id ?? null);
            }}
            onSaveItems={async (items, netto, vat, brutto) => {
              await updateItems({
                id: activeVersion._id,
                items,
                valueNetto: netto,
                valueVat: vat,
                valueBrutto: brutto,
              });
            }}
            onSaveNotes={async (notes) => {
              await updateNotes({ id: activeVersion._id, notes });
            }}
            onPreview={
              activeVersion.fileItemId
                ? () => void openPreview(activeVersion.fileItemId!, activeVersion.fileName ?? "Podgląd PDF")
                : undefined
            }
          />
        ) : (
          <div className="qvm-main-empty">
            <div className="qvm-main-empty-icon"><I.doc s={40} /></div>
            <div className="qvm-main-empty-text">Wybierz wersję wyceny z listy po lewej.</div>
          </div>
        )}
      </div>

      {/* Wysuwany podgląd PDF */}
      {preview && (
        <>
          <div className="pdf-drawer-overlay" onClick={closePreview} />
          <div className="pdf-drawer">
            <div className="pdf-drawer-header">
              <span className="pdf-drawer-filename">{preview.fileName}</span>
              <button className="pdf-drawer-close" onClick={closePreview}>
                <I.x s={16} />
              </button>
            </div>
            <div className="pdf-drawer-body">
              {preview.loading && <div className="pdf-drawer-state">Ładowanie podglądu…</div>}
              {preview.error && (
                <div className="pdf-drawer-state pdf-drawer-error">{preview.error}</div>
              )}
              {preview.data && <PdfViewer data={preview.data} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

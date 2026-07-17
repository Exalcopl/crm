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

function AdditionalData({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  const renderVal = (val: unknown): string => {
    if (val == null) return "—";
    if (Array.isArray(val)) return val.map((v) => renderVal(v)).join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const relevantKeys = ["dokument", "dostawca", "odbiorca", "zakres_oferty", "uwagi"] as const;
  const docData = data as Record<string, unknown>;

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
        <div className="qvm-additional">
          {relevantKeys.map((key) => {
            const val = docData[key];
            if (val == null) return null;
            if (typeof val === "object" && !Array.isArray(val)) {
              const obj = val as Record<string, unknown>;
              return (
                <div key={key} className="qvm-additional-group">
                  <div className="qvm-additional-group-title">{key.replace(/_/g, " ")}</div>
                  {Object.entries(obj).map(([k, v]) => (
                    v != null && (
                      <div key={k} className="qvm-additional-row">
                        <span className="qvm-additional-key">{k.replace(/_/g, " ")}</span>
                        <span className="qvm-additional-val">{renderVal(v)}</span>
                      </div>
                    )
                  ))}
                </div>
              );
            }
            return (
              <div key={key} className="qvm-additional-row">
                <span className="qvm-additional-key">{key.replace(/_/g, " ")}</span>
                <span className="qvm-additional-val">{renderVal(val)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function QuoteVersionsManager({ quote, archived }: { quote: Quote; archived: boolean }) {
  const versions = (useQuery(api.quoteVersions.listByQuote, { quoteId: quote._id }) ?? []) as QuoteVersion[];
  const [activeId, setActiveId] = useState<Id<"quoteVersions"> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const acceptVersion = useMutation(api.quoteVersions.acceptVersion);
  const rejectVersion = useMutation(api.quoteVersions.rejectVersion);
  const deleteVersion = useMutation(api.quoteVersions.deleteVersion);
  const updateItems = useMutation(api.quoteVersions.updateItems);
  const updateNotes = useMutation(api.quoteVersions.updateNotes);
  const listFiles = useAction(api.sharepoint.listWycenaSubfolderFiles);
  const runOcr = useAction(api.sharepoint.runOcrForFile);

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
          />
        ) : (
          <div className="qvm-main-empty">
            <div className="qvm-main-empty-icon"><I.doc s={40} /></div>
            <div className="qvm-main-empty-text">Wybierz wersję wyceny z listy po lewej.</div>
          </div>
        )}
      </div>
    </div>
  );
}

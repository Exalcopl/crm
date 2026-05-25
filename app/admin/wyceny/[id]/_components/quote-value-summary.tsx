"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function QuoteValueSummary({
  quoteId,
  value,
  onOpenPozycje,
}: {
  quoteId: Id<"quotes">;
  value: number | null;
  onOpenPozycje: () => void;
}) {
  const items = useQuery(api.quoteItems.list, { quoteId }) ?? [];
  const hasValue = value !== null;
  const netto = hasValue ? value / 1.23 : null;
  const vat = hasValue ? value - (netto ?? 0) : null;

  const previewItems = items.slice(0, 5);
  const remaining = Math.max(items.length - previewItems.length, 0);

  if (!hasValue && items.length === 0) {
    return (
      <div className="quote-detail-value-empty">
        <div className="quote-detail-empty-title">Brak pozycji</div>
        <div className="quote-detail-empty-text">
          Dodaj pierwszą pozycję, aby wyliczyć wartość oferty.
        </div>
        <button
          type="button"
          className="fluent-btn fluent-btn-primary"
          onClick={onOpenPozycje}
        >
          <I.plus s={13} sw={2.2} />
          <span>Otwórz edytor pozycji</span>
        </button>
      </div>
    );
  }

  return (
    <div className="quote-detail-value-wide">
      <div className="quote-detail-value-totals">
        <SummaryCell label="Netto" value={netto ?? 0} />
        <SummaryCell label="VAT 23%" value={vat ?? 0} />
        <SummaryCell label="Brutto" value={value ?? 0} highlight />
      </div>

      {previewItems.length > 0 && (
        <div className="quote-detail-value-positions">
          <div className="quote-detail-value-positions-head">
            <div>Nazwa</div>
            <div>Wymiary</div>
            <div>Materiał</div>
            <div className="align-right">Ilość</div>
            <div className="align-right">Cena jedn.</div>
            <div className="align-right">Wartość</div>
          </div>
          {previewItems.map((it) => (
            <div key={it._id} className="quote-detail-value-positions-row">
              <div className="quote-detail-value-positions-name">{it.name}</div>
              <div>
                {it.dimensions ?? (
                  <span className="quote-detail-muted">—</span>
                )}
              </div>
              <div>
                {it.material ?? <span className="quote-detail-muted">—</span>}
              </div>
              <div className="align-right">{it.qty}</div>
              <div className="align-right">{formatPLN(it.unitPrice)}</div>
              <div className="align-right">{formatPLN(it.lineTotal)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="quote-detail-value-foot">
        <button
          type="button"
          className="quote-detail-value-link"
          onClick={onOpenPozycje}
        >
          {remaining > 0
            ? `Zobacz wszystkie pozycje (+${remaining})`
            : "Edytuj pozycje"}
          <I.arrow s={12} sw={2} />
        </button>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`quote-detail-value-cell${highlight ? " is-highlight" : ""}`}
    >
      <div className="quote-detail-value-cell-label">{label}</div>
      <div className="quote-detail-value-cell-num">
        <span>{formatPLN(value)}</span>
        <em>PLN</em>
      </div>
    </div>
  );
}

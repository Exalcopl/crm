"use client";

import type { Id } from "@/convex/_generated/dataModel";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function QuoteValueSummary({
  quoteId,
  value,
}: {
  quoteId: Id<"quotes">;
  value: number | null;
}) {
  const hasValue = value !== null;
  const netto = hasValue ? value / 1.23 : null;
  const vat = hasValue ? value - (netto ?? 0) : null;

  if (!hasValue) {
    return (
      <div className="quote-detail-value-empty">
        <div className="quote-detail-empty-title">Brak wartości</div>
        <div className="quote-detail-empty-text">
          Wartość oferty nie została określona.
        </div>
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

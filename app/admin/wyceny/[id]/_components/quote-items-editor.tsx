"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type Field = "name" | "dimensions" | "material" | "qty" | "unitPrice";

export function QuoteItemsEditor({
  quoteId,
  disabled,
}: {
  quoteId: Id<"quotes">;
  disabled?: boolean;
}) {
  const items = useQuery(api.quoteItems.list, { quoteId });
  const add = useMutation(api.quoteItems.add);
  const update = useMutation(api.quoteItems.update);
  const remove = useMutation(api.quoteItems.remove);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    dimensions: "",
    material: "",
    qty: "1",
    unitPrice: "",
  });

  const totalBrutto =
    items?.reduce((acc, it) => acc + it.lineTotal, 0) ?? 0;
  const totalNetto = totalBrutto / 1.23;
  const totalVat = totalBrutto - totalNetto;

  async function handleAdd() {
    const name = draft.name.trim();
    const qty = parseNumber(draft.qty);
    const unitPrice = parseNumber(draft.unitPrice);
    if (!name) {
      toast.error("Podaj nazwę pozycji");
      return;
    }
    if (qty === null || qty <= 0) {
      toast.error("Podaj prawidłową ilość");
      return;
    }
    if (unitPrice === null || unitPrice < 0) {
      toast.error("Podaj prawidłową cenę jednostkową");
      return;
    }
    setAdding(true);
    try {
      await add({
        quoteId,
        name,
        dimensions: draft.dimensions.trim() || undefined,
        material: draft.material.trim() || undefined,
        qty,
        unitPrice,
      });
      setDraft({
        name: "",
        dimensions: "",
        material: "",
        qty: "1",
        unitPrice: "",
      });
      toast.success("Pozycja dodana");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się dodać");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: Id<"quoteItems">) {
    if (!window.confirm("Usunąć pozycję?")) return;
    try {
      await remove({ id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się usunąć");
    }
  }

  return (
    <div className="quote-items-editor">
      <div className="quote-items-table">
        <div className="quote-items-row quote-items-head" role="row">
          <div>Nazwa</div>
          <div>Wymiary</div>
          <div>Materiał</div>
          <div className="align-right">Ilość</div>
          <div className="align-right">Cena jedn.</div>
          <div className="align-right">Wartość</div>
          <div></div>
        </div>

        {items === undefined && (
          <div className="quote-items-empty">Wczytywanie…</div>
        )}

        {items !== undefined && items.length === 0 && !disabled && (
          <div className="quote-items-empty">
            Brak pozycji. Dodaj pierwszą poniżej.
          </div>
        )}

        {items?.map((item) => (
          <ItemRow
            key={item._id}
            item={item}
            disabled={disabled}
            onUpdate={(field, raw) =>
              handleUpdateField(update, item, field, raw)
            }
            onRemove={() => void handleRemove(item._id)}
          />
        ))}
      </div>

      {!disabled && (
        <div className="quote-items-add">
          <div className="quote-items-add-grid">
            <input
              className="quote-items-input"
              placeholder="Nazwa, np. Okno PCV 2-szybowe"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="quote-items-input"
              placeholder="Wymiary, np. 120x140"
              value={draft.dimensions}
              onChange={(e) =>
                setDraft({ ...draft, dimensions: e.target.value })
              }
            />
            <input
              className="quote-items-input"
              placeholder="Materiał / kolor"
              value={draft.material}
              onChange={(e) => setDraft({ ...draft, material: e.target.value })}
            />
            <input
              className="quote-items-input align-right"
              placeholder="Ilość"
              value={draft.qty}
              onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
              inputMode="decimal"
            />
            <input
              className="quote-items-input align-right"
              placeholder="Cena jedn. (brutto)"
              value={draft.unitPrice}
              onChange={(e) =>
                setDraft({ ...draft, unitPrice: e.target.value })
              }
              inputMode="decimal"
            />
            <button
              type="button"
              className="fluent-btn fluent-btn-primary quote-items-add-btn"
              onClick={() => void handleAdd()}
              disabled={adding}
            >
              <I.plus s={13} sw={2.2} />
              <span>{adding ? "Dodaję…" : "Dodaj"}</span>
            </button>
          </div>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="quote-items-totals">
          <div className="quote-items-totals-cell">
            <div className="quote-items-totals-label">Netto</div>
            <div className="quote-items-totals-value">
              {formatPLN(totalNetto)} <em>PLN</em>
            </div>
          </div>
          <div className="quote-items-totals-cell">
            <div className="quote-items-totals-label">VAT 23%</div>
            <div className="quote-items-totals-value">
              {formatPLN(totalVat)} <em>PLN</em>
            </div>
          </div>
          <div className="quote-items-totals-cell is-highlight">
            <div className="quote-items-totals-label">Brutto</div>
            <div className="quote-items-totals-value">
              {formatPLN(totalBrutto)} <em>PLN</em>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function handleUpdateField(
  update: ReturnType<typeof useMutation<typeof api.quoteItems.update>>,
  item: Doc<"quoteItems">,
  field: Field,
  raw: string,
) {
  try {
    if (field === "qty" || field === "unitPrice") {
      const parsed = parseNumber(raw);
      if (parsed === null || parsed < 0) {
        toast.error("Nieprawidłowa wartość liczbowa");
        return;
      }
      await update({ id: item._id, [field]: parsed });
    } else {
      await update({ id: item._id, [field]: raw });
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
  }
}

function ItemRow({
  item,
  disabled,
  onUpdate,
  onRemove,
}: {
  item: Doc<"quoteItems">;
  disabled?: boolean;
  onUpdate: (field: Field, raw: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="quote-items-row" role="row">
      <InlineCell
        value={item.name}
        disabled={disabled}
        onCommit={(v) => onUpdate("name", v)}
      />
      <InlineCell
        value={item.dimensions ?? ""}
        placeholder="—"
        disabled={disabled}
        onCommit={(v) => onUpdate("dimensions", v)}
      />
      <InlineCell
        value={item.material ?? ""}
        placeholder="—"
        disabled={disabled}
        onCommit={(v) => onUpdate("material", v)}
      />
      <InlineCell
        value={String(item.qty)}
        align="right"
        disabled={disabled}
        onCommit={(v) => onUpdate("qty", v)}
        numeric
      />
      <InlineCell
        value={formatPLN(item.unitPrice)}
        align="right"
        disabled={disabled}
        onCommit={(v) => onUpdate("unitPrice", v)}
        numeric
      />
      <div className="quote-items-cell align-right quote-items-cell-total">
        {formatPLN(item.lineTotal)}
      </div>
      <div className="quote-items-cell quote-items-cell-actions">
        {!disabled && (
          <button
            type="button"
            className="quote-items-row-remove"
            onClick={onRemove}
            aria-label="Usuń pozycję"
            title="Usuń"
          >
            <I.trash s={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function InlineCell({
  value,
  placeholder,
  align,
  disabled,
  numeric,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  align?: "right";
  disabled?: boolean;
  numeric?: boolean;
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function start() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className={`quote-items-input${align === "right" ? " align-right" : ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        inputMode={numeric ? "decimal" : undefined}
      />
    );
  }

  return (
    <button
      type="button"
      className={`quote-items-cell quote-items-cell-display${
        align === "right" ? " align-right" : ""
      }${disabled ? " is-disabled" : ""}`}
      onClick={start}
      disabled={disabled}
      title={disabled ? undefined : "Kliknij aby edytować"}
    >
      {value || (
        <span className="quote-detail-muted">{placeholder ?? "—"}</span>
      )}
    </button>
  );
}

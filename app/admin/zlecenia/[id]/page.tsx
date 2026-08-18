"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";
import { toast } from "sonner";
import Link from "next/link";
import { QuoteFileBrowser } from "../../wyceny/[id]/_components/quote-file-browser";
import { OrderFileBrowser } from "./_components/order-file-browser";
import { OrderRwView } from "./_components/order-rw-view";
import { InvestmentModal } from "../../wyceny/[id]/_components/investment-section";
import {
  getProjectTypeStyle,
  formatDeadline,
  deadlineTone,
  deadlineDaysFromToday,
  ownerInitials,
  type Quote,
} from "../../_lib/quotes";

type OrderStatus = "nowe" | "akceptacja" | "kompletacja" | "produkcja" | "montaz" | "gotowe" | "wstrzymane";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  nowe: { label: "Nowe", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  akceptacja: { label: "Akceptacja", color: "#8250df", bg: "rgba(130, 80, 223, 0.15)" },
  kompletacja: { label: "W kompletacji", color: "#f0883e", bg: "rgba(240, 136, 62, 0.15)" },
  produkcja: { label: "W produkcji", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  montaz: { label: "Do montażu", color: "#d29922", bg: "rgba(210, 153, 34, 0.15)" },
  gotowe: { label: "Zrealizowane", color: "#3fb950", bg: "rgba(63, 185, 80, 0.15)" },
  wstrzymane: { label: "Wstrzymane", color: "#8b949e", bg: "rgba(139, 148, 158, 0.15)" },
};

function formatCurrency(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
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

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="cal-card" style={{ padding: 0, overflow: "hidden" }}>
      <header
        className="quote-detail-section-head"
        style={{
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "#1f242c",
          borderBottom: isOpen ? "1px solid #30363d" : "none",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#f0f6fc" }}>
          {icon && <span style={{ display: "flex", alignItems: "center", color: "#8b949e" }}>{icon}</span>}
          <span>{title}</span>
        </div>
        <div style={{ color: "#8b949e", display: "flex", alignItems: "center" }}>
          {isOpen ? <I.up s={14} /> : <span style={{ display: "inline-block", transform: "rotate(180deg)" }}><I.up s={14} /></span>}
        </div>
      </header>
      {isOpen && (
        <div style={{ padding: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function OrderSimpleNotes({
  orderId,
  initialNotes,
}: {
  orderId: Id<"orders">;
  initialNotes: string;
}) {
  const updateNotes = useMutation(api.orders.updateNotes);
  const [value, setValue] = useState(initialNotes || "");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!isDirty && (initialNotes || "") !== value) {
      setValue(initialNotes || "");
    }
  }, [initialNotes, isDirty, value]);

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateNotes({ id: orderId, notes: valueRef.current });
      setIsDirty(false);
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2500);
    } catch (e) {
      console.error("Błąd zapisywania notatek:", e);
    } finally {
      setSaving(false);
    }
  }, [isDirty, saving, orderId, updateNotes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        className="fluent-input"
        style={{
          width: "100%",
          minHeight: "120px",
          resize: "vertical",
          fontSize: "13.5px",
          lineHeight: "1.5",
          padding: "10px 12px",
          borderRadius: "6px",
          fontFamily: "inherit",
          border: "1px solid #30363d",
          background: "#0d1117",
          color: "white",
        }}
        placeholder="Wpisz zwykłe notatki do tego zlecenia (bez dat i historii)..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setIsDirty(true);
          setSavedRecently(false);
        }}
        onBlur={() => {
          if (isDirty) {
            void handleSave();
          }
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "28px",
        }}
      >
        <span style={{ fontSize: "11.5px", color: "#8b949e" }}>
          {isDirty
            ? "Niezapisane zmiany — kliknij poza pole lub przycisk Zapisz"
            : "Zapisuje się automatycznie po wyjściu z pola lub przyciskiem"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && (
            <span style={{ fontSize: "12px", color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
              Zapisywanie...
            </span>
          )}
          {!saving && savedRecently && !isDirty && (
            <span
              style={{
                fontSize: "12px",
                color: "#3fb950",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 500,
              }}
            >
              <I.check s={14} /> Zapisano
            </span>
          )}
          {!saving && isDirty && (
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              onClick={handleSave}
            >
              Zapisz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderStatusPipeline({
  currentIndex,
  disabled,
  onStatusChange,
  isCompact,
}: {
  currentIndex: number;
  disabled?: boolean;
  onStatusChange?: (status: OrderStatus) => void;
  isCompact?: boolean;
}) {
  const statuses = Object.keys(STATUS_CONFIG) as OrderStatus[];
  return (
    <div className={`quote-detail-pipeline${isCompact ? " is-compact" : ""}`} aria-label="Status pipeline">
      {statuses.map((status, idx) => {
        const done = idx < currentIndex;
        const current = idx === currentIndex;
        const config = STATUS_CONFIG[status];
        const clickable = !disabled && !current;
        return (
          <div
            key={status}
            className={`quote-detail-pipeline-step${current ? " is-current" : ""}${done ? " is-done" : ""}`}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStatusChange?.(status) : undefined}
              className={`quote-detail-pipeline-marker${clickable ? " is-clickable" : ""}`}
              style={current ? { background: config.color, borderColor: config.color } : done ? { borderColor: config.color } : undefined}
              title={clickable ? `Ustaw status: ${config.label}` : undefined}
            >
              {done ? <I.check s={isCompact ? 8 : 11} sw={2.4} /> : <span className="quote-detail-pipeline-dot" />}
            </button>
            <div className="quote-detail-pipeline-label" style={current ? { color: config.color } : undefined}>
              {config.label}
            </div>
            {statuses.length > 0 && idx < statuses.length - 1 && (
              <div className={`quote-detail-pipeline-bar${idx < currentIndex ? " is-done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deadlineRelative(iso: string): string {
  const days = deadlineDaysFromToday(iso);
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  if (days === -1) return "wczoraj";
  if (days > 0) return `za ${days} dni`;
  return `${Math.abs(days)} dni temu`;
}

// Najbliższe nadchodzące wydarzenie (lub ostatnie minione), po dacie
function nextEventDate(events: { date: string }[]): string | null {
  if (events.length === 0) return null;
  const todayIso = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD lokalnie
  const upcoming = events.filter((e) => e.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length > 0) return upcoming[0].date;
  return [...events].sort((a, b) => b.date.localeCompare(a.date))[0].date;
}

// ─── Nagłówek zlecenia (1:1 z nagłówkiem wyceny) ────────────────────────────────

function OrderClientStrip({ order, quote }: { order: Doc<"orders">; quote: Quote | null }) {
  const router = useRouter();
  const ensureLink = useMutation(api.clients.ensureLinkedToQuote);
  const [linking, setLinking] = useState(false);
  const name = order.clientName;
  const phone = order.clientPhone || quote?.contact?.phone;
  const email = order.clientEmail || quote?.contact?.email;
  const address = [quote?.contact?.street, quote?.contact?.postalCity].filter(Boolean).join(", ");

  async function openClient() {
    if (linking) return;
    if (order.clientId) { router.push(`/admin/klienci/${order.clientId}`); return; }
    if (!quote) return;
    setLinking(true);
    try {
      const clientId = await ensureLink({ quoteId: quote._id });
      router.push(`/admin/klienci/${clientId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się otworzyć klienta");
    } finally {
      setLinking(false);
    }
  }

  return (
    <button type="button" className="quote-detail-client-strip is-clickable" onClick={() => void openClient()} title="Otwórz szczegóły klienta" disabled={linking}>
      <span className="quote-detail-client-avatar" aria-hidden>{ownerInitials(name)}</span>
      <span className="quote-detail-client-info">
        <span className="quote-detail-client-name">
          {name}
          <span className="quote-detail-client-arrow" aria-hidden><I.arrow s={11} sw={2} /></span>
        </span>
      </span>
    </button>
  );
}

function OrderOwnerEditor({ order, ownerName }: { order: Doc<"orders">; ownerName: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  type AssignableUser = { _id: Id<"users">; name: string | null; email: string | null };
  const assignable = (useQuery(api.users.listAssignable, open ? {} : "skip") as AssignableUser[] | undefined) ?? [];
  const setOwner = useMutation(api.orders.setOwner);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onClick); window.removeEventListener("keydown", onKey); };
  }, [open]);

  function assign(userId: Id<"users">) {
    if (order.ownerId !== userId) void setOwner({ id: order._id, ownerId: userId });
    setOpen(false);
  }

  return (
    <div className="quote-detail-meta-owner-wrap" ref={wrapperRef}>
      <button type="button" className="quote-detail-meta-value quote-detail-meta-owner quote-detail-meta-owner-trigger"
        onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="kanban-card-owner-avatar">{ownerInitials(ownerName)}</span>
        <span className="quote-detail-meta-num">{ownerName}</span>
        <span className="quote-detail-meta-owner-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="quote-detail-meta-owner-popover" role="listbox" aria-label="Wybierz opiekuna">
          {assignable.length === 0 ? (
            <div className="quote-detail-meta-owner-empty">Brak użytkowników z rolą admin lub sales.</div>
          ) : (
            assignable.map((u) => {
              const label = u.name?.trim() || u.email?.trim() || "—";
              const active = order.ownerId === u._id;
              return (
                <button key={u._id as unknown as string} type="button" role="option" aria-selected={active}
                  className={`quote-detail-meta-owner-option${active ? " is-active" : ""}`} onClick={() => assign(u._id)}>
                  <span className="kanban-card-owner-avatar">{ownerInitials(label)}</span>
                  <span>{label}</span>
                  {active && <span className="quote-detail-meta-owner-check"><I.check s={12} sw={2.4} /></span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function OrderDetailHeader({ order, quote, onStatusChange, updating }: {
  order: Doc<"orders">;
  quote: Quote | null | undefined;
  onStatusChange: (s: OrderStatus) => void;
  updating: boolean;
}) {
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const updateValueNetto = useMutation(api.orders.updateValueNetto);
  const owners = (useQuery(
    api.users.getByIds,
    order.ownerId ? { userIds: [order.ownerId] } : "skip",
  ) as Array<{ _id: Id<"users">; name: string | null; email: string | null }> | undefined);
  const ownerName = order.ownerId
    ? (owners?.[0]?.name?.trim() || owners?.[0]?.email?.trim() || "…")
    : "Nieprzypisany";

  const [copied, setCopied] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false);
  const ignoreBlurValueRef = useRef(false);

  const events = (useQuery(api.calendarEvents.listByOrder, { orderId: order._id }) as { date: string }[] | undefined) ?? [];
  const nextDate = nextEventDate(events);
  const tone = nextDate ? deadlineTone(nextDate) : "ok";
  const statuses = Object.keys(STATUS_CONFIG) as OrderStatus[];
  const statusIndex = statuses.indexOf(order.status as OrderStatus);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      toast.success(`Skopiowano: ${order.orderNumber}`);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Nie udało się skopiować");
    }
  }

  async function handleSaveValue() {
    if (tempValue.trim() === "") { setIsEditingValue(false); return; }
    const cleanVal = tempValue.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(cleanVal);
    if (isNaN(parsed) || parsed < 0) { toast.error("Podaj poprawną wartość nieujemną"); return; }
    if (parsed === order.valueNetto) { setIsEditingValue(false); return; }
    setIsEditingValue(false);
    try {
      await updateValueNetto({ id: order._id, valueNetto: parsed });
      toast.success("Zaktualizowano wartość zlecenia");
    } catch {
      toast.error("Błąd zapisu");
    }
  }

  const investmentLabel = quote?.investment?.name || quote?.investment?.address || order.investment?.address || "Ustaw lokalizację";
  const pTypes = order.projectType && order.projectType.length > 0 ? order.projectType : (quote?.projectType || []);

  return (
    <div className="quote-detail-header">
      <div className="quote-detail-header-row">
        <div className="quote-detail-header-main">
          <div className="quote-detail-hero">
            <button type="button" className={`quote-detail-id-pill${copied ? " is-copied" : ""}`}
              onClick={() => void copyNumber()} title="Kliknij, aby skopiować numer zlecenia"
              aria-label={`Skopiuj numer zlecenia ${order.orderNumber}`}>
              <span className="quote-detail-id-label">Numer zlecenia</span>
              <span className="quote-detail-id-value">{order.orderNumber}</span>
              <span className="quote-detail-id-icon" aria-hidden>{copied ? <I.check s={14} sw={2.4} /> : <I.doc s={14} />}</span>
            </button>
            <OrderClientStrip order={order} quote={quote ?? null} />
            {(quote || order.investment?.address) && (
              <button type="button" className="quote-detail-investment-trigger" onClick={() => { if(quote) setIsInvestmentOpen(true); }}
                title="Pokaż lokalizację inwestycji" aria-label="Lokalizacja inwestycji"
                style={{ cursor: quote ? "pointer" : "default" }}>
                <span className="quote-detail-investment-trigger-icon"><I.pin s={14} sw={2} /></span>
                <span className="quote-detail-investment-trigger-value">{investmentLabel}</span>
              </button>
            )}
            {pTypes.length > 0 && (
              <div className="quote-detail-hero-types">
                {pTypes.map((t) => {
                  const s = getProjectTypeStyle(projectTypes, t);
                  return (
                    <span key={t} className="kanban-chip kanban-chip-type" style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
                      <span className="kanban-chip-dot" style={{ background: s.fg }} />
                      {t}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="quote-detail-header-meta">
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Wartość netto</div>
            <div className="quote-detail-meta-value">
              {isEditingValue ? (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)}
                    onBlur={() => { if (ignoreBlurValueRef.current) return; void handleSaveValue(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); void handleSaveValue(); }
                      else if (e.key === "Escape") { e.preventDefault(); ignoreBlurValueRef.current = true; setIsEditingValue(false); }
                    }}
                    placeholder="Kwota netto..." className="fluent-input"
                    style={{ padding: "3px 6px", fontSize: "11px", width: "90px", textAlign: "right" }} autoFocus />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "2px" }}>PLN</span>
                </div>
              ) : (
                <div onClick={() => { ignoreBlurValueRef.current = false; setTempValue(String(order.valueNetto)); setIsEditingValue(true); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "2px 4px", borderRadius: "4px" }}
                  title="Kliknij, aby edytować wartość netto">
                  <span className="quote-detail-meta-num">{formatPLN(order.valueNetto)}</span>
                  <span className="quote-detail-meta-unit">PLN</span>
                </div>
              )}
            </div>
          </div>
          <div className="quote-detail-meta-divider" />
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Opiekun</div>
            <OrderOwnerEditor order={order} ownerName={ownerName} />
          </div>
        </div>
      </div>
      <OrderStatusPipeline currentIndex={statusIndex} disabled={updating} onStatusChange={onStatusChange} />
      {isInvestmentOpen && quote && (
        <InvestmentModal quote={quote} archived={false} onClose={() => setIsInvestmentOpen(false)} />
      )}
    </div>
  );
}

// ─── Terminy zlecenia (wydarzenia kalendarza) ───────────────────────────────────

type CalCategory = { _id: Id<"calendarCategories">; name: string; color: string; code: string };
type CalEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  color?: string;
  category?: string;
};

function formatEventDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(iso + "T00:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

function formatEventDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pl-PL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface OrderItem {
  lp: number;
  description: string;
  quantity: number | null;
  unit?: string;
  priceNetto: number | null;
  valueNetto: number | null;
}

function OrderItemsManager({ orderId, order }: { orderId: Id<"orders">; order: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const updateItems = useMutation(api.orders.updateItems);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setItems((order.items || []) as OrderItem[]);
    }
  }, [order.items, isEditing]);

  function handleAddItem() {
    const nextLp = items.length > 0 ? Math.max(...items.map(i => i.lp)) + 1 : 1;
    setItems([
      ...items,
      {
        lp: nextLp,
        description: "",
        quantity: 1,
        unit: "szt.",
        priceNetto: 0,
        valueNetto: 0,
      }
    ]);
  }

  function handleRemoveItem(lp: number) {
    const filtered = items.filter(i => i.lp !== lp);
    const renumbered = filtered.map((item, index) => ({
      ...item,
      lp: index + 1
    }));
    setItems(renumbered);
  }

  function handleFieldChange(lp: number, field: keyof OrderItem, value: any) {
    const updated = items.map(item => {
      if (item.lp === lp) {
        const newItem = { ...item, [field]: value };
        if (field === "quantity" || field === "priceNetto") {
          const qty = field === "quantity" ? value : item.quantity;
          const price = field === "priceNetto" ? value : item.priceNetto;
          newItem.valueNetto = (qty || 0) * (price || 0);
        }
        return newItem;
      }
      return item;
    });
    setItems(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const validItems = items.map(item => ({
        lp: item.lp,
        description: item.description.trim() || "Pozycja bez nazwy",
        quantity: item.quantity != null ? Number(item.quantity) : null,
        unit: item.unit ? item.unit.trim() : undefined,
        priceNetto: item.priceNetto != null ? Number(item.priceNetto) : null,
        valueNetto: item.valueNetto != null ? Number(item.valueNetto) : null,
      }));
      await updateItems({ id: orderId, items: validItems });
      toast.success("Zapisano pozycje zlecenia");
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd zapisu pozycji");
    } finally {
      setSaving(false);
    }
  }

  const totalNetto = isEditing 
    ? items.reduce((acc, item) => acc + (item.valueNetto || 0), 0)
    : (order.valueNetto || 0);
  const totalVat = isEditing
    ? Number((totalNetto * ((order.vatRate || 23) / 100)).toFixed(2))
    : (order.valueVat || 0);
  const totalBrutto = isEditing
    ? Number((totalNetto + totalVat).toFixed(2))
    : (order.valueBrutto || 0);

  return (
    <div className="cal-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" }}>
          Pozycje zlecenia
        </div>
        {!isEditing ? (
          <button
            type="button"
            className="fluent-btn fluent-btn-sm"
            onClick={() => setIsEditing(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <I.edit s={13} /> Edytuj pozycje
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="fluent-btn fluent-btn-sm"
              onClick={handleAddItem}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#21262d", color: "#c9d1d9" }}
            >
              <I.plus s={13} /> Dodaj pozycję
            </button>
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost fluent-btn-sm"
              onClick={() => setIsEditing(false)}
              disabled={saving}
            >
              Anuluj
            </button>
            <button
              type="button"
              className="fluent-btn fluent-btn-primary fluent-btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Zapisywanie..." : "Zapisz"}
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="qvm-items-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="qvm-th" style={{ width: 50 }}>Lp.</th>
              <th className="qvm-th">Opis</th>
              <th className="qvm-th" style={{ width: 90 }}>Ilość</th>
              <th className="qvm-th" style={{ width: 80 }}>Jedn.</th>
              <th className="qvm-th" style={{ width: 120 }}>Cena netto</th>
              <th className="qvm-th" style={{ width: 130 }}>Wartość netto</th>
              {isEditing && <th className="qvm-th" style={{ width: 60, textAlign: "center" }}>Akcja</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isEditing ? 7 : 6} style={{ textAlign: "center", padding: 24, color: "#8b949e" }}>
                  Brak pozycji zlecenia
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.lp} className="qvm-tr">
                  <td className="qvm-td" style={{ color: "#8b949e" }}>{row.lp}</td>
                  <td className="qvm-td">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleFieldChange(row.lp, "description", e.target.value)}
                        style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
                        placeholder="Wpisz opis pozycji..."
                      />
                    ) : (
                      row.description
                    )}
                  </td>
                  <td className="qvm-td">
                    {isEditing ? (
                      <input
                        type="number"
                        value={row.quantity ?? ""}
                        onChange={(e) => handleFieldChange(row.lp, "quantity", e.target.value === "" ? null : Number(e.target.value))}
                        style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
                      />
                    ) : (
                      row.quantity ?? "—"
                    )}
                  </td>
                  <td className="qvm-td">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.unit ?? ""}
                        onChange={(e) => handleFieldChange(row.lp, "unit", e.target.value === "" ? undefined : e.target.value)}
                        style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
                        placeholder="szt."
                      />
                    ) : (
                      row.unit ?? "—"
                    )}
                  </td>
                  <td className="qvm-td">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.priceNetto ?? ""}
                        onChange={(e) => handleFieldChange(row.lp, "priceNetto", e.target.value === "" ? null : Number(e.target.value))}
                        style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
                      />
                    ) : (
                      row.priceNetto != null ? formatCurrency(row.priceNetto) : "—"
                    )}
                  </td>
                  <td className="qvm-td" style={{ fontWeight: 500 }}>
                    {formatCurrency(row.valueNetto || 0)}
                  </td>
                  {isEditing && (
                    <td className="qvm-td" style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ color: "#ffb4af" }}
                        onClick={() => handleRemoveItem(row.lp)}
                        title="Usuń pozycję"
                      >
                        <I.trash s={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 16, background: "#161b22", borderTop: "1px solid #30363d", display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 13 }}>
        <div>Netto: <strong>{formatCurrency(totalNetto)}</strong></div>
        <div>VAT ({order.vatRate || 23}%): <strong>{formatCurrency(totalVat)}</strong></div>
        <div>Brutto: <strong style={{ color: "#3fb950" }}>{formatCurrency(totalBrutto)}</strong></div>
      </div>
    </div>
  );
}

function OrderDeadlines({ orderId, order }: { orderId: Id<"orders">, order: any }) {
  const events = (useQuery(api.calendarEvents.listByOrder, { orderId }) as CalEvent[] | undefined) ?? [];
  const categories = (useQuery(api.calendarCategories.list, {}) as CalCategory[] | undefined) ?? [];
  const createForOrder = useMutation(api.calendarEvents.createForOrder);
  const updateForOrder = useMutation(api.calendarEvents.updateForOrder);
  const removeForOrder = useMutation(api.calendarEvents.removeForOrder);

  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<Id<"calendarEvents"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: "", date: "", startTime: "09:00", endTime: "10:00", description: "" });

  const usedCodes = new Set(events.map((e) => e.category).filter(Boolean));
  const availableCats = categories.filter((c) => !usedCodes.has(c.code));
  const catByCode = new Map(categories.map((c) => [c.code, c]));

  function resetForm() {
    setForm({ category: availableCats[0]?.code ?? "", date: "", startTime: "09:00", endTime: "10:00", description: "" });
  }

  function startAdd() {
    setEditId(null);
    setForm({ category: availableCats[0]?.code ?? "", date: "", startTime: "09:00", endTime: "10:00", description: "" });
    setAdding(true);
  }

  function startEdit(ev: CalEvent) {
    setAdding(false);
    setEditId(ev._id);
    setForm({ category: ev.category ?? "", date: ev.date, startTime: ev.startTime, endTime: ev.endTime, description: ev.description ?? "" });
  }

  async function save() {
    if (!form.date) { toast.error("Podaj datę"); return; }
    setBusy(true);
    try {
      if (editId) {
        await updateForOrder({ id: editId, date: form.date, startTime: form.startTime, endTime: form.endTime, description: form.description || null });
      } else {
        if (!form.category) { toast.error("Wybierz kategorię"); setBusy(false); return; }
        await createForOrder({ orderId, category: form.category, date: form.date, startTime: form.startTime, endTime: form.endTime, description: form.description || undefined });
      }
      setAdding(false); setEditId(null); resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: Id<"calendarEvents">) {
    try { await removeForOrder({ id }); } catch (e) { toast.error(e instanceof Error ? e.message : "Błąd"); }
  }

  const updateDates = useMutation(api.orders.updateDates);
  async function delOrderDate(type: "deadline" | "productionStartDate" | "productionEndDate" | "assemblyStartDate" | "assemblyEndDate" | "deliveryDate" | "acceptanceDate") {
    try {
      await updateDates({ id: orderId, [type]: null });
      toast.success("Usunięto termin");
    } catch(e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Błąd usuwania terminu");
    }
  }

  async function setOrderDateInline(type: "deadline" | "productionStartDate" | "productionEndDate" | "assemblyStartDate" | "assemblyEndDate" | "deliveryDate" | "acceptanceDate", val: string) {
    if (!val) return;
    try {
      await updateDates({ id: orderId, [type]: val });
      toast.success("Zapisano termin");
    } catch(e) {
      toast.error("Błąd zapisu terminu");
    }
  }

  const editing = adding || editId !== null;

  return (
    <div className="cal-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #30363d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#f0f6fc" }}>
          <I.cal s={14} /> Terminy
        </div>
        {!editing && (
          <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={startAdd}>
            <I.plus s={13} /> Dodaj wydarzenie
          </button>
        )}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 1. Utworzenie zlecenia */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #d41d3c`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d41d3c", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Utworzenie zlecenia
            </div>
            <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDateTime(order.createdAt)}</span>
          </div>
        </div>

        {/* 2. Data akceptacji */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #d41d3c`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d41d3c", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Data akceptacji
            </div>
            {order.acceptanceDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.acceptanceDate)}</span>
            ) : (
              <span style={{ color: "#8b949e", fontWeight: 400, fontStyle: "italic" }}>— brak (automatyczna) —</span>
            )}
          </div>
          {order.acceptanceDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("acceptanceDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* 3. Produkcja (początek) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #d41d3c`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d41d3c", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Produkcja (początek)
            </div>
            {order.productionStartDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.productionStartDate)}</span>
            ) : (
              <input
                type="date"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", width: 140, colorScheme: "dark" }}
                onChange={(e) => void setOrderDateInline("productionStartDate", e.target.value)}
              />
            )}
          </div>
          {order.productionStartDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("productionStartDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* 4. Produkcja (zakończenie) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #d41d3c`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d41d3c", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Produkcja (zakończenie)
            </div>
            {order.productionEndDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.productionEndDate)}</span>
            ) : (
              <input
                type="date"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", width: 140, colorScheme: "dark" }}
                onChange={(e) => void setOrderDateInline("productionEndDate", e.target.value)}
              />
            )}
          </div>
          {order.productionEndDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("productionEndDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* 5. Montaż (rozpoczęcie) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #8b5cf6`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Montaż (rozpoczęcie)
            </div>
            {order.assemblyStartDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.assemblyStartDate)}</span>
            ) : (
              <input
                type="date"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", width: 140, colorScheme: "dark" }}
                onChange={(e) => void setOrderDateInline("assemblyStartDate", e.target.value)}
              />
            )}
          </div>
          {order.assemblyStartDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("assemblyStartDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* 6. Montaż (zakończenie) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #8b5cf6`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Montaż (zakończenie)
            </div>
            {order.assemblyEndDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.assemblyEndDate)}</span>
            ) : (
              <input
                type="date"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", width: 140, colorScheme: "dark" }}
                onChange={(e) => void setOrderDateInline("assemblyEndDate", e.target.value)}
              />
            )}
          </div>
          {order.assemblyEndDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("assemblyEndDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* 7. Data odbioru */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid #d41d3c`, borderRadius: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d41d3c", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500, flexShrink: 0, width: 180 }}>
              Data odbioru
            </div>
            {order.deliveryDate ? (
              <span style={{ color: "#8b949e", fontWeight: 400 }}>{formatEventDate(order.deliveryDate)}</span>
            ) : (
              <input
                type="date"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", width: 140, colorScheme: "dark" }}
                onChange={(e) => void setOrderDateInline("deliveryDate", e.target.value)}
              />
            )}
          </div>
          {order.deliveryDate && (
            <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void delOrderDate("deliveryDate")}><I.trash s={13} /></button>
          )}
        </div>

        {/* Wydarzenia w kalendarzu */}
        {events.map((ev) => {
          const cat = ev.category ? catByCode.get(ev.category) : undefined;
          const color = cat?.color ?? ev.color ?? "#9ca3af";
          if (editId === ev._id) return <EventForm key={ev._id} form={form} setForm={setForm} categories={[]} lockCategory catColor={color} busy={busy} onSave={save} onCancel={() => { setEditId(null); resetForm(); }} />;
          return (
            <div key={ev._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#0d1117", border: "1px solid #21262d", borderLeft: `3px solid ${color}`, borderRadius: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#f0f6fc", fontWeight: 500 }}>
                  {cat?.name ?? ev.category ?? "Termin"}
                  <span style={{ color: "#8b949e", fontWeight: 400, marginLeft: 8 }}>{formatEventDate(ev.date)} · {ev.startTime}–{ev.endTime}</span>
                </div>
                {ev.description && <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>{ev.description}</div>}
              </div>
              <button type="button" className="icon-btn" title="Edytuj" onClick={() => startEdit(ev)}><I.edit s={13} /></button>
              <button type="button" className="icon-btn" title="Usuń" style={{ color: "#ffb4af" }} onClick={() => void del(ev._id)}><I.trash s={13} /></button>
            </div>
          );
        })}

        {adding && (
          <EventForm form={form} setForm={setForm} categories={availableCats} busy={busy} onSave={save} onCancel={() => { setAdding(false); resetForm(); }} />
        )}
      </div>
    </div>
  );
}

function EventForm({
  form, setForm, categories, lockCategory, catColor, busy, onSave, onCancel,
}: {
  form: { category: string; date: string; startTime: string; endTime: string; description: string };
  setForm: (f: { category: string; date: string; startTime: string; endTime: string; description: string }) => void;
  categories: CalCategory[];
  lockCategory?: boolean;
  catColor?: string;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputStyle: React.CSSProperties = { background: "#0d1117", border: "1px solid #30363d", color: "white", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" };
  return (
    <div style={{ padding: 12, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {!lockCategory ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 11, color: "#8b949e" }}>Kategoria</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={busy} style={inputStyle}>
              {categories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: catColor }} />
            <span style={{ fontSize: 12, color: "#8b949e" }}>Edycja terminu</span>
          </div>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>Data</span>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={busy} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>Od</span>
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={busy} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>Do</span>
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} disabled={busy} style={inputStyle} />
        </label>
      </div>
      <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opis (opcjonalnie)" disabled={busy} style={inputStyle} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={onCancel} disabled={busy}>Anuluj</button>
        <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={onSave} disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz"}</button>
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const orderId = id as Id<"orders">;

  const order = useQuery(api.orders.get, { id: orderId });
  const updateOrderStatus = useMutation(api.orders.updateStatus);

  const quote = useQuery(
    api.quotes.get,
    order && order.quoteId ? { id: order.quoteId } : "skip"
  );

  const quoteActivities = useQuery(
    api.quoteActivity.list,
    order && order.quoteId ? { quoteId: order.quoteId } : "skip"
  ) ?? [];

  const orderActivities = useQuery(
    api.orderActivity.list,
    order ? { orderId: order._id } : "skip"
  ) ?? [];

  const activities = [...quoteActivities, ...orderActivities].sort((a, b) => b.createdAt - a.createdAt);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [activeView, setActiveView] = useState<"szczegoly" | "rw">("szczegoly");

  const archiveOrder = useMutation(api.orders.archive);
  const restoreOrder = useMutation(api.orders.restore);
  const removeOrder = useMutation(api.orders.remove);

  const [updating, setUpdating] = useState(false);

  if (order === undefined) {
    return (
      <main className="fluent-content">
        <div className="quote-detail-missing">
          <div className="quote-detail-missing-title">Ładowanie zlecenia…</div>
        </div>
      </main>
    );
  }

  if (order === null) {
    return (
      <main className="fluent-content">
        <div className="quote-detail-missing">
          <div className="quote-detail-missing-title">Nie znaleziono zlecenia</div>
          <Link href="/admin/zlecenia" className="quote-detail-missing-link">
            ← Wróć do listy zleceń
          </Link>
        </div>
      </main>
    );
  }

  async function handleStatusChange(status: OrderStatus) {
    setUpdating(true);
    try {
      await updateOrderStatus({ id: orderId, status });
      toast.success("Status zlecenia został zaktualizowany");
    } catch (err: any) {
      toast.error(err.message || "Błąd zmiany statusu");
    } finally {
      setUpdating(false);
    }
  }

  async function confirmDelete() {
    if (!order) return;
    try {
      await removeOrder({ id: order._id });
      toast.success("Zlecenie zostało usunięte");
      router.push("/admin/zlecenia");
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas usuwania zlecenia");
    }
  }

  async function confirmArchive() {
    if (!order) return;
    try {
      await archiveOrder({ id: order._id });
      toast.success("Zlecenie zostało zarchiwizowane");
      router.push("/admin/zlecenia");
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas archiwizacji zlecenia");
    }
  }

  async function toggleArchive() {
    if (!order) return;
    if (order.archived) {
      try {
        await restoreOrder({ id: order._id });
        toast.success("Zlecenie zostało przywrócone");
      } catch (e: any) {
        toast.error(e.message || "Błąd podczas przywracania zlecenia");
      }
    } else {
      setConfirmArchiveOpen(true);
    }
  }

  const currentStatus = order.status as OrderStatus;
  const config = STATUS_CONFIG[currentStatus];
  const statuses = Object.keys(STATUS_CONFIG) as OrderStatus[];
  const statusIndex = statuses.indexOf(currentStatus);

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn
            icon={<I.arrowLeft s={22} />}
            label="Wróć"
            onClick={() => router.push("/admin/zlecenia")}
          />
        </RibbonGroup>
        <RibbonGroup label="Widok">
          <RibbonBtn
            icon={<I.doc s={22} />}
            label="Szczegóły"
            active={activeView === "szczegoly"}
            onClick={() => setActiveView("szczegoly")}
          />
          <RibbonBtn
            icon={<I.rw s={22} />}
            label="Rozchód (RW)"
            active={activeView === "rw"}
            onClick={() => setActiveView("rw")}
          />
        </RibbonGroup>
        <RibbonGroup label="Operacje">
          <RibbonBtn
            icon={<I.link s={22} />}
            label="Otwórz folder"
            disabled={!order.sharepoint?.webUrl}
            onClick={() => order.sharepoint?.webUrl && window.open(order.sharepoint.webUrl, "_blank")}
          />
          <RibbonBtn
            icon={order.archived ? <I.arrowLeft s={22} /> : <I.archive s={22} />}
            label={order.archived ? "Przywróć" : "Archiwizuj"}
            onClick={toggleArchive}
          />
          <RibbonBtn
            icon={<I.trash s={22} />}
            label="Usuń"
            onClick={() => setConfirmDeleteOpen(true)}
          />
        </RibbonGroup>
      </div>

      {activeView === "rw" && (
        <main className="fluent-content" style={{ padding: "16px 24px" }}>
          <OrderRwView orderId={orderId} />
        </main>
      )}
      <main className="fluent-content" style={{ padding: "16px 24px", display: activeView === "szczegoly" ? "flex" : "none", flexDirection: "column", gap: 20 }}>
        {/* Nagłówek 1:1 z wyceną */}
        <OrderDetailHeader
          order={order}
          quote={quote as unknown as Quote | null | undefined}
          onStatusChange={handleStatusChange}
          updating={updating}
        />

        {/* Grid 4-kolumnowy (taki sam jak wycena) */}
        <div className="quote-detail-grid-customizable">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="quote-widget-item">
              <OrderDeadlines orderId={orderId} order={order} />
            </div>
            {quote?.sharepoint ? (
              <QuoteFileBrowser quote={quote} archived={false} />
            ) : order.sharepoint ? (
              <OrderFileBrowser order={order} archived={false} />
            ) : null}
            {/* Historia i Aktywność została przeniesiona do kolumny 4 */}
          </div>

          {/* Kolumny 2-3: Notatki + Pozycje */}
          <div className="quote-widget-item quote-widget-span-2" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="cal-card">
              <div className="cal-card-title">Notatki</div>
              <OrderSimpleNotes orderId={orderId} initialNotes={order.notes || ""} />
            </div>
            
            <OrderItemsManager orderId={orderId} order={order} />
          </div>

          {/* Kolumna 4: Historia */}
          <div className="quote-widget-item quote-widget-span-1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CollapsibleSection title="Historia i Aktywność" icon={<I.clock s={14} />}>
              <div className="order-activities-list">
                {activities.length === 0 ? (
                  <div style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
                    Brak wpisów w historii
                  </div>
                ) : (
                activities.map((act: any) => (
                  <div key={act._id} className="order-activity-item">
                    <div className="order-activity-header">
                      <span className="order-activity-author">{act.authorName}</span>
                      <span className="order-activity-time">{formatDate(act.createdAt)}</span>
                    </div>
                    <div className="order-activity-title">{act.title}</div>
                    {act.detail && <div className="order-activity-detail">{act.detail}</div>}
                  </div>
                ))
                )}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .order-details-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .order-details-columns {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .order-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 20px;
          margin-top: 8px;
        }
        .order-field-label {
          font-size: 11px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .order-field-value {
          font-size: 13.5px;
          color: #f0f6fc;
        }
        .order-activities-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .order-activity-item {
          background: #0d1117;
          border: 1px solid #21262d;
          border-radius: 6px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .order-activity-header {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          color: #8b949e;
        }
        .order-activity-author {
          font-weight: 600;
        }
        .order-activity-title {
          font-weight: 500;
          font-size: 12.5px;
          color: #c9d1d9;
        }
        .order-activity-detail {
          font-size: 11.5px;
          color: #8b949e;
        }
      `}</style>
      {confirmDeleteOpen && (
        <ConfirmDeleteModal
          orderId={order.orderNumber}
          clientName={order.clientName}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {confirmArchiveOpen && (
        <ConfirmArchiveModal
          orderId={order.orderNumber}
          clientName={order.clientName}
          onCancel={() => setConfirmArchiveOpen(false)}
          onConfirm={() => void confirmArchive()}
        />
      )}
    </>
  );
}
function ConfirmDeleteModal({
  orderId,
  clientName,
  onCancel,
  onConfirm,
}: {
  orderId: string;
  clientName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Usuń zlecenie"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="fluent-modal fluent-modal-sm">
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon fluent-modal-title-icon-danger">
              <I.trash s={16} sw={2.2} />
            </span>
            <span>Usuń zlecenie</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onCancel}
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>
        <div className="fluent-modal-body">
          <p className="fluent-modal-text">
            Czy na pewno chcesz usunąć zlecenie{" "}
            <strong>{orderId}</strong>
            {clientName ? (
              <>
                {" "}dla klienta <strong>{clientName}</strong>
              </>
            ) : null}
            ?
          </p>
          <p className="fluent-modal-text fluent-modal-text-muted">
            Tej operacji nie można cofnąć.
          </p>
        </div>
        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onCancel}
            autoFocus
          >
            Nie
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-danger"
            onClick={onConfirm}
          >
            <I.trash s={14} sw={2.2} />
            <span>Tak, usuń</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function ConfirmArchiveModal({
  orderId,
  clientName,
  onCancel,
  onConfirm,
}: {
  orderId: string;
  clientName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, isLoading]);

  function handleConfirm() {
    setIsLoading(true);
    setTimeout(() => {
      onConfirm();
      setIsLoading(false);
    }, 300);
  }

  return (
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Archiwizuj zlecenie"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div className="fluent-modal fluent-modal-sm">
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon">
              <I.archive s={16} sw={2.2} />
            </span>
            <span>Archiwizuj zlecenie</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onCancel}
            aria-label="Zamknij"
            disabled={isLoading}
          >
            ×
          </button>
        </header>
        <div className="fluent-modal-body">
          <p className="fluent-modal-text">
            Na pewno archiwizować zlecenie{" "}
            <strong>{orderId}</strong>
            {clientName ? (
              <>
                {" "}dla klienta <strong>{clientName}</strong>
              </>
            ) : null}
            ?
          </p>
        </div>
        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onCancel}
            autoFocus
            disabled={isLoading}
          >
            Nie
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-primary"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-small" aria-hidden="true" />
                <span>Archiwizuję…</span>
              </>
            ) : (
              <>
                <I.archive s={14} sw={2.2} />
                <span>Tak, archiwizuj</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import {
  PROJECT_TYPE_STYLES,
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  deadlineDaysFromToday,
  deadlineTone,
  formatDeadline,
  ownerInitials,
  type Quote,
} from "../../_lib/quotes";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";
import { OwnerNamesProvider, useOwnerName } from "../../_lib/owner-names";

type DetailTab = "szczegoly" | "pozycje" | "pomiary" | "pliki" | "aktywnosc" | "powiazane";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "szczegoly", label: "Szczegóły", icon: <I.doc s={22} /> },
  { id: "pozycje", label: "Pozycje", icon: <I.box s={22} /> },
  { id: "pomiary", label: "Pomiary", icon: <I.ruler s={22} /> },
  { id: "pliki", label: "Pliki", icon: <I.paperclip s={22} /> },
  { id: "aktywnosc", label: "Aktywność", icon: <I.clock s={22} /> },
  { id: "powiazane", label: "Powiązane", icon: <I.link s={22} /> },
];

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const quote = useQuery(api.quotes.get, { id: id as Id<"quotes"> }) as Quote | null | undefined;
  const removeQuote = useMutation(api.quotes.remove);
  const archiveQuote = useMutation(api.quotes.archive);
  const restoreQuote = useMutation(api.quotes.restore);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DetailTab>("szczegoly");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const isArchived = quote?.archived === true;

  async function confirmDelete() {
    if (!quote) return;
    await removeQuote({ id: quote._id });
    setConfirmDeleteOpen(false);
    router.push(isArchived ? "/admin/archiwum" : "/admin");
  }

  function toggleArchive() {
    if (!quote) return;
    if (isArchived) {
      void confirmRestore();
    } else {
      setConfirmArchiveOpen(true);
    }
  }

  async function confirmArchive() {
    if (!quote) return;
    await archiveQuote({ id: quote._id });
    setConfirmArchiveOpen(false);
    router.push("/admin");
  }

  async function confirmRestore() {
    if (!quote) return;
    await restoreQuote({ id: quote._id });
    router.push("/admin");
  }

  if (quote === undefined) {
    return (
      <>
        <QuoteDetailRibbon
          onBack={() => router.push("/admin")}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onDelete={() => setConfirmDeleteOpen(true)}
          onArchive={toggleArchive}
          quote={undefined}
          archived={false}
          disabled
        />
        <main className="fluent-content">
          <div className="quote-detail-missing">
            <div className="quote-detail-missing-title">Ładowanie…</div>
          </div>
        </main>
      </>
    );
  }

  if (quote === null) {
    return (
      <>
        <QuoteDetailRibbon
          onBack={() => router.push("/admin")}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onDelete={() => {}}
          onArchive={() => {}}
          quote={null}
          archived={false}
          disabled
        />
        <main className="fluent-content">
          <div className="quote-detail-missing">
            <div className="quote-detail-missing-title">Nie znaleziono wyceny</div>
            <div className="quote-detail-missing-id">ID: {id}</div>
            <Link href="/admin" className="quote-detail-missing-link">
              ← Wróć do listy wycen
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <QuoteDetailRibbon
        onBack={() => router.push(isArchived ? "/admin/archiwum" : "/admin")}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDelete={() => setConfirmDeleteOpen(true)}
        onArchive={toggleArchive}
        quote={quote}
        archived={isArchived}
      />
      <main className="fluent-content">
        <QuoteDetailLayout
          quote={quote}
          activeTab={activeTab}
          archived={isArchived}
          onRestore={toggleArchive}
        />
      </main>
      {confirmDeleteOpen && (
        <ConfirmDeleteModal
          quoteId={quote.id}
          clientName={quote.contact.name}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {confirmArchiveOpen && (
        <ConfirmArchiveModal
          quoteId={quote.id}
          clientName={quote.contact.name}
          onCancel={() => setConfirmArchiveOpen(false)}
          onConfirm={() => void confirmArchive()}
        />
      )}
    </>
  );
}

function ConfirmDeleteModal({
  quoteId,
  clientName,
  onCancel,
  onConfirm,
}: {
  quoteId: string;
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
      aria-label="Usuń wycenę"
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
            <span>Usuń wycenę</span>
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
            Czy na pewno chcesz usunąć wycenę{" "}
            <strong>{quoteId}</strong>
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
  quoteId,
  clientName,
  onCancel,
  onConfirm,
}: {
  quoteId: string;
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
      aria-label="Archiwizuj wycenę"
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
            <span>Archiwizuj wycenę</span>
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
            Na pewno archiwizować wycenę{" "}
            <strong>{quoteId}</strong>
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

function QuoteDetailRibbon({
  onBack,
  activeTab,
  onTabChange,
  onDelete,
  onArchive,
  quote,
  archived,
  disabled,
}: {
  onBack: () => void;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onDelete: () => void;
  onArchive: () => void;
  quote?: Quote | null;
  archived: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn icon={<I.arrowLeft s={22} />} label="Wróć do listy" onClick={onBack} />
      </RibbonGroup>
      <RibbonGroup label="Wycena">
        {TABS.map((t) => (
          <RibbonBtn
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={activeTab === t.id}
            disabled={disabled}
            onClick={() => onTabChange(t.id)}
          />
        ))}
      </RibbonGroup>
      <RibbonGroup label="Operacje">
        {quote && <SharepointRibbonBtn quote={quote} disabled={disabled} />}
        <RibbonBtn
          icon={archived ? <I.arrowLeft s={22} /> : <I.archive s={22} />}
          label={archived ? "Przywróć" : "Archiwizuj"}
          disabled={disabled}
          onClick={onArchive}
        />
        <RibbonBtn
          icon={<I.trash s={22} />}
          label="Usuń"
          disabled={disabled}
          onClick={onDelete}
        />
      </RibbonGroup>
    </div>
  );
}

function QuoteDetailLayout({
  quote,
  activeTab,
  archived,
  onRestore,
}: {
  quote: Quote;
  activeTab: DetailTab;
  archived: boolean;
  onRestore: () => void;
}) {
  return (
    <OwnerNamesProvider quotes={[quote]}>
      <div className="quote-detail">
        {archived && <ArchivedBanner onRestore={onRestore} />}
        <QuoteDetailHeader quote={quote} archived={archived} />
        <div className="quote-detail-main">
          {activeTab === "szczegoly" && <TabSzczegoly quote={quote} archived={archived} />}
          {activeTab === "pozycje" && <TabPozycje quote={quote} />}
          {activeTab === "pomiary" && <TabPomiary quote={quote} />}
          {activeTab === "pliki" && <TabPliki />}
          {activeTab === "aktywnosc" && <TabAktywnosc quote={quote} />}
          {activeTab === "powiazane" && <TabPowiazane />}
        </div>
      </div>
    </OwnerNamesProvider>
  );
}

function ArchivedBanner({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="quote-detail-archived-banner" role="status">
      <span className="quote-detail-archived-banner-icon" aria-hidden="true">
        <I.archive s={18} sw={2} />
      </span>
      <div className="quote-detail-archived-banner-text">
        <div className="quote-detail-archived-banner-title">
          Ta wycena jest w archiwum
        </div>
        <div className="quote-detail-archived-banner-sub">
          Tylko do odczytu — zmiany nie będą zapisywane.
        </div>
      </div>
      <button
        type="button"
        className="quote-detail-archived-banner-action"
        onClick={onRestore}
      >
        <span>Przywróć</span>
        <I.arrowLeft s={12} sw={2.2} />
      </button>
    </div>
  );
}

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function deadlineRelative(iso: string): string {
  const days = deadlineDaysFromToday(iso);
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  if (days === -1) return "wczoraj";
  if (days > 0) return `za ${days} dni`;
  return `${Math.abs(days)} dni temu`;
}

function SharepointRibbonBtn({
  quote,
  disabled,
}: {
  quote: Quote;
  disabled?: boolean;
}) {
  const retry = useMutation(api.quotes.retrySharepoint);
  const [retrying, setRetrying] = useState(false);
  const sp = quote.sharepoint;

  async function handleRetry() {
    setRetrying(true);
    try {
      await retry({ id: quote._id });
    } finally {
      setRetrying(false);
    }
  }

  function handleOpen() {
    if (sp?.status === "created" && sp.webUrl) {
      window.open(sp.webUrl, "_blank");
    }
  }

  if (!sp) {
    return (
      <RibbonBtn
        icon={<I.plus s={22} />}
        label="Utwórz folder"
        disabled={disabled || retrying}
        onClick={handleRetry}
      />
    );
  }

  if (sp.status === "pending") {
    return (
      <RibbonBtn
        icon={<span className="spinner-small" aria-hidden />}
        label="Tworzenie…"
        disabled
      />
    );
  }

  if (sp.status === "created") {
    return (
      <RibbonBtn
        icon={<I.link s={22} />}
        label="Otwórz folder"
        disabled={disabled}
        onClick={handleOpen}
      />
    );
  }

  return (
    <RibbonBtn
      icon={<I.alert s={22} />}
      label="Ponów"
      disabled={disabled || retrying}
      onClick={handleRetry}
    />
  );
}

function SharepointMeta({ quote }: { quote: Quote }) {
  const retry = useMutation(api.quotes.retrySharepoint);
  const [retrying, setRetrying] = useState(false);
  const sp = quote.sharepoint;

  async function handleRetry() {
    setRetrying(true);
    try {
      await retry({ id: quote._id });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="quote-detail-meta-item">
      <div className="quote-detail-meta-label">SharePoint</div>
      <div className="quote-detail-meta-value">
        {!sp ? (
          <span className="quote-detail-meta-sp-pending">
            <span className="quote-detail-meta-sp-spinner" aria-hidden />
            Tworzenie folderu…
          </span>
        ) : sp.status === "created" ? (
          <a
            href={sp.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quote-detail-meta-sp-link"
          >
            <I.link s={13} />
            Otwórz folder
          </a>
        ) : (
          <span className="quote-detail-meta-sp-failed">
            <I.alert s={13} />
            Błąd
            <button
              className="quote-detail-meta-sp-retry"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? "…" : "Ponów"}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function QuoteDetailHeader({ quote, archived }: { quote: Quote; archived: boolean }) {
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const statusIndex = QUOTE_STATUSES.indexOf(quote.status);
  const ownerName = useOwnerName(quote);

  return (
    <div className="quote-detail-header">
      <div className="quote-detail-header-row">
        <div className="quote-detail-header-main">
          <div className="quote-detail-header-idline">
            <span className="quote-detail-id">{quote.id}</span>
            {quote.projectType.map((t) => {
              const s = PROJECT_TYPE_STYLES[t];
              return (
                <span
                  key={t}
                  className="kanban-chip kanban-chip-type"
                  style={{
                    background: s.bg,
                    color: s.fg,
                    borderColor: s.border,
                  }}
                >
                  <span className="kanban-chip-dot" style={{ background: s.fg }} />
                  {t}
                </span>
              );
            })}
          </div>
          <div className="quote-detail-client">{quote.contact.name}</div>
        </div>
        <div className="quote-detail-header-meta">
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Wartość</div>
            <div className="quote-detail-meta-value">
              {hasValue ? (
                <>
                  <span className="quote-detail-meta-num">{formatPLN(quote.value!)}</span>
                  <span className="quote-detail-meta-unit">PLN</span>
                </>
              ) : (
                <span className="quote-detail-meta-empty">— brak —</span>
              )}
            </div>
          </div>
          <div className="quote-detail-meta-divider" />
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Termin</div>
            <div className={`quote-detail-meta-value tone-${tone}`}>
              <span className="quote-detail-meta-num">{formatDeadline(quote.deadline)}</span>
              <span className="quote-detail-meta-unit">{deadlineRelative(quote.deadline)}</span>
            </div>
          </div>
          <div className="quote-detail-meta-divider" />
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Opiekun</div>
            <OwnerEditor quote={quote} ownerName={ownerName} disabled={archived} />
          </div>
          <div className="quote-detail-meta-divider" />
          <SharepointMeta quote={quote} />
        </div>
      </div>
      <QuoteStatusPipeline currentIndex={statusIndex} />
    </div>
  );
}

function OwnerEditor({
  quote,
  ownerName,
  disabled,
}: {
  quote: Quote;
  ownerName: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  type AssignableUser = { _id: Id<"users">; name: string | null; email: string | null };
  const assignable =
    (useQuery(api.users.listAssignable, open ? {} : "skip") as
      | AssignableUser[]
      | undefined) ?? [];

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setOwner = useMutation(api.quotes.setOwner);

  function assign(userId: Id<"users">) {
    if (quote.ownerId === userId) {
      setOpen(false);
      return;
    }
    void setOwner({ id: quote._id, ownerId: userId });
    setOpen(false);
  }

  return (
    <div className="quote-detail-meta-owner-wrap" ref={wrapperRef}>
      <button
        type="button"
        className="quote-detail-meta-value quote-detail-meta-owner quote-detail-meta-owner-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="kanban-card-owner-avatar">{ownerInitials(ownerName)}</span>
        <span className="quote-detail-meta-num">{ownerName}</span>
        {!disabled && (
          <span className="quote-detail-meta-owner-caret" aria-hidden>
            ▾
          </span>
        )}
      </button>
      {open && (
        <div
          className="quote-detail-meta-owner-popover"
          role="listbox"
          aria-label="Wybierz opiekuna"
        >
          {assignable.length === 0 ? (
            <div className="quote-detail-meta-owner-empty">
              Brak użytkowników z rolą admin lub sales.
            </div>
          ) : (
            assignable.map((u) => {
              const label = u.name?.trim() || u.email?.trim() || "—";
              const active = quote.ownerId === u._id;
              return (
                <button
                  key={u._id as unknown as string}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`quote-detail-meta-owner-option${
                    active ? " is-active" : ""
                  }`}
                  onClick={() => assign(u._id)}
                >
                  <span className="kanban-card-owner-avatar">
                    {ownerInitials(label)}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function QuoteStatusPipeline({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="quote-detail-pipeline" aria-label="Status pipeline">
      {QUOTE_STATUSES.map((status, idx) => {
        const done = idx < currentIndex;
        const current = idx === currentIndex;
        const color = QUOTE_STATUS_COLORS[status];
        return (
          <div
            key={status}
            className={`quote-detail-pipeline-step${current ? " is-current" : ""}${
              done ? " is-done" : ""
            }`}
          >
            <div className="quote-detail-pipeline-marker" style={current ? { background: color, borderColor: color } : done ? { borderColor: color } : undefined}>
              {done ? <I.check s={11} sw={2.4} /> : <span className="quote-detail-pipeline-dot" />}
            </div>
            <div className="quote-detail-pipeline-label" style={current ? { color } : undefined}>
              {status}
            </div>
            {idx < QUOTE_STATUSES.length - 1 && (
              <div className={`quote-detail-pipeline-bar${idx < currentIndex ? " is-done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  action,
  bodyClassName,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="quote-detail-section">
      <header className="quote-detail-section-head">
        <div className="quote-detail-section-title">
          {icon && <span className="quote-detail-section-icon">{icon}</span>}
          <span>{title}</span>
        </div>
        {action && <div className="quote-detail-section-action">{action}</div>}
      </header>
      <div className={`quote-detail-section-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="quote-detail-field">
      <div className="quote-detail-field-label">{label}</div>
      <div className="quote-detail-field-value">{value}</div>
    </div>
  );
}

function TabSzczegoly({ quote, archived }: { quote: Quote; archived: boolean }) {
  const hasValue = quote.value !== null;
  const netto = hasValue ? quote.value! / 1.23 : null;
  const vat = hasValue ? quote.value! - netto! : null;
  const ownerName = useOwnerName(quote);
  void archived;

  return (
    <div className="quote-detail-stack-row">
      <Section title="Dane kontaktowe" icon={<I.user s={14} />}>
        <div className="quote-detail-fields">
          <Field label="Nazwa / firma" value={quote.contact.name} />
          <Field
            label="Ulica"
            value={
              quote.contact.street ? (
                quote.contact.street
              ) : (
                <span className="quote-detail-muted">— uzupełnij —</span>
              )
            }
          />
          <Field
            label="Kod, miasto"
            value={
              quote.contact.postalCity ? (
                quote.contact.postalCity
              ) : (
                <span className="quote-detail-muted">— uzupełnij —</span>
              )
            }
          />
          <Field
            label="Telefon"
            value={
              <span className="quote-detail-inline">
                <I.phone s={12} />
                {quote.contact.phone ? (
                  <span>{quote.contact.phone}</span>
                ) : (
                  <span className="quote-detail-muted">— uzupełnij —</span>
                )}
              </span>
            }
          />
          <Field
            label="E-mail"
            value={
              <span className="quote-detail-inline">
                <I.mail s={12} />
                {quote.contact.email ? (
                  <span>{quote.contact.email}</span>
                ) : (
                  <span className="quote-detail-muted">— uzupełnij —</span>
                )}
              </span>
            }
          />
        </div>
      </Section>

      <Section title="Projekt" icon={<I.layers s={14} />}>
        <div className="quote-detail-fields">
          <Field
            label="Typ"
            value={
              quote.projectType.length > 0 ? (
                <div className="quote-detail-types">
                  {quote.projectType.map((t) => {
                    const s = PROJECT_TYPE_STYLES[t];
                    return (
                      <span
                        key={t}
                        className="kanban-chip kanban-chip-type"
                        style={{
                          background: s.bg,
                          color: s.fg,
                          borderColor: s.border,
                        }}
                      >
                        <span className="kanban-chip-dot" style={{ background: s.fg }} />
                        {t}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="quote-detail-muted">— brak —</span>
              )
            }
          />
          <Field label="Status" value={quote.status} />
          <Field label="Termin oferty" value={formatDeadline(quote.deadline)} />
          <Field label="Opiekun" value={ownerName} />
          <Field label="Źródło leada" value={<span className="quote-detail-muted">— uzupełnij —</span>} />
          <Field label="Ważność oferty" value={<span className="quote-detail-muted">30 dni (domyślnie)</span>} />
        </div>
      </Section>

      <Section title="Wartość" icon={<I.pln s={14} />}>
        {hasValue ? (
          <div className="quote-detail-money">
            <div className="quote-detail-money-row">
              <span>Netto</span>
              <span className="quote-detail-money-num">{formatPLN(netto!)} <em>PLN</em></span>
            </div>
            <div className="quote-detail-money-row">
              <span>VAT 23%</span>
              <span className="quote-detail-money-num">{formatPLN(vat!)} <em>PLN</em></span>
            </div>
            <div className="quote-detail-money-row is-total">
              <span>Brutto</span>
              <span className="quote-detail-money-num">{formatPLN(quote.value!)} <em>PLN</em></span>
            </div>
          </div>
        ) : (
          <div className="quote-detail-empty">
            <div className="quote-detail-empty-title">Brak wyceny</div>
            <div className="quote-detail-empty-text">
              Dodaj pozycje, aby wyliczyć wartość oferty.
            </div>
          </div>
        )}
      </Section>

      <OpisUwagiSection quoteId={quote._id} author={ownerName} />

      <ZadaniaSection />
    </div>
  );
}

function TabPozycje({ quote }: { quote: Quote }) {
  const hasValue = quote.value !== null;
  return (
    <div className="quote-detail-stack">
      <Section
        title="Pozycje oferty"
        icon={<I.box s={14} />}
        action={<span className="quote-detail-pill">Wkrótce — wersja edytowalna</span>}
      >
        {hasValue ? (
          <div className="quote-detail-positions">
            <div className="quote-detail-positions-head">
              <div>Nazwa</div>
              <div>Wymiary</div>
              <div>Materiał / kolor</div>
              <div className="align-right">Ilość</div>
              <div className="align-right">Cena jedn.</div>
              <div className="align-right">Wartość</div>
            </div>
            <div className="quote-detail-positions-row">
              <div>
                Konstrukcja{" "}
                {quote.projectType.length > 0
                  ? quote.projectType.map((t) => t.toLowerCase()).join(" + ")
                  : "—"}
              </div>
              <div className="quote-detail-muted">— uzupełnij —</div>
              <div className="quote-detail-muted">— uzupełnij —</div>
              <div className="align-right">1</div>
              <div className="align-right quote-detail-muted">—</div>
              <div className="align-right">{formatPLN(quote.value!)}</div>
            </div>
            <div className="quote-detail-positions-foot">
              <span>Razem</span>
              <span>{formatPLN(quote.value!)} <em>PLN</em></span>
            </div>
          </div>
        ) : (
          <div className="quote-detail-empty">
            <div className="quote-detail-empty-title">Brak pozycji</div>
            <div className="quote-detail-empty-text">
              Edycja pozycji zostanie dodana w następnej iteracji.
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function TabPomiary({ quote }: { quote: Quote }) {
  const needsMeasurement = quote.status === "Pomiary i uzgodnienia" || quote.status === "Kontakt z klientem";
  return (
    <div className="quote-detail-stack">
      <Section title="Pomiary" icon={<I.ruler s={14} />}>
        <div className="quote-detail-empty">
          <div className="quote-detail-empty-title">
            {needsMeasurement ? "Pomiar do zaplanowania" : "Brak zaplanowanych pomiarów"}
          </div>
          <div className="quote-detail-empty-text">
            Dodaj termin wizyty, pomiarowca i wymiary otworów. Zrzuty z miejsca pomiaru możesz załączyć w zakładce „Pliki”.
          </div>
        </div>
      </Section>
    </div>
  );
}

function TabPliki() {
  return (
    <div className="quote-detail-stack">
      <Section title="Pliki i załączniki" icon={<I.paperclip s={14} />}>
        <div className="quote-detail-dropzone">
          <I.download s={20} />
          <div className="quote-detail-dropzone-title">Przeciągnij pliki tutaj</div>
          <div className="quote-detail-dropzone-text">
            PDF oferty, rysunki techniczne, zdjęcia z pomiaru, korespondencja z klientem.
          </div>
        </div>
      </Section>
    </div>
  );
}

function TabAktywnosc({ quote }: { quote: Quote }) {
  const events = [
    {
      icon: <I.refresh s={12} />,
      title: `Status zmieniony na „${quote.status}"`,
      meta: "Adam Borowski · 2026-05-09 14:22",
    },
    {
      icon: <I.mail s={12} />,
      title: "Wysłano zapytanie do klienta",
      meta: "Joanna Krawczyk · 2026-05-08 11:05",
    },
    {
      icon: <I.plus s={12} />,
      title: "Wycena utworzona",
      meta: "Leszek Sakowski · 2026-05-07 09:30",
    },
  ];

  return (
    <div className="quote-detail-stack">
      <Section title="Aktywność" icon={<I.clock s={14} />}>
        <div className="quote-detail-activity">
          {events.map((e, i) => (
            <div key={i} className="quote-detail-activity-item">
              <div className="quote-detail-activity-icon">{e.icon}</div>
              <div className="quote-detail-activity-body">
                <div className="quote-detail-activity-title">{e.title}</div>
                <div className="quote-detail-activity-meta">{e.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function TabPowiazane() {
  return (
    <div className="quote-detail-stack">
      <Section title="Powiązane elementy" icon={<I.link s={14} />}>
        <div className="quote-detail-empty">
          <div className="quote-detail-empty-text">
            Brak powiązanych zleceń, faktur ani zadań.
          </div>
        </div>
      </Section>
    </div>
  );
}

function formatNoteDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OpisUwagiSection({
  quoteId,
  author,
}: {
  quoteId: Id<"quotes">;
  author: string;
}) {
  const notes = useQuery(api.quoteNotes.list, { quoteId }) ?? [];
  const addNote = useMutation(api.quoteNotes.add);
  const removeNote = useMutation(api.quoteNotes.remove);
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    void addNote({ quoteId, text, authorName: author });
    setDraft("");
  }

  return (
    <Section
      title="Opis/Uwagi"
      icon={<I.doc s={14} />}
      action={
        <span className="quote-detail-todo-count">{notes.length}</span>
      }
      bodyClassName="quote-detail-todo-body"
    >
      <ul className="quote-detail-notes-list">
        {notes.length === 0 && (
          <li className="quote-detail-todo-empty">
            Brak notatek — dodaj pierwszą poniżej.
          </li>
        )}
        {notes.map((n) => (
          <li key={n._id as unknown as string} className="quote-detail-note-item">
            <div className="quote-detail-note-body">
              <div className="quote-detail-note-text">{n.text}</div>
              <div className="quote-detail-note-meta">
                <span className="quote-detail-note-author">
                  <span className="kanban-card-owner-avatar">
                    {ownerInitials(n.authorName)}
                  </span>
                  <span>{n.authorName}</span>
                </span>
                <span className="quote-detail-note-sep">·</span>
                <span>{formatNoteDate(n.createdAt)}</span>
              </div>
            </div>
            <button
              type="button"
              className="quote-detail-todo-remove"
              onClick={() => void removeNote({ id: n._id })}
              aria-label="Usuń notatkę"
            >
              <I.trash s={12} />
            </button>
          </li>
        ))}
      </ul>

      <form
        className="quote-detail-todo-add quote-detail-note-add"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <span className="quote-detail-todo-add-icon">
          <I.plus s={14} />
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Dodaj notatkę… (Cmd/Ctrl+Enter)"
          className="quote-detail-todo-input quote-detail-note-input"
          rows={2}
        />
        <button
          type="submit"
          className="quote-detail-todo-submit"
          disabled={!draft.trim()}
        >
          Dodaj
        </button>
      </form>
    </Section>
  );
}

type QuoteTask = { id: string; title: string; done: boolean };

function ZadaniaSection() {
  const [tasks, setTasks] = useState<QuoteTask[]>([
    { id: "t1", title: "Skontaktuj się z klientem", done: false },
    { id: "t2", title: "Przygotuj wstępną wycenę", done: false },
  ]);
  const [draft, setDraft] = useState("");

  const remaining = tasks.filter((t) => !t.done).length;

  function addTask() {
    const title = draft.trim();
    if (!title) return;
    setTasks((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, title, done: false },
    ]);
    setDraft("");
  }

  function toggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Section
      title="Zadania"
      icon={<I.check s={14} />}
      action={
        <span className="quote-detail-todo-count">
          {remaining} / {tasks.length}
        </span>
      }
      bodyClassName="quote-detail-todo-body"
    >
      <ul className="quote-detail-todo-list">
        {tasks.length === 0 && (
          <li className="quote-detail-todo-empty">
            Brak zadań — dodaj pierwsze poniżej.
          </li>
        )}
        {tasks.map((t) => (
          <li
            key={t.id}
            className={`quote-detail-todo-item${t.done ? " is-done" : ""}`}
          >
            <button
              type="button"
              className="quote-detail-todo-row"
              onClick={() => toggle(t.id)}
              aria-label={
                t.done ? "Oznacz jako niewykonane" : "Oznacz jako wykonane"
              }
              aria-pressed={t.done}
            >
              <span className="quote-detail-todo-check" aria-hidden="true">
                {t.done && <I.check s={12} sw={2.6} />}
              </span>
              <span className="quote-detail-todo-text">{t.title}</span>
            </button>
            <button
              type="button"
              className="quote-detail-todo-remove"
              onClick={() => remove(t.id)}
              aria-label="Usuń zadanie"
            >
              <I.trash s={12} />
            </button>
          </li>
        ))}
      </ul>

      <form
        className="quote-detail-todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          addTask();
        }}
      >
        <span className="quote-detail-todo-add-icon">
          <I.plus s={14} />
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dodaj zadanie…"
          className="quote-detail-todo-input"
        />
        <button
          type="submit"
          className="quote-detail-todo-submit"
          disabled={!draft.trim()}
        >
          Dodaj
        </button>
      </form>
    </Section>
  );
}

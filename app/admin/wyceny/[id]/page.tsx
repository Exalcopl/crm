"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import {
  getProjectTypeStyle,
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
import { InvestmentModal } from "./_components/investment-section";
import { OpisUwagiHorizontalSection } from "./_components/opis-uwagi-horizontal";
import { TasksKanban } from "./_components/tasks-kanban";
import { QuoteValueSummary } from "./_components/quote-value-summary";
import { HelperQuestionsSection } from "./_components/helper-questions";
import { QuoteFiles } from "./_components/quote-files";
import { WycenaOcrSection } from "./_components/wycena-ocr";

type DetailTab = "szczegoly" | "pozycje" | "pomiary" | "aktywnosc" | "powiazane";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "szczegoly", label: "Szczegóły", icon: <I.doc s={22} /> },
  { id: "pozycje", label: "Wycena", icon: <I.box s={22} /> },
  { id: "pomiary", label: "Pomiary", icon: <I.ruler s={22} /> },
  { id: "aktywnosc", label: "Aktywność", icon: <I.clock s={22} /> },
  { id: "powiazane", label: "Powiązane", icon: <I.link s={22} /> },
];

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const code = decodeURIComponent(id);
  const quote = useQuery(api.quotes.getByCode, { code }) as Quote | null | undefined;
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
    router.push(isArchived ? "/admin/archiwum" : "/admin/wyceny");
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
    router.push("/admin/wyceny");
  }

  async function confirmRestore() {
    if (!quote) return;
    await restoreQuote({ id: quote._id });
    router.push("/admin/wyceny");
  }

  if (quote === undefined) {
    return (
      <>
        <QuoteDetailRibbon
          onBack={() => router.push("/admin/wyceny")}
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
          onBack={() => router.push("/admin/wyceny")}
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
            <div className="quote-detail-missing-id">ID: {code}</div>
            <Link href="/admin/wyceny" className="quote-detail-missing-link">
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
        onBack={() => router.push(isArchived ? "/admin/archiwum" : "/admin/wyceny")}
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
          onTabChange={setActiveTab}
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
  onTabChange,
}: {
  quote: Quote;
  activeTab: DetailTab;
  archived: boolean;
  onRestore: () => void;
  onTabChange: (tab: DetailTab) => void;
}) {
  const isSzczegoly = activeTab === "szczegoly";
  return (
    <OwnerNamesProvider quotes={[quote]}>
      <div className="quote-detail">
        {archived && <ArchivedBanner onRestore={onRestore} />}
        <QuoteDetailHeader quote={quote} archived={archived} />
        {isSzczegoly && (
          <>
            <Section title="Pytania pomocnicze" icon={<I.help s={14} />}>
              <HelperQuestionsSection quoteId={quote._id} />
            </Section>
            <OpisUwagiHorizontalSection quote={quote} archived={archived} />
            <TasksKanban quote={quote} archived={archived} />
            <QuoteFiles quote={quote} archived={archived} />
          </>
        )}
        <div className="quote-detail-main">
          {isSzczegoly && <TabSzczegoly quote={quote} archived={archived} />}
          {activeTab === "pozycje" && <TabPozycje quote={quote} />}
          {activeTab === "pomiary" && <TabPomiary quote={quote} />}
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


function QuoteDetailHeader({ quote, archived }: { quote: Quote; archived: boolean }) {
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const setStatusMutation = useMutation(api.quotes.setStatus);
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const statusIndex = QUOTE_STATUSES.indexOf(quote.status);
  const ownerName = useOwnerName(quote);
  const [idCopied, setIdCopied] = useState(false);
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false);

  const investmentLabel = quote.investment?.name
    ? quote.investment.name
    : quote.investment?.address
      ? quote.investment.address
      : "Ustaw lokalizację";

  async function handleStatusChange(newStatus: typeof QUOTE_STATUSES[number]) {
    try {
      await setStatusMutation({ id: quote._id, status: newStatus });
      toast.success(`Status zmieniony na „${newStatus}"`);
    } catch {
      toast.error("Nie udało się zmienić statusu");
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(quote.id);
      setIdCopied(true);
      toast.success(`Skopiowano: ${quote.id}`);
      setTimeout(() => setIdCopied(false), 1400);
    } catch {
      toast.error("Nie udało się skopiować");
    }
  }

  return (
    <div className="quote-detail-header">
      <div className="quote-detail-header-row">
        <div className="quote-detail-header-main">
          <div className="quote-detail-hero">
            <button
              type="button"
              className={`quote-detail-id-pill${idCopied ? " is-copied" : ""}`}
              onClick={() => void copyId()}
              title="Kliknij, aby skopiować ID"
              aria-label={`Skopiuj ID wyceny ${quote.id}`}
            >
              <span className="quote-detail-id-label">ID wyceny</span>
              <span className="quote-detail-id-value">{quote.id}</span>
              <span className="quote-detail-id-icon" aria-hidden>
                {idCopied ? <I.check s={14} sw={2.4} /> : <I.doc s={14} />}
              </span>
            </button>
            <button
              type="button"
              className="quote-detail-investment-trigger"
              onClick={() => setIsInvestmentOpen(true)}
              title="Pokaż lokalizację inwestycji"
              aria-label="Lokalizacja inwestycji"
            >
              <span className="quote-detail-investment-trigger-icon">
                <I.pin s={14} sw={2} />
              </span>
              <span className="quote-detail-investment-trigger-value">
                {investmentLabel}
              </span>
            </button>
            <div className="quote-detail-hero-types">
              {quote.projectType.map((t) => {
                const s = getProjectTypeStyle(projectTypes, t);
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
          </div>
          <ClientContactStrip quote={quote} />
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
        </div>
      </div>
      <QuoteStatusPipeline
        currentIndex={statusIndex}
        disabled={archived}
        onStatusChange={handleStatusChange}
      />
      {isInvestmentOpen && (
        <InvestmentModal
          quote={quote}
          archived={archived}
          onClose={() => setIsInvestmentOpen(false)}
        />
      )}
    </div>
  );
}

function ClientContactStrip({ quote }: { quote: Quote }) {
  const router = useRouter();
  const ensureLink = useMutation(api.clients.ensureLinkedToQuote);
  const [linking, setLinking] = useState(false);
  const contact = quote.contact;
  const initials = ownerInitials(contact.name);
  const address = [contact.street, contact.postalCity]
    .filter(Boolean)
    .join(", ");

  async function openClient() {
    if (linking) return;
    if ((quote as Quote & { clientId?: Id<"clients"> }).clientId) {
      router.push(
        `/admin/klienci/${(quote as Quote & { clientId?: Id<"clients"> }).clientId}`,
      );
      return;
    }
    setLinking(true);
    try {
      const clientId = await ensureLink({ quoteId: quote._id });
      router.push(`/admin/klienci/${clientId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Nie udało się otworzyć klienta",
      );
    } finally {
      setLinking(false);
    }
  }

  return (
    <button
      type="button"
      className="quote-detail-client-strip is-clickable"
      onClick={() => void openClient()}
      title="Otwórz szczegóły klienta"
      disabled={linking}
    >
      <span className="quote-detail-client-avatar" aria-hidden>
        {initials}
      </span>
      <span className="quote-detail-client-info">
        <span className="quote-detail-client-name">
          {contact.name}
          <span className="quote-detail-client-arrow" aria-hidden>
            <I.arrow s={11} sw={2} />
          </span>
        </span>
        <span className="quote-detail-client-meta">
          {contact.phone ? (
            <span className="quote-detail-client-link">
              <I.phone s={11} />
              <span>{contact.phone}</span>
            </span>
          ) : null}
          {contact.email ? (
            <span className="quote-detail-client-link">
              <I.mail s={11} />
              <span>{contact.email}</span>
            </span>
          ) : null}
          {address ? (
            <span className="quote-detail-client-addr">
              <I.pin s={11} />
              <span>{address}</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
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

function QuoteStatusPipeline({
  currentIndex,
  disabled,
  onStatusChange,
}: {
  currentIndex: number;
  disabled?: boolean;
  onStatusChange?: (status: typeof QUOTE_STATUSES[number]) => void;
}) {
  return (
    <div className="quote-detail-pipeline" aria-label="Status pipeline">
      {QUOTE_STATUSES.map((status, idx) => {
        const done = idx < currentIndex;
        const current = idx === currentIndex;
        const color = QUOTE_STATUS_COLORS[status];
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
              style={current ? { background: color, borderColor: color } : done ? { borderColor: color } : undefined}
              title={clickable ? `Ustaw status: ${status}` : undefined}
            >
              {done ? <I.check s={11} sw={2.4} /> : <span className="quote-detail-pipeline-dot" />}
            </button>
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

function TabSzczegoly({
  quote,
  archived,
}: {
  quote: Quote;
  archived: boolean;
}) {
  void archived;
  return (
    <div className="quote-detail-stack">
      <Section title="Wartość oferty" icon={<I.pln s={14} />}>
        <QuoteValueSummary quoteId={quote._id} value={quote.value} />
      </Section>
    </div>
  );
}

function TabPozycje({ quote }: { quote: Quote }) {
  return <WycenaOcrSection quote={quote} />;
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


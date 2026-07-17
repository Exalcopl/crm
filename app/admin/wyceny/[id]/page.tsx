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
import { TasksKanban } from "./_components/tasks-kanban";
import { QuoteValueSummary } from "./_components/quote-value-summary";
import { HelperQuestionsSection } from "./_components/helper-questions";
import { QuoteFileBrowser } from "./_components/quote-file-browser";
import { QuoteVersionsManager } from "./_components/quote-versions-manager";
import { QuoteConfigurator } from "./_components/quote-configurator";
import { QuoteNotesFeed } from "./_components/quote-notes-feed";

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

  const versions = useQuery(
    api.quoteVersions.listByQuote,
    quote ? { quoteId: quote._id } : "skip"
  ) ?? [];
  const order = useQuery(
    api.orders.getByQuote,
    quote ? { quoteId: quote._id } : "skip"
  );
  const createOrder = useMutation(api.orders.create);

  const [activeTab, setActiveTab] = useState<DetailTab>("szczegoly");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const isArchived = quote?.archived === true;
  const acceptedVersion = versions.find((v: any) => v.status === "accepted");

  async function confirmCreateOrder() {
    if (!quote || !acceptedVersion) return;
    setIsCreatingOrder(true);
    try {
      await createOrder({
        quoteId: quote._id,
        quoteVersionId: acceptedVersion._id,
      });
      toast.success("Pomyślnie utworzono zlecenie!");
      setConfirmOrderOpen(false);
      router.push("/admin/zlecenia");
    } catch (err: any) {
      toast.error(err.message || "Błąd podczas tworzenia zlecenia");
    } finally {
      setIsCreatingOrder(false);
    }
  }

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
        order={order}
        acceptedVersion={acceptedVersion}
        onCreateOrder={() => setConfirmOrderOpen(true)}
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
      {confirmOrderOpen && acceptedVersion && (
        <ConfirmOrderModal
          quoteId={quote.id}
          clientName={quote.contact.name}
          orderValue={acceptedVersion.valueNetto}
          onCancel={() => setConfirmOrderOpen(false)}
          onConfirm={() => void confirmCreateOrder()}
          isLoading={isCreatingOrder}
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
  order,
  acceptedVersion,
  onCreateOrder,
}: {
  onBack: () => void;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onDelete: () => void;
  onArchive: () => void;
  quote?: Quote | null;
  archived: boolean;
  disabled?: boolean;
  order?: any;
  acceptedVersion?: any;
  onCreateOrder?: () => void;
}) {
  const router = useRouter();
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
      {quote && order && (
        <RibbonGroup label="Powiązane">
          <RibbonBtn
            icon={<I.box s={22} />}
            label="Zlecenie"
            disabled={disabled}
            onClick={() => router.push(`/admin/zlecenia/${order._id}`)}
          />
        </RibbonGroup>
      )}
      <RibbonGroup label="Operacje">
        {quote && <SharepointRibbonBtn quote={quote} disabled={disabled} />}
        {quote && !order && (
          <RibbonBtn
            icon={<I.box s={22} />}
            label="Stwórz zlecenie"
            disabled={disabled || !acceptedVersion}
            onClick={onCreateOrder}
          />
        )}
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
        {activeTab === "szczegoly" ? (
          <div className="quote-detail-grid-customizable">
            {/* Kolumna 1: zadania + pytania pomocnicze */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="quote-widget-item">
                <TasksKanban quote={quote} archived={archived} />
              </div>
              <div className="quote-widget-item">
                <Section title="Pytania pomocnicze" icon={<I.help s={14} />}>
                  <HelperQuestionsSection quoteId={quote._id} />
                </Section>
              </div>
            </div>

            {/* Kolumny 2-3 (środek): Notatki */}
            <div className="quote-widget-item quote-widget-span-2">
              <Section title="Notatki" icon={<I.doc s={14} />}>
                <QuoteNotesFeed quoteId={quote._id} archived={archived} />
              </Section>
            </div>

            {/* Kolumna 4: Pliki */}
            <div className="quote-widget-item quote-widget-span-1">
              <QuoteFileBrowser quote={quote} archived={archived} />
            </div>
          </div>
        ) : (
          <div className="quote-detail-main">
            {activeTab === "pozycje" && <TabPozycje quote={quote} archived={archived} />}
            {activeTab === "pomiary" && <TabPomiary quote={quote} />}
            {activeTab === "aktywnosc" && <TabAktywnosc quote={quote} />}
            {activeTab === "powiazane" && <TabPowiazane />}
          </div>
        )}
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


function QuoteClientNoteBanner({ quote }: { quote: Quote }) {
  const notes = useQuery(api.quoteNotes.list, { quoteId: quote._id }) ?? [];
  const clientNotes = notes.filter((n: any) => n.authorId === null);
  if (clientNotes.length === 0) return null;

  return (
    <div className="quote-client-note-banner">
      <span className="quote-client-note-banner-icon" aria-hidden>
        <I.doc s={13} sw={2} />
      </span>
      <div className="quote-client-note-banner-body">
        <span className="quote-client-note-banner-label">Notatka od klienta</span>
        {clientNotes.map((n: any) => (
          <p key={n._id as unknown as string} className="quote-client-note-banner-text">
            {n.text}
          </p>
        ))}
      </div>
    </div>
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
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const updateLabel = useMutation(api.quotes.updateCustomLabel);
  const ignoreBlurLabelRef = useRef(false);

  const [isEditingValue, setIsEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const updateValueMutation = useMutation(api.quotes.updateValue);
  const ignoreBlurValueRef = useRef(false);

  async function handleSaveValue() {
    let finalVal: number | null = null;
    if (tempValue.trim() !== "") {
      const cleanVal = tempValue.replace(/\s/g, "").replace(",", ".");
      const parsed = Number(cleanVal);
      if (isNaN(parsed) || parsed < 0) {
        toast.error("Podaj poprawną wartość nieujemną");
        return;
      }
      finalVal = parsed;
    }
    if ((finalVal ?? null) === (quote.value ?? null)) {
      setIsEditingValue(false);
      return;
    }
    setIsEditingValue(false);
    try {
      await updateValueMutation({ id: quote._id, value: finalVal });
      toast.success("Zaktualizowano wartość wyceny");
    } catch {
      toast.error("Błąd zapisu");
    }
  }

  async function handleSaveLabel() {
    const cleaned = tempLabel.trim() || undefined;
    if ((cleaned ?? undefined) === (quote.customLabel ?? undefined)) {
      setIsEditingLabel(false);
      return;
    }
    setIsEditingLabel(false);
    try {
      await updateLabel({ id: quote._id, customLabel: cleaned });
      toast.success("Zaktualizowano wyróżnik B2B");
    } catch {
      toast.error("Błąd zapisu");
    }
  }

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
            <ClientContactStrip quote={quote} />
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
          {quote.contact.clientType === "business" && (
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {isEditingLabel ? (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    onBlur={() => {
                      if (ignoreBlurLabelRef.current) return;
                      void handleSaveLabel();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSaveLabel();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        ignoreBlurLabelRef.current = true;
                        setIsEditingLabel(false);
                      }
                    }}
                    placeholder="Wpisz wyróżnik B2B (np. inwestycję)..."
                    className="fluent-input"
                    style={{ padding: "4px 10px", fontSize: "12px", width: "260px", borderLeft: "3px solid var(--accent-primary)" }}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (archived) return;
                    ignoreBlurLabelRef.current = false;
                    setTempLabel(quote.customLabel || "");
                    setIsEditingLabel(true);
                  }}
                  style={{
                    cursor: archived ? "default" : "pointer",
                    display: "inline-flex",
                    alignItems: "center"
                  }}
                  title={archived ? undefined : "Kliknij, aby edytować wyróżnik B2B"}
                >
                  {quote.customLabel ? (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "var(--accent-primary)",
                        background: "var(--accent-soft)",
                        border: "1px solid var(--accent-line)",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        transition: "all 0.15s ease"
                      }}
                    >
                      🏷️ Wyróżnik B2B: <strong>{quote.customLabel}</strong>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        padding: "3px 8px",
                        border: "1px dashed var(--border-color)",
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.02)",
                        transition: "all 0.15s ease"
                      }}
                    >
                      🏷️ + Dodaj wyróżnik B2B (tekst własny)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="quote-detail-header-meta">
          <div className="quote-detail-meta-item">
            <div className="quote-detail-meta-label">Wartość</div>
            <div className="quote-detail-meta-value">
              {isEditingValue ? (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={() => {
                      if (ignoreBlurValueRef.current) return;
                      void handleSaveValue();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSaveValue();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        ignoreBlurValueRef.current = true;
                        setIsEditingValue(false);
                      }
                    }}
                    placeholder="Kwota netto..."
                    className="fluent-input"
                    style={{ padding: "3px 6px", fontSize: "11px", width: "90px", textAlign: "right" }}
                    autoFocus
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "2px" }}>PLN</span>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (archived) return;
                    ignoreBlurValueRef.current = false;
                    setTempValue(quote.value !== null && quote.value !== undefined ? String(quote.value) : "");
                    setIsEditingValue(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: archived ? "default" : "pointer",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    transition: "background 0.15s ease"
                  }}
                  title={archived ? undefined : "Kliknij, aby edytować wartość netto"}
                >
                  {hasValue ? (
                    <>
                      <span className="quote-detail-meta-num">{formatPLN(quote.value!)}</span>
                      <span className="quote-detail-meta-unit">PLN</span>
                    </>
                  ) : (
                    <span className="quote-detail-meta-empty">— brak —</span>
                  )}
                </div>
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
      <QuoteClientNoteBanner quote={quote} />
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
  isCompact,
}: {
  currentIndex: number;
  disabled?: boolean;
  onStatusChange?: (status: typeof QUOTE_STATUSES[number]) => void;
  isCompact?: boolean;
}) {
  return (
    <div className={`quote-detail-pipeline${isCompact ? " is-compact" : ""}`} aria-label="Status pipeline">
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
              {done ? <I.check s={isCompact ? 8 : 11} sw={2.4} /> : <span className="quote-detail-pipeline-dot" />}
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

function QuoteInfoCard({ quote, archived }: { quote: Quote; archived: boolean }) {
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const setStatusMutation = useMutation(api.quotes.setStatus);
  const statusIndex = QUOTE_STATUSES.indexOf(quote.status);
  const [idCopied, setIdCopied] = useState(false);
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false);

  const investmentLabel = quote.investment?.name
    ? quote.investment.name
    : quote.investment?.address
      ? quote.investment.address
      : "Ustaw lokalizację";

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

  async function handleStatusChange(newStatus: typeof QUOTE_STATUSES[number]) {
    try {
      await setStatusMutation({ id: quote._id, status: newStatus });
      toast.success(`Status zmieniony na „${newStatus}"`);
    } catch {
      toast.error("Nie udało się zmienić statusu");
    }
  }

  return (
    <Section title="Informacje podstawowe" icon={<I.doc s={14} />}>
      <div className="quote-detail-info-card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="quote-detail-hero" style={{ marginBottom: "4px" }}>
          <button
            type="button"
            className={`quote-detail-id-pill${idCopied ? " is-copied" : ""}`}
            onClick={() => void copyId()}
            title="Kliknij, aby skopiować ID"
            aria-label={`Skopiuj ID wyceny ${quote.id}`}
          >
            <span className="quote-detail-id-label">ID</span>
            <span className="quote-detail-id-value" style={{ fontSize: "16px" }}>{quote.id}</span>
            <span className="quote-detail-id-icon" aria-hidden>
              {idCopied ? <I.check s={12} sw={2.4} /> : <I.doc s={12} />}
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
              <I.pin s={12} sw={2} />
            </span>
            <span className="quote-detail-investment-trigger-value" style={{ fontSize: "11px" }}>
              {investmentLabel}
            </span>
          </button>
        </div>
        <div className="quote-detail-hero-types" style={{ marginBottom: "4px" }}>
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
        <ClientContactStrip quote={quote} />

        <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "4px", paddingTop: "12px" }} />
        <QuoteStatusPipeline
          currentIndex={statusIndex}
          disabled={archived}
          onStatusChange={handleStatusChange}
          isCompact={true}
        />
      </div>

      {isInvestmentOpen && (
        <InvestmentModal
          quote={quote}
          archived={archived}
          onClose={() => setIsInvestmentOpen(false)}
        />
      )}
    </Section>
  );
}

function QuoteMetaCard({ quote, archived }: { quote: Quote; archived: boolean }) {
  const tone = deadlineTone(quote.deadline);
  const hasValue = quote.value !== null;
  const ownerName = useOwnerName(quote);

  return (
    <Section title="Parametry wyceny" icon={<I.pln s={14} />}>
      <div className="quote-detail-grid-meta-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="quote-detail-meta-item">
          <div className="quote-detail-meta-label">Wartość</div>
          <div className="quote-detail-meta-value" style={{ borderBottom: "none", paddingBottom: 0 }}>
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
        <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
        <div className="quote-detail-meta-item">
          <div className="quote-detail-meta-label">Termin</div>
          <div className={`quote-detail-meta-value tone-${tone}`} style={{ borderBottom: "none", paddingBottom: 0 }}>
            <span className="quote-detail-meta-num">{formatDeadline(quote.deadline)}</span>
            <span className="quote-detail-meta-unit" style={{ marginLeft: "4px" }}>{deadlineRelative(quote.deadline)}</span>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
        <div className="quote-detail-meta-item">
          <div className="quote-detail-meta-label">Opiekun</div>
          <OwnerEditor quote={quote} ownerName={ownerName} disabled={archived} />
        </div>
      </div>
    </Section>
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

function TabPozycje({ quote, archived }: { quote: Quote; archived: boolean }) {
  const norm = quote.projectType.map((t) => t.toLowerCase());
  const hasStolarka = norm.some((t) => t.includes("stolarka")) || quote.id.startsWith("ST-");
  const hasPergola = norm.some((t) => t.includes("pergola"));
  const hasZadaszenia = norm.some((t) => t.includes("zadasz"));

  if (!hasStolarka && !hasPergola && !hasZadaszenia) {
    return (
      <div className="quote-detail-stack">
        <Section title="Wycena" icon={<I.box s={14} />}>
          <div className="quote-detail-empty">
            <div className="quote-detail-empty-title">Wybierz typ projektu</div>
            <div className="quote-detail-empty-text">
              Ta wycena nie ma typu z konfiguratorem ani ze skanowaniem. Ustaw typ projektu w zakładce „Szczegóły”,
              aby skonfigurować wycenę (Pergola / Zadaszenia) lub wczytać ofertę przez OCR (Stolarka aluminiowa).
            </div>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="quote-detail-stack">
      {hasPergola && (
        <QuoteConfigurator
          quoteId={quote._id}
          slug="pergola"
          typeName="Pergola"
          configuration={quote.configuration}
          calculator={(quote as { calculator?: unknown }).calculator}
          archived={archived}
        />
      )}
      {hasZadaszenia && (
        <QuoteConfigurator
          quoteId={quote._id}
          slug="zadaszenia"
          typeName="Zadaszenia"
          configuration={quote.configuration}
          calculator={(quote as { calculator?: unknown }).calculator}
          archived={archived}
        />
      )}
      {hasStolarka && <QuoteVersionsManager quote={quote} archived={archived} />}
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


function activityIcon(type: string) {
  switch (type) {
    case "quote_created": return <I.plus s={12} />;
    case "configuration_updated": return <I.doc s={12} />;
    case "value_updated": return <I.pln s={12} />;
    case "custom_label_updated": return <I.edit s={12} />;
    default: return <I.refresh s={12} />;
  }
}

function formatActivityDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function TabAktywnosc({ quote }: { quote: Quote }) {
  const events = useQuery(api.quoteActivity.list, { quoteId: quote._id }) ?? [];

  return (
    <div className="quote-detail-stack">
      <Section title="Aktywność" icon={<I.clock s={14} />}>
        {events.length === 0 ? (
          <div className="quote-detail-empty">
            <div className="quote-detail-empty-text">Brak zarejestrowanych zdarzeń.</div>
          </div>
        ) : (
          <div className="quote-detail-activity">
            {events.map((e: any) => (
              <div key={e._id} className="quote-detail-activity-item">
                <div className="quote-detail-activity-icon">{activityIcon(e.type)}</div>
                <div className="quote-detail-activity-body">
                  <div className="quote-detail-activity-title">{e.title}</div>
                  <div className="quote-detail-activity-meta">
                    {e.authorName} · {formatActivityDate(e.createdAt)}
                    {e.detail && <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>— {e.detail}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

function ConfirmOrderModal({
  quoteId,
  clientName,
  orderValue,
  onCancel,
  onConfirm,
  isLoading,
}: {
  quoteId: string;
  clientName: string;
  orderValue: number;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Potwierdź stworzenie zlecenia"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div className="fluent-modal fluent-modal-sm">
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon">
              <I.box s={16} sw={2.2} />
            </span>
            <span>Stwórz zlecenie</span>
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
          <p className="fluent-modal-text" style={{ marginBottom: 12 }}>
            Czy na pewno chcesz stworzyć zlecenie z wyceny <strong>{quoteId}</strong> dla klienta <strong>{clientName}</strong>?
          </p>
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#8b949e" }}>Wartość zlecenia (netto):</span>
            <strong style={{ color: "#58a6ff" }}>{orderValue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</strong>
          </div>
          <p className="fluent-modal-text" style={{ marginTop: 12, fontSize: 11.5, color: "#8b949e" }}>
            Uwaga: Powoduje to zmianę statusu wyceny na <strong>Zrobione</strong>.
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
            Anuluj
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-primary"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-small" aria-hidden="true" />
                <span>Tworzenie…</span>
              </>
            ) : (
              <>
                <I.plus s={14} sw={2.2} />
                <span>Stwórz zlecenie</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}


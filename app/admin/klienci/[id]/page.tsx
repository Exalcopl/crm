"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";
import { ClientDetailHeader } from "./_components/client-detail-header";
import { ClientStats } from "./_components/client-stats";
import { ClientInvestmentsMap } from "./_components/client-investments-map";
import { ClientFiles } from "./_components/client-files";
import { ClientNotes } from "./_components/client-notes";
import { ClientQuotesList } from "./_components/client-quotes-list";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();
  const client = useQuery(api.clients.get, { id: clientId }) as
    | Doc<"clients">
    | null
    | undefined;
  const quotes = useQuery(api.quotes.listByClient, { clientId });
  const deleteClientCascade = useAction(api.sharepoint.deleteClientCascade);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!client || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteClientCascade({ clientId });
      toast.success(
        `Usunięto klienta ${client.name}` +
          (result.removedQuotes > 0
            ? ` wraz z ${result.removedQuotes} wycenami`
            : "") +
          (result.sharepointDeleted ? " i folderem SharePoint." : "."),
      );
      router.push("/admin/klienci");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Nie udało się usunąć klienta",
      );
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  if (client === undefined) {
    return (
      <>
        <ClientDetailRibbon
          onBack={() => router.push("/admin/klienci")}
          onDelete={() => setConfirmDeleteOpen(true)}
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

  if (client === null) {
    return (
      <>
        <ClientDetailRibbon
          onBack={() => router.push("/admin/klienci")}
          onDelete={() => setConfirmDeleteOpen(true)}
          disabled
        />
        <main className="fluent-content">
          <div className="quote-detail-missing">
            <div className="quote-detail-missing-title">
              Nie znaleziono klienta
            </div>
            <Link href="/admin/klienci" className="quote-detail-missing-link">
              ← Wróć do listy klientów
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <ClientDetailRibbon
        onBack={() => router.push("/admin/klienci")}
        onDelete={() => setConfirmDeleteOpen(true)}
      />
      <main className="fluent-content">
        <div className="client-detail">
          <ClientDetailHeader client={client} />
          <ClientStats clientId={clientId} />
          <div className="client-detail-grid">
            <ClientQuotesList clientId={clientId} />
            <ClientNotes clientId={clientId} />
          </div>
          <ClientInvestmentsMap clientId={clientId} />
          <ClientFiles client={client} />
        </div>
      </main>
      {confirmDeleteOpen && (
        <ConfirmDeleteClientModal
          clientName={client.name}
          quotesCount={quotes?.length ?? 0}
          hasSharepointFolder={!!client.sharepointFolder?.itemId}
          deleting={deleting}
          onCancel={() => {
            if (!deleting) setConfirmDeleteOpen(false);
          }}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function ClientDetailRibbon({
  onBack,
  onDelete,
  disabled,
}: {
  onBack: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn
          icon={<I.arrowLeft s={22} />}
          label="Wróć do listy"
          onClick={onBack}
        />
      </RibbonGroup>
      <RibbonGroup label="System">
        <RibbonBtn
          icon={<I.trash s={22} />}
          label="Usuń klienta"
          onClick={onDelete}
          disabled={disabled}
        />
      </RibbonGroup>
    </div>
  );
}

function ConfirmDeleteClientModal({
  clientName,
  quotesCount,
  hasSharepointFolder,
  deleting,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  quotesCount: number;
  hasSharepointFolder: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, deleting]);

  return (
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Usuń klienta"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div className="fluent-modal fluent-modal-sm">
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon fluent-modal-title-icon-danger">
              <I.trash s={16} sw={2.2} />
            </span>
            <span>Usuń klienta</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>
        <div className="fluent-modal-body">
          <p className="fluent-modal-text">
            Czy na pewno chcesz usunąć klienta <strong>{clientName}</strong>?
          </p>
          <p className="fluent-modal-text fluent-modal-text-muted">
            Wraz z klientem zostaną trwale usunięte:
          </p>
          <ul className="fluent-modal-text fluent-modal-text-muted" style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              {quotesCount > 0
                ? `${quotesCount} ${quotesCount === 1 ? "wycena" : quotesCount < 5 ? "wyceny" : "wycen"} (wraz z pozycjami, notatkami i zadaniami)`
                : "brak powiązanych wycen"}
            </li>
            <li>notatki klienta</li>
            <li>
              {hasSharepointFolder
                ? "folder klienta na SharePoint razem z podfolderami i plikami"
                : "brak folderu SharePoint"}
            </li>
          </ul>
          <p className="fluent-modal-text fluent-modal-text-muted" style={{ marginTop: 12 }}>
            Tej operacji nie można cofnąć.
          </p>
        </div>
        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
          >
            Nie
          </button>
          <button
            type="button"
            className="fluent-btn fluent-btn-danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            <I.trash s={14} sw={2.2} />
            <span>{deleting ? "Usuwam…" : "Tak, usuń"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

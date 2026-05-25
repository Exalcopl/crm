"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useQuery } from "convex/react";
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

  if (client === undefined) {
    return (
      <>
        <ClientDetailRibbon onBack={() => router.push("/admin/klienci")} />
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
        <ClientDetailRibbon onBack={() => router.push("/admin/klienci")} />
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
      <ClientDetailRibbon onBack={() => router.push("/admin/klienci")} />
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
    </>
  );
}

function ClientDetailRibbon({ onBack }: { onBack: () => void }) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn
          icon={<I.arrowLeft s={22} />}
          label="Wróć do listy"
          onClick={onBack}
        />
      </RibbonGroup>
    </div>
  );
}

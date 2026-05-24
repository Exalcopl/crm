"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";
import {
  ProjectTypeFilterStrip,
  computeProjectTypeCounts,
  type ProjectTypeFilter,
} from "../_components/project-type-filter";
import { QuoteListView } from "../_components/quote-list";
import { OwnerNamesProvider } from "../_lib/owner-names";
import type { Quote } from "../_lib/quotes";

function ArchiwumRibbon({ onBack }: { onBack: () => void }) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn
          icon={<I.arrowLeft s={22} />}
          label="Wróć do wycen"
          onClick={onBack}
        />
      </RibbonGroup>
      <RibbonGroup label="Archiwum">
        <RibbonBtn icon={<I.archive s={22} />} label="Archiwum" active />
      </RibbonGroup>
    </div>
  );
}

export default function ArchiwumPage() {
  const router = useRouter();
  const archivedRaw = useQuery(api.quotes.listArchived);
  const archived = (archivedRaw as unknown as Quote[] | undefined) ?? [];
  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");

  const counts = useMemo(() => computeProjectTypeCounts(archived), [archived]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return archived;
    return archived.filter((q) => q.projectType.includes(filter));
  }, [archived, filter]);

  return (
    <>
      <ArchiwumRibbon onBack={() => router.push("/admin")} />
      <main className="fluent-content">
        <OwnerNamesProvider quotes={archived}>
          <ProjectTypeFilterStrip
            value={filter}
            counts={counts}
            onChange={setFilter}
          />
          <QuoteListView
            quotes={filteredQuotes}
            emptyLabel={
              archivedRaw === undefined
                ? "Wczytywanie…"
                : "Brak zarchiwizowanych wycen."
            }
          />
        </OwnerNamesProvider>
      </main>
    </>
  );
}

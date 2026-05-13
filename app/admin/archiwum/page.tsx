"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { I } from "../_lib/icons";
import { useQuotes } from "../_lib/quotes-store";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";
import {
  ProjectTypeFilterStrip,
  computeProjectTypeCounts,
  type ProjectTypeFilter,
} from "../_components/project-type-filter";
import { QuoteListView } from "../_components/quote-list";

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
  const allQuotes = useQuotes();
  const archived = useMemo(
    () => allQuotes.filter((q) => q.archived === true),
    [allQuotes],
  );
  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");

  const counts = useMemo(() => computeProjectTypeCounts(archived), [archived]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return archived;
    return archived.filter((q) => q.projectType === filter);
  }, [archived, filter]);

  return (
    <>
      <ArchiwumRibbon onBack={() => router.push("/admin")} />
      <main className="fluent-content">
        <ProjectTypeFilterStrip
          value={filter}
          counts={counts}
          onChange={setFilter}
        />
        <QuoteListView
          quotes={filteredQuotes}
          emptyLabel="Brak zarchiwizowanych wycen."
        />
      </main>
    </>
  );
}

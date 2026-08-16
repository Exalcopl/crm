"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
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
import Link from "next/link";
import { formatDeadline } from "../_lib/quotes";

function formatCurrency(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nowe: { label: "Nowe", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  akceptacja: { label: "Akceptacja", color: "#8250df", bg: "rgba(130, 80, 223, 0.15)" },
  kompletacja: { label: "W kompletacji", color: "#f0883e", bg: "rgba(240, 136, 62, 0.15)" },
  produkcja: { label: "W produkcji", color: "#58a6ff", bg: "rgba(88, 166, 255, 0.15)" },
  montaz: { label: "Do montażu", color: "#d29922", bg: "rgba(210, 153, 34, 0.15)" },
  gotowe: { label: "Zrealizowane", color: "#3fb950", bg: "rgba(63, 185, 80, 0.15)" },
  wstrzymane: { label: "Wstrzymane", color: "#8b949e", bg: "rgba(139, 148, 158, 0.15)" },
};

function ArchiwumRibbon({ onBack, tab }: { onBack: () => void; tab: "wyceny" | "zlecenia" }) {
  return (
    <div className="fluent-ribbon">
      <RibbonGroup label="Nawigacja">
        <RibbonBtn
          icon={<I.arrowLeft s={22} />}
          label={tab === "zlecenia" ? "Wróć do zleceń" : "Wróć do wycen"}
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
  const [activeTab, setActiveTab] = useState<"wyceny" | "zlecenia">("wyceny");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "zlecenia" || tab === "wyceny") {
      setActiveTab(tab);
    }
  }, []);

  function handleTabChange(tab: "wyceny" | "zlecenia") {
    setActiveTab(tab);
    router.replace(`/admin/archiwum?tab=${tab}`);
  }

  // Dane Wycen
  const archivedQuotesRaw = useQuery(api.quotes.listArchived);
  const archivedQuotes = (archivedQuotesRaw as unknown as Quote[] | undefined) ?? [];
  const projectTypes = (useQuery(api.projectTypes.list) ?? []) as Array<{ name: string; color: string }>;
  const [filter, setFilter] = useState<ProjectTypeFilter>("Wszystkie");

  const typeNames = useMemo(() => projectTypes.map((t) => t.name), [projectTypes]);
  const counts = useMemo(() => computeProjectTypeCounts(archivedQuotes, typeNames), [archivedQuotes, typeNames]);

  const filteredQuotes = useMemo(() => {
    if (filter === "Wszystkie") return archivedQuotes;
    return archivedQuotes.filter((q) => q.projectType.includes(filter));
  }, [archivedQuotes, filter]);

  // Dane Zleceń
  const archivedOrdersRaw = useQuery(api.orders.listArchived);
  const archivedOrders = archivedOrdersRaw ?? [];

  return (
    <>
      <ArchiwumRibbon 
        onBack={() => router.push(activeTab === "zlecenia" ? "/admin/zlecenia" : "/admin/wyceny")} 
        tab={activeTab} 
      />
      <main className="fluent-content">
        {/* Zakładki */}
        <div style={{ display: "flex", gap: 1, background: "#30363d", padding: "4px 8px 0", borderBottom: "1px solid #30363d" }}>
          <button
            onClick={() => handleTabChange("wyceny")}
            style={{
              padding: "8px 16px",
              background: activeTab === "wyceny" ? "#0d1117" : "transparent",
              color: activeTab === "wyceny" ? "#f0f6fc" : "#8b949e",
              border: "1px solid " + (activeTab === "wyceny" ? "#30363d" : "transparent"),
              borderBottom: "1px solid " + (activeTab === "wyceny" ? "#0d1117" : "transparent"),
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: -1,
            }}
          >
            Archiwum Wycen ({archivedQuotes.length})
          </button>
          <button
            onClick={() => handleTabChange("zlecenia")}
            style={{
              padding: "8px 16px",
              background: activeTab === "zlecenia" ? "#0d1117" : "transparent",
              color: activeTab === "zlecenia" ? "#f0f6fc" : "#8b949e",
              border: "1px solid " + (activeTab === "zlecenia" ? "#30363d" : "transparent"),
              borderBottom: "1px solid " + (activeTab === "zlecenia" ? "#0d1117" : "transparent"),
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: -1,
            }}
          >
            Archiwum Zleceń ({archivedOrders.length})
          </button>
        </div>

        <div style={{ padding: "16px 0" }}>
          {activeTab === "wyceny" ? (
            <OwnerNamesProvider quotes={archivedQuotes}>
              <ProjectTypeFilterStrip
                allTypes={projectTypes}
                value={filter}
                counts={counts}
                onChange={setFilter}
              />
              <QuoteListView
                quotes={filteredQuotes}
                emptyLabel={
                  archivedQuotesRaw === undefined
                    ? "Wczytywanie…"
                    : "Brak zarchiwizowanych wycen."
                }
              />
            </OwnerNamesProvider>
          ) : (
            <div style={{ padding: "0 16px" }}>
              <div className="qvm-items-wrap" style={{ border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
                <table className="qvm-items-table">
                  <thead>
                    <tr>
                      <th className="qvm-th">Numer zlecenia</th>
                      <th className="qvm-th">Klient</th>
                      <th className="qvm-th">Wartość netto</th>
                      <th className="qvm-th">Termin</th>
                      <th className="qvm-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedOrdersRaw === undefined ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#8b949e" }}>
                          Wczytywanie…
                        </td>
                      </tr>
                    ) : archivedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#8b949e" }}>
                          Brak zarchiwizowanych zleceń.
                        </td>
                      </tr>
                    ) : (
                      archivedOrders.map((order: any) => {
                        const statusObj = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || { label: order.status, color: "#8b949e", bg: "rgba(139, 148, 158, 0.15)" };
                        return (
                          <tr key={order._id} className="qvm-tr">
                            <td className="qvm-td" style={{ fontWeight: 600 }}>
                              <Link href={`/admin/zlecenia/${order._id}`} style={{ color: "#58a6ff", textDecoration: "none" }}>
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td className="qvm-td">
                              <div>{order.clientName}</div>
                              <div style={{ fontSize: 11, color: "#8b949e" }}>{order.clientPhone || order.clientEmail}</div>
                            </td>
                            <td className="qvm-td">{formatCurrency(order.valueNetto)}</td>
                            <td className="qvm-td">{order.deadline ? formatDeadline(order.deadline) : "—"}</td>
                            <td className="qvm-td">
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 99,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: statusObj.bg,
                                  color: statusObj.color,
                                }}
                              >
                                {statusObj.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

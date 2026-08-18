"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { RibbonGroup, RibbonBtn } from "../_components/ribbon";
import {
  Wrench,
  CheckCircle2,
  Clock,
  User,
  Search,
  Filter,
  Check,
  RotateCcw,
} from "lucide-react";

export default function ZgloszeniaItPage() {
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [search, setSearch] = useState("");

  const tickets = useQuery(api.tasks.listItTickets, { statusFilter: filter });
  const updateStatus = useMutation(api.tasks.updateItTicketStatus);

  const handleStatusChange = async (id: Id<"tasks">, status: "todo" | "in_progress" | "done") => {
    try {
      await updateStatus({ id, status });
      toast.success(status === "done" ? "Zgłoszenie zostało zamknięte!" : "Zaktualizowano status zgłoszenia");
    } catch {
      toast.error("Błąd aktualizacji statusu");
    }
  };

  const filteredTickets = (tickets || []).filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(s) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      t.creatorName.toLowerCase().includes(s)
    );
  });

  const openCount = (tickets || []).filter((t) => t.status !== "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117", color: "#c9d1d9" }}>
      {/* Top Ribbon */}
      <RibbonGroup label="Zgłoszenia IT">
        <RibbonBtn
          active={filter === "open"}
          onClick={() => setFilter("open")}
          icon={<Clock size={16} />}
          label={`Otwarte (${openCount})`}
        />
        <RibbonBtn
          active={filter === "closed"}
          onClick={() => setFilter("closed")}
          icon={<CheckCircle2 size={16} />}
          label="Zamknięte"
        />
        <RibbonBtn
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={<Filter size={16} />}
          label="Wszystkie"
        />
      </RibbonGroup>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f6fc", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <Wrench size={22} style={{ color: "#38bdf8" }} /> Zgłoszenia IT & Błędy
            </h1>
            <p style={{ fontSize: 13, color: "#8b949e", margin: 0 }}>
              Kolejka zgłoszeń technicznych, poprawek oraz propozycji zmian zgłoszonych przez użytkowników CRM.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 260 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8b949e" }} />
              <input
                type="text"
                placeholder="Szukaj w zgłoszeniach..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  padding: "6px 12px 6px 32px",
                  color: "#f0f6fc",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {!tickets ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>Ładowanie zgłoszeń IT...</div>
        ) : filteredTickets.length === 0 ? (
          <div
            style={{
              padding: 56,
              textAlign: "center",
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              color: "#8b949e",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={44} style={{ color: "#3fb950", marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f6fc" }}>Brak zgłoszeń w tej kategorii</div>
            <div style={{ fontSize: 13, marginTop: 6, color: "#8b949e" }}>Wszystkie błędy i zgłoszenia techniczne zostały rozwiązane!</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filteredTickets.map((t) => {
              const isClosed = t.status === "done";
              const isNew = t.status === "todo";

              return (
                <div
                  key={t._id}
                  style={{
                    background: "#161b22",
                    border: `1px solid ${isClosed ? "#21262d" : isNew ? "#38bdf850" : "#d9770650"}`,
                    borderLeft: `4px solid ${isClosed ? "#238636" : isNew ? "#38bdf8" : "#d97706"}`,
                    borderRadius: 8,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: isClosed ? 0.75 : 1,
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        {/* Status Badge Select */}
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t._id, e.target.value as any)}
                          style={{
                            background: isClosed
                              ? "rgba(35, 134, 54, 0.2)"
                              : isNew
                              ? "rgba(56, 189, 248, 0.2)"
                              : "rgba(217, 119, 6, 0.2)",
                            color: isClosed ? "#3fb950" : isNew ? "#38bdf8" : "#fbbf24",
                            border: `1px solid ${isClosed ? "#238636" : isNew ? "#38bdf8" : "#d97706"}`,
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="todo" style={{ background: "#161b22", color: "#38bdf8" }}>
                            Nowe (Oczekuje)
                          </option>
                          <option value="in_progress" style={{ background: "#161b22", color: "#fbbf24" }}>
                            W trakcie realizacji
                          </option>
                          <option value="done" style={{ background: "#161b22", color: "#3fb950" }}>
                            Zamknięte (Rozwiązane)
                          </option>
                        </select>

                        <span style={{ fontSize: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
                          <User size={12} /> Zgłosił: <strong style={{ color: "#c9d1d9" }}>{t.creatorName}</strong>
                        </span>

                        <span style={{ fontSize: 11, color: "#6e7681" }}>
                          · {new Date(t.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc", margin: 0, lineHeight: 1.4 }}>
                        {t.title}
                      </h3>
                    </div>

                    {/* Quick Close / Reopen Button */}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(t._id, isClosed ? "todo" : "done")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: isClosed ? "#21262d" : "#238636",
                        border: "1px solid #30363d",
                        borderRadius: 6,
                        padding: "5px 12px",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {isClosed ? (
                        <>
                          <RotateCcw size={12} /> Otwórz ponownie
                        </>
                      ) : (
                        <>
                          <Check size={12} /> Zamknij zgłoszenie
                        </>
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  {t.description && (
                    <div
                      style={{
                        background: "#0d1117",
                        border: "1px solid #21262d",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#c9d1d9",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {t.description}
                    </div>
                  )}

                  {/* Footer (if closed) */}
                  {isClosed && t.completedAt && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        borderTop: "1px solid #21262d",
                        paddingTop: 10,
                        marginTop: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#3fb950" }}>
                        ✓ Zamknięto {new Date(t.completedAt).toLocaleDateString("pl-PL")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

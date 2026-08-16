"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";

// ─── Stałe ─────────────────────────────────────────────────────────────────────
const VAT_RATES = [0, 5, 8, 23];

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Modal z nowym kluczem API ─────────────────────────────────────────────────
function ApiKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#161b22", border: "1px solid #f85149", borderRadius: 10, width: 520, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc" }}>🔑 Twój klucz API</div>

        <div style={{ background: "rgba(248, 81, 73, 0.08)", border: "1px solid #f85149", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#f85149" }}>
          ⚠️ <strong>Skopiuj klucz teraz.</strong> Ze względów bezpieczeństwa nie będzie on widoczny po zamknięciu tego okna.
        </div>

        <div style={{ background: "#0d1117", borderRadius: 6, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{ flex: 1, fontSize: 13, color: "#3fb950", wordBreak: "break-all" as const, fontFamily: "monospace" }}>
            {apiKey}
          </code>
          <button
            type="button"
            onClick={copyKey}
            style={{ background: copied ? "#3fb950" : "#21262d", border: "1px solid #30363d", color: copied ? "#0d1117" : "#f0f6fc", borderRadius: 5, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, transition: "all 0.2s" }}
          >
            {copied ? "✓ Skopiowano" : "Kopiuj"}
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#8b949e" }}>
          <strong style={{ color: "#f0f6fc" }}>Użycie:</strong>
          <pre style={{ background: "#0d1117", borderRadius: 6, padding: "10px 12px", marginTop: 8, fontSize: 11, color: "#f0f6fc", overflow: "auto" }}>
{`curl -X POST https://[convex-url]/api/partner/orders \\
  -H "X-Api-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"valueNetto": 12500.00}'`}
          </pre>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={onClose}>
            Rozumiem, zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formularz tworzenia / edycji Partnera ─────────────────────────────────────
function PartnerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: {
    _id?: Id<"partners">;
    name: string;
    clientId: Id<"clients">;
    clientName: string;
    projectType: string[];
    margin: number;
  };
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const clients = useQuery(api.clients.list, {}) ?? [];
  const projectTypes = useQuery(api.projectTypes.listActive) ?? [];

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    clientId: initial?.clientId ?? ("" as any),
    projectType: initial?.projectType[0] ?? "",
    margin: initial?.margin ?? 0,
  });
  const [busy, setBusy] = useState(false);

  const selectedClient = clients.find((c: any) => c._id === form.clientId);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Podaj nazwę Partnera"); return; }
    if (!form.clientId) { toast.error("Wybierz klienta CRM"); return; }
    if (!form.projectType) { toast.error("Wybierz typ projektu"); return; }

    setBusy(true);
    try {
      const projectType = [form.projectType];
      await onSave({
        name: form.name.trim(),
        clientId: form.clientId,
        clientName: selectedClient?.name ?? form.name,
        projectType,
        margin: form.margin,
      });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0d1117", border: "1px solid #30363d", color: "#f0f6fc",
    borderRadius: 6, padding: "7px 10px", fontSize: 13, width: "100%", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
        Nazwa Partnera *
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} disabled={busy} placeholder="np. Firma ABC Sp. z o.o." />
      </label>

      <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
        Powiązany Klient CRM *
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value as any })} style={inputStyle} disabled={busy}>
          <option value="">— Wybierz klienta —</option>
          {clients.map((c: any) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        {selectedClient && (
          <span style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
            {selectedClient.email && `✉ ${selectedClient.email}`}
            {selectedClient.phoneRaw && ` · 📞 ${selectedClient.phoneRaw}`}
          </span>
        )}
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Typ projektu *
          <select
            value={form.projectType}
            onChange={(e) => setForm({ ...form, projectType: e.target.value })}
            style={inputStyle}
            disabled={busy}
          >
            <option value="">— Wybierz typ projektu —</option>
            {projectTypes.map((pt: any) => (
              <option key={pt._id} value={pt.name}>{pt.name}</option>
            ))}
          </select>
          {projectTypes.length === 0 && (
            <span style={{ fontSize: 11, color: "#f85149", marginTop: 2 }}>
              Brak aktywnych typów projektów. Dodaj je w Konfigurator → Typy projektów.
            </span>
          )}
        </label>
        <label style={{ fontSize: 12, color: "#8b949e", display: "flex", flexDirection: "column", gap: 4 }}>
          Marża (%) *
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.margin}
            onChange={(e) => setForm({ ...form, margin: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
            disabled={busy}
            placeholder="np. 10"
          />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <button type="button" className="fluent-btn fluent-btn-ghost fluent-btn-sm" onClick={onCancel} disabled={busy}>Anuluj</button>
        <button type="button" className="fluent-btn fluent-btn-primary fluent-btn-sm" onClick={handleSave} disabled={busy}>
          {busy ? "Zapisywanie…" : (initial?._id ? "Zapisz zmiany" : "Utwórz Partnera")}
        </button>
      </div>
    </div>
  );
}

// ─── Główna strona ──────────────────────────────────────────────────────────────
export default function PartnerzyPage() {
  const router = useRouter();
  const partners = useQuery(api.partners.list) ?? [];

  const createPartner = useMutation(api.partners.create);
  const updatePartner = useMutation(api.partners.update);
  const removePartner = useMutation(api.partners.remove);
  const regenerateKey = useMutation(api.partners.regenerateApiKey);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"partners"> | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const editingPartner = editId ? partners.find((p: any) => p._id === editId) : null;

  async function handleCreate(data: any) {
    try {
      const result = await createPartner(data);
      toast.success("Partner utworzony. Zapisz swój klucz API!");
      setShowForm(false);
      setNewApiKey(result.apiKey);
    } catch (e: any) {
      toast.error(e.message || "Błąd tworzenia Partnera");
    }
  }

  async function handleUpdate(data: any) {
    if (!editId) return;
    try {
      await updatePartner({ id: editId, ...data });
      toast.success("Dane Partnera zaktualizowane");
      setEditId(null);
    } catch (e: any) {
      toast.error(e.message || "Błąd aktualizacji");
    }
  }

  async function handleToggleActive(id: Id<"partners">, current: boolean) {
    try {
      await updatePartner({ id, isActive: !current });
      toast.success(!current ? "Partner aktywowany" : "Partner dezaktywowany");
    } catch (e: any) {
      toast.error(e.message || "Błąd zmiany statusu");
    }
  }

  async function handleRegenerate(id: Id<"partners">) {
    if (!confirm("Na pewno zregenerować klucz API? Stary klucz przestanie działać natychmiast.")) return;
    try {
      const result = await regenerateKey({ id });
      setNewApiKey(result.apiKey);
      toast.success("Klucz API zregenerowany. Skopiuj nowy klucz!");
    } catch (e: any) {
      toast.error(e.message || "Błąd regeneracji klucza");
    }
  }

  async function handleDelete(id: Id<"partners">) {
    if (!confirm("Na pewno usunąć tego Partnera? Jego klucz API przestanie działać.")) return;
    try {
      await removePartner({ id });
      toast.success("Partner usunięty");
    } catch (e: any) {
      toast.error(e.message || "Błąd usuwania");
    }
  }

  return (
    <>
      {/* Modal klucza API */}
      {newApiKey && <ApiKeyModal apiKey={newApiKey} onClose={() => setNewApiKey(null)} />}

      {/* Ribbon */}
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn icon={<I.arrowLeft s={22} />} label="Wróć" onClick={() => router.back()} />
        </RibbonGroup>
        <RibbonGroup label="Partnerzy">
          <RibbonBtn icon={<I.plus s={22} />} label="Nowy Partner" onClick={() => { setShowForm(true); setEditId(null); }} />
        </RibbonGroup>
        <RibbonGroup label="API">
          <RibbonBtn
            icon={<I.doc s={22} />}
            label="Dokumentacja"
            onClick={() => window.open("https://docs.convex.dev/", "_blank")}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content" style={{ padding: "20px 24px" }}>
        {/* Nagłówek */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f6fc", margin: 0 }}>Partnerzy API</h1>
          <p style={{ fontSize: 13, color: "#8b949e", margin: "4px 0 0" }}>
            Zewnętrzni partnerzy tworzący zlecenia przez API. {partners.length} partnerów.
          </p>
        </div>

        {/* Endpoint info */}
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 3 }}>Endpoint API (POST)</div>
            <code style={{ fontSize: 12, color: "#58a6ff", fontFamily: "monospace" }}>
              {typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname.replace("localhost:3000", "twoja-domena.convex.site")}` : "https://..."}/api/partner/orders
            </code>
          </div>
          <div style={{ fontSize: 11, color: "#8b949e", textAlign: "right" as const }}>
            <div>Nagłówek: <code style={{ color: "#f0f6fc" }}>X-Api-Key</code></div>
            <div>Body: <code style={{ color: "#f0f6fc" }}>{"{ valueNetto: number }"}</code></div>
          </div>
        </div>

        {/* Formularz */}
        {(showForm || editId) && (
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc", marginBottom: 14 }}>
              {editId ? "Edytuj Partnera" : "Nowy Partner"}
            </div>
            <PartnerForm
              initial={editingPartner ? {
                _id: editingPartner._id,
                name: editingPartner.name,
                clientId: editingPartner.clientId,
                clientName: editingPartner.clientName,
                projectType: editingPartner.projectType,
                margin: editingPartner.margin,
              } : undefined}
              onSave={editId ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditId(null); }}
            />
          </div>
        )}

        {/* Brak partnerów */}
        {partners.length === 0 && !showForm && (
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f0f6fc", marginBottom: 6 }}>Brak Partnerów</div>
            <div style={{ fontSize: 13, color: "#8b949e", marginBottom: 16 }}>
              Dodaj pierwszego Partnera, aby wygenerować klucz API i umożliwić tworzenie zleceń z zewnątrz.
            </div>
            <button type="button" className="fluent-btn fluent-btn-primary" onClick={() => setShowForm(true)}>
              + Nowy Partner
            </button>
          </div>
        )}

        {/* Lista partnerów */}
        {partners.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {partners.map((partner: any) => (
              <div
                key={partner._id}
                style={{
                  background: "#161b22",
                  border: `1px solid ${partner.isActive ? "#30363d" : "#21262d"}`,
                  borderRadius: 8,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: partner.isActive ? 1 : 0.6,
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: partner.isActive ? "#3fb950" : "#6e7681",
                  boxShadow: partner.isActive ? "0 0 6px #3fb950" : "none",
                }} />

                {/* Dane partnera */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc" }}>{partner.name}</span>
                    {!partner.isActive && (
                      <span style={{ fontSize: 10, color: "#6e7681", border: "1px solid #30363d", borderRadius: 3, padding: "1px 5px" }}>NIEAKTYWNY</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 12, color: "#8b949e" }}>
                      👤 <strong style={{ color: "#f0f6fc" }}>{partner.clientName}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: "#8b949e" }}>
                      📁 {partner.projectType.join(", ")}
                    </span>
                    <span style={{ fontSize: 12, color: "#8b949e" }}>
                      📈 Marża: {partner.margin}%
                    </span>
                    {partner.ordersCount !== undefined && partner.ordersCount > 0 && (
                      <span style={{ fontSize: 12, color: "#8b949e" }}>
                        📋 {partner.ordersCount} zleceń
                      </span>
                    )}
                    {partner.lastUsedAt && (
                      <span style={{ fontSize: 12, color: "#8b949e" }}>
                        Ostatnie użycie: {formatDate(partner.lastUsedAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <code style={{ fontSize: 11, color: "#58a6ff", fontFamily: "monospace", background: "#0d1117", padding: "2px 6px", borderRadius: 3 }}>
                      {partner.apiKeyPrefix}…
                    </code>
                    <span style={{ fontSize: 11, color: "#6e7681", marginLeft: 6 }}>
                      od {formatDate(partner.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Akcje */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    title="Edytuj"
                    onClick={() => { setEditId(partner._id); setShowForm(false); }}
                    style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#58a6ff"; e.currentTarget.style.color = "#58a6ff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    title="Regeneruj klucz API"
                    onClick={() => handleRegenerate(partner._id)}
                    style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#d29922"; e.currentTarget.style.color = "#d29922"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                  >
                    🔄 Regeneruj klucz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(partner._id, partner.isActive)}
                    style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = partner.isActive ? "#f85149" : "#3fb950"; e.currentTarget.style.color = partner.isActive ? "#f85149" : "#3fb950"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                  >
                    {partner.isActive ? "Dezaktywuj" : "Aktywuj"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(partner._id)}
                    style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f85149"; e.currentTarget.style.color = "#f85149"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { getProjectTypeStyle, ownerInitials, type ContactInfo } from "../../_lib/quotes";
import type { Client } from "../../_lib/clients";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";
import { toast } from "sonner";

function clientFromDoc(c: Doc<"clients">): Client {
  return {
    id: c._id,
    name: c.name,
    street: c.street,
    postalCity: c.postalCity,
    phone: c.phoneRaw,
    email: c.email,
    type: c.type,
    nip: c.nip,
    contactPerson: c.contactPerson,
  };
}

function isoFromOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDeadlineLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DEADLINE_QUICK: { label: string; days: number }[] = [
  { label: "Dziś", days: 0 },
  { label: "+3 dni", days: 3 },
  { label: "+7 dni", days: 7 },
  { label: "+14 dni", days: 14 },
  { label: "+30 dni", days: 30 },
];

type RankedClient = { client: Client; count: number; saved: boolean };

export default function NoweZleceniePage() {
  const router = useRouter();
  const createOrder = useMutation(api.orders.createStandalone);
  const convexClients = (useQuery(api.clients.list) ?? []) as Doc<"clients">[];
  const activeProjectTypes = (useQuery(api.projectTypes.listActive) ?? []) as Array<{ _id: string; name: string; color: string }>;

  const allClients = useMemo<RankedClient[]>(() => {
    const map = new Map<string, RankedClient>();
    for (const c of convexClients) {
      map.set(c.name, { client: clientFromDoc(c), count: 0, saved: true });
    }
    return [...map.values()].sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [convexClients]);

  const frequentClients = useMemo(() => allClients.slice(0, 6), [allClients]);

  // ─── Klient ─────────────────────────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [forceNewClient, setForceNewClient] = useState(false);

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const [nip, setNip] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [nipLoading, setNipLoading] = useState(false);
  const [nipError, setNipError] = useState<string | null>(null);

  const fetchNipData = useAction(api.clients.fetchNipData); // This uses action, but wait, fetchNipData is an action. Let's use useAction
  const fetchNipDataAction = useConvex(); // we will handle nip differently or use action

  // ─── Typ projektu ────────────────────────────────────────────────────────────
  const [projectType, setProjectType] = useState<string | null>(null);

  // ─── Terminy ──────────────────────────────────────────────────────────────────
  const [deadline, setDeadline] = useState(isoFromOffsetDays(7));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [acceptanceDate, setAcceptanceDate] = useState("");

  // ─── Wartość i Pozycje ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState([{ lp: 1, description: "Konstrukcje aluminiowe", quantity: 1, unit: "kpl", priceNetto: 0, valueNetto: 0 }]);
  const [vatRateText, setVatRateText] = useState("23");

  const valueNetto = items.reduce((sum, item) => sum + (item.valueNetto || 0), 0);
  const vatRate = parseFloat(vatRateText.replace(",", ".")) || 23;
  const valueVat = valueNetto * (vatRate / 100);
  const valueBrutto = valueNetto + valueVat;

  // ─── Lokalizacja inwestycji ──────────────────────────────────────────────────
  const [investmentAddress, setInvestmentAddress] = useState("");
  const [investmentPlaceId, setInvestmentPlaceId] = useState<string | undefined>(undefined);
  const [investmentLat, setInvestmentLat] = useState<number | undefined>(undefined);
  const [investmentLng, setInvestmentLng] = useState<number | undefined>(undefined);
  const [investmentNotes, setInvestmentNotes] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const [touched, setTouched] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "creating" }
    | { kind: "waitingFolder" }
  >({ kind: "idle" });

  const searchResults = useMemo<RankedClient[]>(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return allClients
      .filter((entry) => {
        const c = entry.client;
        return [c.name, c.phone, c.email, c.postalCity, c.street]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
      .slice(0, 6);
  }, [clientQuery, allClients]);

  function applyClient(c: Client) {
    setSelectedClient(c);
    setShowNewClientForm(false);
    setClientQuery("");
    setName(c.name);
    setStreet(c.street ?? "");
    setPostalCity(c.postalCity ?? "");
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setClientType(c.type ?? "individual");
    setNip(c.nip ?? "");
    setContactPerson(c.contactPerson ?? "");
    setNipError(null);
  }

  function clearClient() {
    setSelectedClient(null);
    setName("");
    setStreet("");
    setPostalCity("");
    setPhone("");
    setEmail("");
    setClientType("individual");
    setNip("");
    setContactPerson("");
    setNipError(null);
    setInvestmentAddress("");
    setInvestmentPlaceId(undefined);
    setInvestmentLat(undefined);
    setInvestmentLng(undefined);
    setInvestmentNotes("");
  }

  function startNewClient(initialName?: string) {
    setSelectedClient(null);
    setShowNewClientForm(true);
    setName(initialName ?? "");
    setStreet("");
    setPostalCity("");
    setPhone("");
    setEmail("");
    setClientType("individual");
    setNip("");
    setContactPerson("");
    setNipError(null);
  }

  const nameValid = name.trim().length > 0;
  const projectTypeValid = projectType !== null;
  const deadlineValid = deadline === "" || /^\d{4}-\d{2}-\d{2}$/.test(deadline);

  const canSubmit = (selectedClient || nameValid) && projectTypeValid && deadlineValid;

  async function submitForm() {
    if (!canSubmit) {
      setTouched(true);
      toast.error("Wypełnij poprawnie wszystkie wymagane pola.");
      return;
    }
    setSubmitStatus({ kind: "creating" });

    try {
      const orderId = await createOrder({
        contact: {
          name: name.trim() || selectedClient?.name || "Brak nazwy",
          street: street.trim() || undefined,
          postalCity: postalCity.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
        projectType: projectType ? [projectType] : [],
        investment: {
          address: investmentAddress.trim() || undefined,
          notes: investmentNotes.trim() || undefined,
        },
        deadline: deadline || undefined,
        deliveryDate: deliveryDate || undefined,
        acceptanceDate: acceptanceDate || undefined,
        items,
        valueNetto,
        vatRate,
        valueVat,
        valueBrutto,
      });

      toast.success("Zlecenie utworzone pomyślnie.");
      router.push(`/admin/zlecenia/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || "Błąd podczas zapisu zlecenia");
      setSubmitStatus({ kind: "idle" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitForm();
  }

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn icon={<I.arrowLeft s={22} />} label="Wróć do listy" onClick={() => router.push("/admin/zlecenia")} />
        </RibbonGroup>
        <RibbonGroup label="Akcje">
          <RibbonBtn
            icon={<I.save s={22} sw={2.2} />}
            label={submitStatus.kind === "creating" ? "Zapisywanie…" : "Zapisz"}
            primary
            disabled={submitStatus.kind !== "idle" || (touched && !canSubmit)}
            onClick={submitForm}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content">
        <form className="quote-new-v2" onSubmit={handleSubmit}>
          <header className="quote-new-v2-header">
            <div className="quote-new-v2-header-icon">
              <I.box s={20} sw={2.2} />
            </div>
            <div>
              <h1 className="quote-new-v2-title">Nowe zlecenie</h1>
              <p className="quote-new-v2-subtitle">
                Wybierz klienta, typ projektu i szczegóły zlecenia. Zlecenie bez przypisanej wyceny.
              </p>
            </div>
          </header>

          <div className="quote-new-v2-grid">

            {/* ─── Klient ─────────────────────────────────────────────────── */}
            <FormBox
              title="Klient"
              icon={<I.user s={14} />}
              required
              span={12}
              tag={
                selectedClient ? (
                  <span className="quote-new-v2-tag is-ok"><I.check s={10} sw={2.6} /> wybrany</span>
                ) : null
              }
              action={
                selectedClient || showNewClientForm ? (
                  <button type="button" className="quote-new-v2-linkbtn" onClick={() => { setShowNewClientForm(false); clearClient(); setForceNewClient(false); }}>
                    {selectedClient || showNewClientForm ? "Wybierz innego" : "Wymuś nowego"}
                  </button>
                ) : null
              }
            >
              {selectedClient ? (
                <SelectedClientCard client={selectedClient} />
              ) : showNewClientForm ? (
                <NewClientForm
                  name={name} street={street} postalCity={postalCity} phone={phone} email={email}
                  nameError={touched && !nameValid}
                  clientType={clientType} onClientType={setClientType}
                  nip={nip} onNip={setNip}
                  contactPerson={contactPerson} onContactPerson={setContactPerson}
                  nipError={nipError} nipLoading={nipLoading} onFetchNip={() => {}}
                  onName={setName} onStreet={setStreet} onPostalCity={setPostalCity} onPhone={setPhone} onEmail={setEmail}
                />
              ) : (
                <ClientPicker
                  query={clientQuery} onQuery={setClientQuery}
                  searchResults={searchResults} frequent={frequentClients}
                  onPick={(rc) => applyClient(rc.client)}
                  onCreateNew={() => startNewClient(clientQuery.trim())}
                />
              )}
            </FormBox>

            {/* ─── Typ projektu ───────────────────────────────────────────── */}
            <FormBox
              title="Typ projektu"
              icon={<I.layers s={14} />}
              required
              span={12}
            >
              <div className="quote-new-v2-type-grid">
                {activeProjectTypes.map((t) => {
                  const s = getProjectTypeStyle(activeProjectTypes, t.name);
                  const active = projectType === t.name;
                  return (
                    <button
                      type="button"
                      key={t._id}
                      className={`quote-new-v2-type${active ? " is-active" : ""}`}
                      style={active ? { background: s.bg, color: s.fg, borderColor: s.border } : undefined}
                      onClick={() => setProjectType(active ? null : t.name)}
                      aria-pressed={active}
                    >
                      <span className="quote-new-v2-type-dot" style={{ background: s.fg }} />
                      <span>{t.name}</span>
                      {active && <span className="quote-new-v2-type-check"><I.check s={12} sw={2.6} /></span>}
                    </button>
                  );
                })}
              </div>
              {touched && !projectTypeValid && (
                <span className="fluent-field-error">Wybierz typ projektu.</span>
              )}
            </FormBox>

            {/* ─── Terminy ──────────────────────────────────────────── */}
            <FormBox
              title="Terminy"
              icon={<I.cal s={14} />}
              required
              span={6}
              tag={deadlineValid ? <span className="quote-new-v2-hint">{formatDeadlineLabel(deadline)}</span> : null}
            >
              <div className="quote-new-v2-quickrow">
                {DEADLINE_QUICK.map((q) => {
                  const iso = isoFromOffsetDays(q.days);
                  const active = deadline === iso;
                  return (
                    <button
                      type="button"
                      key={q.label}
                      className={`quote-new-v2-quick${active ? " is-active" : ""}`}
                      onClick={() => setDeadline(iso)}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                <label className="fluent-field fluent-field-full">
                  <span className="fluent-field-label">Termin realizacji (Deadline) - opcjonalnie</span>
                  <input
                    className="fluent-input"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  {touched && !deadlineValid && (
                    <span className="fluent-field-error">Wybierz datę.</span>
                  )}
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label className="fluent-field" style={{ flex: 1 }}>
                    <span className="fluent-field-label">Data dostawy</span>
                    <input
                      className="fluent-input"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </label>
                  <label className="fluent-field" style={{ flex: 1 }}>
                    <span className="fluent-field-label">Data akceptacji</span>
                    <input
                      className="fluent-input"
                      type="date"
                      value={acceptanceDate}
                      onChange={(e) => setAcceptanceDate(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </FormBox>

            {/* ─── Wartość zlecenia ──────────────────────────────────────────── */}
            <FormBox title="Wartość zlecenia" icon={<I.pln s={14} />} span={6}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="fluent-field fluent-field-full">
                  <span className="fluent-field-label">Wartość Netto</span>
                  <div className="quote-new-v2-money">
                    <input
                      className="fluent-input quote-new-v2-money-input"
                      type="text"
                      inputMode="decimal"
                      value={valueNetto.toFixed(2)}
                      readOnly
                      style={{ background: "rgba(255,255,255,0.05)" }}
                      placeholder="0,00"
                    />
                    <span className="quote-new-v2-money-unit">PLN</span>
                  </div>
                </label>

                <div style={{ display: "flex", gap: "12px" }}>
                  <label className="fluent-field" style={{ flex: 1 }}>
                    <span className="fluent-field-label">Stawka VAT (%)</span>
                    <input
                      className="fluent-input"
                      type="number"
                      value={vatRateText}
                      onChange={(e) => setVatRateText(e.target.value)}
                    />
                  </label>
                  <label className="fluent-field" style={{ flex: 1 }}>
                    <span className="fluent-field-label">Wartość Brutto</span>
                    <input
                      className="fluent-input"
                      type="number"
                      value={valueBrutto.toFixed(2)}
                      readOnly
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </label>
                </div>
              </div>
            </FormBox>

            {/* ─── Pozycje zlecenia ──────────────────────────────────────────── */}
            <FormBox title="Pozycje" icon={<I.box s={14} />} span={12}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ minWidth: "24px", color: "var(--text-muted)" }}>{item.lp}.</span>
                    <label className="fluent-field" style={{ flex: 2, marginBottom: 0 }}>
                      <input className="fluent-input" placeholder="Opis pozycji" value={item.description} onChange={e => {
                        const newItems = [...items];
                        newItems[i].description = e.target.value;
                        setItems(newItems);
                      }} />
                    </label>
                    <label className="fluent-field" style={{ flex: "0 0 80px", marginBottom: 0 }}>
                      <input type="number" min="1" className="fluent-input" placeholder="Ilość" value={item.quantity || ""} onChange={e => {
                        const newItems = [...items];
                        const q = Number(e.target.value);
                        newItems[i].quantity = q;
                        newItems[i].valueNetto = q * newItems[i].priceNetto;
                        setItems(newItems);
                      }} />
                    </label>
                    <label className="fluent-field" style={{ flex: "0 0 60px", marginBottom: 0 }}>
                      <input type="text" className="fluent-input" placeholder="Jm." value={item.unit || ""} onChange={e => {
                        const newItems = [...items];
                        newItems[i].unit = e.target.value;
                        setItems(newItems);
                      }} />
                    </label>
                    <label className="fluent-field" style={{ flex: "0 0 120px", marginBottom: 0 }}>
                      <input type="number" step="0.01" min="0" className="fluent-input" placeholder="Cena netto" value={item.priceNetto === 0 && !item.priceNetto ? "" : item.priceNetto} onChange={e => {
                        const newItems = [...items];
                        const p = Number(e.target.value);
                        newItems[i].priceNetto = p;
                        newItems[i].valueNetto = newItems[i].quantity * p;
                        setItems(newItems);
                      }} />
                    </label>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, lp: idx + 1 }));
                          setItems(newItems);
                        }}
                        style={{
                          background: "none", border: "none", color: "#f85149", cursor: "pointer",
                          padding: "6px", display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        title="Usuń pozycję"
                      >
                        <I.trash s={16} />
                      </button>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="fluent-btn fluent-btn-ghost"
                    onClick={() => {
                      setItems([
                        ...items,
                        { lp: items.length + 1, description: "", quantity: 1, unit: "szt", priceNetto: 0, valueNetto: 0 }
                      ]);
                    }}
                  >
                    <I.plus s={14} />
                    Dodaj pozycję
                  </button>
                </div>
              </div>
            </FormBox>

            {/* ─── Lokalizacja inwestycji ──────────────────────────────────── */}
            <FormBox title="Lokalizacja inwestycji" icon={<I.pin s={14} />} span={12} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
              {apiKey ? (
                <APIProvider apiKey={apiKey}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label className="fluent-field fluent-field-full">
                      <span className="fluent-field-label">Wpisz adres (autouzupełnianie Google Maps)</span>
                      <AdminAddressAutocompleteInput
                        value={investmentAddress}
                        onChangeText={setInvestmentAddress}
                        onSelect={(p) => {
                          setInvestmentAddress(p.address);
                          setInvestmentPlaceId(p.placeId);
                          setInvestmentLat(p.lat);
                          setInvestmentLng(p.lng);
                        }}
                      />
                    </label>
                    <label className="fluent-field fluent-field-full">
                      <span className="fluent-field-label">Notatki do lokalizacji</span>
                      <textarea
                        className="cfg-textarea"
                        value={investmentNotes}
                        onChange={(e) => setInvestmentNotes(e.target.value)}
                        placeholder="np. wjazd od ulicy Polnej, kod do bramy 1234..."
                        rows={2}
                      />
                    </label>
                  </div>
                </APIProvider>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label className="fluent-field fluent-field-full">
                    <span className="fluent-field-label">Adres inwestycji</span>
                    <input
                      className="fluent-input"
                      type="text"
                      value={investmentAddress}
                      onChange={(e) => setInvestmentAddress(e.target.value)}
                      placeholder="np. ul. Słoneczna 5, Kraków"
                    />
                  </label>
                  <label className="fluent-field fluent-field-full">
                    <span className="fluent-field-label">Notatki do lokalizacji</span>
                    <textarea
                      className="cfg-textarea"
                      value={investmentNotes}
                      onChange={(e) => setInvestmentNotes(e.target.value)}
                      placeholder="np. wjazd od ulicy Polnej, kod do bramy 1234..."
                      rows={2}
                    />
                  </label>
                </div>
              )}
            </FormBox>

          </div>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </main>
    </>
  );
}

// ─── FormBox ─────────────────────────────────────────────────────────────────

function FormBox({
  title, icon, required, span, tag, action, children,
}: {
  title: string;
  icon: React.ReactNode;
  required?: boolean;
  span: 4 | 6 | 8 | 12;
  tag?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`quote-detail-section quote-new-v2-cell quote-new-v2-cell-${span}`}>
      <header className="quote-detail-section-head">
        <div className="quote-detail-section-title">
          <span className="quote-detail-section-icon">{icon}</span>
          <span>{title}</span>
          {required && <span className="quote-new-v2-required">*</span>}
          {tag}
        </div>
        {action && <div className="quote-detail-section-action">{action}</div>}
      </header>
      <div className="quote-detail-section-body quote-new-v2-body">{children}</div>
    </section>
  );
}

// ─── Klient ───────────────────────────────────────────────────────────────────

function SelectedClientCard({ client }: { client: Client }) {
  const hasMeta = client.street || client.postalCity || client.phone || client.email || client.nip || client.contactPerson;
  return (
    <div className="quote-new-v2-selected">
      <div className="quote-new-v2-selected-avatar">
        {client.type === "business" ? "🏢" : ownerInitials(client.name)}
      </div>
      <div className="quote-new-v2-selected-body">
        <div className="quote-new-v2-selected-name">
          {client.name}
          {client.type === "business" && (
            <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--text-muted)", marginLeft: "6px" }}>
              (Firma)
            </span>
          )}
        </div>
        {hasMeta ? (
          <div className="quote-new-v2-selected-meta">
            {client.nip && <span><strong>NIP:</strong> {client.nip}</span>}
            {client.contactPerson && <span><strong>Osoba kont.:</strong> {client.contactPerson}</span>}
            {client.street && <span>{client.street}</span>}
            {client.postalCity && <span>{client.postalCity}</span>}
            {client.phone && <span className="quote-new-v2-selected-inline"><I.phone s={12} /> {client.phone}</span>}
            {client.email && <span className="quote-new-v2-selected-inline"><I.mail s={12} /> {client.email}</span>}
          </div>
        ) : (
          <div className="quote-new-v2-selected-meta quote-new-v2-selected-empty">Brak dodatkowych danych kontaktowych.</div>
        )}
      </div>
    </div>
  );
}

function ClientPicker({
  query, onQuery, searchResults, frequent, onPick, onCreateNew,
}: {
  query: string;
  onQuery: (v: string) => void;
  searchResults: RankedClient[];
  frequent: RankedClient[];
  onPick: (c: RankedClient) => void;
  onCreateNew: () => void;
}) {
  const trimmed = query.trim();
  return (
    <div className="quote-new-v2-picker">
      <div className="quote-new-v2-search">
        <I.search s={14} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Szukaj klienta po nazwie, telefonie, e-mailu…"
        />
        {query && (
          <button type="button" className="quote-new-v2-search-clear" onClick={() => onQuery("")} aria-label="Wyczyść">×</button>
        )}
      </div>

      {trimmed ? (
        <div className="quote-new-v2-results">
          {searchResults.length === 0 ? (
            <div className="quote-new-v2-empty">Brak klientów pasujących do „{trimmed}"</div>
          ) : (
            searchResults.map((entry) => (
              <button key={entry.client.id} type="button" className="quote-new-v2-result" onClick={() => onPick(entry)}>
                <span className="quote-new-v2-result-avatar">{ownerInitials(entry.client.name)}</span>
                <span className="quote-new-v2-result-body">
                  <span className="quote-new-v2-result-name">{entry.client.name}</span>
                  <span className="quote-new-v2-result-meta">
                    {[entry.client.postalCity, entry.client.phone, entry.client.email].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                {entry.count > 0 && <span className="quote-new-v2-result-badge">{entry.count}×</span>}
                <span className="quote-new-v2-result-add"><I.arrow s={14} sw={2.2} /></span>
              </button>
            ))
          )}
        </div>
      ) : frequent.length > 0 ? (
        <>
          <div className="quote-new-v2-sublabel">
            <span>Najczęściej wybierani</span>
            <span className="quote-new-v2-sublabel-hint">kliknij, aby wybrać</span>
          </div>
          <div className="quote-new-v2-freq-grid">
            {frequent.map((entry) => (
              <button key={entry.client.id} type="button" className="quote-new-v2-freq" onClick={() => onPick(entry)}>
                <span className="quote-new-v2-freq-avatar">{ownerInitials(entry.client.name)}</span>
                <span className="quote-new-v2-freq-body">
                  <span className="quote-new-v2-freq-name">{entry.client.name}</span>
                  <span className="quote-new-v2-freq-meta">{entry.client.postalCity || entry.client.phone || entry.client.email || "—"}</span>
                </span>
                {entry.count > 0 && <span className="quote-new-v2-freq-badge">{entry.count}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="quote-new-v2-empty">Brak zapisanych klientów. Dodaj pierwszego poniżej.</div>
      )}

      <button type="button" className="quote-new-v2-create" onClick={onCreateNew}>
        <I.plus s={14} sw={2.2} />
        <span>{trimmed ? `Dodaj nowego klienta „${trimmed}"` : "Dodaj nowego klienta"}</span>
      </button>
    </div>
  );
}

function NewClientForm({
  name, street, postalCity, phone, email, nameError,
  clientType, onClientType, nip, onNip, contactPerson, onContactPerson,
  nipError, nipLoading, onFetchNip,
  onName, onStreet, onPostalCity, onPhone, onEmail,
}: {
  name: string; street: string; postalCity: string; phone: string; email: string;
  nameError: boolean;
  clientType: "individual" | "business";
  onClientType: (v: "individual" | "business") => void;
  nip: string;
  onNip: (v: string) => void;
  contactPerson: string;
  onContactPerson: (v: string) => void;
  nipError: string | null;
  nipLoading: boolean;
  onFetchNip: () => void;
  onName: (v: string) => void; onStreet: (v: string) => void; onPostalCity: (v: string) => void;
  onPhone: (v: string) => void; onEmail: (v: string) => void;
}) {
  const isBusiness = clientType === "business";
  const nipValid = clientType === "individual" || nip.replace(/\D/g, "").length === 10;

  return (
    <div className="quote-new-v2-newclient">
      <div style={{ marginBottom: "16px" }}>
        <span className="fluent-field-label" style={{ display: "block", marginBottom: "6px" }}>Typ klienta</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`fluent-btn ${clientType === "individual" ? "fluent-btn-primary" : "fluent-btn-ghost"}`}
            onClick={() => {
              onClientType("individual");
              onName("");
              onStreet("");
              onPostalCity("");
              onNip("");
            }}
            style={{ padding: "6px 14px", fontSize: "13px" }}
          >
            Osoba prywatna
          </button>
          <button
            type="button"
            className={`fluent-btn ${clientType === "business" ? "fluent-btn-primary" : "fluent-btn-ghost"}`}
            onClick={() => {
              onClientType("business");
              onName("");
              onStreet("");
              onPostalCity("");
              onNip("");
            }}
            style={{ padding: "6px 14px", fontSize: "13px" }}
          >
            Firma
          </button>
        </div>
      </div>

      <div className="quote-new-v2-newclient-grid">
        {isBusiness && (
          <label className="fluent-field fluent-field-full">
            <span className="fluent-field-label">NIP <span className="fluent-field-required">*</span></span>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                className="fluent-input"
                type="text"
                value={nip}
                onChange={(e) => onNip(e.target.value)}
                placeholder="np. 1234567890"
                maxLength={15}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="fluent-btn"
                onClick={onFetchNip}
                disabled={nip.replace(/\D/g, "").length !== 10 || nipLoading}
                style={{ whiteSpace: "nowrap", padding: "0 12px", border: "1px solid var(--border)" }}
              >
                {nipLoading ? "Pobieranie..." : "Pobierz dane"}
              </button>
            </div>
            {nipError && <span className="fluent-field-error" style={{ display: "block", marginTop: "4px" }}>{nipError}</span>}
            {!nipValid && <span className="fluent-field-error" style={{ display: "block", marginTop: "4px" }}>Podaj poprawny 10-cyfrowy NIP.</span>}
          </label>
        )}

        <label className="fluent-field fluent-field-full">
          <span className="fluent-field-label">
            {isBusiness ? "Nazwa firmy" : "Nazwa / imię i nazwisko"}{" "}
            <span className="fluent-field-required">*</span>
          </span>
          <input
            className="fluent-input"
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={isBusiness ? "np. ProBud Inwestycje" : "np. Jan Kowalski"}
            autoFocus
          />
          {nameError && <span className="fluent-field-error">Podaj nazwę lub firmę.</span>}
        </label>

        {isBusiness && (
          <label className="fluent-field fluent-field-full">
            <span className="fluent-field-label">Osoba kontaktowa</span>
            <input
              className="fluent-input"
              type="text"
              value={contactPerson}
              onChange={(e) => onContactPerson(e.target.value)}
              placeholder="np. Jan Kowalski"
            />
          </label>
        )}

        <label className="fluent-field">
          <span className="fluent-field-label">Ulica</span>
          <input className="fluent-input" type="text" value={street} onChange={(e) => onStreet(e.target.value)} placeholder="np. ul. Kwiatowa 12" />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">Kod, miasto</span>
          <input className="fluent-input" type="text" value={postalCity} onChange={(e) => onPostalCity(e.target.value)} placeholder="np. 00-001 Warszawa" />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">Telefon</span>
          <input className="fluent-input" type="tel" value={phone} onChange={(e) => onPhone(e.target.value)} placeholder="np. +48 600 000 000" />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">E-mail</span>
          <input className="fluent-input" type="email" value={email} onChange={(e) => onEmail(e.target.value)} placeholder="np. kontakt@firma.pl" />
        </label>
      </div>
    </div>
  );
}

function AdminAddressAutocompleteInput({
  value,
  onChangeText,
  onSelect,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (p: {
    address: string;
    placeId?: string;
    lat?: number;
    lng?: number;
  }) => void;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["place_id", "formatted_address", "geometry", "name"],
      types: ["geocode"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      onSelect({
        address: place.formatted_address || place.name || "",
        placeId: place.place_id,
        lat: loc?.lat(),
        lng: loc?.lng(),
      });
    });
    return () => {
      listener.remove();
    };
  }, [places, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
      placeholder="Wpisz adres inwestycji, np. Słoneczna 5, Kraków"
      className="fluent-input"
      autoComplete="off"
    />
  );
}

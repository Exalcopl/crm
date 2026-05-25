"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import {
  getProjectTypeStyle,
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  ownerInitials,
  type ContactInfo,
  type QuoteStatus,
} from "../../_lib/quotes";
import type { Client } from "../../_lib/clients";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";

function clientFromDoc(c: Doc<"clients">): Client {
  return {
    id: c._id,
    name: c.name,
    street: c.street,
    postalCity: c.postalCity,
    phone: c.phoneRaw,
    email: c.email,
  };
}

const DEADLINE_QUICK: { label: string; days: number }[] = [
  { label: "Dziś", days: 0 },
  { label: "+3 dni", days: 3 },
  { label: "+7 dni", days: 7 },
  { label: "+14 dni", days: 14 },
  { label: "+30 dni", days: 30 },
];


function isoFromOffsetDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
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

type RankedClient = { client: Client; count: number; saved: boolean };

export default function NowaWycenaPage() {
  const router = useRouter();
  const createQuote = useMutation(api.quotes.create);
  const convexQuotes = useQuery(api.quotes.list) ?? [];
  const activeProjectTypes = (useQuery(api.projectTypes.listActive) ?? []) as Array<{ _id: string; name: string; color: string }>;
  const convexClients = (useQuery(api.clients.list) ?? []) as Doc<"clients">[];

  const allClients = useMemo<RankedClient[]>(() => {
    const map = new Map<string, RankedClient>();
    for (const c of convexClients) {
      map.set(c.name, { client: clientFromDoc(c), count: 0, saved: true });
    }
    for (const q of convexQuotes) {
      const name = q.contact.name.trim();
      if (!name) continue;
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(name, {
          client: {
            id: `virtual-${name}`,
            name,
            street: q.contact.street,
            postalCity: q.contact.postalCity,
            phone: q.contact.phone,
            email: q.contact.email,
          },
          count: 1,
          saved: false,
        });
      }
    }
    return [...map.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.client.name.localeCompare(b.client.name);
    });
  }, [convexClients, convexQuotes]);

  const frequentClients = useMemo(
    () => allClients.slice(0, 6),
    [allClients],
  );

  type AssignableUser = { _id: Id<"users">; name: string | null; email: string | null };
  const assignableUsers =
    (useQuery(api.users.listAssignable, {}) as AssignableUser[] | undefined) ?? [];

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [projectTypes, setProjectTypes] = useState<string[]>([]);

  function toggleProjectType(t: string) {
    setProjectTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }
  const [status, setStatus] = useState<QuoteStatus>("Do zrobienia");
  const [valueText, setValueText] = useState("");
  const [deadline, setDeadline] = useState(isoFromOffsetDays(7));
  const [ownerId, setOwnerId] = useState<Id<"users"> | null>(null);
  const [touched, setTouched] = useState(false);
  const [forceNewClient, setForceNewClient] = useState(false);

  type MatchedClient = { _id: Id<"clients">; name: string } | null;
  const matchedClient =
    (useQuery(
      api.clients.findMatchPublic,
      !selectedClient && !forceNewClient && (phone.trim() || name.trim())
        ? { name: name.trim(), phone: phone.trim() || undefined }
        : "skip",
    ) as MatchedClient | undefined) ?? null;

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
  }

  function clearClientFields() {
    setName("");
    setStreet("");
    setPostalCity("");
    setPhone("");
    setEmail("");
  }

  function clearClient() {
    setSelectedClient(null);
    clearClientFields();
  }

  function startNewClient(initialName?: string) {
    setSelectedClient(null);
    setShowNewClientForm(true);
    setName(initialName ?? "");
    setStreet("");
    setPostalCity("");
    setPhone("");
    setEmail("");
  }

  const parsedValue = useMemo(() => {
    const t = valueText.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [valueText]);

  const nameValid = name.trim().length > 0;
  const ownerValid = ownerId !== null;
  const deadlineValid = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const valueValid = parsedValue === null || Number.isFinite(parsedValue);
  const projectTypesValid = projectTypes.length > 0;
  const canSubmit =
    nameValid &&
    ownerValid &&
    deadlineValid &&
    valueValid &&
    projectTypesValid;

  function handleCancel() {
    router.push("/admin");
  }

  async function submitForm() {
    setTouched(true);
    if (!canSubmit) return;
    const contact: ContactInfo = {
      name: name.trim(),
      street: trimOrUndefined(street),
      postalCity: trimOrUndefined(postalCity),
      phone: trimOrUndefined(phone),
      email: trimOrUndefined(email),
    };

    try {
      const result = await createQuote({
        contact,
        projectType: projectTypes,
        status,
        value: parsedValue === null ? null : (parsedValue as number),
        deadline,
        ownerId,
      });
      router.push(`/admin/wyceny/${encodeURIComponent(result.code)}`);
    } catch (err) {
      console.error("Błąd zapisu wyceny:", err);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitForm();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn
            icon={<I.arrowLeft s={22} />}
            label="Wróć do listy"
            onClick={handleCancel}
          />
        </RibbonGroup>
        <RibbonGroup label="Akcje">
          <RibbonBtn
            icon={<I.save s={22} sw={2.2} />}
            label="Zapisz"
            primary
            disabled={touched && !canSubmit}
            onClick={submitForm}
          />
        </RibbonGroup>
      </div>

      <main className="fluent-content">
        <form className="quote-new-v2" onSubmit={handleSubmit}>
          <header className="quote-new-v2-header">
            <div className="quote-new-v2-header-icon">
              <I.plus s={20} sw={2.2} />
            </div>
            <div>
              <h1 className="quote-new-v2-title">Nowa wycena</h1>
              <p className="quote-new-v2-subtitle">
                Wybierz klienta jednym kliknięciem, dorzuć typ projektu i termin —
                gotowe.
              </p>
            </div>
          </header>

          <div className="quote-new-v2-grid">
            <FormBox
              title="Klient"
              icon={<I.user s={14} />}
              required
              span={12}
              tag={
                selectedClient ? (
                  <span className="quote-new-v2-tag is-ok">
                    <I.check s={10} sw={2.6} /> wybrany
                  </span>
                ) : matchedClient ? (
                  <span className="quote-new-v2-tag">
                    <I.search s={10} /> rozpoznano
                  </span>
                ) : null
              }
              action={
                selectedClient || showNewClientForm || matchedClient ? (
                  <button
                    type="button"
                    className="quote-new-v2-linkbtn"
                    onClick={() => {
                      setShowNewClientForm(false);
                      clearClient();
                      setForceNewClient(false);
                    }}
                  >
                    {selectedClient || showNewClientForm ? "Wybierz innego" : "Wymuś nowego"}
                  </button>
                ) : null
              }
            >
              {matchedClient && !selectedClient && !showNewClientForm && !forceNewClient ? (
                <div className="quote-new-v2-matched-banner">
                  <div className="quote-new-v2-matched-icon">
                    <I.check s={16} sw={2.4} />
                  </div>
                  <div className="quote-new-v2-matched-body">
                    <div className="quote-new-v2-matched-title">
                      Rozpoznano klienta: <strong>{matchedClient.name}</strong>
                    </div>
                    <div className="quote-new-v2-matched-text">
                      Wycena zostanie dołączona do tego klienta
                    </div>
                  </div>
                </div>
              ) : selectedClient ? (
                <SelectedClientCard client={selectedClient} />
              ) : showNewClientForm ? (
                <NewClientForm
                  name={name}
                  street={street}
                  postalCity={postalCity}
                  phone={phone}
                  email={email}
                  nameError={touched && !nameValid}
                  onName={setName}
                  onStreet={setStreet}
                  onPostalCity={setPostalCity}
                  onPhone={setPhone}
                  onEmail={setEmail}
                />
              ) : (
                <ClientPicker
                  query={clientQuery}
                  onQuery={setClientQuery}
                  searchResults={searchResults}
                  frequent={frequentClients}
                  onPick={(rc) => applyClient(rc.client)}
                  onCreateNew={() => startNewClient(clientQuery.trim())}
                />
              )}
            </FormBox>

            <FormBox
              title="Typ projektu"
              icon={<I.layers s={14} />}
              required
              span={8}
              tag={
                <span className="quote-new-v2-hint">
                  można wybrać kilka
                </span>
              }
            >
              <div className="quote-new-v2-type-grid">
                {activeProjectTypes.map((t) => {
                  const s = getProjectTypeStyle(activeProjectTypes, t.name);
                  const active = projectTypes.includes(t.name);
                  return (
                    <button
                      type="button"
                      key={t._id}
                      className={`quote-new-v2-type${active ? " is-active" : ""}`}
                      style={
                        active
                          ? {
                              background: s.bg,
                              color: s.fg,
                              borderColor: s.border,
                            }
                          : undefined
                      }
                      onClick={() => toggleProjectType(t.name)}
                      aria-pressed={active}
                    >
                      <span
                        className="quote-new-v2-type-dot"
                        style={{ background: s.fg }}
                      />
                      <span>{t.name}</span>
                      {active && (
                        <span className="quote-new-v2-type-check">
                          <I.check s={12} sw={2.6} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {touched && !projectTypesValid && (
                <span className="fluent-field-error">
                  Wybierz co najmniej jeden typ projektu.
                </span>
              )}
            </FormBox>

            <FormBox
              title="Opiekun"
              icon={<I.user s={14} />}
              required
              span={4}
            >
              {assignableUsers.length > 0 ? (
                <div className="quote-new-v2-owner-chips">
                  {assignableUsers.map((u) => {
                    const label = u.name?.trim() || u.email?.trim() || "—";
                    const active = ownerId === u._id;
                    return (
                      <button
                        key={u._id as unknown as string}
                        type="button"
                        className={`quote-new-v2-owner-chip${
                          active ? " is-active" : ""
                        }`}
                        onClick={() => setOwnerId(u._id)}
                      >
                        <span className="kanban-card-owner-avatar">
                          {ownerInitials(label)}
                        </span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="fluent-field-hint">
                  Brak użytkowników z rolą admin lub sales.
                </span>
              )}
              {touched && !ownerValid && (
                <span className="fluent-field-error">Wybierz opiekuna.</span>
              )}
            </FormBox>

            <FormBox
              title="Status początkowy"
              icon={<I.flag s={14} />}
              span={12}
            >
              <div className="quote-new-v2-status-row">
                {QUOTE_STATUSES.map((s, idx) => {
                  const color = QUOTE_STATUS_COLORS[s];
                  const active = status === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      className={`quote-new-v2-status-step${
                        active ? " is-active" : ""
                      }`}
                      style={
                        active
                          ? {
                              borderColor: color,
                              boxShadow: `inset 0 0 0 1px ${color}`,
                            }
                          : undefined
                      }
                      onClick={() => setStatus(s)}
                    >
                      <span
                        className="quote-new-v2-status-dot"
                        style={{ background: color }}
                      />
                      <span className="quote-new-v2-status-label">{s}</span>
                      <span className="quote-new-v2-status-idx">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </FormBox>

            <FormBox
              title="Termin oferty"
              icon={<I.cal s={14} />}
              required
              span={6}
              tag={
                deadlineValid ? (
                  <span className="quote-new-v2-hint">
                    {formatDeadlineLabel(deadline)}
                  </span>
                ) : null
              }
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
              <input
                className="fluent-input"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              {touched && !deadlineValid && (
                <span className="fluent-field-error">Wybierz datę.</span>
              )}
            </FormBox>

            <FormBox
              title="Wartość brutto"
              icon={<I.pln s={14} />}
              span={6}
              tag={<span className="quote-new-v2-hint">opcjonalnie</span>}
            >
              <div className="quote-new-v2-money">
                <input
                  className="fluent-input quote-new-v2-money-input"
                  type="text"
                  inputMode="decimal"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  placeholder="0,00"
                />
                <span className="quote-new-v2-money-unit">PLN</span>
              </div>
              {touched && !valueValid && (
                <span className="fluent-field-error">
                  Podaj liczbę nieujemną.
                </span>
              )}
            </FormBox>
          </div>

          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </main>
    </>
  );
}

function FormBox({
  title,
  icon,
  required,
  span,
  tag,
  action,
  children,
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
    <section
      className={`quote-detail-section quote-new-v2-cell quote-new-v2-cell-${span}`}
    >
      <header className="quote-detail-section-head">
        <div className="quote-detail-section-title">
          <span className="quote-detail-section-icon">{icon}</span>
          <span>{title}</span>
          {required && <span className="quote-new-v2-required">*</span>}
          {tag}
        </div>
        {action && (
          <div className="quote-detail-section-action">{action}</div>
        )}
      </header>
      <div className="quote-detail-section-body quote-new-v2-body">
        {children}
      </div>
    </section>
  );
}

function SelectedClientCard({ client }: { client: Client }) {
  const hasMeta =
    client.street || client.postalCity || client.phone || client.email;
  return (
    <div className="quote-new-v2-selected">
      <div className="quote-new-v2-selected-avatar">
        {ownerInitials(client.name)}
      </div>
      <div className="quote-new-v2-selected-body">
        <div className="quote-new-v2-selected-name">{client.name}</div>
        {hasMeta ? (
          <div className="quote-new-v2-selected-meta">
            {client.street && <span>{client.street}</span>}
            {client.postalCity && <span>{client.postalCity}</span>}
            {client.phone && (
              <span className="quote-new-v2-selected-inline">
                <I.phone s={12} /> {client.phone}
              </span>
            )}
            {client.email && (
              <span className="quote-new-v2-selected-inline">
                <I.mail s={12} /> {client.email}
              </span>
            )}
          </div>
        ) : (
          <div className="quote-new-v2-selected-meta quote-new-v2-selected-empty">
            Brak dodatkowych danych kontaktowych.
          </div>
        )}
      </div>
    </div>
  );
}

function ClientPicker({
  query,
  onQuery,
  searchResults,
  frequent,
  onPick,
  onCreateNew,
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
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="quote-new-v2-search-clear"
            onClick={() => onQuery("")}
            aria-label="Wyczyść"
          >
            ×
          </button>
        )}
      </div>

      {trimmed ? (
        <div className="quote-new-v2-results">
          {searchResults.length === 0 ? (
            <div className="quote-new-v2-empty">
              Brak klientów pasujących do „{trimmed}”
            </div>
          ) : (
            searchResults.map((entry) => (
              <button
                key={entry.client.id}
                type="button"
                className="quote-new-v2-result"
                onClick={() => onPick(entry)}
              >
                <span className="quote-new-v2-result-avatar">
                  {ownerInitials(entry.client.name)}
                </span>
                <span className="quote-new-v2-result-body">
                  <span className="quote-new-v2-result-name">
                    {entry.client.name}
                  </span>
                  <span className="quote-new-v2-result-meta">
                    {[
                      entry.client.postalCity,
                      entry.client.phone,
                      entry.client.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </span>
                {entry.count > 0 && (
                  <span className="quote-new-v2-result-badge">
                    {entry.count}×
                  </span>
                )}
                <span className="quote-new-v2-result-add">
                  <I.arrow s={14} sw={2.2} />
                </span>
              </button>
            ))
          )}
        </div>
      ) : frequent.length > 0 ? (
        <>
          <div className="quote-new-v2-sublabel">
            <span>Najczęściej wybierani</span>
            <span className="quote-new-v2-sublabel-hint">
              kliknij, aby wybrać
            </span>
          </div>
          <div className="quote-new-v2-freq-grid">
            {frequent.map((entry) => (
              <button
                key={entry.client.id}
                type="button"
                className="quote-new-v2-freq"
                onClick={() => onPick(entry)}
              >
                <span className="quote-new-v2-freq-avatar">
                  {ownerInitials(entry.client.name)}
                </span>
                <span className="quote-new-v2-freq-body">
                  <span className="quote-new-v2-freq-name">
                    {entry.client.name}
                  </span>
                  <span className="quote-new-v2-freq-meta">
                    {entry.client.postalCity ||
                      entry.client.phone ||
                      entry.client.email ||
                      "—"}
                  </span>
                </span>
                {entry.count > 0 && (
                  <span className="quote-new-v2-freq-badge">
                    {entry.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="quote-new-v2-empty">
          Brak zapisanych klientów. Dodaj pierwszego poniżej.
        </div>
      )}

      <button
        type="button"
        className="quote-new-v2-create"
        onClick={onCreateNew}
      >
        <I.plus s={14} sw={2.2} />
        <span>
          {trimmed
            ? `Dodaj nowego klienta „${trimmed}”`
            : "Dodaj nowego klienta"}
        </span>
      </button>
    </div>
  );
}

function NewClientForm({
  name,
  street,
  postalCity,
  phone,
  email,
  nameError,
  onName,
  onStreet,
  onPostalCity,
  onPhone,
  onEmail,
}: {
  name: string;
  street: string;
  postalCity: string;
  phone: string;
  email: string;
  nameError: boolean;
  onName: (v: string) => void;
  onStreet: (v: string) => void;
  onPostalCity: (v: string) => void;
  onPhone: (v: string) => void;
  onEmail: (v: string) => void;
}) {
  return (
    <div className="quote-new-v2-newclient">
      <div className="quote-new-v2-newclient-grid">
        <label className="fluent-field fluent-field-full">
          <span className="fluent-field-label">
            Nazwa / firma <span className="fluent-field-required">*</span>
          </span>
          <input
            className="fluent-input"
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="np. ProBud Inwestycje"
            autoFocus
          />
          {nameError && (
            <span className="fluent-field-error">
              Podaj nazwę lub firmę.
            </span>
          )}
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">Ulica</span>
          <input
            className="fluent-input"
            type="text"
            value={street}
            onChange={(e) => onStreet(e.target.value)}
            placeholder="np. ul. Kwiatowa 12"
          />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">Kod, miasto</span>
          <input
            className="fluent-input"
            type="text"
            value={postalCity}
            onChange={(e) => onPostalCity(e.target.value)}
            placeholder="np. 00-001 Warszawa"
          />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">Telefon</span>
          <input
            className="fluent-input"
            type="tel"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="np. +48 600 000 000"
          />
        </label>
        <label className="fluent-field">
          <span className="fluent-field-label">E-mail</span>
          <input
            className="fluent-input"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="np. kontakt@firma.pl"
          />
        </label>
      </div>
    </div>
  );
}

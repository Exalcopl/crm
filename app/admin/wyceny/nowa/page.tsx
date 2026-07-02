"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../../_lib/icons";
import { FilePicker } from "@/app/_components/file-picker";
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
import {
  CRM_COLORS,
  CRM_ROOF_TYPES,
  CRM_ORIENTATIONS,
  CRM_LIGHTING_OPTIONS,
  CRM_SIDE_ENCLOSURES,
  CRM_ADDONS,
  CRM_ZADASZENIA_TYPES,
  CRM_ZADASZENIA_ROOF_TYPES,
  CRM_ZADASZENIA_LIGHTING,
  CRM_ZADASZENIA_ADDONS,
} from "../../_lib/configurator-data";

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

// ─── Typy konfiguracji ───────────────────────────────────────────────────────

type PergolaConfig = {
  rodzajId: string;
  orientacjaId: string;
  width: number;
  depth: number;
  height: number;
  structureColor: string;
  roofColor: string;
  lighting: Record<string, string>;
  enclosureTypeId: string | null;
  enclosureVariantId: string | null;
  addons: string[];
};

type ZadaszeniaConfig = {
  rodzajId: string;
  width: number;
  depth: number;
  height1: number;
  height2: number;
  dachId: string;
  structureColor: string;
  lighting: Record<string, string>;
  enclosureTypeId: string | null;
  enclosureVariantId: string | null;
  addons: string[];
};

const DEFAULT_PERGOLA: PergolaConfig = {
  rodzajId: CRM_ROOF_TYPES[0].id,
  orientacjaId: CRM_ORIENTATIONS[0].id,
  width: 400,
  depth: 300,
  height: 250,
  structureColor: CRM_COLORS[0].id,
  roofColor: CRM_COLORS[0].id,
  lighting: {},
  enclosureTypeId: null,
  enclosureVariantId: null,
  addons: [],
};

const DEFAULT_ZADASZENIA: ZadaszeniaConfig = {
  rodzajId: CRM_ZADASZENIA_TYPES[0].id,
  width: 400,
  depth: 300,
  height1: 250,
  height2: 220,
  dachId: CRM_ZADASZENIA_ROOF_TYPES[0].id,
  structureColor: CRM_COLORS[0].id,
  lighting: {},
  enclosureTypeId: null,
  enclosureVariantId: null,
  addons: [],
};

type RankedClient = { client: Client; count: number; saved: boolean };

// ─── Mapowanie nazwy typu na identyfikator konfiguracji ──────────────────────

function getConfigKey(typeName: string): "pergola" | "zadaszenia" | "stolarka" | null {
  const n = typeName.toLowerCase();
  if (n === "pergola") return "pergola";
  if (n === "zadaszenia") return "zadaszenia";
  if (n === "stolarka") return "stolarka";
  return null;
}

// ─── Budowanie JSON konfiguracji (identyczny format jak na www) ──────────────

function buildPergolaConfiguration(p: PergolaConfig): unknown {
  const roof = CRM_ROOF_TYPES.find(r => r.id === p.rodzajId);
  const orientation = CRM_ORIENTATIONS.find(o => o.id === p.orientacjaId);
  const structureColor = CRM_COLORS.find(c => c.id === p.structureColor);
  const roofColor = CRM_COLORS.find(c => c.id === p.roofColor);
  const enclosureType = CRM_SIDE_ENCLOSURES.find(e => e.id === p.enclosureTypeId);
  const enclosureVariant = enclosureType?.variants.find(v => v.id === p.enclosureVariantId);
  return {
    type: "pergola",
    rodzajPergoli: roof?.name ?? p.rodzajId,
    orientacja: orientation?.name ?? p.orientacjaId,
    wymiary: { szerokosc: p.width, wysieg: p.depth, wysokosc: p.height },
    kolorKonstrukcji: structureColor?.name ?? p.structureColor,
    kolorDachu: roofColor?.name ?? p.roofColor,
    oswietlenie: Object.fromEntries(
      CRM_LIGHTING_OPTIONS.map(type => {
        const subId = p.lighting[type.id];
        const subName = subId ? type.subOptions.find(s => s.id === subId)?.name ?? null : null;
        return [type.id, subName];
      })
    ),
    zabudowyBoczne: {
      typ: enclosureType?.name ?? null,
      wariant: enclosureVariant?.name ?? null,
    },
    dodatki: CRM_ADDONS.filter(a => p.addons.includes(a.id)).map(a => a.name),
  };
}

function buildZadaszeniaConfiguration(z: ZadaszeniaConfig): unknown {
  const rodzaj = CRM_ZADASZENIA_TYPES.find(r => r.id === z.rodzajId);
  const dach = CRM_ZADASZENIA_ROOF_TYPES.find(d => d.id === z.dachId);
  const structureColor = CRM_COLORS.find(c => c.id === z.structureColor);
  const enclosureType = CRM_SIDE_ENCLOSURES.find(e => e.id === z.enclosureTypeId);
  const enclosureVariant = enclosureType?.variants.find(v => v.id === z.enclosureVariantId);
  return {
    type: "zadaszenia",
    rodzajZadaszenia: rodzaj?.name ?? z.rodzajId,
    wymiary: { szerokosc: z.width, wysieg: z.depth, wysokoscWyzsza: z.height1, wysokoscNizsza: z.height2 },
    dach: dach?.name ?? z.dachId,
    kolorKonstrukcji: structureColor?.name ?? z.structureColor,
    oswietlenie: Object.fromEntries(
      CRM_ZADASZENIA_LIGHTING.map(type => {
        const subId = z.lighting[type.id];
        const subName = subId ? type.subOptions.find(s => s.id === subId)?.name ?? null : null;
        return [type.id, subName];
      })
    ),
    zabudowyBoczne: {
      typ: enclosureType?.name ?? null,
      wariant: enclosureVariant?.name ?? null,
    },
    dodatki: CRM_ZADASZENIA_ADDONS.filter(a => z.addons.includes(a.id)).map(a => a.name),
  };
}

// ─── Komponent główny ────────────────────────────────────────────────────────

export default function NowaWycenaPage() {
  const router = useRouter();
  const convex = useConvex();
  const createQuote = useMutation(api.quotes.create);
  const createUploadSession = useAction(api.sharepoint.createUploadSession);
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

  const frequentClients = useMemo(() => allClients.slice(0, 6), [allClients]);

  type AssignableUser = { _id: Id<"users">; name: string | null; email: string | null };
  const assignableUsers =
    (useQuery(api.users.listAssignable, {}) as AssignableUser[] | undefined) ?? [];

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

  const fetchNipData = useAction(api.clients.fetchNipData);

  async function handleFetchNip() {
    const cleanNip = nip.replace(/\D/g, "");
    if (cleanNip.length !== 10) {
      setNipError("NIP musi mieć 10 cyfr");
      return;
    }
    setNipLoading(true);
    setNipError(null);
    try {
      const data = await fetchNipData({ nip: cleanNip });
      setName(data.name || "");
      setStreet(data.street || "");
      setPostalCity(data.postalCity || "");
    } catch (err: any) {
      setNipError(err.message || "Błąd pobierania");
    } finally {
      setNipLoading(false);
    }
  }

  // ─── Typ projektu ────────────────────────────────────────────────────────────
  const [projectType, setProjectType] = useState<string | null>(null);

  // ─── Konfiguracja ────────────────────────────────────────────────────────────
  const [pergola, setPergola] = useState<PergolaConfig>(DEFAULT_PERGOLA);
  const [zadaszenia, setZadaszenia] = useState<ZadaszeniaConfig>(DEFAULT_ZADASZENIA);
  const [stolarkaOpis, setStolarkaOpis] = useState("");

  // ─── Wycena ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<QuoteStatus>("Do zrobienia");
  const [valueText, setValueText] = useState("");
  const [deadline, setDeadline] = useState(isoFromOffsetDays(7));
  const [ownerId, setOwnerId] = useState<Id<"users"> | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  // ─── Lokalizacja inwestycji ──────────────────────────────────────────────────
  const [investmentAddress, setInvestmentAddress] = useState("");
  const [investmentPlaceId, setInvestmentPlaceId] = useState<string | undefined>(undefined);
  const [investmentLat, setInvestmentLat] = useState<number | undefined>(undefined);
  const [investmentLng, setInvestmentLng] = useState<number | undefined>(undefined);
  const [investmentNotes, setInvestmentNotes] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const [customLabel, setCustomLabel] = useState("");

  const [touched, setTouched] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "creating" }
    | { kind: "waitingFolder" }
    | { kind: "uploading"; done: number; total: number }
  >({ kind: "idle" });

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
    setClientType(c.type ?? "individual");
    setNip(c.nip ?? "");
    setContactPerson(c.contactPerson ?? "");
    setNipError(null);
    setCustomLabel("");
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
    setCustomLabel("");
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
    setInvestmentAddress("");
    setInvestmentPlaceId(undefined);
    setInvestmentLat(undefined);
    setInvestmentLng(undefined);
    setInvestmentNotes("");
    setCustomLabel("");
  }

  const parsedValue = useMemo(() => {
    const t = valueText.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [valueText]);

  const configKey = projectType ? getConfigKey(projectType) : null;

  const nameValid = name.trim().length > 0;
  const ownerValid = ownerId !== null;
  const deadlineValid = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const valueValid = parsedValue === null || Number.isFinite(parsedValue);
  const projectTypeValid = projectType !== null;
  const nipValid = clientType === "individual" || nip.replace(/\D/g, "").length === 10;
  const canSubmit = nameValid && ownerValid && deadlineValid && valueValid && projectTypeValid && nipValid;

  function handleCancel() {
    router.push("/admin/wyceny");
  }

  async function waitForSharepointFolder(quoteId: Id<"quotes">) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const q = await convex.query(api.quotes.get, { id: quoteId });
      if (q?.sharepoint?.status === "created") return true;
      if (q?.sharepoint?.status === "failed") return false;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  async function uploadOne(quoteId: Id<"quotes">, file: File) {
    const { uploadUrl } = await createUploadSession({ quoteId, fileName: file.name });
    const headers: Record<string, string> = { "Content-Length": String(file.size) };
    if (file.size > 0) {
      headers["Content-Range"] = `bytes 0-${file.size - 1}/${file.size}`;
    }
    const res = await fetch(uploadUrl, { method: "PUT", headers, body: file });
    if (!res.ok && res.status !== 201) throw new Error(`Upload ${res.status}`);
  }

  function buildConfiguration(): unknown | undefined {
    if (!projectType) return undefined;
    const key = getConfigKey(projectType);
    if (key === "pergola") return buildPergolaConfiguration(pergola);
    if (key === "zadaszenia") return buildZadaszeniaConfiguration(zadaszenia);
    if (key === "stolarka" && stolarkaOpis.trim()) {
      return { type: "stolarka", opis: stolarkaOpis.trim() };
    }
    return undefined;
  }

  async function submitForm() {
    setTouched(true);
    if (!canSubmit) return;
    if (submitStatus.kind !== "idle") return;

    const contact: ContactInfo = {
      name: name.trim(),
      street: trimOrUndefined(street),
      postalCity: trimOrUndefined(postalCity),
      phone: trimOrUndefined(phone),
      email: trimOrUndefined(email),
      clientType,
      nip: clientType === "business" ? nip.trim() : undefined,
      contactPerson: clientType === "business" ? contactPerson.trim() : undefined,
    };

    try {
      setSubmitStatus({ kind: "creating" });
      const result = await createQuote({
        contact,
        projectType: projectType ? [projectType] : [],
        status,
        value: parsedValue === null ? null : (parsedValue as number),
        deadline,
        ownerId,
        configuration: buildConfiguration(),
        customLabel: customLabel.trim() || undefined,
        investment: investmentAddress.trim()
          ? {
              address: investmentAddress.trim(),
              placeId: investmentPlaceId,
              lat: investmentLat,
              lng: investmentLng,
              notes: investmentNotes.trim() || undefined,
            }
          : undefined,
      });

      if (pendingFiles.length > 0) {
        setSubmitStatus({ kind: "waitingFolder" });
        const ready = await waitForSharepointFolder(result._id);
        if (ready) {
          setSubmitStatus({ kind: "uploading", done: 0, total: pendingFiles.length });
          for (let i = 0; i < pendingFiles.length; i++) {
            try { await uploadOne(result._id, pendingFiles[i]); } catch (e) { console.error("[upload]", e); }
            setSubmitStatus({ kind: "uploading", done: i + 1, total: pendingFiles.length });
          }
        }
      }

      router.push(`/admin/wyceny/${encodeURIComponent(result.code)}`);
    } catch (err) {
      console.error("Błąd zapisu wyceny:", err);
      setSubmitStatus({ kind: "idle" });
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Nawigacja">
          <RibbonBtn icon={<I.arrowLeft s={22} />} label="Wróć do listy" onClick={handleCancel} />
        </RibbonGroup>
        <RibbonGroup label="Akcje">
          <RibbonBtn
            icon={<I.save s={22} sw={2.2} />}
            label={
              submitStatus.kind === "creating" ? "Zapisywanie…"
              : submitStatus.kind === "waitingFolder" ? "Przygotowuję folder…"
              : submitStatus.kind === "uploading" ? `Wysyłam ${submitStatus.done}/${submitStatus.total}`
              : "Zapisz"
            }
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
              <I.plus s={20} sw={2.2} />
            </div>
            <div>
              <h1 className="quote-new-v2-title">Nowa wycena</h1>
              <p className="quote-new-v2-subtitle">
                Wybierz klienta, typ projektu i wypełnij konfigurację — wszystkie dane trafią do CRM.
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
                ) : matchedClient ? (
                  <span className="quote-new-v2-tag"><I.search s={10} /> rozpoznano</span>
                ) : null
              }
              action={
                selectedClient || showNewClientForm || matchedClient ? (
                  <button type="button" className="quote-new-v2-linkbtn" onClick={() => { setShowNewClientForm(false); clearClient(); setForceNewClient(false); }}>
                    {selectedClient || showNewClientForm ? "Wybierz innego" : "Wymuś nowego"}
                  </button>
                ) : null
              }
            >
              {matchedClient && !selectedClient && !showNewClientForm && !forceNewClient ? (
                <div className="quote-new-v2-matched-banner">
                  <div className="quote-new-v2-matched-icon"><I.check s={16} sw={2.4} /></div>
                  <div className="quote-new-v2-matched-body">
                    <div className="quote-new-v2-matched-title">Rozpoznano klienta: <strong>{matchedClient.name}</strong></div>
                    <div className="quote-new-v2-matched-text">Wycena zostanie dołączona do tego klienta</div>
                  </div>
                </div>
              ) : selectedClient ? (
                <SelectedClientCard client={selectedClient} />
              ) : showNewClientForm ? (
                <NewClientForm
                  name={name} street={street} postalCity={postalCity} phone={phone} email={email}
                  nameError={touched && !nameValid}
                  clientType={clientType} onClientType={setClientType}
                  nip={nip} onNip={setNip}
                  contactPerson={contactPerson} onContactPerson={setContactPerson}
                  nipError={nipError} nipLoading={nipLoading} onFetchNip={handleFetchNip}
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
              {((selectedClient && selectedClient.type === "business") || (showNewClientForm && clientType === "business")) && (
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px dashed var(--border-subtle)" }}>
                  <label className="fluent-field fluent-field-full">
                    <span className="fluent-field-label" style={{ fontWeight: 600 }}>Tekst własny (wyróżnik B2B, np. inwestycja)</span>
                    <input
                      className="fluent-input"
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="np. Inwestycja przy ul. Polnej / Budynek B"
                      style={{ borderLeft: "3px solid var(--accent-primary)" }}
                    />
                    <span className="fluent-field-hint">Ten tekst będzie widoczny na tablicy Kanban oraz w szczegółach obok ID wyceny.</span>
                  </label>
                </div>
              )}
            </FormBox>

            {/* ─── Typ projektu ───────────────────────────────────────────── */}
            <FormBox
              title="Typ projektu"
              icon={<I.layers s={14} />}
              required
              span={8}
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
                      {getConfigKey(t.name) && (
                        <span className="cfg-type-badge">konfigurator</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {touched && !projectTypeValid && (
                <span className="fluent-field-error">Wybierz typ projektu.</span>
              )}
            </FormBox>

            {/* ─── Opiekun ────────────────────────────────────────────────── */}
            <FormBox title="Opiekun" icon={<I.user s={14} />} required span={4}>
              {assignableUsers.length > 0 ? (
                <div className="quote-new-v2-owner-chips">
                  {assignableUsers.map((u) => {
                    const label = u.name?.trim() || u.email?.trim() || "—";
                    const active = ownerId === u._id;
                    return (
                      <button
                        key={u._id as unknown as string}
                        type="button"
                        className={`quote-new-v2-owner-chip${active ? " is-active" : ""}`}
                        onClick={() => setOwnerId(u._id)}
                      >
                        <span className="kanban-card-owner-avatar">{ownerInitials(label)}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="fluent-field-hint">Brak użytkowników z rolą admin lub sales.</span>
              )}
              {touched && !ownerValid && (
                <span className="fluent-field-error">Wybierz opiekuna.</span>
              )}
            </FormBox>

            {/* ─── KONFIGURACJA PERGOLA ────────────────────────────────────── */}
            {configKey === "pergola" && <>
              <FormBox title="Rodzaj pergoli" icon={<I.wrench s={14} />} span={6}>
                <CfgSubsection label="Rodzaj mocowania">
                  <CfgChips
                    options={CRM_ROOF_TYPES}
                    value={pergola.rodzajId}
                    onChange={(v) => setPergola(p => ({ ...p, rodzajId: v }))}
                  />
                </CfgSubsection>
                <CfgSubsection label="Orientacja">
                  <CfgChips
                    options={CRM_ORIENTATIONS}
                    value={pergola.orientacjaId}
                    onChange={(v) => setPergola(p => ({ ...p, orientacjaId: v }))}
                  />
                </CfgSubsection>
              </FormBox>

              <FormBox title="Wymiary" icon={<I.ruler s={14} />} span={6} tag={<span className="quote-new-v2-hint">cm</span>}>
                <CfgDimensions
                  fields={[
                    { label: "Szerokość", value: pergola.width, onChange: (v) => setPergola(p => ({ ...p, width: v })) },
                    { label: "Głębokość", value: pergola.depth, onChange: (v) => setPergola(p => ({ ...p, depth: v })) },
                    { label: "Wysokość", value: pergola.height, onChange: (v) => setPergola(p => ({ ...p, height: v })) },
                  ]}
                />
              </FormBox>

              <FormBox title="Kolor konstrukcji" icon={<I.box s={14} />} span={6}>
                <CfgColorPicker
                  colors={CRM_COLORS}
                  value={pergola.structureColor}
                  onChange={(v) => setPergola(p => ({ ...p, structureColor: v }))}
                />
              </FormBox>

              <FormBox title="Kolor dachu" icon={<I.box s={14} />} span={6}>
                <CfgColorPicker
                  colors={CRM_COLORS}
                  value={pergola.roofColor}
                  onChange={(v) => setPergola(p => ({ ...p, roofColor: v }))}
                />
              </FormBox>

              <FormBox title="Oświetlenie" icon={<I.layers s={14} />} span={12} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgLighting
                  options={CRM_LIGHTING_OPTIONS}
                  value={pergola.lighting}
                  onChange={(v) => setPergola(p => ({ ...p, lighting: v }))}
                />
              </FormBox>

              <FormBox title="Zabudowy boczne" icon={<I.glass s={14} />} span={6} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgEnclosures
                  enclosures={CRM_SIDE_ENCLOSURES}
                  typeId={pergola.enclosureTypeId}
                  variantId={pergola.enclosureVariantId}
                  onType={(v) => setPergola(p => ({ ...p, enclosureTypeId: v, enclosureVariantId: null }))}
                  onVariant={(v) => setPergola(p => ({ ...p, enclosureVariantId: v }))}
                />
              </FormBox>

              <FormBox title="Dodatki" icon={<I.pkg s={14} />} span={6} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgAddons
                  addons={CRM_ADDONS}
                  selected={pergola.addons}
                  onChange={(v) => setPergola(p => ({ ...p, addons: v }))}
                />
              </FormBox>
            </>}

            {/* ─── KONFIGURACJA ZADASZENIA ─────────────────────────────────── */}
            {configKey === "zadaszenia" && <>
              <FormBox title="Rodzaj zadaszenia" icon={<I.wrench s={14} />} span={6}>
                <CfgSubsection label="Rodzaj">
                  <CfgChips
                    options={CRM_ZADASZENIA_TYPES}
                    value={zadaszenia.rodzajId}
                    onChange={(v) => setZadaszenia(z => ({ ...z, rodzajId: v }))}
                  />
                </CfgSubsection>
                <CfgSubsection label="Rodzaj dachu">
                  <CfgChips
                    options={CRM_ZADASZENIA_ROOF_TYPES}
                    value={zadaszenia.dachId}
                    onChange={(v) => setZadaszenia(z => ({ ...z, dachId: v }))}
                  />
                </CfgSubsection>
              </FormBox>

              <FormBox title="Wymiary" icon={<I.ruler s={14} />} span={6} tag={<span className="quote-new-v2-hint">cm</span>}>
                <CfgDimensions
                  fields={[
                    { label: "Szerokość", value: zadaszenia.width, onChange: (v) => setZadaszenia(z => ({ ...z, width: v })) },
                    { label: "Głębokość", value: zadaszenia.depth, onChange: (v) => setZadaszenia(z => ({ ...z, depth: v })) },
                    { label: "Wys. wyższa", value: zadaszenia.height1, onChange: (v) => setZadaszenia(z => ({ ...z, height1: v })) },
                    { label: "Wys. niższa", value: zadaszenia.height2, onChange: (v) => setZadaszenia(z => ({ ...z, height2: v })) },
                  ]}
                />
              </FormBox>

              <FormBox title="Kolor konstrukcji" icon={<I.box s={14} />} span={12}>
                <CfgColorPicker
                  colors={CRM_COLORS}
                  value={zadaszenia.structureColor}
                  onChange={(v) => setZadaszenia(z => ({ ...z, structureColor: v }))}
                />
              </FormBox>

              <FormBox title="Oświetlenie" icon={<I.layers s={14} />} span={12} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgLighting
                  options={CRM_ZADASZENIA_LIGHTING}
                  value={zadaszenia.lighting}
                  onChange={(v) => setZadaszenia(z => ({ ...z, lighting: v }))}
                />
              </FormBox>

              <FormBox title="Zabudowy boczne" icon={<I.glass s={14} />} span={6} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgEnclosures
                  enclosures={CRM_SIDE_ENCLOSURES}
                  typeId={zadaszenia.enclosureTypeId}
                  variantId={zadaszenia.enclosureVariantId}
                  onType={(v) => setZadaszenia(z => ({ ...z, enclosureTypeId: v, enclosureVariantId: null }))}
                  onVariant={(v) => setZadaszenia(z => ({ ...z, enclosureVariantId: v }))}
                />
              </FormBox>

              <FormBox title="Dodatki" icon={<I.pkg s={14} />} span={6} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <CfgAddons
                  addons={CRM_ZADASZENIA_ADDONS}
                  selected={zadaszenia.addons}
                  onChange={(v) => setZadaszenia(z => ({ ...z, addons: v }))}
                />
              </FormBox>
            </>}

            {/* ─── KONFIGURACJA STOLARKA ───────────────────────────────────── */}
            {configKey === "stolarka" && (
              <FormBox title="Opis zapytania" icon={<I.doc s={14} />} span={12} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
                <textarea
                  className="cfg-textarea"
                  value={stolarkaOpis}
                  onChange={(e) => setStolarkaOpis(e.target.value)}
                  placeholder="Opisz rodzaj stolarki, wymiary, liczbę sztuk, ewentualne wymagania…"
                  rows={4}
                />
              </FormBox>
            )}

            {/* ─── Status ─────────────────────────────────────────────────── */}
            <FormBox title="Status początkowy" icon={<I.flag s={14} />} span={12}>
              <div className="quote-new-v2-status-row">
                {QUOTE_STATUSES.map((s, idx) => {
                  const color = QUOTE_STATUS_COLORS[s];
                  const active = status === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      className={`quote-new-v2-status-step${active ? " is-active" : ""}`}
                      style={active ? { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
                      onClick={() => setStatus(s)}
                    >
                      <span className="quote-new-v2-status-dot" style={{ background: color }} />
                      <span className="quote-new-v2-status-label">{s}</span>
                      <span className="quote-new-v2-status-idx">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </FormBox>

            {/* ─── Termin oferty ──────────────────────────────────────────── */}
            <FormBox
              title="Termin oferty"
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

            {/* ─── Wartość netto ──────────────────────────────────────────── */}
            <FormBox title="Wartość netto" icon={<I.pln s={14} />} span={6} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
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
                <span className="fluent-field-error">Podaj liczbę nieujemną.</span>
              )}
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

            {/* ─── Pliki ──────────────────────────────────────────────────── */}
            <FormBox title="Pliki projektowe i zdjęcia" icon={<I.paperclip s={14} />} span={12} tag={<span className="quote-new-v2-hint">opcjonalnie</span>}>
              <FilePicker files={pendingFiles} onChange={setPendingFiles} disabled={submitStatus.kind !== "idle"} />
              {submitStatus.kind === "waitingFolder" && (
                <span className="fluent-field-hint">Tworzymy folder na SharePoint, zaraz wgramy pliki…</span>
              )}
              {submitStatus.kind === "uploading" && (
                <span className="fluent-field-hint">Wysyłanie plików: {submitStatus.done} / {submitStatus.total}</span>
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
          autoFocus
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

// ─── Komponenty konfiguracji ──────────────────────────────────────────────────

function CfgSubsection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cfg-subsection">
      <div className="cfg-subsection-label">{label}</div>
      <div className="cfg-subsection-body">{children}</div>
    </div>
  );
}

function CfgChips({
  options, value, onChange,
}: {
  options: { id: string; name: string; desc?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cfg-chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`cfg-chip${value === o.id ? " is-active" : ""}`}
          onClick={() => onChange(o.id)}
          title={o.desc}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

function CfgDimensions({
  fields,
}: {
  fields: { label: string; value: number; onChange: (v: number) => void }[];
}) {
  return (
    <div className="cfg-dims">
      {fields.map((f) => (
        <label key={f.label} className="cfg-dim">
          <span className="cfg-dim-label">{f.label}</span>
          <div className="cfg-dim-row">
            <input
              className="fluent-input cfg-dim-input"
              type="number"
              min={1}
              step={1}
              value={f.value}
              onChange={(e) => f.onChange(Math.max(1, Number(e.target.value) || 1))}
            />
            <span className="cfg-dim-unit">cm</span>
          </div>
        </label>
      ))}
    </div>
  );
}

function CfgColorPicker({
  colors, value, onChange,
}: {
  colors: { id: string; name: string; group: string; swatch: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const groups = [
    { key: "standard", label: "Standardowe RAL" },
    { key: "nonstandard", label: "Niestandardowe" },
    { key: "decor", label: "Dekory" },
  ];
  return (
    <div className="cfg-colors">
      {groups.map((g) => {
        const cols = colors.filter((c) => c.group === g.key);
        if (!cols.length) return null;
        return (
          <div key={g.key} className="cfg-color-group">
            <div className="cfg-color-group-label">{g.label}</div>
            <div className="cfg-swatches">
              {cols.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cfg-swatch${value === c.id ? " is-active" : ""}`}
                  title={c.name}
                  onClick={() => onChange(c.id)}
                >
                  <span className="cfg-swatch-circle" style={{ background: c.swatch }} />
                  <span className="cfg-swatch-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CfgLighting({
  options, value, onChange,
}: {
  options: { id: string; name: string; subOptions: { id: string; name: string }[] }[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  function toggleType(typeId: string) {
    if (value[typeId]) {
      const next = { ...value };
      delete next[typeId];
      onChange(next);
    } else {
      onChange({ ...value, [typeId]: options.find(o => o.id === typeId)!.subOptions[0].id });
    }
  }

  function setSubOption(typeId: string, subId: string) {
    onChange({ ...value, [typeId]: subId });
  }

  return (
    <div className="cfg-lighting">
      {options.map((opt) => {
        const active = !!value[opt.id];
        return (
          <div key={opt.id} className={`cfg-lighting-item${active ? " is-active" : ""}`}>
            <button
              type="button"
              className={`cfg-lighting-toggle${active ? " is-active" : ""}`}
              onClick={() => toggleType(opt.id)}
            >
              <span className="cfg-lighting-check">
                {active ? <I.check s={12} sw={2.6} /> : <I.plus s={12} sw={2.2} />}
              </span>
              <span>{opt.name}</span>
            </button>
            {active && (
              <div className="cfg-lighting-subopts">
                {opt.subOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`cfg-lighting-subopt${value[opt.id] === s.id ? " is-active" : ""}`}
                    onClick={() => setSubOption(opt.id, s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CfgEnclosures({
  enclosures, typeId, variantId, onType, onVariant,
}: {
  enclosures: { id: string; name: string; variants: { id: string; name: string }[] }[];
  typeId: string | null;
  variantId: string | null;
  onType: (v: string | null) => void;
  onVariant: (v: string | null) => void;
}) {
  const selected = enclosures.find((e) => e.id === typeId);
  return (
    <div className="cfg-enclosures">
      <div className="cfg-chips">
        {enclosures.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`cfg-chip${typeId === e.id ? " is-active" : ""}`}
            onClick={() => onType(typeId === e.id ? null : e.id)}
          >
            {e.name}
          </button>
        ))}
      </div>
      {selected && (
        <div className="cfg-enclosure-variants">
          <div className="cfg-subsection-label">Wariant</div>
          <div className="cfg-chips">
            {selected.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`cfg-chip${variantId === v.id ? " is-active" : ""}`}
                onClick={() => onVariant(variantId === v.id ? null : v.id)}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CfgAddons({
  addons, selected, onChange,
}: {
  addons: { id: string; name: string; desc: string; price: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }
  return (
    <div className="cfg-addons">
      {addons.map((a) => {
        const active = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            className={`cfg-addon${active ? " is-active" : ""}`}
            onClick={() => toggle(a.id)}
          >
            <span className="cfg-addon-check">
              {active ? <I.check s={12} sw={2.6} /> : null}
            </span>
            <span className="cfg-addon-body">
              <span className="cfg-addon-name">{a.name}</span>
              <span className="cfg-addon-desc">{a.desc}</span>
            </span>
          </button>
        );
      })}
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

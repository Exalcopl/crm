"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { I } from "../../_lib/icons";
import {
  QUOTE_STATUSES,
  type ContactInfo,
  type ProjectType,
  type Quote,
  type QuoteStatus,
} from "../../_lib/quotes";
import { setQuotes, useQuotes } from "../../_lib/quotes-store";
import { useClients } from "../../_lib/clients-store";
import { RibbonBtn, RibbonGroup } from "../../_components/ribbon";

const PROJECT_TYPES: ProjectType[] = [
  "Zadaszenia",
  "Pergola",
  "Stolarka",
  "Ogrodzenie",
  "Osłony okienne",
  "Inne",
];

function nextQuoteId(quotes: Quote[]): string {
  const year = new Date().getFullYear();
  const prefix = `WC-${year}-`;
  const used = quotes
    .map((q) => {
      const m = /^WC-\d{4}-(\d+)$/.exec(q.id);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = (used.length > 0 ? Math.max(...used) : 700) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export default function NowaWycenaPage() {
  const router = useRouter();
  const quotes = useQuotes();
  const clients = useClients();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCity, setPostalCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("Zadaszenia");
  const [status, setStatus] = useState<QuoteStatus>("Do zrobienia");
  const [valueText, setValueText] = useState("");
  const [deadline, setDeadline] = useState(todayIso());
  const [owner, setOwner] = useState("");
  const [touched, setTouched] = useState(false);

  function applyClient(id: string) {
    setSelectedClientId(id);
    if (!id) return;
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setName(c.name);
    setStreet(c.street ?? "");
    setPostalCity(c.postalCity ?? "");
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
  }

  function clearSelectionOnEdit(setter: (v: string) => void) {
    return (v: string) => {
      if (selectedClientId) setSelectedClientId("");
      setter(v);
    };
  }

  const parsedValue = useMemo(() => {
    const t = valueText.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [valueText]);

  const nameValid = name.trim().length > 0;
  const ownerValid = owner.trim().length > 0;
  const deadlineValid = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const valueValid = parsedValue === null || Number.isFinite(parsedValue);
  const canSubmit = nameValid && ownerValid && deadlineValid && valueValid;

  function handleCancel() {
    router.push("/admin");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    const contact: ContactInfo = {
      name: name.trim(),
      street: trimOrUndefined(street),
      postalCity: trimOrUndefined(postalCity),
      phone: trimOrUndefined(phone),
      email: trimOrUndefined(email),
    };
    const id = nextQuoteId(quotes);
    const created: Quote = {
      id,
      contact,
      projectType,
      status,
      value: parsedValue === null ? null : (parsedValue as number),
      deadline,
      owner: owner.trim(),
    };
    setQuotes((prev) => [created, ...prev]);
    router.push(`/admin/wyceny/${id}`);
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
      </div>

      <main className="fluent-content">
        <form className="quote-new" onSubmit={handleSubmit}>
          <header className="quote-new-header">
            <div className="quote-new-header-icon">
              <I.plus s={18} sw={2.2} />
            </div>
            <div>
              <h1 className="quote-new-title">Nowa wycena</h1>
              <p className="quote-new-subtitle">
                Wypełnij dane kontaktowe i parametry wyceny. Możesz też wybrać
                istniejącego klienta z listy.
              </p>
            </div>
          </header>

          <section className="quote-new-section">
            <div className="quote-new-section-head">
              <I.user s={14} />
              <span>Dane kontaktowe</span>
            </div>
            <div className="fluent-form-grid">
              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">Istniejący klient</span>
                <select
                  className="fluent-input"
                  value={selectedClientId}
                  onChange={(e) => applyClient(e.target.value)}
                  disabled={clients.length === 0}
                >
                  <option value="">
                    {clients.length === 0
                      ? "— brak zapisanych klientów —"
                      : "— wpisz nowe dane lub wybierz klienta —"}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">
                  Nazwa / firma <span className="fluent-field-required">*</span>
                </span>
                <input
                  className="fluent-input"
                  type="text"
                  value={name}
                  onChange={(e) => clearSelectionOnEdit(setName)(e.target.value)}
                  placeholder="np. ProBud Inwestycje"
                  autoFocus
                />
                {touched && !nameValid && (
                  <span className="fluent-field-error">Podaj nazwę lub firmę.</span>
                )}
              </label>

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">Ulica</span>
                <input
                  className="fluent-input"
                  type="text"
                  value={street}
                  onChange={(e) =>
                    clearSelectionOnEdit(setStreet)(e.target.value)
                  }
                  placeholder="np. ul. Kwiatowa 12"
                />
              </label>

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">Kod, miasto</span>
                <input
                  className="fluent-input"
                  type="text"
                  value={postalCity}
                  onChange={(e) =>
                    clearSelectionOnEdit(setPostalCity)(e.target.value)
                  }
                  placeholder="np. 00-001 Warszawa"
                />
              </label>

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">Telefon</span>
                <input
                  className="fluent-input"
                  type="tel"
                  value={phone}
                  onChange={(e) =>
                    clearSelectionOnEdit(setPhone)(e.target.value)
                  }
                  placeholder="np. +48 600 000 000"
                />
              </label>

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">E-mail</span>
                <input
                  className="fluent-input"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    clearSelectionOnEdit(setEmail)(e.target.value)
                  }
                  placeholder="np. kontakt@firma.pl"
                />
              </label>
            </div>
          </section>

          <section className="quote-new-section">
            <div className="quote-new-section-head">
              <I.layers s={14} />
              <span>Wycena</span>
            </div>
            <div className="fluent-form-grid">
              <label className="fluent-field">
                <span className="fluent-field-label">Typ projektu</span>
                <select
                  className="fluent-input"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fluent-field">
                <span className="fluent-field-label">Status</span>
                <select
                  className="fluent-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                >
                  {QUOTE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fluent-field">
                <span className="fluent-field-label">Wartość brutto (PLN)</span>
                <input
                  className="fluent-input"
                  type="text"
                  inputMode="decimal"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  placeholder="opcjonalnie"
                />
                {touched && !valueValid && (
                  <span className="fluent-field-error">
                    Podaj liczbę nieujemną.
                  </span>
                )}
              </label>

              <label className="fluent-field">
                <span className="fluent-field-label">
                  Termin oferty <span className="fluent-field-required">*</span>
                </span>
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

              <label className="fluent-field fluent-field-full">
                <span className="fluent-field-label">
                  Właściciel <span className="fluent-field-required">*</span>
                </span>
                <input
                  className="fluent-input"
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="np. Adam Borowski"
                />
                {touched && !ownerValid && (
                  <span className="fluent-field-error">Podaj właściciela.</span>
                )}
              </label>
            </div>
          </section>

          <footer className="quote-new-foot">
            <button
              type="button"
              className="fluent-btn fluent-btn-ghost"
              onClick={handleCancel}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="fluent-btn fluent-btn-primary"
              disabled={touched && !canSubmit}
            >
              <I.plus s={14} sw={2.2} />
              <span>Utwórz wycenę</span>
            </button>
          </footer>
        </form>
      </main>
    </>
  );
}

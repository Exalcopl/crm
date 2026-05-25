"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { I } from "../_lib/icons";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";

const LEGACY_STORAGE_KEY = "exalco.clients.v1";

type ClientDraft = {
  name: string;
  street: string;
  postalCity: string;
  phone: string;
  email: string;
};

const EMPTY_DRAFT: ClientDraft = {
  name: "",
  street: "",
  postalCity: "",
  phone: "",
  email: "",
};

function toDraft(c: Doc<"clients">): ClientDraft {
  return {
    name: c.name,
    street: c.street ?? "",
    postalCity: c.postalCity ?? "",
    phone: c.phoneRaw ?? "",
    email: c.email ?? "",
  };
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

type LegacyClient = {
  name?: string;
  street?: string;
  postalCity?: string;
  phone?: string;
  email?: string;
};

function readLegacy(): LegacyClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LegacyClient[];
  } catch {
    return [];
  }
}

export default function KlienciPage() {
  const clients = useQuery(api.clients.list) as
    | Doc<"clients">[]
    | undefined;
  const update = useMutation(api.clients.update);
  const migrate = useMutation(api.clients.migrateFromLocal);

  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; id: Id<"clients"> }
    | null
  >(null);
  const migratedRef = useRef(false);

  useEffect(() => {
    if (migratedRef.current) return;
    if (clients === undefined) return;
    const legacy = readLegacy();
    if (legacy.length === 0) {
      migratedRef.current = true;
      return;
    }
    migratedRef.current = true;
    const items = legacy
      .filter((c) => typeof c.name === "string" && c.name.trim().length > 0)
      .map((c) => ({
        name: c.name!.trim(),
        street: trimOrUndefined(c.street ?? ""),
        postalCity: trimOrUndefined(c.postalCity ?? ""),
        phone: trimOrUndefined(c.phone ?? ""),
        email: trimOrUndefined(c.email ?? ""),
      }));
    if (items.length === 0) return;
    void migrate({ items })
      .then(() => {
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {}
      })
      .catch(() => {
        // jeśli się nie udało, zostaw localStorage do następnej próby
        migratedRef.current = false;
      });
  }, [clients, migrate]);

  async function handleCreate(draft: ClientDraft) {
    await migrate({
      items: [
        {
          name: draft.name.trim(),
          street: trimOrUndefined(draft.street),
          postalCity: trimOrUndefined(draft.postalCity),
          phone: trimOrUndefined(draft.phone),
          email: trimOrUndefined(draft.email),
        },
      ],
    });
    setDialog(null);
  }

  async function handleUpdate(id: Id<"clients">, draft: ClientDraft) {
    await update({
      id,
      name: draft.name.trim(),
      street: draft.street.trim() ? draft.street.trim() : null,
      postalCity: draft.postalCity.trim() ? draft.postalCity.trim() : null,
      phone: draft.phone.trim() ? draft.phone.trim() : null,
      email: draft.email.trim() ? draft.email.trim() : null,
    });
    setDialog(null);
  }

  const editing =
    dialog?.mode === "edit"
      ? clients?.find((c) => c._id === dialog.id) ?? null
      : null;

  const loading = clients === undefined;
  const empty = clients !== undefined && clients.length === 0;

  return (
    <>
      <div className="fluent-ribbon">
        <RibbonGroup label="Główna">
          <RibbonBtn
            icon={<I.plus s={22} />}
            label="Nowy klient"
            primary
            onClick={() => setDialog({ mode: "create" })}
          />
        </RibbonGroup>
      </div>
      <main className="fluent-content">
        {loading ? (
          <div className="client-empty" aria-busy="true">
            <div className="client-empty-text">Wczytywanie…</div>
          </div>
        ) : empty ? (
          <div className="client-empty">
            <I.users s={28} />
            <div className="client-empty-title">Brak zapisanych klientów</div>
            <div className="client-empty-text">
              Dodaj klientów, aby móc szybko wybierać ich podczas tworzenia
              wyceny.
            </div>
            <button
              type="button"
              className="fluent-btn fluent-btn-primary"
              onClick={() => setDialog({ mode: "create" })}
            >
              <I.plus s={14} sw={2.2} />
              <span>Dodaj pierwszego klienta</span>
            </button>
          </div>
        ) : (
          <div className="client-list" role="table" aria-label="Lista klientów">
            <div className="client-list-header" role="row">
              <div role="columnheader">Nazwa / firma</div>
              <div role="columnheader">Ulica</div>
              <div role="columnheader">Kod, miasto</div>
              <div role="columnheader">Telefon</div>
              <div role="columnheader">E-mail</div>
              <div role="columnheader" className="align-right">
                Akcje
              </div>
            </div>
            <div className="client-list-body">
              {clients!.map((c) => (
                <ClientRow
                  key={c._id}
                  client={c}
                  onEdit={() => setDialog({ mode: "edit", id: c._id })}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      {dialog && (
        <ClientDialog
          initial={editing ? toDraft(editing) : EMPTY_DRAFT}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onSubmit={(draft) =>
            dialog.mode === "create"
              ? void handleCreate(draft)
              : void handleUpdate(dialog.id, draft)
          }
        />
      )}
    </>
  );
}

function ClientRow({
  client,
  onEdit,
}: {
  client: Doc<"clients">;
  onEdit: () => void;
}) {
  const router = useRouter();
  const href = `/admin/klienci/${client._id}`;
  const go = () => router.push(href);
  return (
    <div
      className="client-list-row is-clickable"
      role="row"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="client-list-cell client-list-cell-name">
        {client.name}
      </div>
      <div className="client-list-cell">
        {client.street ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.postalCity ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.phoneRaw ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.email ?? <span className="client-list-muted">—</span>}
      </div>
      <div
        className="client-list-cell client-list-actions align-right"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={href}
          className="client-list-action"
          aria-label="Otwórz szczegóły klienta"
          title="Otwórz"
        >
          <I.arrow s={14} />
        </Link>
        <button
          type="button"
          className="client-list-action"
          onClick={onEdit}
          aria-label="Edytuj klienta"
          title="Edytuj"
        >
          <I.edit s={14} />
        </button>
      </div>
    </div>
  );
}

function ClientDialog({
  initial,
  mode,
  onClose,
  onSubmit,
}: {
  initial: ClientDraft;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (draft: ClientDraft) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [street, setStreet] = useState(initial.street);
  const [postalCity, setPostalCity] = useState(initial.postalCity);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const nameValid = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!nameValid) return;
    onSubmit({ name, street, postalCity, phone, email });
  }

  return (
    <div
      className="fluent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Nowy klient" : "Edycja klienta"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="fluent-modal" onSubmit={handleSubmit}>
        <header className="fluent-modal-head">
          <div className="fluent-modal-title">
            <span className="fluent-modal-title-icon">
              {mode === "create" ? (
                <I.plus s={16} sw={2.2} />
              ) : (
                <I.edit s={16} sw={2.2} />
              )}
            </span>
            <span>{mode === "create" ? "Nowy klient" : "Edycja klienta"}</span>
          </div>
          <button
            type="button"
            className="fluent-modal-close"
            onClick={onClose}
            aria-label="Zamknij"
          >
            ×
          </button>
        </header>

        <div className="fluent-modal-body">
          <div className="fluent-form-grid">
            <label className="fluent-field fluent-field-full">
              <span className="fluent-field-label">
                Nazwa / firma <span className="fluent-field-required">*</span>
              </span>
              <input
                className="fluent-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setStreet(e.target.value)}
                placeholder="np. ul. Kwiatowa 12"
              />
            </label>

            <label className="fluent-field fluent-field-full">
              <span className="fluent-field-label">Kod, miasto</span>
              <input
                className="fluent-input"
                type="text"
                value={postalCity}
                onChange={(e) => setPostalCity(e.target.value)}
                placeholder="np. 00-001 Warszawa"
              />
            </label>

            <label className="fluent-field fluent-field-full">
              <span className="fluent-field-label">Telefon</span>
              <input
                className="fluent-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="np. +48 600 000 000"
              />
            </label>

            <label className="fluent-field fluent-field-full">
              <span className="fluent-field-label">E-mail</span>
              <input
                className="fluent-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="np. kontakt@firma.pl"
              />
            </label>
          </div>
        </div>

        <footer className="fluent-modal-foot">
          <button
            type="button"
            className="fluent-btn fluent-btn-ghost"
            onClick={onClose}
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="fluent-btn fluent-btn-primary"
            disabled={touched && !nameValid}
          >
            {mode === "create" ? (
              <>
                <I.plus s={14} sw={2.2} />
                <span>Utwórz klienta</span>
              </>
            ) : (
              <>
                <I.save s={14} sw={2.2} />
                <span>Zapisz zmiany</span>
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

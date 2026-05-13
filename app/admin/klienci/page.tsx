"use client";

import { useEffect, useState } from "react";
import { I } from "../_lib/icons";
import { nextClientId, type Client } from "../_lib/clients";
import { setClients, useClients } from "../_lib/clients-store";
import { RibbonBtn, RibbonGroup } from "../_components/ribbon";

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

function toDraft(c: Client): ClientDraft {
  return {
    name: c.name,
    street: c.street ?? "",
    postalCity: c.postalCity ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
  };
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export default function KlienciPage() {
  const clients = useClients();
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; id: string } | null
  >(null);

  function handleCreate(draft: ClientDraft) {
    const id = nextClientId(clients);
    const created: Client = {
      id,
      name: draft.name.trim(),
      street: trimOrUndefined(draft.street),
      postalCity: trimOrUndefined(draft.postalCity),
      phone: trimOrUndefined(draft.phone),
      email: trimOrUndefined(draft.email),
    };
    setClients((prev) => [created, ...prev]);
    setDialog(null);
  }

  function handleUpdate(id: string, draft: ClientDraft) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: draft.name.trim(),
              street: trimOrUndefined(draft.street),
              postalCity: trimOrUndefined(draft.postalCity),
              phone: trimOrUndefined(draft.phone),
              email: trimOrUndefined(draft.email),
            }
          : c,
      ),
    );
    setDialog(null);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Usunąć tego klienta?")) return;
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  const editing =
    dialog?.mode === "edit" ? clients.find((c) => c.id === dialog.id) : null;

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
        {clients.length === 0 ? (
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
              {clients.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  onEdit={() => setDialog({ mode: "edit", id: c.id })}
                  onDelete={() => handleDelete(c.id)}
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
              ? handleCreate(draft)
              : handleUpdate(dialog.id, draft)
          }
        />
      )}
    </>
  );
}

function ClientRow({
  client,
  onEdit,
  onDelete,
}: {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="client-list-row" role="row">
      <div className="client-list-cell client-list-cell-name">{client.name}</div>
      <div className="client-list-cell">
        {client.street ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.postalCity ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.phone ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell">
        {client.email ?? <span className="client-list-muted">—</span>}
      </div>
      <div className="client-list-cell client-list-actions align-right">
        <button
          type="button"
          className="client-list-action"
          onClick={onEdit}
          aria-label="Edytuj klienta"
          title="Edytuj"
        >
          <I.edit s={14} />
        </button>
        <button
          type="button"
          className="client-list-action is-danger"
          onClick={onDelete}
          aria-label="Usuń klienta"
          title="Usuń"
        >
          <I.trash s={14} />
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

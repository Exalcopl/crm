"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { I } from "@/app/admin/_lib/icons";
import { ownerInitials } from "@/app/admin/_lib/quotes";

type Field = "name" | "street" | "postalCity" | "phone" | "email";

const PLACEHOLDERS: Record<Field, string> = {
  name: "Nazwa / firma",
  street: "Ulica i numer",
  postalCity: "Kod, miasto",
  phone: "Telefon",
  email: "E-mail",
};

function valueOf(client: Doc<"clients">, field: Field): string {
  switch (field) {
    case "name":
      return client.name;
    case "street":
      return client.street ?? "";
    case "postalCity":
      return client.postalCity ?? "";
    case "phone":
      return client.phoneRaw ?? "";
    case "email":
      return client.email ?? "";
  }
}

export function ClientDetailHeader({ client }: { client: Doc<"clients"> }) {
  const update = useMutation(api.clients.update);
  const ensureFolder = useAction(api.sharepoint.ensureClientFolder);
  const [creatingFolder, setCreatingFolder] = useState(false);

  async function save(field: Field, raw: string) {
    const value = raw.trim();
    const current = valueOf(client, field);
    if (value === current) return;
    if (field === "name" && value.length === 0) {
      toast.error("Nazwa nie może być pusta");
      return;
    }
    try {
      await update({
        id: client._id,
        [field]: field === "name" ? value : value ? value : null,
      });
      toast.success("Zapisano");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać");
    }
  }

  async function handleOpenFolder() {
    const sp = client.sharepointFolder;
    if (sp?.status === "created" && sp.webUrl) {
      window.open(sp.webUrl, "_blank");
      return;
    }
    setCreatingFolder(true);
    try {
      const result = await ensureFolder({ clientId: client._id });
      if (result?.webUrl) {
        window.open(result.webUrl, "_blank");
        toast.success("Folder klienta jest gotowy");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Nie udało się utworzyć folderu",
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  const sp = client.sharepointFolder;
  const hasFolder = sp?.status === "created" && !!sp.webUrl;

  return (
    <header className="client-detail-header">
      <div className="client-detail-header-main">
        <div className="client-detail-avatar" aria-hidden>
          {ownerInitials(client.name)}
        </div>
        <div className="client-detail-header-body">
          <EditableField
            field="name"
            value={client.name}
            onSave={(v) => save("name", v)}
            displayClassName="client-detail-name"
            inputClassName="client-detail-name-input"
            inline
          />
          <div className="client-detail-header-meta">
            <ContactCell
              icon={<I.pin s={11} />}
              fields={[
                <EditableField
                  key="street"
                  field="street"
                  value={client.street ?? ""}
                  onSave={(v) => save("street", v)}
                  placeholder={PLACEHOLDERS.street}
                />,
                <span key="sep" className="client-detail-meta-sep">
                  ·
                </span>,
                <EditableField
                  key="postalCity"
                  field="postalCity"
                  value={client.postalCity ?? ""}
                  onSave={(v) => save("postalCity", v)}
                  placeholder={PLACEHOLDERS.postalCity}
                />,
              ]}
            />
            <ContactCell
              icon={<I.phone s={11} />}
              fields={[
                <EditableField
                  key="phone"
                  field="phone"
                  value={client.phoneRaw ?? ""}
                  onSave={(v) => save("phone", v)}
                  placeholder={PLACEHOLDERS.phone}
                />,
              ]}
            />
            <ContactCell
              icon={<I.mail s={11} />}
              fields={[
                <EditableField
                  key="email"
                  field="email"
                  value={client.email ?? ""}
                  onSave={(v) => save("email", v)}
                  placeholder={PLACEHOLDERS.email}
                />,
              ]}
            />
          </div>
        </div>
      </div>
      <div className="client-detail-header-actions">
        <button
          type="button"
          className="client-detail-sp-btn"
          onClick={() => void handleOpenFolder()}
          disabled={creatingFolder}
          title={
            hasFolder
              ? "Otwórz folder klienta na SharePoint"
              : "Utwórz folder klienta na SharePoint"
          }
        >
          {creatingFolder ? (
            <>
              <span className="spinner-small" aria-hidden />
              <span>Tworzenie folderu…</span>
            </>
          ) : hasFolder ? (
            <>
              <I.link s={14} sw={2} />
              <span>Folder na SharePoint</span>
              <I.arrow s={12} sw={2} />
            </>
          ) : (
            <>
              <I.plus s={14} sw={2} />
              <span>Utwórz folder na SharePoint</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}

function ContactCell({
  icon,
  fields,
}: {
  icon: React.ReactNode;
  fields: React.ReactNode[];
}) {
  return (
    <div className="client-detail-meta-cell">
      <span className="client-detail-meta-icon" aria-hidden>
        {icon}
      </span>
      {fields}
    </div>
  );
}

function EditableField({
  field,
  value,
  onSave,
  placeholder,
  inline,
  displayClassName,
  inputClassName,
}: {
  field: Field;
  value: string;
  onSave: (v: string) => Promise<void> | void;
  placeholder?: string;
  inline?: boolean;
  displayClassName?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    void Promise.resolve(onSave(draft)).finally(() => setEditing(false));
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
        className={inputClassName ?? "client-detail-edit-input"}
        value={draft}
        autoFocus
        placeholder={placeholder ?? PLACEHOLDERS[field]}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
    );
  }

  const display = value.trim();
  return (
    <button
      type="button"
      className={`client-detail-edit-trigger${
        inline ? " is-inline" : ""
      }${display ? "" : " is-empty"}${
        displayClassName ? ` ${displayClassName}` : ""
      }`}
      onClick={startEdit}
      title="Kliknij aby edytować"
    >
      {display || (
        <span className="client-detail-edit-placeholder">
          {placeholder ?? PLACEHOLDERS[field]}
        </span>
      )}
    </button>
  );
}

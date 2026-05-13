"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePermissions } from "../admin/_lib/permissions";

export default function AccountProfilePage() {
  const { user, isLoading } = usePermissions();
  const updateProfile = useMutation(api.account.updateProfile);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name != null) setName(user.name);
  }, [user?.name]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <main className="account-content">Ładowanie…</main>;
  if (!user) return <main className="account-content">Nie zalogowano</main>;

  return (
    <main className="account-content">
      <h1 className="account-title">Twoje konto</h1>

      <section className="account-card">
        <h2>Dane podstawowe</h2>
        <form className="account-form" onSubmit={onSubmit}>
          <label className="account-field">
            <span>Imię i nazwisko</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Imię Nazwisko"
            />
          </label>
          <label className="account-field">
            <span>E-mail</span>
            <input value={user.email ?? ""} disabled />
          </label>
          <label className="account-field">
            <span>Rola</span>
            <input value={user.role?.displayName ?? "Bez roli"} disabled />
          </label>
          {error ? <div className="account-error">{error}</div> : null}
          {savedAt ? (
            <div className="account-success">Zapisano</div>
          ) : null}
          <div className="account-actions">
            <button
              type="submit"
              className="account-btn account-btn-primary"
              disabled={saving}
            >
              {saving ? "Zapisywanie..." : "Zapisz zmiany"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

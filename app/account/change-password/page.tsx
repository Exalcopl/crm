"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePermissions } from "../../admin/_lib/permissions";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isLoading } = usePermissions();
  const changePassword = useAction(api.account.changePassword);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mustChange = user?.mustChangePassword ?? false;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    setError(null);
    if (next.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków");
      return;
    }
    if (next !== confirm) {
      setError("Nowe hasła nie są identyczne");
      return;
    }
    if (next === current) {
      setError("Nowe hasło musi być inne niż obecne");
      return;
    }
    setWorking(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      if (mustChange) {
        router.replace("/admin");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zmiany hasła");
    } finally {
      setWorking(false);
    }
  }

  if (isLoading) return <main className="account-content">Ładowanie…</main>;
  if (!user) return <main className="account-content">Nie zalogowano</main>;

  return (
    <main className="account-content">
      <h1 className="account-title">
        {mustChange ? "Ustaw nowe hasło" : "Zmiana hasła"}
      </h1>

      {mustChange ? (
        <div className="account-info">
          Twoje konto używa hasła tymczasowego. Aby kontynuować, ustaw własne
          hasło.
        </div>
      ) : null}

      <section className="account-card">
        <form className="account-form" onSubmit={onSubmit}>
          <label className="account-field">
            <span>Obecne hasło</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="account-field">
            <span>Nowe hasło</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
              Min. 8 znaków.
            </small>
          </label>
          <label className="account-field">
            <span>Powtórz nowe hasło</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error ? <div className="account-error">{error}</div> : null}
          {done && !mustChange ? (
            <div className="account-success">Hasło zmienione</div>
          ) : null}
          <div className="account-actions">
            <button
              type="submit"
              className="account-btn account-btn-primary"
              disabled={working}
            >
              {working ? "Zmiana..." : "Zmień hasło"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

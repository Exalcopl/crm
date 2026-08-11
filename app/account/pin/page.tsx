"use client";

import { FormEvent, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePermissions } from "../../admin/_lib/permissions";

export default function AccountPinPage() {
  const { user, isLoading } = usePermissions();
  const setPinAction = useAction(api.account.setPin);
  const removePinAction = useAction(api.account.removePin);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPin = Boolean(user?.pinSetAt);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    setError(null);
    setSuccess(null);

    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      setError("Kod PIN musi składać się z 4 do 6 cyfr");
      return;
    }
    if (trimmed !== confirmPin.trim()) {
      setError("Wprowadzone kody PIN nie są identyczne");
      return;
    }

    setWorking(true);
    try {
      await setPinAction({ pin: trimmed });
      setSuccess("Kod PIN został pomyślnie zapisany!");
      setPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas zapisywania kodu PIN");
    } finally {
      setWorking(false);
    }
  }

  async function onRemove() {
    if (working) return;
    if (!confirm("Czy na pewno chcesz usunąć kod PIN dla swojego konta?")) return;
    setError(null);
    setSuccess(null);
    setWorking(true);
    try {
      await removePinAction({});
      setSuccess("Kod PIN został usunięty.");
      setPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd podczas usuwania PIN-u");
    } finally {
      setWorking(false);
    }
  }

  if (isLoading) return <main className="account-content">Ładowanie…</main>;
  if (!user) return <main className="account-content">Nie zalogowano</main>;

  return (
    <main className="account-content">
      <h1 className="account-title">Szybkie logowanie kodem PIN</h1>

      <section className="account-card">
        <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Ustaw swój spersonalizowany kod PIN (4 do 6 cyfr), aby móc się szybko i wygodnie logować do systemu bez używania pełnego hasła.
        </div>

        <div style={{
          padding: "10px 14px",
          borderRadius: "6px",
          backgroundColor: hasPin ? "rgba(63, 185, 80, 0.1)" : "var(--bg-elevated)",
          border: `1px solid ${hasPin ? "rgba(63, 185, 80, 0.3)" : "var(--border-subtle)"}`,
          fontSize: "12.5px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "16px" }}>{hasPin ? "🔒" : "🔓"}</span>
          <span>
            {hasPin
              ? `Kod PIN jest aktywny (ustawiony ${new Date(user.pinSetAt!).toLocaleDateString("pl-PL")})`
              : "Brak aktywnego kodu PIN na Twoim koncie"}
          </span>
        </div>

        <form className="account-form" onSubmit={onSubmit}>
          <label className="account-field">
            <span>{hasPin ? "Nowy kod PIN" : "Wprowadź kod PIN (4-6 cyfr)"}</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="np. 1234"
              required
            />
          </label>

          <label className="account-field">
            <span>Potwierdź kod PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Powtórz kod PIN"
              required
            />
          </label>

          {error ? <div className="account-error">{error}</div> : null}
          {success ? <div className="account-success">{success}</div> : null}

          <div className="account-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="submit"
              className="account-btn account-btn-primary"
              disabled={working}
            >
              {working ? "Zapisywanie..." : hasPin ? "Zmień kod PIN" : "Zapisz kod PIN"}
            </button>

            {hasPin && (
              <button
                type="button"
                onClick={onRemove}
                className="account-btn"
                style={{ backgroundColor: "rgba(248, 81, 73, 0.15)", color: "#ff8478", border: "1px solid rgba(248, 81, 73, 0.3)" }}
                disabled={working}
              >
                Usunięcie PIN
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}

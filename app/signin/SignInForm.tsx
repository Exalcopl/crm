"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/admin/panel";

  const [mode, setMode] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim().toLowerCase());
      formData.set("flow", "signIn");

      if (mode === "pin") {
        formData.set("password", pin.trim());
        await signIn("pin", formData);
      } else {
        formData.set("password", password);
        await signIn("password", formData);
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Logowanie nie powiodło się";
      const friendly = message.includes("InvalidAccountId") ||
        message.includes("InvalidSecret") ||
        message.toLowerCase().includes("invalid")
        ? mode === "pin" ? "Niepoprawny e-mail lub kod PIN" : "Niepoprawny e-mail lub hasło"
        : message;
      setError(friendly);
      setLoading(false);
    }
  }

  return (
    <form className="signin-form" onSubmit={onSubmit} noValidate>
      <div style={{ display: "flex", gap: "4px", padding: "3px", background: "var(--bg-elevated)", borderRadius: "8px", marginBottom: "16px", border: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => { setMode("password"); setError(null); }}
          style={{
            flex: 1,
            padding: "6px",
            fontSize: "12.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: "none",
            background: mode === "password" ? "var(--bg-surface)" : "transparent",
            color: mode === "password" ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
            boxShadow: mode === "password" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
            transition: "all 120ms"
          }}
        >
          🔑 Hasło
        </button>
        <button
          type="button"
          onClick={() => { setMode("pin"); setError(null); }}
          style={{
            flex: 1,
            padding: "6px",
            fontSize: "12.5px",
            fontWeight: 500,
            borderRadius: "6px",
            border: "none",
            background: mode === "pin" ? "var(--bg-surface)" : "transparent",
            color: mode === "pin" ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
            boxShadow: mode === "pin" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
            transition: "all 120ms"
          }}
        >
          🔢 Kod PIN
        </button>
      </div>

      <label className="signin-field">
        <span className="signin-label">E-mail</span>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="signin-input"
          placeholder="adres@firma.pl"
        />
      </label>

      {mode === "password" ? (
        <label className="signin-field">
          <span className="signin-label">Hasło</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="signin-input"
            placeholder="••••••••"
          />
        </label>
      ) : (
        <label className="signin-field">
          <span className="signin-label">Kod PIN (4-6 cyfr)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="signin-input"
            placeholder="••••"
          />
        </label>
      )}

      {error ? <div className="signin-error">{error}</div> : null}
      <button type="submit" className="signin-submit" disabled={loading}>
        {loading ? "Logowanie..." : mode === "pin" ? "Zaloguj z PIN" : "Zaloguj się"}
      </button>
    </form>
  );
}

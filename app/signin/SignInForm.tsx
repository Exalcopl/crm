"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/admin/panel";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      formData.set("password", password);
      formData.set("flow", "signIn");
      await signIn("password", formData);
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Logowanie nie powiodło się";
      const friendly = message.includes("InvalidAccountId") ||
        message.includes("InvalidSecret") ||
        message.toLowerCase().includes("invalid")
        ? "Niepoprawny e-mail lub hasło"
        : message;
      setError(friendly);
      setLoading(false);
    }
  }

  return (
    <form className="signin-form" onSubmit={onSubmit} noValidate>
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
      {error ? <div className="signin-error">{error}</div> : null}
      <button type="submit" className="signin-submit" disabled={loading}>
        {loading ? "Logowanie..." : "Zaloguj się"}
      </button>
    </form>
  );
}

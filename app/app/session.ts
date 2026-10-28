"use client";

export interface PinSession {
  userId: string;
  email: string;
  name: string;
}

const SESSION_KEY = "app_pin_session";

export function loadSession(): PinSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PinSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: PinSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

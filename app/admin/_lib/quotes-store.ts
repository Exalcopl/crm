"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_QUOTES, QUOTE_STATUSES, type Quote, type QuoteStatus } from "./quotes";

const STORAGE_KEY = "exalco.quotes.v2";

const LEGACY_STATUS_MAP: Record<string, QuoteStatus> = {
  Pomiary: "Pomiary i uzgodnienia",
  "Szykowanie produkcji": "Pomiary i uzgodnienia",
};

function migrateQuotes(rows: Quote[]): { quotes: Quote[]; changed: boolean } {
  let changed = false;
  const valid = new Set<string>(QUOTE_STATUSES);
  const quotes = rows.map((q) => {
    if (valid.has(q.status)) return q;
    const next = LEGACY_STATUS_MAP[q.status as string] ?? "Do zrobienia";
    changed = true;
    return { ...q, status: next };
  });
  return { quotes, changed };
}

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryState: Quote[] = INITIAL_QUOTES;
let hydrated = false;

function loadFromStorage(): Quote[] {
  if (typeof window === "undefined") return INITIAL_QUOTES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_QUOTES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_QUOTES;
    const { quotes, changed } = migrateQuotes(parsed as Quote[]);
    if (changed) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
      } catch {
        /* ignore */
      }
    }
    return quotes;
  } catch {
    return INITIAL_QUOTES;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  memoryState = loadFromStorage();
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    memoryState = loadFromStorage();
    listeners.forEach((l) => l());
  });
}

if (typeof window !== "undefined") {
  ensureHydrated();
}

function subscribe(listener: Listener) {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return memoryState;
}

function getServerSnapshot() {
  return INITIAL_QUOTES;
}

export function useQuotes(): Quote[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setQuotes(updater: Quote[] | ((prev: Quote[]) => Quote[])) {
  ensureHydrated();
  memoryState =
    typeof updater === "function"
      ? (updater as (p: Quote[]) => Quote[])(memoryState)
      : updater;
  persist();
  listeners.forEach((l) => l());
}

"use client";

import { useSyncExternalStore } from "react";
import {
  QUOTE_STATUSES,
  type ProjectType,
  type Quote,
  type QuoteStatus,
} from "./quotes";

const STORAGE_KEY = "exalco.quotes.v2";

const LEGACY_STATUS_MAP: Record<string, QuoteStatus> = {
  Pomiary: "Pomiary i uzgodnienia",
  "Szykowanie produkcji": "Pomiary i uzgodnienia",
};

function migrateQuotes(rows: Quote[]): { quotes: Quote[]; changed: boolean } {
  let changed = false;
  const valid = new Set<string>(QUOTE_STATUSES);
  const quotes = rows.map((row) => {
    const legacy = row as Quote & { owner?: string };
    let next: Quote = row;
    if (!valid.has(next.status)) {
      const mapped = LEGACY_STATUS_MAP[next.status as string] ?? "Do zrobienia";
      next = { ...next, status: mapped };
      changed = true;
    }
    if (!("ownerId" in next) || next.ownerId === undefined) {
      const ownerLegacy = legacy.owner?.trim() || next.ownerLegacy;
      next = { ...next, ownerId: null, ownerLegacy };
      changed = true;
    }
    if ("owner" in next) {
      const { owner: _drop, ...rest } = next as Quote & { owner?: string };
      void _drop;
      next = rest as Quote;
      changed = true;
    }
    if (!Array.isArray(next.projectType)) {
      const single = next.projectType as unknown as ProjectType | undefined;
      next = { ...next, projectType: single ? [single] : [] };
      changed = true;
    }
    return next;
  });
  return { quotes, changed };
}

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryState: Quote[] = [];
let hydrated = false;

function loadFromStorage(): Quote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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
    return [];
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
  return [];
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

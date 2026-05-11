"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_QUOTES, type Quote } from "./quotes";

const STORAGE_KEY = "exalco.quotes.v2";

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
    return parsed as Quote[];
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

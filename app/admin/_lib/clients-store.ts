"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_CLIENTS, type Client } from "./clients";

const STORAGE_KEY = "exalco.clients.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryState: Client[] = INITIAL_CLIENTS;
let hydrated = false;

function loadFromStorage(): Client[] {
  if (typeof window === "undefined") return INITIAL_CLIENTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_CLIENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_CLIENTS;
    return parsed as Client[];
  } catch {
    return INITIAL_CLIENTS;
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
  return INITIAL_CLIENTS;
}

export function useClients(): Client[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setClients(updater: Client[] | ((prev: Client[]) => Client[])) {
  ensureHydrated();
  memoryState =
    typeof updater === "function"
      ? (updater as (p: Client[]) => Client[])(memoryState)
      : updater;
  persist();
  listeners.forEach((l) => l());
}

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Quote } from "./quotes";

export type OwnerInfo = {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  isActive: boolean;
};

const OwnerNamesContext = createContext<Map<string, OwnerInfo> | null>(null);

export function OwnerNamesProvider({
  quotes,
  children,
}: {
  quotes: Quote[];
  children: ReactNode;
}) {
  const ownerIds = useMemo(() => {
    const seen = new Set<string>();
    const out: Id<"users">[] = [];
    for (const q of quotes) {
      if (!q.ownerId) continue;
      const key = q.ownerId as unknown as string;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q.ownerId);
    }
    return out;
  }, [quotes]);

  const usersRaw = useQuery(
    api.users.getByIds,
    ownerIds.length > 0 ? { userIds: ownerIds } : "skip",
  ) as OwnerInfo[] | undefined;

  const map = useMemo(() => {
    const m = new Map<string, OwnerInfo>();
    for (const u of usersRaw ?? []) m.set(u._id as unknown as string, u);
    return m;
  }, [usersRaw]);

  return (
    <OwnerNamesContext.Provider value={map}>
      {children}
    </OwnerNamesContext.Provider>
  );
}

export function resolveOwnerName(
  quote: Pick<Quote, "ownerId" | "ownerLegacy">,
  map: Map<string, OwnerInfo> | null,
): string {
  if (quote.ownerId && map) {
    const u = map.get(quote.ownerId as unknown as string);
    if (u) return u.name?.trim() || u.email?.trim() || "—";
  }
  return quote.ownerLegacy?.trim() || "—";
}

export function useOwnerNamesMap(): Map<string, OwnerInfo> | null {
  return useContext(OwnerNamesContext);
}

export function useOwnerName(quote: Pick<Quote, "ownerId" | "ownerLegacy">): string {
  const map = useContext(OwnerNamesContext);
  return resolveOwnerName(quote, map);
}

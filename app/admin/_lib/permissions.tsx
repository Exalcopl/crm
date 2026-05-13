"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type CurrentUser = {
  _id: string;
  email: string | null;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: {
    _id: string;
    name: string;
    displayName: string;
    isSystem: boolean;
  } | null;
  permissions: string[];
};

type PermissionsContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  has: (resource: string, action: string) => boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const me = useQuery(api.permissions.me) as CurrentUser | null | undefined;

  const value = useMemo<PermissionsContextValue>(() => {
    const user = (me ?? null) as CurrentUser | null;
    const set = new Set(user?.permissions ?? []);
    return {
      user,
      isLoading: me === undefined,
      has: (resource, action) => set.has(`${resource}:${action}`),
    };
  }, [me]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error("usePermissions must be used inside <PermissionsProvider>");
  }
  return ctx;
}

export function PermissionGate({
  resource,
  action,
  fallback = null,
  children,
}: {
  resource: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { has, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!has(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
}

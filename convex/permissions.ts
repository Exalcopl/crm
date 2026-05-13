import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const RESOURCES = ["wyceny", "klienci", "users", "roles"] as const;
export const ACTIONS = ["read", "create", "update", "delete"] as const;
export const SCOPES = ["own", "team", "all"] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Scope = (typeof SCOPES)[number];

const CACHE_TTL_MS = 60 * 1000;
type CacheEntry = { permissions: Set<string>; expiresAt: number };
const permissionCache = new Map<string, CacheEntry>();

function cacheKey(roleId: Id<"roles">) {
  return roleId as unknown as string;
}

async function loadPermissionsForRole(
  ctx: QueryCtx | MutationCtx,
  roleId: Id<"roles">,
): Promise<Set<string>> {
  const entry = permissionCache.get(cacheKey(roleId));
  const now = Date.now();
  if (entry && entry.expiresAt > now) return entry.permissions;

  const links = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .collect();

  const keys = new Set<string>();
  for (const link of links) {
    const perm = await ctx.db.get(link.permissionId);
    if (!perm) continue;
    keys.add(`${perm.resource}:${perm.action}`);
  }

  permissionCache.set(cacheKey(roleId), { permissions: keys, expiresAt: now + CACHE_TTL_MS });
  return keys;
}

export function invalidatePermissionCache(roleId: Id<"roles">) {
  permissionCache.delete(cacheKey(roleId));
}

export function clearPermissionCache() {
  permissionCache.clear();
}

export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  resource: Resource | string,
  action: Action | string,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  if (!user || user.isActive === false) return false;
  if (!user.roleId) return false;
  const perms = await loadPermissionsForRole(ctx, user.roleId);
  return perms.has(`${resource}:${action}`);
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  resource: Resource | string,
  action: Action | string,
): Promise<void> {
  const ok = await hasPermission(ctx, resource, action);
  if (!ok) throw new Error("Brak uprawnień");
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const role = user.roleId ? await ctx.db.get(user.roleId) : null;
    const permissions: string[] = [];
    if (user.roleId) {
      const links = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", user.roleId!))
        .collect();
      for (const link of links) {
        const perm = await ctx.db.get(link.permissionId);
        if (perm) permissions.push(`${perm.resource}:${perm.action}`);
      }
    }
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      isActive: user.isActive ?? true,
      mustChangePassword: user.mustChangePassword ?? false,
      role: role ? { _id: role._id, name: role.name, displayName: role.displayName, isSystem: role.isSystem } : null,
      permissions,
    };
  },
});

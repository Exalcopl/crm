import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  hasPermission,
  invalidatePermissionCache,
  requirePermission,
} from "./permissions";
import type { Id } from "./_generated/dataModel";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const allowed = await hasPermission(ctx, "roles", "read");
    if (!allowed) return [];
    const roles = await ctx.db.query("roles").collect();
    const usersByRole = await ctx.db.query("users").collect();
    const counts = new Map<string, number>();
    for (const u of usersByRole) {
      if (!u.roleId) continue;
      const k = u.roleId as unknown as string;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return roles
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((r) => ({
        _id: r._id,
        name: r.name,
        displayName: r.displayName,
        isSystem: r.isSystem,
        userCount: counts.get(r._id as unknown as string) ?? 0,
        createdAt: r._creationTime,
      }));
  },
});

export const get = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const allowed = await hasPermission(ctx, "roles", "read");
    if (!allowed) return null;
    const role = await ctx.db.get(roleId);
    if (!role) return null;
    return role;
  },
});

export const allPermissions = query({
  args: {},
  handler: async (ctx) => {
    const allowed = await hasPermission(ctx, "roles", "read");
    if (!allowed) return [];
    const perms = await ctx.db.query("permissions").collect();
    return perms.map((p) => ({
      _id: p._id,
      resource: p.resource,
      action: p.action,
      scope: p.scope,
    }));
  },
});

export const permissionsForRole = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const allowed = await hasPermission(ctx, "roles", "read");
    if (!allowed) return [];
    const links = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    return links.map((l) => l.permissionId);
  },
});

export const create = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    await requirePermission(ctx, "roles", "create");
    const trimmed = displayName.trim();
    if (trimmed.length < 2) throw new Error("Nazwa za krótka");
    const baseName = slugify(trimmed);
    if (!baseName) throw new Error("Nazwa zawiera tylko niedozwolone znaki");

    let name = baseName;
    let suffix = 1;
    while (true) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (!existing) break;
      suffix++;
      name = `${baseName}_${suffix}`;
    }

    const roleId = await ctx.db.insert("roles", {
      name,
      displayName: trimmed,
      isSystem: false,
    });
    return roleId;
  },
});

export const updateDisplayName = mutation({
  args: { roleId: v.id("roles"), displayName: v.string() },
  handler: async (ctx, { roleId, displayName }) => {
    await requirePermission(ctx, "roles", "update");
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Rola nie istnieje");
    if (role.isSystem) throw new Error("Rola systemowa nie może być modyfikowana");
    const trimmed = displayName.trim();
    if (trimmed.length < 2) throw new Error("Nazwa za krótka");
    await ctx.db.patch(roleId, { displayName: trimmed });
  },
});

export const remove = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    await requirePermission(ctx, "roles", "delete");
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Rola nie istnieje");
    if (role.isSystem) throw new Error("Rola systemowa nie może być usunięta");
    const assigned = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .first();
    if (assigned) {
      throw new Error(
        "Nie można usunąć roli — przypisani użytkownicy. Przepnij ich najpierw.",
      );
    }
    const links = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    await ctx.db.delete(roleId);
    invalidatePermissionCache(roleId);
  },
});

export const setPermissions = mutation({
  args: {
    roleId: v.id("roles"),
    permissionIds: v.array(v.id("permissions")),
  },
  handler: async (ctx, { roleId, permissionIds }) => {
    await requirePermission(ctx, "roles", "update");
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Rola nie istnieje");
    if (role.isSystem) {
      throw new Error("Rola systemowa nie może być modyfikowana");
    }

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();

    const wantedSet = new Set(permissionIds.map((id) => id as unknown as string));
    const existingMap = new Map<string, Id<"rolePermissions">>();
    for (const l of existing) {
      existingMap.set(l.permissionId as unknown as string, l._id);
    }

    for (const [permKey, linkId] of existingMap) {
      if (!wantedSet.has(permKey)) await ctx.db.delete(linkId);
    }
    for (const permId of permissionIds) {
      if (existingMap.has(permId as unknown as string)) continue;
      const perm = await ctx.db.get(permId);
      if (!perm) continue;
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: permId,
        grantedAt: Date.now(),
      });
    }
    invalidatePermissionCache(roleId);
  },
});

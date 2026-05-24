import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { RESOURCES, ACTIONS, SCOPES } from "./permissions";
import type { Id } from "./_generated/dataModel";

const SUPER_ADMIN_ROLE = "super_admin";

export const _internalEnsurePermissions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("permissions").collect();
    const present = new Set(
      all.map((p) => `${p.resource}:${p.action}:${p.scope}`),
    );
    const ids: Id<"permissions">[] = [];
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        for (const scope of SCOPES) {
          const key = `${resource}:${action}:${scope}`;
          if (present.has(key)) continue;
          const id = await ctx.db.insert("permissions", { resource, action, scope });
          ids.push(id);
        }
      }
    }
    return { created: ids.length };
  },
});

export const _internalEnsureSuperAdminRole = internalMutation({
  args: {},
  handler: async (ctx) => {
    let role = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", SUPER_ADMIN_ROLE))
      .first();
    if (!role) {
      const id = await ctx.db.insert("roles", {
        name: SUPER_ADMIN_ROLE,
        displayName: "Super Admin",
        isSystem: true,
      });
      role = await ctx.db.get(id);
    }
    if (!role) throw new Error("Nie udało się utworzyć roli super_admin");

    const allPerms = await ctx.db.query("permissions").collect();
    const links = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", role!._id))
      .collect();
    const linkedIds = new Set(
      links.map((l) => l.permissionId as unknown as string),
    );

    let added = 0;
    for (const p of allPerms) {
      if (linkedIds.has(p._id as unknown as string)) continue;
      await ctx.db.insert("rolePermissions", {
        roleId: role._id,
        permissionId: p._id,
        grantedAt: Date.now(),
      });
      added++;
    }
    return { roleId: role._id, added };
  },
});

export const _internalAttachRole = internalMutation({
  args: { userId: v.id("users"), roleId: v.id("roles") },
  handler: async (ctx, { userId, roleId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return;
    await ctx.db.patch(userId, {
      roleId,
      isActive: true,
      mustChangePassword: u.mustChangePassword ?? false,
    });
  },
});

export const _internalFindUserByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return user ? user._id : null;
  },
});

export const promoteSuperAdmin = action({
  args: { email: v.string() },
  handler: async (
    ctx,
    { email },
  ): Promise<{
    userId: Id<"users">;
    roleId: Id<"roles">;
    previousRoleId: Id<"roles"> | null;
  }> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new Error("Niepoprawny e-mail");

    await ctx.runMutation(internal.seed._internalEnsurePermissions, {});
    const roleResult: { roleId: Id<"roles">; added: number } =
      await ctx.runMutation(internal.seed._internalEnsureSuperAdminRole, {});

    const userId: Id<"users"> | null = await ctx.runMutation(
      internal.seed._internalFindUserByEmail,
      { email: normalized },
    );
    if (!userId) {
      throw new Error(`Nie znaleziono użytkownika o e-mailu ${normalized}`);
    }

    const previousRoleId: Id<"roles"> | null = await ctx.runMutation(
      internal.seed._internalSetSuperAdmin,
      { userId, roleId: roleResult.roleId },
    );

    return { userId, roleId: roleResult.roleId, previousRoleId };
  },
});

export const _internalSetSuperAdmin = internalMutation({
  args: { userId: v.id("users"), roleId: v.id("roles") },
  handler: async (ctx, { userId, roleId }) => {
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("Użytkownik zniknął w trakcie operacji");
    const previousRoleId = (u.roleId as Id<"roles"> | undefined) ?? null;
    await ctx.db.patch(userId, { roleId, isActive: true });
    return previousRoleId;
  },
});

export const seedAdmin = action({
  args: {},
  handler: async (ctx): Promise<{
    permissionsCreated: number;
    superAdminRoleId: Id<"roles">;
    permissionsLinked: number;
    adminUserId: Id<"users">;
    adminCreated: boolean;
  }> => {
    const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@exalco.pl")
      .trim()
      .toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      throw new Error(
        "Ustaw SEED_ADMIN_PASSWORD (min 8 znaków) w env Convexa: `npx convex env set SEED_ADMIN_PASSWORD <hasło>`",
      );
    }

    const permResult: { created: number } = await ctx.runMutation(
      internal.seed._internalEnsurePermissions,
      {},
    );

    const roleResult: { roleId: Id<"roles">; added: number } = await ctx.runMutation(
      internal.seed._internalEnsureSuperAdminRole,
      {},
    );

    let adminId: Id<"users"> | null = await ctx.runMutation(
      internal.seed._internalFindUserByEmail,
      { email },
    );

    let created = false;
    if (!adminId) {
      const result = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: password },
        profile: {
          email,
          name: "Super Admin",
          isActive: true,
          mustChangePassword: false,
          roleId: roleResult.roleId,
        },
      });
      adminId = result.user._id;
      created = true;
    }

    await ctx.runMutation(internal.seed._internalAttachRole, {
      userId: adminId!,
      roleId: roleResult.roleId,
    });

    return {
      permissionsCreated: permResult.created,
      superAdminRoleId: roleResult.roleId,
      permissionsLinked: roleResult.added,
      adminUserId: adminId!,
      adminCreated: created,
    };
  },
});

export const resetAdminPassword = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@exalco.pl").trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      throw new Error("Ustaw SEED_ADMIN_PASSWORD w env Convexa");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: password },
    });
    return { ok: true };
  },
});

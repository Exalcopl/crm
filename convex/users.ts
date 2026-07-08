import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId, createAccount } from "@convex-dev/auth/server";
import { hasPermission, requirePermission } from "./permissions";
import type { Doc, Id } from "./_generated/dataModel";

const PASSWORD_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";

function generateTempPassword(length = 16) {
  const cryptoObj = globalThis.crypto;
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowed = await hasPermission(ctx, "users", "read");
    if (!allowed) return [];

    const all = await ctx.db.query("users").collect();
    const search = args.search?.trim().toLowerCase();

    const filtered = all.filter((u) => {
      if (args.roleId !== undefined && u.roleId !== args.roleId) return false;
      if (args.isActive !== undefined) {
        const active = u.isActive ?? true;
        if (active !== args.isActive) return false;
      }
      if (search) {
        const hay = `${u.email ?? ""} ${u.name ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const roleIds = Array.from(
      new Set(filtered.map((u) => u.roleId).filter(Boolean) as Id<"roles">[]),
    );
    const roles = await Promise.all(roleIds.map((id) => ctx.db.get(id)));
    const roleById = new Map<string, Doc<"roles">>();
    for (const r of roles) if (r) roleById.set(r._id as unknown as string, r);

    return filtered
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
      .map((u) => ({
        _id: u._id,
        email: u.email ?? null,
        name: u.name ?? null,
        isActive: u.isActive ?? true,
        mustChangePassword: u.mustChangePassword ?? false,
        roleId: u.roleId ?? null,
        role: u.roleId
          ? roleById.get(u.roleId as unknown as string) ?? null
          : null,
        isAssignable: u.isAssignable ?? true,
        createdAt: u._creationTime,
      }));
  },
});

const ASSIGNABLE_ROLE_NAMES = ["admin", "sales"] as const;

export const listAssignable = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];

    const roles = await ctx.db.query("roles").collect();
    const assignableRoleIds = new Set(
      roles
        .filter((r) => (ASSIGNABLE_ROLE_NAMES as readonly string[]).includes(r.name))
        .map((r) => r._id as unknown as string),
    );
    if (assignableRoleIds.size === 0) return [];

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => {
        if ((u.isActive ?? true) === false) return false;
        if ((u.isAssignable ?? true) === false) return false;
        if (!u.roleId) return false;
        return assignableRoleIds.has(u.roleId as unknown as string);
      })
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
      }))
      .sort((a, b) =>
        (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""),
      );
  },
});

export const listAllAssignable = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => {
        if ((u.isActive ?? true) === false) return false;
        if ((u.isAssignable ?? true) === false) return false;
        return true;
      })
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        isCurrentUser:
          (u._id as unknown as string) === (callerId as unknown as string),
      }))
      .sort((a, b) =>
        (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""),
      );
  },
});

export const getByIds = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) return [];
    if (userIds.length === 0) return [];

    const unique = Array.from(new Set(userIds.map((id) => id as unknown as string)));
    const users = await Promise.all(
      unique.map((id) => ctx.db.get(id as unknown as Id<"users">)),
    );
    return users
      .filter((u): u is Doc<"users"> => u !== null)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        isActive: u.isActive ?? true,
      }));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const allowed = await hasPermission(ctx, "users", "read");
    if (!allowed) return null;
    const users = await ctx.db.query("users").collect();
    let active = 0;
    let inactive = 0;
    let withoutRole = 0;
    for (const u of users) {
      if (u.isActive === false) inactive++;
      else active++;
      if (!u.roleId) withoutRole++;
    }
    return { total: users.length, active, inactive, withoutRole };
  },
});

export const setActive = mutation({
  args: { userId: v.id("users"), isActive: v.boolean() },
  handler: async (ctx, { userId, isActive }) => {
    await requirePermission(ctx, "users", "update");
    const callerId = await getAuthUserId(ctx);
    if (callerId === userId && !isActive) {
      throw new Error("Nie możesz dezaktywować własnego konta");
    }
    await ctx.db.patch(userId, { isActive });
    return null;
  },
});

export const setAssignable = mutation({
  args: { userId: v.id("users"), isAssignable: v.boolean() },
  handler: async (ctx, { userId, isAssignable }) => {
    await requirePermission(ctx, "users", "update");
    await ctx.db.patch(userId, { isAssignable });
    return null;
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), roleId: v.union(v.id("roles"), v.null()) },
  handler: async (ctx, { userId, roleId }) => {
    await requirePermission(ctx, "users", "update");
    if (roleId) {
      const role = await ctx.db.get(roleId);
      if (!role) throw new Error("Rola nie istnieje");
    }
    await ctx.db.patch(userId, { roleId: roleId ?? undefined });
    return null;
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requirePermission(ctx, "users", "delete");
    const callerId = await getAuthUserId(ctx);
    if (callerId === userId) {
      throw new Error("Nie możesz usunąć własnego konta");
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const acc of accounts) {
      await ctx.db.delete(acc._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const sess of sessions) {
      await ctx.db.delete(sess._id);
    }

    await ctx.db.delete(userId);
    return null;
  },
});

export const _internalCreateUser = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
    mustChangePassword: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      name: args.name,
      roleId: args.roleId,
      mustChangePassword: args.mustChangePassword,
      isActive: args.isActive,
    });
  },
});

export const _internalCheckEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return existing ? existing._id : null;
  },
});

export const _internalCheckPermission = internalQuery({
  args: { resource: v.string(), action: v.string() },
  handler: async (ctx, args) => {
    return await hasPermission(ctx, args.resource, args.action);
  },
});

export const _internalSetMustChange = internalMutation({
  args: { userId: v.id("users"), value: v.boolean() },
  handler: async (ctx, { userId, value }) => {
    await ctx.db.patch(userId, { mustChangePassword: value });
  },
});

export const adminCreate = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args): Promise<{ password: string; userId: Id<"users"> }> => {
    const allowed: boolean = await ctx.runQuery(
      internal.users._internalCheckPermission,
      { resource: "users", action: "create" },
    );
    if (!allowed) throw new Error("Brak uprawnień");

    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Niepoprawny e-mail");

    const existing: Id<"users"> | null = await ctx.runQuery(
      internal.users._internalCheckEmail,
      { email },
    );
    if (existing) throw new Error("Użytkownik o tym e-mailu już istnieje");

    const password = generateTempPassword(16);
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: {
        email,
        name: args.name?.trim() || undefined,
        isActive: true,
        mustChangePassword: true,
        roleId: args.roleId,
      },
    });

    await ctx.runMutation(internal.users._internalCreateUser, {
      userId: result.user._id,
      name: args.name?.trim() || undefined,
      roleId: args.roleId,
      mustChangePassword: true,
      isActive: true,
    });

    return { password, userId: result.user._id };
  },
});

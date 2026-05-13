import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";

export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Nie zalogowano");
    const trimmed = name.trim();
    if (trimmed.length < 1) throw new Error("Imię nie może być puste");
    await ctx.db.patch(userId, { name: trimmed });
  },
});

export const _internalGetAuthEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

export const _internalMarkPasswordChanged = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Nie zalogowano");
    await ctx.db.patch(userId, { mustChangePassword: false });
  },
});

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }): Promise<void> => {
    if (newPassword.length < 8) {
      throw new Error("Nowe hasło musi mieć co najmniej 8 znaków");
    }
    if (currentPassword === newPassword) {
      throw new Error("Nowe hasło musi być inne niż obecne");
    }
    const email: string | null = await ctx.runQuery(
      internal.account._internalGetAuthEmail,
      {},
    );
    if (!email) throw new Error("Nie zalogowano");

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email, secret: currentPassword },
      });
    } catch {
      throw new Error("Niepoprawne obecne hasło");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });

    await ctx.runMutation(internal.account._internalMarkPasswordChanged, {});
  },
});

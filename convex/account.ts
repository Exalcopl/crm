import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";

export async function hashPinString(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`exalco-pin-v1:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

export const _internalMarkPinSet = internalMutation({
  args: { pinHash: v.string() },
  handler: async (ctx, { pinHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Nie zalogowano");
    await ctx.db.patch(userId, {
      pinHash,
      pinSetAt: Date.now(),
    });
  },
});

export const _internalMarkPinRemoved = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Nie zalogowano");
    await ctx.db.patch(userId, {
      pinHash: undefined,
      pinSetAt: undefined,
    });
  },
});

export const setPin = action({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      throw new Error("Kod PIN musi składać się z 4 do 6 cyfr");
    }
    const email: string | null = await ctx.runQuery(
      internal.account._internalGetAuthEmail,
      {},
    );
    if (!email) throw new Error("Nie zalogowano");

    const pinHash = await hashPinString(trimmed);

    try {
      await modifyAccountCredentials(ctx, {
        provider: "pin",
        account: { id: email, secret: trimmed },
      });
    } catch (err) {
      // If account for "pin" provider doesn't exist yet, link it via email
      await createAccount(ctx, {
        provider: "pin",
        account: { id: email, secret: trimmed },
        profile: { email },
        shouldLinkViaEmail: true,
      });
    }

    await ctx.runMutation(internal.account._internalMarkPinSet, { pinHash });
  },
});

export const removePin = action({
  args: {},
  handler: async (ctx) => {
    const email: string | null = await ctx.runQuery(
      internal.account._internalGetAuthEmail,
      {},
    );
    if (!email) throw new Error("Nie zalogowano");

    try {
      await modifyAccountCredentials(ctx, {
        provider: "pin",
        account: { id: email, secret: `disabled_${Date.now()}_${Math.random()}` },
      });
    } catch {
      // If account didn't exist, ignore error
    }

    await ctx.runMutation(internal.account._internalMarkPinRemoved, {});
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

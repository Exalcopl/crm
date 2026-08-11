import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { hashPinString } from "./account";

export type PinSession = {
  userId: string;
  email: string;
  name: string;
};

/**
 * Resolves a PIN to a user session object.
 * Used by /app (mobile PWA) – does NOT create a Convex Auth session.
 * Returns { userId, email, name } on success, null if PIN is invalid.
 */
export const resolvePin = action({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<PinSession | null> => {
    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) return null;

    const pinHash = await hashPinString(trimmed);
    const result = (await ctx.runQuery(internal.authPin._internalFindUserByPinHash, {
      pinHash,
    })) as { userId: string; email: string; name: string } | null;

    if (!result) return null;
    return { userId: result.userId, email: result.email, name: result.name };
  },
});

export const _internalFindUserByPinHash = internalQuery({
  args: { pinHash: v.string() },
  handler: async (ctx, { pinHash }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_pinHash", (q) => q.eq("pinHash", pinHash))
      .first();

    if (!user) return null;
    return {
      userId: user._id as string,
      email: user.email ?? "",
      name: (user.name as string | undefined) ?? user.email ?? "",
    };
  },
});

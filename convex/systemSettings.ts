import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const getOcrProvider = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "ocr_provider"))
      .first();

    return (setting?.value as string) || "anthropic";
  },
});

export const setOcrProvider = mutation({
  args: { provider: v.union(v.literal("anthropic"), v.literal("gemini")) },
  handler: async (ctx, { provider }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Brak autoryzacji");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Użytkownik nie istnieje");

    if (user.roleId) {
      const role = await ctx.db.get(user.roleId);
      if (role?.name !== "admin" && role?.name !== "super_admin") {
        throw new Error("Brak uprawnień administratora");
      }
    } else {
      throw new Error("Brak uprawnień administratora");
    }

    const existing = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "ocr_provider"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: provider });
    } else {
      await ctx.db.insert("systemSettings", {
        key: "ocr_provider",
        value: provider,
      });
    }
  },
});

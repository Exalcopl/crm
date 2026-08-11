import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const testPinFlow = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) throw new Error(`User ${email} not found`);

    // Test updating pinSetAt
    const now = Date.now();
    await ctx.db.patch(user._id, { pinSetAt: now });

    const updated = await ctx.db.get(user._id);
    const pinSetSuccess = updated?.pinSetAt === now;

    return {
      userId: user._id,
      email: user.email,
      pinSetSuccess,
      pinSetAt: updated?.pinSetAt,
    };
  },
});

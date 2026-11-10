import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const DEFAULT_ENABLED_TYPES = ["new_quote", "new_order"];

// List notifications for current user (last 30 days, max 50 items)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", thirtyDaysAgo))
      .order("desc")
      .take(50);

    // Filter by targetUserId if set
    const userNotifications = allNotifications.filter((n) => {
      if (n.targetUserId && userId && n.targetUserId !== userId) {
        return false;
      }
      return true;
    });

    const notificationsWithReadState = userNotifications.map((n) => {
      const isRead = userId ? n.readBy.includes(userId) : false;
      return {
        ...n,
        isRead,
      };
    });

    const unreadCount = notificationsWithReadState.filter((n) => !n.isRead).length;

    return {
      notifications: notificationsWithReadState,
      unreadCount,
    };
  },
});

// Get global notification settings
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();

    if (!setting) {
      return {
        enabledTypes: DEFAULT_ENABLED_TYPES,
        soundEnabled: true,
      };
    }

    return {
      enabledTypes: setting.enabledTypes,
      soundEnabled: setting.soundEnabled,
    };
  },
});

// Update global notification settings (admin only)
export const updateSettings = mutation({
  args: {
    enabledTypes: v.array(v.string()),
    soundEnabled: v.boolean(),
  },
  handler: async (ctx, { enabledTypes, soundEnabled }) => {
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
      .query("notificationSettings")
      .withIndex("by_key", (q) => q.eq("key", "global_settings"))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        enabledTypes,
        soundEnabled,
        updatedAt: now,
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("notificationSettings", {
        key: "global_settings",
        enabledTypes,
        soundEnabled,
        updatedAt: now,
        updatedBy: userId,
      });
    }
  },
});

// Mark single notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const notification = await ctx.db.get(notificationId);
    if (!notification) return;

    if (!notification.readBy.includes(userId)) {
      await ctx.db.patch(notificationId, {
        readBy: [...notification.readBy, userId],
      });
    }
  },
});

// Mark all notifications as read for current user
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", thirtyDaysAgo))
      .collect();

    for (const n of notifications) {
      if (!n.readBy.includes(userId)) {
        await ctx.db.patch(n._id, {
          readBy: [...n.readBy, userId],
        });
      }
    }
  },
});

// Helper function to trigger a notification from any mutation handler
export async function triggerNotification(
  ctx: { db: any },
  args: {
    type: string;
    title: string;
    message: string;
    link: string;
    entityId?: string;
    targetUserId?: any;
    metadata?: any;
  }
) {
  const setting = await ctx.db
    .query("notificationSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "global_settings"))
    .first();

  const enabledTypes = setting ? setting.enabledTypes : DEFAULT_ENABLED_TYPES;

  if (!enabledTypes.includes(args.type)) {
    return null;
  }

  return await ctx.db.insert("notifications", {
    type: args.type,
    title: args.title,
    message: args.message,
    link: args.link,
    targetUserId: args.targetUserId,
    readBy: [],
    entityId: args.entityId,
    createdAt: Date.now(),
    metadata: args.metadata,
  });
}

// Mutation to create a notification (internal/system call)
export const createNotification = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    message: v.string(),
    link: v.string(),
    entityId: v.optional(v.string()),
    targetUserId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await triggerNotification(ctx, args);
  },
});


import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    roleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
    mustChangePassword: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["roleId"]),

  roles: defineTable({
    name: v.string(),
    displayName: v.string(),
    isSystem: v.boolean(),
  }).index("by_name", ["name"]),

  permissions: defineTable({
    resource: v.string(),
    action: v.string(),
    scope: v.union(v.literal("own"), v.literal("team"), v.literal("all")),
  })
    .index("by_resource_action_scope", ["resource", "action", "scope"])
    .index("by_resource", ["resource"]),

  rolePermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
    grantedAt: v.number(),
    grantedBy: v.optional(v.id("users")),
  })
    .index("by_role", ["roleId"])
    .index("by_role_permission", ["roleId", "permissionId"]),

  contacts: defineTable({
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.union(
      v.literal("lead"),
      v.literal("active"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),
});

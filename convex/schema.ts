import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const { users: _authUsers, ...otherAuthTables } = authTables;

export default defineSchema({
  ...otherAuthTables,

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

  clients: defineTable({
    name: v.string(),
    nameNormalized: v.string(),
    phoneRaw: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    email: v.optional(v.string()),
    street: v.optional(v.string()),
    postalCity: v.optional(v.string()),
    createdAt: v.number(),
    sharepointFolder: v.optional(
      v.object({
        itemId: v.string(),
        driveId: v.string(),
        webUrl: v.string(),
        status: v.union(
          v.literal("pending"),
          v.literal("created"),
          v.literal("failed"),
        ),
        error: v.optional(v.string()),
        attempts: v.number(),
        lastTriedAt: v.number(),
      }),
    ),
  })
    .index("by_phone_normalized", ["phoneNormalized"])
    .index("by_name_normalized", ["nameNormalized"]),

  quotes: defineTable({
    code: v.string(),
    clientId: v.optional(v.id("clients")),
    contact: v.object({
      name: v.string(),
      street: v.optional(v.string()),
      postalCity: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
    value: v.union(v.number(), v.null()),
    status: v.union(
      v.literal("Do zrobienia"),
      v.literal("Kontakt z klientem"),
      v.literal("Pomiary i uzgodnienia"),
      v.literal("Zrobione"),
    ),
    deadline: v.string(),
    projectType: v.array(
      v.union(
        v.literal("Zadaszenia"),
        v.literal("Pergola"),
        v.literal("Stolarka"),
        v.literal("Ogrodzenie"),
        v.literal("Osłony okienne"),
        v.literal("Inne"),
      ),
    ),
    ownerId: v.union(v.id("users"), v.null()),
    ownerLegacy: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    sharepoint: v.optional(
      v.object({
        webUrl: v.string(),
        parentFolderItemId: v.optional(v.string()),
        subfolderItemId: v.optional(v.string()),
        driveId: v.string(),
        status: v.union(
          v.literal("pending"),
          v.literal("created"),
          v.literal("failed"),
        ),
        error: v.optional(v.string()),
        attempts: v.number(),
        lastTriedAt: v.number(),
      }),
    ),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_archived", ["archived"])
    .index("by_client", ["clientId"]),

  quoteCounters: defineTable({
    year: v.number(),
    seq: v.number(),
  }).index("by_year", ["year"]),

  quoteNotes: defineTable({
    quoteId: v.id("quotes"),
    text: v.string(),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
    createdAt: v.number(),
  }).index("by_quote", ["quoteId"]),
});

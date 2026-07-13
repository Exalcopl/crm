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
    isAssignable: v.optional(v.boolean()),
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
    type: v.optional(v.union(v.literal("individual"), v.literal("business"))),
    nip: v.optional(v.string()),
    nipNormalized: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
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
    .index("by_name_normalized", ["nameNormalized"])
    .index("by_nip_normalized", ["nipNormalized"]),

  projectTypes: defineTable({
    name: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    categoryName: v.string(),
    categoryCode: v.string(),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),

  projectTypeQuestions: defineTable({
    projectTypeId: v.id("projectTypes"),
    text: v.string(),
    answerType: v.union(
      v.literal("text"),
      v.literal("boolean"),
      v.literal("number"),
    ),
    units: v.optional(v.array(v.string())),
    isRequired: v.boolean(),
    isActive: v.boolean(),
    order: v.number(),
  })
    .index("by_projectType", ["projectTypeId"])
    .index("by_projectType_order", ["projectTypeId", "order"]),

  quoteAnswers: defineTable({
    quoteId: v.id("quotes"),
    questionId: v.id("projectTypeQuestions"),
    projectTypeId: v.id("projectTypes"),
    textValue: v.optional(v.string()),
    booleanValue: v.optional(v.boolean()),
    numberValue: v.optional(v.number()),
    numberUnit: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_question", ["quoteId", "questionId"])
    .index("by_quote_projectType", ["quoteId", "projectTypeId"])
    .index("by_question", ["questionId"]),

  quotes: defineTable({
    code: v.string(),
    customLabel: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    contact: v.object({
      name: v.string(),
      street: v.optional(v.string()),
      postalCity: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      nip: v.optional(v.string()),
      clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
      contactPerson: v.optional(v.string()),
    }),
    investment: v.optional(
      v.object({
        name: v.optional(v.string()),
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
    value: v.union(v.number(), v.null()),
    status: v.union(
      v.literal("Do zrobienia"),
      v.literal("Kontakt z klientem"),
      v.literal("Pomiary i uzgodnienia"),
      v.literal("Zrobione"),
    ),
    deadline: v.string(),
    projectType: v.array(v.string()),
    ownerId: v.union(v.id("users"), v.null()),
    ownerLegacy: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("admin"), v.literal("public"))),
    configuration: v.optional(v.any()),
    publicUploadToken: v.optional(v.string()),
    publicUploadTokenExpiresAt: v.optional(v.number()),
    sharepoint: v.optional(
      v.object({
        webUrl: v.string(),
        parentFolderItemId: v.optional(v.string()),
        subfolderItemId: v.optional(v.string()),
        // legacy fields from old schema
        folderId: v.optional(v.string()),
        itemId: v.optional(v.string()),
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

  tasks: defineTable({
    quoteId: v.optional(v.id("quotes")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
    ),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    assigneeIds: v.optional(v.array(v.id("users"))),
    dueDate: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.union(v.id("users"), v.null()),
    completedAt: v.optional(v.number()),
    order: v.number(),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_status", ["quoteId", "status"]),

  publicSubmissionAttempts: defineTable({
    ip: v.string(),
    createdAt: v.number(),
  })
    .index("by_ip_createdAt", ["ip", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  clientNotes: defineTable({
    clientId: v.id("clients"),
    text: v.string(),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),

  quoteOcrResults: defineTable({
    quoteId: v.id("quotes"),
    fileItemId: v.string(),
    fileName: v.string(),
    ocrJson: v.any(),
    processedAt: v.number(),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_file", ["quoteId", "fileItemId"]),

  quoteActivity: defineTable({
    quoteId: v.id("quotes"),
    type: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
    createdAt: v.number(),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_created", ["quoteId", "createdAt"]),

  projectTypeGalleryImages: defineTable({
    projectTypeId: v.id("projectTypes"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    order: v.number(),
    uploadedAt: v.number(),
  })
    .index("by_projectType", ["projectTypeId"])
    .index("by_projectType_order", ["projectTypeId", "order"]),

  calendarEvents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    isAllDay: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
    color: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    recurrence: v.optional(
      v.union(
        v.literal("none"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
    ),
    recurrenceInterval: v.optional(v.number()),
    recurrenceEndDate: v.optional(v.string()),
    parentEventId: v.optional(v.id("calendarEvents")),
    type: v.optional(v.union(v.literal("private"), v.literal("company"))),
    category: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_createdBy", ["createdBy"])
    .index("by_createdBy_date", ["createdBy", "date"]),

  calendarCategories: defineTable({
    name: v.string(),
    color: v.string(),
    code: v.string(),
  }).index("by_code", ["code"]),

  projectTypeDefaultTasks: defineTable({
    projectTypeId: v.id("projectTypes"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_projectType", ["projectTypeId"])
    .index("by_projectType_order", ["projectTypeId", "order"]),
});

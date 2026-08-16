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
    pinHash: v.optional(v.string()),
    pinSetAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["roleId"])
    .index("by_pinHash", ["pinHash"]),

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
    // Stan kalkulatora konfiguratora (override cen grup, własne pozycje, stawka VAT)
    calculator: v.optional(v.any()),
    notes: v.optional(v.string()),
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
    archived: v.optional(v.boolean()),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_status", ["quoteId", "status"])
    .index("by_archived", ["archived"]),

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

  orderActivity: defineTable({
    orderId: v.id("orders"),
    type: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    authorId: v.union(v.id("users"), v.null()),
    authorName: v.string(),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_order_created", ["orderId", "createdAt"]),

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
    // Powiązanie ze zleceniem (terminy zlecenia = wydarzenia kalendarza)
    orderId: v.optional(v.id("orders")),
    quoteId: v.optional(v.id("quotes")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_createdBy", ["createdBy"])
    .index("by_createdBy_date", ["createdBy", "date"])
    .index("by_order", ["orderId"]),

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

  quoteVersions: defineTable({
    quoteId: v.id("quotes"),
    versionNumber: v.number(),
    // source: "ocr" = from SharePoint PDF, "manual" = manual calculator
    source: v.union(v.literal("ocr"), v.literal("manual")),
    // true = wersja generowana z konfiguratora (kalkulator); upsertowana
    isConfigurator: v.optional(v.boolean()),
    // For OCR versions
    fileItemId: v.optional(v.string()),
    fileName: v.optional(v.string()),
    // Display title, e.g. "Wersja z pliku: Oferta_V2.pdf"
    title: v.string(),
    // Financials
    valueNetto: v.number(),
    valueVat: v.number(),
    valueBrutto: v.number(),
    vatRate: v.number(), // e.g. 23 for 23%
    // Line items
    items: v.array(
      v.object({
        lp: v.number(),
        description: v.string(),
        quantity: v.union(v.number(), v.null()),
        unit: v.optional(v.string()),
        priceNetto: v.union(v.number(), v.null()),
        valueNetto: v.union(v.number(), v.null()),
      }),
    ),
    // Additional structured data from OCR (supplier, scope, etc.)
    additionalData: v.optional(v.any()),
    // Version notes
    notes: v.optional(v.string()),
    // Status
    status: v.union(
      v.literal("draft"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_quote", ["quoteId"])
    .index("by_quote_status", ["quoteId", "status"])
    .index("by_quote_file", ["quoteId", "fileItemId"]),

  // ─── Configurator structure (source of truth for CRM + website) ──────────────
  // Produkty konfiguratora (Pergola, Zadaszenia). Na razie bez dodawania nowych z UI.
  configuratorProducts: defineTable({
    slug: v.string(), // "pergola" | "zadaszenia"
    name: v.string(), // "Pergola"
    order: v.number(),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  // Generyczne pola produktu (rodzaj, wymiary, kolory, oświetlenie, dodatki…)
  configuratorFields: defineTable({
    productId: v.id("configuratorProducts"),
    key: v.string(), // stabilny klucz zgodny z JSON konfiguracji, np. "rodzajPergoli"
    label: v.string(),
    type: v.union(
      v.literal("select"), // pojedynczy wybór
      v.literal("multiselect"), // wielokrotny wybór (np. dodatki, zabudowy zadaszeń)
      v.literal("number"),
      v.literal("dimensions"), // złożenie kilku liczb (szer × wysięg × wys)
      v.literal("color"), // wybór koloru (opcje ze swatchem)
    ),
    section: v.string(), // grupa wyświetlania, np. "Podstawowe", "Oświetlenie"
    order: v.number(),
    isRequired: v.boolean(),
    isActive: v.boolean(),
    // Konfiguracja zależna od typu (np. subFields dla dimensions, unit, group dla oświetlenia)
    config: v.optional(v.any()),
    // Zależność: pokaż pole tylko gdy inne pole = wartość (Faza 2)
    visibleWhen: v.optional(v.object({ fieldKey: v.string(), equals: v.string() })),
  })
    .index("by_product", ["productId"])
    .index("by_product_order", ["productId", "order"]),

  // Opcje pól wyboru; parentOptionId pozwala na pod-opcje / warianty (np. wariant zależny od typu)
  configuratorOptions: defineTable({
    fieldId: v.id("configuratorFields"),
    parentOptionId: v.optional(v.id("configuratorOptions")),
    key: v.string(),
    label: v.string(),
    order: v.number(),
    isActive: v.boolean(),
    price: v.optional(v.number()), // Faza 2
    swatch: v.optional(v.string()), // kolor (oklch/hex) dla pól color
    group: v.optional(v.string()), // grupa koloru: standard/nonstandard/decor
    imageId: v.optional(v.id("_storage")), // Faza 3 (zdjęcia/ikony)
  })
    .index("by_field", ["fieldId"])
    .index("by_field_order", ["fieldId", "order"])
    .index("by_parent", ["parentOptionId"]),

  // Tracks SharePoint webhook subscriptions per drive/folder
  sharepointWebhookSubscriptions: defineTable({
    subscriptionId: v.string(),
    driveId: v.string(),
    // itemId of the folder being watched (quote's subfolderItemId)
    itemId: v.string(),
    quoteId: v.id("quotes"),
    expirationDateTime: v.string(), // ISO string
    createdAt: v.number(),
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_quote", ["quoteId"]),

  orders: defineTable({
    quoteId: v.optional(v.id("quotes")),
    quoteVersionId: v.optional(v.id("quoteVersions")),
    orderNumber: v.string(), // np. ZL/2026/0001
    projectType: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("nowe"),
      v.literal("akceptacja"),
      v.literal("kompletacja"),
      v.literal("produkcja"),
      v.literal("montaz"),
      v.literal("gotowe"),
      v.literal("wstrzymane")
    ),
    clientId: v.optional(v.id("clients")),
    investment: v.optional(
      v.object({
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
    valueNetto: v.number(),
    valueVat: v.number(),
    valueBrutto: v.number(),
    vatRate: v.number(),
    items: v.array(
      v.object({
        lp: v.number(),
        description: v.string(),
        quantity: v.union(v.number(), v.null()),
        unit: v.optional(v.string()),
        priceNetto: v.union(v.number(), v.null()),
        valueNetto: v.union(v.number(), v.null()),
      })
    ),
    clientName: v.string(),
    clientEmail: v.optional(v.string()),
    clientPhone: v.optional(v.string()),
    deadline: v.optional(v.string()), // Termin realizacji w formacie YYYY-MM-DD
    deliveryDate: v.optional(v.string()), // Data dostawy YYYY-MM-DD
    acceptanceDate: v.optional(v.string()), // Data akceptacji YYYY-MM-DD
    ownerId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    sharepoint: v.optional(
      v.object({
        parentFolderItemId: v.optional(v.string()),
        subfolderItemId: v.optional(v.string()),
        driveId: v.optional(v.string()),
        webUrl: v.optional(v.string()),
        status: v.union(v.literal("pending"), v.literal("created"), v.literal("failed")),
        error: v.optional(v.string()),
        attempts: v.number(),
        lastTriedAt: v.number(),
      })
    ),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_quote", ["quoteId"])
    .index("by_client", ["clientId"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_archived", ["archived"]),

  orderCounters: defineTable({
    year: v.number(),
    seq: v.number(),
  }).index("by_year", ["year"]),

  systemSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});

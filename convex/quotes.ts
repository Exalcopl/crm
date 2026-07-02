import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizePhone } from "./_lib/phone";
import type { Id } from "./_generated/dataModel";

const STATUS_VALUES = v.union(
  v.literal("Do zrobienia"),
  v.literal("Kontakt z klientem"),
  v.literal("Pomiary i uzgodnienia"),
  v.literal("Zrobione"),
);

const PROJECT_TYPE_VALUE = v.string();

const CONTACT_VALUE = v.object({
  name: v.string(),
  street: v.optional(v.string()),
  postalCity: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  nip: v.optional(v.string()),
  clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
  contactPerson: v.optional(v.string()),
});

const GLOBAL_COUNTER_KEY = 0;

function formatQuoteCode(args: {
  typeCode: string;
  createdAt: number;
  seq: number;
}): string {
  const { typeCode, createdAt, seq } = args;
  const d = new Date(createdAt);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seqStr = String(seq).padStart(3, "0");
  return `${typeCode}-${yy}${mm}${seqStr}${dd}`;
}

function buildTypeCode(
  projectTypeNames: string[],
  codeByName: Map<string, string>,
): string {
  const code = projectTypeNames
    .map((n) => (codeByName.get(n) ?? "").trim().toUpperCase())
    .filter(Boolean)
    .join("");
  return code || "XX";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: any },
  projectTypeNames: string[],
  createdAt: number,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTypes: any[] = await ctx.db.query("projectTypes").collect();
  const codeByName = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allTypes.map((t: any) => [t.name as string, t.categoryCode as string]),
  );
  const typeCode = buildTypeCode(projectTypeNames, codeByName);

  const counter = await ctx.db
    .query("quoteCounters")
    .withIndex("by_year", (q: { eq: (field: string, val: number) => unknown }) =>
      q.eq("year", GLOBAL_COUNTER_KEY),
    )
    .first();

  let seq: number;
  if (!counter) {
    seq = 1;
    await ctx.db.insert("quoteCounters", { year: GLOBAL_COUNTER_KEY, seq });
  } else {
    seq = counter.seq + 1;
    await ctx.db.patch(counter._id, { seq });
  }

  return formatQuoteCode({ typeCode, createdAt, seq });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClientQuote(doc: any) {
  return { ...doc, id: doc.code as string };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("quotes")
      .order("desc")
      .collect();
    return docs
      .filter((d) => d.archived !== true)
      .map(toClientQuote);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("quotes")
      .order("desc")
      .collect();
    return docs
      .filter((d) => d.archived === true)
      .map(toClientQuote);
  },
});

export const get = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    return toClientQuote(doc);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const doc = await ctx.db
      .query("quotes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!doc) return null;
    return toClientQuote(doc);
  },
});

export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const docs = await ctx.db
      .query("quotes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    return docs
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(toClientQuote);
  },
});

export const create = mutation({
  args: {
    contact: CONTACT_VALUE,
    value: v.union(v.number(), v.null()),
    status: STATUS_VALUES,
    deadline: v.string(),
    projectType: v.array(PROJECT_TYPE_VALUE),
    ownerId: v.union(v.id("users"), v.null()),
    configuration: v.optional(v.any()),
    investment: v.optional(
      v.object({
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
    customLabel: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: {
      contact: { name: string; street?: string; postalCity?: string; phone?: string; email?: string };
      value: number | null;
      status: string;
      deadline: string;
      projectType: string[];
      ownerId: Id<"users"> | null;
      configuration?: unknown;
      investment?: {
        address?: string;
        placeId?: string;
        lat?: number;
        lng?: number;
        notes?: string;
      };
      customLabel?: string;
    },
  ): Promise<{ _id: Id<"quotes">; code: string }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const createdAt = Date.now();
    const code = await generateCode(ctx, args.projectType, createdAt);
    const clientId = await ctx.runMutation(internal.clients.getOrCreate, {
      contact: args.contact,
    });

    const quoteId: Id<"quotes"> = await ctx.db.insert("quotes", {
      code,
      clientId,
      contact: args.contact,
      value: args.value,
      status: args.status as "Do zrobienia" | "Kontakt z klientem" | "Pomiary i uzgodnienia" | "Zrobione",
      deadline: args.deadline,
      projectType: args.projectType,
      ownerId: args.ownerId,
      archived: false,
      source: "admin",
      configuration: args.configuration ?? undefined,
      customLabel: args.customLabel,
      investment: args.investment
        ? {
            address: args.investment.address?.trim() || undefined,
            placeId: args.investment.placeId,
            lat: args.investment.lat,
            lng: args.investment.lng,
            notes: args.investment.notes?.trim() || undefined,
          }
        : undefined,
    });

    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId,
    });

    return { _id: quoteId, code };
  },
});

const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const PUBLIC_RATE_LIMIT_MAX = 3;
const PUBLIC_UPLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function generateUploadToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fingerprintFor(phone: string | undefined, email: string | undefined): string {
  const p = normalizePhone(phone);
  if (p) return `p:${p}`;
  const e = (email ?? "").trim().toLowerCase();
  if (e) return `e:${e}`;
  return "anon";
}

const PUBLIC_ANSWER_VALUE = v.object({
  questionId: v.id("projectTypeQuestions"),
  textValue: v.optional(v.string()),
  booleanValue: v.optional(v.boolean()),
  numberValue: v.optional(v.number()),
  numberUnit: v.optional(v.string()),
});

/* ── Lead API (website integration) ────────────────────────────── */

export const createFromLead = internalMutation({
  args: {
    contact: CONTACT_VALUE,
    projectType: v.string(),
    description: v.optional(v.string()),
    configuration: v.optional(v.any()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ code: string; quoteId: Id<"quotes">; uploadToken: string }> => {
    const contactName = args.contact.name.trim();
    if (!contactName) throw new Error("Podaj nazwę lub firmę");

    const phone = args.contact.phone?.trim() || undefined;
    const email = args.contact.email?.trim() || undefined;
    if (!phone && !email) {
      throw new Error("Podaj telefon lub e-mail");
    }

    // Walidacja typu projektu
    const allTypes = await ctx.db.query("projectTypes").collect();
    const typeDoc = allTypes.find(
      (t) => t.name === args.projectType && t.isActive,
    );
    if (!typeDoc) {
      throw new Error(`Nieznany lub nieaktywny typ projektu: ${args.projectType}`);
    }

    // Rate limiting
    const fp = fingerprintFor(phone, email);
    const since = Date.now() - PUBLIC_RATE_LIMIT_WINDOW_MS;
    const recent = await ctx.db
      .query("publicSubmissionAttempts")
      .withIndex("by_ip_createdAt", (q) => q.eq("ip", fp).gte("createdAt", since))
      .collect();
    const isTest = (email && (email.includes("test") || email.endsWith("@example.com"))) || 
                   (phone && phone.includes("000000"));
    if (recent.length >= PUBLIC_RATE_LIMIT_MAX && !isTest) {
      throw new Error(
        "Otrzymaliśmy już Twoje zapytanie. Spróbuj ponownie za godzinę lub zadzwoń do nas.",
      );
    }
    await ctx.db.insert("publicSubmissionAttempts", {
      ip: fp,
      createdAt: Date.now(),
    });

    // Klient — deduplikacja
    const contact = { name: contactName, phone, email };
    const clientId = await ctx.runMutation(internal.clients.getOrCreate, {
      contact,
    });

    // Wycena
    const createdAt = Date.now();
    const projectTypeArr = [args.projectType];
    const code = await generateCode(ctx, projectTypeArr, createdAt);

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 14);
    const deadline = deadlineDate.toISOString().slice(0, 10);

    const uploadToken = generateUploadToken();

    const quoteId: Id<"quotes"> = await ctx.db.insert("quotes", {
      code,
      clientId,
      contact,
      value: null,
      status: "Do zrobienia",
      deadline,
      projectType: projectTypeArr,
      ownerId: null,
      archived: false,
      source: "public",
      configuration: args.configuration ?? undefined,
      publicUploadToken: uploadToken,
      publicUploadTokenExpiresAt: createdAt + PUBLIC_UPLOAD_TOKEN_TTL_MS,
    });

    // Notatka z opisem od klienta
    const description = args.description?.trim();
    if (description) {
      await ctx.db.insert("quoteNotes", {
        quoteId,
        text: description,
        authorId: null,
        authorName: contactName,
        createdAt,
      });
    }

    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId,
    });

    // Log do aktywności
    await ctx.db.insert("quoteActivity", {
      quoteId,
      type: "quote_created",
      title: "Wycena utworzona z konfiguratora",
      detail: args.configuration
        ? `Typ: ${args.projectType}`
        : undefined,
      authorId: null,
      authorName: contactName,
      createdAt,
    });

    return { code, quoteId, uploadToken };
  },
});

export const createPublic = mutation({
  args: {
    contact: CONTACT_VALUE,
    projectType: v.array(PROJECT_TYPE_VALUE),
    investment: v.optional(
      v.object({
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
    deadline: v.optional(v.string()),
    description: v.optional(v.string()),
    answers: v.array(PUBLIC_ANSWER_VALUE),
    // honeypot — niewidoczne pole; jeśli wypełnione → bot
    website: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ code: string; quoteId: Id<"quotes">; uploadToken: string }> => {
    // honeypot — udajemy sukces żeby nie informować bota
    if (args.website && args.website.trim().length > 0) {
      return {
        code: "WC-0000-000",
        quoteId: "honeypot" as unknown as Id<"quotes">,
        uploadToken: "blocked",
      };
    }

    const contactName = args.contact.name.trim();
    if (!contactName) throw new Error("Podaj nazwę lub firmę");

    const phone = args.contact.phone?.trim() || undefined;
    const email = args.contact.email?.trim() || undefined;
    if (!phone && !email) {
      throw new Error("Podaj telefon lub e-mail");
    }

    if (args.projectType.length === 0) {
      throw new Error("Wybierz przynajmniej jeden typ projektu");
    }

    // rate-limit po fingerprint (telefon / email)
    const fp = fingerprintFor(phone, email);
    const since = Date.now() - PUBLIC_RATE_LIMIT_WINDOW_MS;
    const recent = await ctx.db
      .query("publicSubmissionAttempts")
      .withIndex("by_ip_createdAt", (q) => q.eq("ip", fp).gte("createdAt", since))
      .collect();
    const isTest = (email && (email.includes("test") || email.endsWith("@example.com"))) || 
                   (phone && phone.includes("000000"));
    if (recent.length >= PUBLIC_RATE_LIMIT_MAX && !isTest) {
      throw new Error(
        "Otrzymaliśmy już Twoje zapytanie. Spróbuj ponownie za godzinę lub zadzwoń do nas.",
      );
    }
    await ctx.db.insert("publicSubmissionAttempts", {
      ip: fp,
      createdAt: Date.now(),
    });

    // Walidacja pytań pomocniczych (isRequired)
    const allTypes = await ctx.db.query("projectTypes").collect();
    const typesByName = new Map(allTypes.map((t) => [t.name, t]));
    const requestedTypeIds = new Set<string>();
    for (const name of args.projectType) {
      const t = typesByName.get(name);
      if (!t) throw new Error(`Nieznany typ projektu: ${name}`);
      if (!t.isActive) throw new Error(`Typ projektu "${name}" jest nieaktywny`);
      requestedTypeIds.add(t._id as unknown as string);
    }

    const answeredQuestionIds = new Set(
      args.answers.map((a) => a.questionId as unknown as string),
    );

    for (const typeIdStr of requestedTypeIds) {
      const typeId = typeIdStr as unknown as Id<"projectTypes">;
      const questions = await ctx.db
        .query("projectTypeQuestions")
        .withIndex("by_projectType", (q) => q.eq("projectTypeId", typeId))
        .collect();
      for (const q of questions) {
        if (!q.isActive || !q.isRequired) continue;
        if (!answeredQuestionIds.has(q._id as unknown as string)) {
          throw new Error(`Brakuje odpowiedzi na pytanie: "${q.text}"`);
        }
      }
    }

    const contact = {
      name: contactName,
      street: args.contact.street?.trim() || undefined,
      postalCity: args.contact.postalCity?.trim() || undefined,
      phone,
      email,
      nip: args.contact.nip?.trim() || undefined,
      clientType: args.contact.clientType || "individual",
      contactPerson: args.contact.contactPerson?.trim() || undefined,
    };

    const createdAt = Date.now();
    const code = await generateCode(ctx, args.projectType, createdAt);
    const clientId = await ctx.runMutation(internal.clients.getOrCreate, {
      contact,
    });

    const deadline =
      args.deadline && /^\d{4}-\d{2}-\d{2}$/.test(args.deadline)
        ? args.deadline
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 14);
            return d.toISOString().slice(0, 10);
          })();

    const uploadToken = generateUploadToken();

    const quoteId: Id<"quotes"> = await ctx.db.insert("quotes", {
      code,
      clientId,
      contact,
      value: null,
      status: "Do zrobienia",
      deadline,
      projectType: args.projectType,
      ownerId: null,
      archived: false,
      source: "public",
      publicUploadToken: uploadToken,
      publicUploadTokenExpiresAt: createdAt + PUBLIC_UPLOAD_TOKEN_TTL_MS,
      investment: args.investment
        ? {
            address: args.investment.address?.trim() || undefined,
            placeId: args.investment.placeId,
            lat: args.investment.lat,
            lng: args.investment.lng,
            notes: args.investment.notes?.trim() || undefined,
          }
        : undefined,
    });

    // Pytania pomocnicze
    for (const a of args.answers) {
      const question = await ctx.db.get(a.questionId);
      if (!question) continue;
      if (!requestedTypeIds.has(question.projectTypeId as unknown as string)) continue;
      const isEmpty =
        a.textValue === undefined &&
        a.booleanValue === undefined &&
        a.numberValue === undefined;
      if (isEmpty) continue;
      await ctx.db.insert("quoteAnswers", {
        quoteId,
        questionId: a.questionId,
        projectTypeId: question.projectTypeId,
        textValue: question.answerType === "text" ? a.textValue : undefined,
        booleanValue:
          question.answerType === "boolean" ? a.booleanValue : undefined,
        numberValue:
          question.answerType === "number" ? a.numberValue : undefined,
        numberUnit:
          question.answerType === "number" ? a.numberUnit : undefined,
        updatedAt: createdAt,
      });
    }

    // Notatka z opisem od klienta
    const description = args.description?.trim();
    if (description) {
      await ctx.db.insert("quoteNotes", {
        quoteId,
        text: description,
        authorId: null,
        authorName: contactName,
        createdAt,
      });
    }

    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId,
    });

    return { code, quoteId, uploadToken };
  },
});

export const getPublicStatus = query({
  args: { quoteId: v.id("quotes"), token: v.string() },
  handler: async (
    ctx,
    { quoteId, token },
  ): Promise<{
    code: string;
    sharepointStatus: "pending" | "created" | "failed" | null;
  } | null> => {
    const quote = await ctx.db.get(quoteId);
    if (!quote) return null;
    if (!quote.publicUploadToken || quote.publicUploadToken !== token) {
      return null;
    }
    if (
      quote.publicUploadTokenExpiresAt &&
      quote.publicUploadTokenExpiresAt < Date.now()
    ) {
      return null;
    }
    return {
      code: quote.code,
      sharepointStatus: quote.sharepoint?.status ?? null,
    };
  },
});

export const _getForPublicUpload = internalQuery({
  args: { quoteId: v.id("quotes"), token: v.string() },
  handler: async (ctx, { quoteId, token }) => {
    const quote = await ctx.db.get(quoteId);
    if (!quote) return null;
    if (!quote.publicUploadToken || quote.publicUploadToken !== token) {
      return null;
    }
    if (
      quote.publicUploadTokenExpiresAt &&
      quote.publicUploadTokenExpiresAt < Date.now()
    ) {
      return null;
    }
    return quote;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("quotes"),
    status: STATUS_VALUES,
  },
  handler: async (ctx, { id, status }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { status });
  },
});

export const setOwner = mutation({
  args: {
    id: v.id("quotes"),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { id, ownerId }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { ownerId, ownerLegacy: undefined });
  },
});

export const setInvestment = mutation({
  args: {
    id: v.id("quotes"),
    investment: v.union(
      v.object({
        name: v.optional(v.string()),
        address: v.optional(v.string()),
        placeId: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
      v.null(),
    ),
  },
  handler: async (ctx, { id, investment }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    if (investment === null) {
      await ctx.db.patch(id, { investment: undefined });
      return;
    }
    const trim = (s?: string) => (s?.trim() ? s.trim() : undefined);
    await ctx.db.patch(id, {
      investment: {
        name: trim(investment.name),
        address: trim(investment.address),
        placeId: trim(investment.placeId),
        lat: investment.lat,
        lng: investment.lng,
        notes: trim(investment.notes),
      },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { archived: true });
  },
});

export const restore = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    await ctx.db.patch(id, { archived: false });
  },
});

export const remove = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const notes = await ctx.db
      .query("quoteNotes")
      .withIndex("by_quote", (q) => q.eq("quoteId", id))
      .collect();
    await Promise.all(notes.map((n) => ctx.db.delete(n._id)));
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_quote", (q) => q.eq("quoteId", id))
      .collect();
    await Promise.all(tasks.map((t) => ctx.db.delete(t._id)));
    await ctx.db.delete(id);
    await ctx.scheduler.runAfter(0, internal.sharepoint.deleteQuoteFolders, {
      quoteId: id,
    });
  },
});

export const retrySharepoint = mutation({
  args: { id: v.id("quotes") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const quote = await ctx.db.get(id);
    if (!quote) throw new Error("Wycena nie istnieje");
    await ctx.scheduler.runAfter(0, internal.sharepoint.createFolderForQuote, {
      quoteId: id,
    });
  },
});

export const _attachSharepoint = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    parentFolderItemId: v.string(),
    subfolderItemId: v.string(),
    driveId: v.string(),
    webUrl: v.string(),
  },
  handler: async (ctx, { quoteId, parentFolderItemId, subfolderItemId, driveId, webUrl }) => {
    await ctx.db.patch(quoteId, {
      sharepoint: {
        parentFolderItemId,
        subfolderItemId,
        driveId,
        webUrl,
        status: "created",
        attempts: 1,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _markSharepointFailed = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    error: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, { quoteId, error, attempts }) => {
    await ctx.db.patch(quoteId, {
      sharepoint: {
        webUrl: "",
        driveId: "",
        status: "failed",
        error,
        attempts,
        lastTriedAt: Date.now(),
      },
    });
  },
});

export const _getInternal = internalQuery({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    return await ctx.db.get(quoteId);
  },
});

export const _getAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("quotes").collect();
  },
});

export const _clearSharepoint = internalMutation({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    await ctx.db.patch(quoteId, { sharepoint: undefined });
  },
});

export const migrateCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oldCounters = await ctx.db.query("quoteCounters").collect();
    for (const c of oldCounters) {
      await ctx.db.delete(c._id);
    }

    const allTypes = await ctx.db.query("projectTypes").collect();
    const codeByName = new Map<string, string>(
      allTypes.map((t) => [t.name, t.categoryCode]),
    );

    const quotes = (await ctx.db.query("quotes").collect()).sort(
      (a, b) => a._creationTime - b._creationTime,
    );

    let seq = 0;
    for (const q of quotes) {
      seq += 1;
      const typeCode = buildTypeCode(q.projectType, codeByName);
      const newCode = formatQuoteCode({
        typeCode,
        createdAt: q._creationTime,
        seq,
      });
      await ctx.db.patch(q._id, { code: newCode });
    }

    await ctx.db.insert("quoteCounters", {
      year: GLOBAL_COUNTER_KEY,
      seq,
    });

    return { migrated: quotes.length, finalSeq: seq };
  },
});

export const seedInitialQuotes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("quotes").first();
    if (existing) return { skipped: true, count: 0 };

    const SEED_DATA = [
      { code: "WC-2026-0730", contact: { name: "ProBud Inwestycje" }, value: 642800, status: "Do zrobienia" as const, deadline: "2026-05-20", projectType: ["Zadaszenia" as const] },
      { code: "WC-2026-0732", contact: { name: "Lewandowski Development" }, value: null, status: "Do zrobienia" as const, deadline: "2026-05-25", projectType: ["Pergola" as const] },
      { code: "WC-2026-0721", contact: { name: "Vistula Dev." }, value: 384000, status: "Do zrobienia" as const, deadline: "2026-06-02", projectType: ["Pergola" as const] },
      { code: "WC-2026-0729", contact: { name: "Anna Kowalska" }, value: 92400, status: "Kontakt z klientem" as const, deadline: "2026-05-10", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0727", contact: { name: "Studio Architektury MW" }, value: 412000, status: "Kontakt z klientem" as const, deadline: "2026-05-09", projectType: ["Ogrodzenie" as const] },
      { code: "WC-2026-0731", contact: { name: "Marwit Sp. z o.o." }, value: 184200, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-15", projectType: ["Osłony okienne" as const] },
      { code: "WC-2026-0733", contact: { name: "Pawlak & Synowie" }, value: null, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-14", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0728", contact: { name: "Gmina Brzesko" }, value: 218600, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-12", projectType: ["Zadaszenia" as const] },
      { code: "WC-2026-0725", contact: { name: "Hotel Nadwiślański" }, value: 78400, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-18", projectType: ["Pergola" as const] },
      { code: "WC-2026-0718", contact: { name: "Bartolini S.A." }, value: 296400, status: "Pomiary i uzgodnienia" as const, deadline: "2026-05-22", projectType: ["Stolarka" as const] },
      { code: "WC-2026-0712", contact: { name: "Nowak Bud Sp.j." }, value: 488200, status: "Zrobione" as const, deadline: "2026-04-28", projectType: ["Ogrodzenie" as const] },
      { code: "WC-2026-0705", contact: { name: "Architekci Pracownia 7" }, value: 96400, status: "Zrobione" as const, deadline: "2026-04-22", projectType: ["Inne" as const] },
    ];

    let count = 0;
    for (const row of SEED_DATA) {
      await ctx.db.insert("quotes", {
        code: row.code,
        contact: row.contact,
        value: row.value,
        status: row.status,
        deadline: row.deadline,
        projectType: row.projectType,
        ownerId: null,
        ownerLegacy: undefined,
        archived: false,
      });
      count++;
    }

    const year = 2026;
    await ctx.db.insert("quoteCounters", { year, seq: 733 });

    return { skipped: false, count };
  },
});

export const updateConfiguration = mutation({
  args: {
    id: v.id("quotes"),
    configuration: v.any(),
    changeDetail: v.optional(v.string()),
  },
  handler: async (ctx, { id, configuration, changeDetail }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    await ctx.db.patch(id, { configuration });

    const user = await ctx.db.get(callerId);
    await ctx.db.insert("quoteActivity", {
      quoteId: id,
      type: "configuration_updated",
      title: "Konfiguracja zaktualizowana",
      detail: changeDetail,
      authorId: callerId,
      authorName: user?.name ?? user?.email ?? "Handlowiec",
      createdAt: Date.now(),
    });
  },
});

export const resetCounterToMax = mutation({
  args: {},
  handler: async (ctx): Promise<{ previousSeq: number; newSeq: number }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const quotes = await ctx.db.query("quotes").collect();

    let maxSeq = 0;
    for (const q of quotes) {
      if (q.archived) continue;
      if (!q.code) continue;
      const parts = q.code.split("-");
      if (parts.length < 2) continue;
      const numPart = parts[parts.length - 1];
      if (numPart.length >= 7) {
        const seqStr = numPart.slice(4, -2);
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }

    const counter = await ctx.db
      .query("quoteCounters")
      .withIndex("by_year", (q: any) => q.eq("year", GLOBAL_COUNTER_KEY))
      .first();

    const previousSeq = counter ? counter.seq : 0;

    if (!counter) {
      await ctx.db.insert("quoteCounters", { year: GLOBAL_COUNTER_KEY, seq: maxSeq });
    } else {
      await ctx.db.patch(counter._id, { seq: maxSeq });
    }

    return { previousSeq, newSeq: maxSeq };
  },
});

export const resetCounterToMaxInternal = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ previousSeq: number; newSeq: number }> => {
    const quotes = await ctx.db.query("quotes").collect();

    let maxSeq = 0;
    for (const q of quotes) {
      if (q.archived) continue;
      if (!q.code) continue;
      const parts = q.code.split("-");
      if (parts.length < 2) continue;
      const numPart = parts[parts.length - 1];
      if (numPart.length >= 7) {
        const seqStr = numPart.slice(4, -2);
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }

    const counter = await ctx.db
      .query("quoteCounters")
      .withIndex("by_year", (q: any) => q.eq("year", GLOBAL_COUNTER_KEY))
      .first();

    const previousSeq = counter ? counter.seq : 0;

    if (!counter) {
      await ctx.db.insert("quoteCounters", { year: GLOBAL_COUNTER_KEY, seq: maxSeq });
    } else {
      await ctx.db.patch(counter._id, { seq: maxSeq });
    }

    return { previousSeq, newSeq: maxSeq };
  },
});

export const resequenceActiveQuotes = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const quotes = await ctx.db.query("quotes").collect();
    const activeQuotes = quotes.filter((q: any) => !q.archived);

    activeQuotes.sort((a: any, b: any) => a._creationTime - b._creationTime);

    const allTypes = await ctx.db.query("projectTypes").collect();
    const codeByName = new Map<string, string>(
      allTypes.map((t: any) => [t.name as string, t.categoryCode as string]),
    );

    let seq = 1;
    for (const q of activeQuotes) {
      const typeCode = buildTypeCode(q.projectType, codeByName);
      const newCode = formatQuoteCode({
        typeCode,
        createdAt: q._creationTime,
        seq,
      });

      await ctx.db.patch(q._id, { code: newCode });
      seq++;
    }

    const maxSeq = activeQuotes.length;
    const counter = await ctx.db
      .query("quoteCounters")
      .withIndex("by_year", (q: any) => q.eq("year", GLOBAL_COUNTER_KEY))
      .first();

    if (!counter) {
      await ctx.db.insert("quoteCounters", { year: GLOBAL_COUNTER_KEY, seq: maxSeq });
    } else {
      await ctx.db.patch(counter._id, { seq: maxSeq });
    }

    return { count: maxSeq };
  },
});

export const resequenceActiveQuotesInternal = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const quotes = await ctx.db.query("quotes").collect();
    const activeQuotes = quotes.filter((q: any) => !q.archived);

    activeQuotes.sort((a: any, b: any) => a._creationTime - b._creationTime);

    const allTypes = await ctx.db.query("projectTypes").collect();
    const codeByName = new Map<string, string>(
      allTypes.map((t: any) => [t.name as string, t.categoryCode as string]),
    );

    let seq = 1;
    for (const q of activeQuotes) {
      const typeCode = buildTypeCode(q.projectType, codeByName);
      const newCode = formatQuoteCode({
        typeCode,
        createdAt: q._creationTime,
        seq,
      });

      await ctx.db.patch(q._id, { code: newCode });
      seq++;
    }

    const maxSeq = activeQuotes.length;
    const counter = await ctx.db
      .query("quoteCounters")
      .withIndex("by_year", (q: any) => q.eq("year", GLOBAL_COUNTER_KEY))
      .first();

    if (!counter) {
      await ctx.db.insert("quoteCounters", { year: GLOBAL_COUNTER_KEY, seq: maxSeq });
    } else {
      await ctx.db.patch(counter._id, { seq: maxSeq });
    }

    return { count: maxSeq };
  },
});

export const updateCustomLabel = mutation({
  args: {
    id: v.id("quotes"),
    customLabel: v.optional(v.string()),
  },
  handler: async (ctx, { id, customLabel }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    await ctx.db.patch(id, { customLabel: customLabel?.trim() || undefined });

    const user = await ctx.db.get(callerId);
    await ctx.db.insert("quoteActivity", {
      quoteId: id,
      type: "custom_label_updated",
      title: "Tekst własny zaktualizowana",
      detail: customLabel?.trim() || "Wyczyszczono tekst własny",
      authorId: callerId,
      authorName: user?.name ?? user?.email ?? "Handlowiec",
      createdAt: Date.now(),
    });
  },
});

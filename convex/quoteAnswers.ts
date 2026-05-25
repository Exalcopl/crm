import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const answerTypeValidator = v.union(
  v.literal("text"),
  v.literal("boolean"),
  v.literal("number"),
);

type AnswerType = "text" | "boolean" | "number";

export const listByQuote = query({
  args: { quoteId: v.id("quotes") },
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.db.get(quoteId);
    if (!quote) return { groups: [], answers: {} as Record<string, unknown> };

    const types = await ctx.db.query("projectTypes").collect();
    const typesByName = new Map(types.map((t) => [t.name, t]));

    const groups: Array<{
      projectType: {
        _id: Id<"projectTypes">;
        name: string;
        color: string;
        categoryCode: string;
      };
      questions: Array<{
        _id: Id<"projectTypeQuestions">;
        text: string;
        answerType: AnswerType;
        units?: string[];
        isRequired: boolean;
        order: number;
      }>;
    }> = [];

    for (const name of quote.projectType) {
      const t = typesByName.get(name);
      if (!t) continue;
      const questions = await ctx.db
        .query("projectTypeQuestions")
        .withIndex("by_projectType", (q) => q.eq("projectTypeId", t._id))
        .collect();
      const active = questions
        .filter((q) => q.isActive)
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          _id: q._id,
          text: q.text,
          answerType: q.answerType as AnswerType,
          units: q.units,
          isRequired: q.isRequired,
          order: q.order,
        }));
      if (active.length === 0) continue;
      groups.push({
        projectType: {
          _id: t._id,
          name: t.name,
          color: t.color,
          categoryCode: t.categoryCode,
        },
        questions: active,
      });
    }

    const allAnswers = await ctx.db
      .query("quoteAnswers")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    const answers: Record<
      string,
      {
        _id: Id<"quoteAnswers">;
        textValue?: string;
        booleanValue?: boolean;
        numberValue?: number;
        numberUnit?: string;
      }
    > = {};
    for (const a of allAnswers) {
      answers[a.questionId as unknown as string] = {
        _id: a._id,
        textValue: a.textValue,
        booleanValue: a.booleanValue,
        numberValue: a.numberValue,
        numberUnit: a.numberUnit,
      };
    }

    return { groups, answers };
  },
});

export const upsert = mutation({
  args: {
    quoteId: v.id("quotes"),
    questionId: v.id("projectTypeQuestions"),
    answerType: answerTypeValidator,
    textValue: v.optional(v.string()),
    booleanValue: v.optional(v.boolean()),
    numberValue: v.optional(v.number()),
    numberUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Pytanie nie istnieje");
    if (question.answerType !== args.answerType) {
      throw new Error("Typ odpowiedzi nie pasuje do pytania");
    }

    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new Error("Wycena nie istnieje");

    const existing = await ctx.db
      .query("quoteAnswers")
      .withIndex("by_quote_question", (q) =>
        q.eq("quoteId", args.quoteId).eq("questionId", args.questionId),
      )
      .first();

    const payload = {
      textValue: args.answerType === "text" ? args.textValue : undefined,
      booleanValue:
        args.answerType === "boolean" ? args.booleanValue : undefined,
      numberValue: args.answerType === "number" ? args.numberValue : undefined,
      numberUnit: args.answerType === "number" ? args.numberUnit : undefined,
      updatedAt: Date.now(),
    };

    const isEmpty =
      payload.textValue === undefined &&
      payload.booleanValue === undefined &&
      payload.numberValue === undefined &&
      payload.numberUnit === undefined;

    if (existing) {
      if (isEmpty) {
        await ctx.db.delete(existing._id);
        return null;
      }
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    if (isEmpty) return null;

    return await ctx.db.insert("quoteAnswers", {
      quoteId: args.quoteId,
      questionId: args.questionId,
      projectTypeId: question.projectTypeId,
      ...payload,
    });
  },
});

export const countForRemovedTypes = query({
  args: {
    quoteId: v.id("quotes"),
    keepProjectTypeNames: v.array(v.string()),
  },
  handler: async (ctx, { quoteId, keepProjectTypeNames }) => {
    const types = await ctx.db.query("projectTypes").collect();
    const keepIds = new Set(
      types
        .filter((t) => keepProjectTypeNames.includes(t.name))
        .map((t) => t._id as unknown as string),
    );
    const answers = await ctx.db
      .query("quoteAnswers")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    return answers.filter(
      (a) => !keepIds.has(a.projectTypeId as unknown as string),
    ).length;
  },
});

export const removeAnswersForRemovedTypes = mutation({
  args: {
    quoteId: v.id("quotes"),
    keepProjectTypeNames: v.array(v.string()),
  },
  handler: async (ctx, { quoteId, keepProjectTypeNames }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const types = await ctx.db.query("projectTypes").collect();
    const keepIds = new Set(
      types
        .filter((t) => keepProjectTypeNames.includes(t.name))
        .map((t) => t._id as unknown as string),
    );
    const answers = await ctx.db
      .query("quoteAnswers")
      .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
      .collect();
    let removed = 0;
    for (const a of answers) {
      if (!keepIds.has(a.projectTypeId as unknown as string)) {
        await ctx.db.delete(a._id);
        removed++;
      }
    }
    return removed;
  },
});

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

type AnswerType = "text" | "boolean" | "number";

const answerTypeValidator = v.union(
  v.literal("text"),
  v.literal("boolean"),
  v.literal("number"),
);

function sanitizeUnits(answerType: AnswerType, units?: string[]) {
  if (answerType !== "number") return undefined;
  if (!units) return [];
  const cleaned = units
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .map((u) => u.slice(0, 16));
  const dedup: string[] = [];
  for (const u of cleaned) {
    if (!dedup.includes(u)) dedup.push(u);
  }
  return dedup;
}

export const listByType = query({
  args: { projectTypeId: v.id("projectTypes") },
  handler: async (ctx, { projectTypeId }) => {
    const items = await ctx.db
      .query("projectTypeQuestions")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", projectTypeId))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

export const listActiveByTypes = query({
  args: { projectTypeIds: v.array(v.id("projectTypes")) },
  handler: async (ctx, { projectTypeIds }) => {
    if (projectTypeIds.length === 0) return [];
    const out: Array<{
      _id: import("./_generated/dataModel").Id<"projectTypeQuestions">;
      projectTypeId: import("./_generated/dataModel").Id<"projectTypes">;
      text: string;
      answerType: AnswerType;
      units?: string[];
      isRequired: boolean;
      isActive: boolean;
      order: number;
    }> = [];
    for (const id of projectTypeIds) {
      const items = await ctx.db
        .query("projectTypeQuestions")
        .withIndex("by_projectType", (q) => q.eq("projectTypeId", id))
        .collect();
      for (const it of items) {
        if (!it.isActive) continue;
        out.push({
          _id: it._id,
          projectTypeId: it.projectTypeId,
          text: it.text,
          answerType: it.answerType as AnswerType,
          units: it.units,
          isRequired: it.isRequired,
          isActive: it.isActive,
          order: it.order,
        });
      }
    }
    return out.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    projectTypeId: v.id("projectTypes"),
    text: v.string(),
    answerType: answerTypeValidator,
    units: v.optional(v.array(v.string())),
    isRequired: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const text = args.text.trim();
    if (!text) throw new Error("Treść pytania nie może być pusta");

    const type = await ctx.db.get(args.projectTypeId);
    if (!type) throw new Error("Typ projektu nie istnieje");

    const existing = await ctx.db
      .query("projectTypeQuestions")
      .withIndex("by_projectType", (q) =>
        q.eq("projectTypeId", args.projectTypeId),
      )
      .collect();
    const maxOrder = existing.reduce((m, q) => Math.max(m, q.order), -1);

    return await ctx.db.insert("projectTypeQuestions", {
      projectTypeId: args.projectTypeId,
      text,
      answerType: args.answerType,
      units: sanitizeUnits(args.answerType, args.units),
      isRequired: args.isRequired,
      isActive: args.isActive,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projectTypeQuestions"),
    text: v.string(),
    answerType: answerTypeValidator,
    units: v.optional(v.array(v.string())),
    isRequired: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, { id, ...fields }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const text = fields.text.trim();
    if (!text) throw new Error("Treść pytania nie może być pusta");

    const current = await ctx.db.get(id);
    if (!current) throw new Error("Pytanie nie istnieje");

    const newUnits = sanitizeUnits(fields.answerType, fields.units);

    await ctx.db.patch(id, {
      text,
      answerType: fields.answerType,
      units: newUnits,
      isRequired: fields.isRequired,
      isActive: fields.isActive,
    });

    if (
      current.answerType !== fields.answerType ||
      JSON.stringify(current.units ?? []) !== JSON.stringify(newUnits ?? [])
    ) {
      const answers = await ctx.db
        .query("quoteAnswers")
        .withIndex("by_question", (q) => q.eq("questionId", id))
        .collect();
      for (const a of answers) {
        const patch: Partial<{
          textValue: string | undefined;
          booleanValue: boolean | undefined;
          numberValue: number | undefined;
          numberUnit: string | undefined;
        }> = {};
        if (current.answerType !== fields.answerType) {
          if (current.answerType === "text") patch.textValue = undefined;
          if (current.answerType === "boolean") patch.booleanValue = undefined;
          if (current.answerType === "number") {
            patch.numberValue = undefined;
            patch.numberUnit = undefined;
          }
        } else if (
          fields.answerType === "number" &&
          a.numberUnit &&
          !(newUnits ?? []).includes(a.numberUnit)
        ) {
          patch.numberUnit = undefined;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(a._id, { ...patch, updatedAt: Date.now() });
        }
      }
    }
  },
});

export const toggleActive = mutation({
  args: { id: v.id("projectTypeQuestions") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const q = await ctx.db.get(id);
    if (!q) throw new Error("Pytanie nie istnieje");
    await ctx.db.patch(id, { isActive: !q.isActive });
  },
});

export const move = mutation({
  args: {
    id: v.id("projectTypeQuestions"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { id, direction }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Pytanie nie istnieje");

    const siblings = await ctx.db
      .query("projectTypeQuestions")
      .withIndex("by_projectType", (q) =>
        q.eq("projectTypeId", current.projectTypeId),
      )
      .collect();
    siblings.sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s._id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await ctx.db.patch(current._id, { order: other.order });
    await ctx.db.patch(other._id, { order: current.order });
  },
});

export const remove = mutation({
  args: { id: v.id("projectTypeQuestions") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    const q = await ctx.db.get(id);
    if (!q) throw new Error("Pytanie nie istnieje");

    const answers = await ctx.db
      .query("quoteAnswers")
      .withIndex("by_question", (qa) => qa.eq("questionId", id))
      .collect();
    for (const a of answers) await ctx.db.delete(a._id);

    await ctx.db.delete(id);
  },
});

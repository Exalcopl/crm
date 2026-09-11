import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Pobiera listę zapisanych szablonów checklist */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("checklistTemplates").collect();
  },
});

/** Zapisuje bieżący zestaw list jako szablon */
export const saveTemplate = mutation({
  args: {
    name: v.string(),
    lists: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        color: v.string(),
        items: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            checked: v.boolean(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { name, lists }) => {
    const id = await ctx.db.insert("checklistTemplates", {
      name,
      lists,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Usuwa szablon o podanym ID */
export const removeTemplate = mutation({
  args: { id: v.id("checklistTemplates") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/** Test weryfikacyjny operacji na własnych checklistach i szablonach */
export const testCustomChecklists = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Stwórz testowy szablon
    const templateId = await ctx.db.insert("checklistTemplates", {
      name: "Testowy Szablon Wyceny",
      lists: [
        {
          id: "list_test_1",
          title: "Analiza Techniczna",
          color: "#3b82f6",
          items: [{ id: "item_1", label: "Sprawdzono profil", checked: true }],
        },
      ],
      createdAt: Date.now(),
    });

    // 2. Pobierz i zweryfikuj szablon
    const fetched = await ctx.db.get(templateId);
    if (!fetched || fetched.name !== "Testowy Szablon Wyceny") {
      throw new Error("Błąd weryfikacji szablonu: nie znaleziono lub błędna nazwa");
    }

    // 3. Posprzątaj po teście
    await ctx.db.delete(templateId);

    return "SUCCESS: Custom checklists schema & template read/write test passed!";
  },
});

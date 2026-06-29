import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Generate upload URL - requires auth
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");
    return await ctx.storage.generateUploadUrl();
  },
});

// Add image after upload - requires auth
// Takes storageId, projectTypeId, fileName, contentType
// Auto-assigns order = max existing order + 1
export const addImage = mutation({
  args: {
    projectTypeId: v.id("projectTypes"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const type = await ctx.db.get(args.projectTypeId);
    if (!type) throw new Error("Typ projektu nie istnieje");

    // Find max order
    const existing = await ctx.db
      .query("projectTypeGalleryImages")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", args.projectTypeId))
      .collect();
    const maxOrder = existing.reduce((max, img) => Math.max(max, img.order), 0);

    return await ctx.db.insert("projectTypeGalleryImages", {
      projectTypeId: args.projectTypeId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      order: maxOrder + 1,
      uploadedAt: Date.now(),
    });
  },
});

// Remove image - requires auth, deletes from storage too
export const removeImage = mutation({
  args: { id: v.id("projectTypeGalleryImages") },
  handler: async (ctx, { id }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    const image = await ctx.db.get(id);
    if (!image) throw new Error("Zdjęcie nie istnieje");

    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(id);
  },
});

// Reorder images - receives array of image IDs in desired order
export const reorderImages = mutation({
  args: {
    projectTypeId: v.id("projectTypes"),
    imageIds: v.array(v.id("projectTypeGalleryImages")),
  },
  handler: async (ctx, { projectTypeId, imageIds }) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Brak autoryzacji");

    for (let i = 0; i < imageIds.length; i++) {
      await ctx.db.patch(imageIds[i], { order: i + 1 });
    }
  },
});

// List images for admin panel - requires auth, includes URLs
export const listByType = query({
  args: { projectTypeId: v.id("projectTypes") },
  handler: async (ctx, { projectTypeId }) => {
    const images = await ctx.db
      .query("projectTypeGalleryImages")
      .withIndex("by_projectType_order", (q) => q.eq("projectTypeId", projectTypeId))
      .collect();

    const result = [];
    for (const img of images) {
      const url = await ctx.storage.getUrl(img.storageId);
      result.push({ ...img, url });
    }
    return result.sort((a, b) => a.order - b.order);
  },
});

// Internal query for HTTP endpoint - no auth
export const listByTypeNameInternal = internalQuery({
  args: { typeName: v.string() },
  handler: async (ctx, { typeName }) => {
    // Find project type by name (case-insensitive by comparing lowercased)
    const allTypes = await ctx.db.query("projectTypes").collect();
    const projectType = allTypes.find(
      (t) => t.name.toLowerCase() === typeName.toLowerCase()
    );
    if (!projectType) return null;

    const images = await ctx.db
      .query("projectTypeGalleryImages")
      .withIndex("by_projectType_order", (q) => q.eq("projectTypeId", projectType._id))
      .collect();

    const sortedImages = images.sort((a, b) => a.order - b.order);

    const result = [];
    for (const img of sortedImages) {
      const url = await ctx.storage.getUrl(img.storageId);
      if (url) {
        result.push({
          url,
          order: img.order,
          fileName: img.fileName,
        });
      }
    }

    return {
      typeName: projectType.name,
      typeColor: projectType.color,
      images: result,
    };
  },
});

// Count images per type - for the types list page
export const countByType = query({
  args: { projectTypeId: v.id("projectTypes") },
  handler: async (ctx, { projectTypeId }) => {
    const images = await ctx.db
      .query("projectTypeGalleryImages")
      .withIndex("by_projectType", (q) => q.eq("projectTypeId", projectTypeId))
      .collect();
    return images.length;
  },
});

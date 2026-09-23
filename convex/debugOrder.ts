import { v } from "convex/values";
import { query } from "./_generated/server";

export const getOrder = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return { error: "Order not found" };
    
    let partner = null;
    if (order.partnerId) {
      partner = await ctx.db.get(order.partnerId);
    }
    
    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      partnerId: order.partnerId,
      partner: partner ? {
        id: partner._id,
        isActive: partner.isActive,
        webhookUrl: partner.webhookUrl,
      } : null,
    };
  }
});

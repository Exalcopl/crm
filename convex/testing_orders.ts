import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateCode } from "./quotes";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const testCreateStandalone = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"orders">> => {
    console.log("[test] Tworzenie samodzielnego zlecenia testowego...");

    const contact = {
      name: "Firma Testowa Sp. z o.o.",
      email: "test@exalco.pl",
      phone: "123456789",
    };

    const projectType = ["Standard"];
    const createdAt = Date.now();
    const orderNumber = await generateCode(ctx as any, projectType, createdAt);
    
    const clientId: Id<"clients"> = await ctx.runMutation(internal.clients.getOrCreate, {
      contact,
    });

    const orderId: Id<"orders"> = await ctx.db.insert("orders", {
      orderNumber,
      status: "nowe",
      clientId,
      projectType,
      valueNetto: 1000,
      valueVat: 230,
      valueBrutto: 1230,
      vatRate: 23,
      items: [
        { lp: 1, description: "Konstrukcje aluminiowe", quantity: 1, unit: "kpl", priceNetto: 1000, valueNetto: 1000 }
      ],
      clientName: contact.name,
      clientEmail: contact.email,
      clientPhone: contact.phone,
      deadline: "2026-12-31",
      deliveryDate: "2026-12-20",
      acceptanceDate: "2026-12-15",
      createdAt,
      sharepoint: {
        status: "pending",
        attempts: 0,
        lastTriedAt: 0,
      }
    });

    console.log(`[test] Zlecenie utworzone pomyślnie. ID: ${orderId}, Numer: ${orderNumber}`);
    return orderId;
  },
});

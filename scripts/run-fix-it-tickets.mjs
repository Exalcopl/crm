import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("http://127.0.0.1:3210");

async function main() {
  console.log("Running fixUnflaggedItTickets...");
  try {
    const count = await client.mutation(api.tasks.fixUnflaggedItTickets, {});
    console.log(`Fixed ${count} unflagged IT tickets in DB.`);
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main();

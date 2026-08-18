import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("http://127.0.0.1:3210");

async function main() {
  console.log("Running IT Ticket verification test...");
  try {
    const result = await client.mutation(api.testing_it_tickets.testItTicketFlow, {});
    console.log("TEST RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("TEST FAILED:", err.message || err);
    process.exit(1);
  }
}

main();

import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission } from "./permissions";

export type SearchEntityType = "wyceny" | "zlecenia";

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  details?: string;
  status?: {
    label: string;
    variant: "default" | "success" | "warning" | "info" | "secondary" | "danger";
  };
  url: string;
  updatedAt?: number;
  score: number;
  snippet?: string;
  sharepointWebUrl?: string;
}

const POLISH_CHAR_MAP: Record<string, string> = {
  ą: "a", Ą: "a",
  ć: "c", Ć: "c",
  ę: "e", Ę: "e",
  ł: "l", Ł: "l",
  ń: "n", Ń: "n",
  ó: "o", Ó: "o",
  ś: "s", Ś: "s",
  ź: "z", Ź: "z",
  ż: "z", Ż: "z",
};

export function normalizeText(text: string): string {
  if (!text) return "";
  const str = text.toLowerCase();
  let normalized = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    normalized += POLISH_CHAR_MAP[char] || char;
  }
  return normalized;
}

export function normalizeDigitsOnly(text: string): string {
  if (!text) return "";
  return text.replace(/\D/g, "");
}

function calculateScore(
  queryNorm: string,
  digitsNorm: string,
  fields: { text: string; weight: number; isDigits?: boolean }[]
): { score: number; snippet?: string } {
  let totalScore = 0;
  let bestSnippet: string | undefined = undefined;

  for (const field of fields) {
    if (!field.text) continue;
    const fieldNorm = normalizeText(field.text);

    // Exact match
    if (fieldNorm === queryNorm) {
      totalScore += field.weight * 10;
      if (!bestSnippet) bestSnippet = field.text;
    }
    // Starts with match
    else if (fieldNorm.startsWith(queryNorm)) {
      totalScore += field.weight * 5;
      if (!bestSnippet) bestSnippet = field.text;
    }
    // Includes match
    else if (fieldNorm.includes(queryNorm)) {
      totalScore += field.weight * 2;
      if (!bestSnippet) bestSnippet = field.text;
    }

    // Check digit matching for phones / NIP / postal codes
    if (field.isDigits && digitsNorm.length >= 3) {
      const fieldDigits = normalizeDigitsOnly(field.text);
      if (fieldDigits.includes(digitsNorm)) {
        totalScore += field.weight * 4;
        if (!bestSnippet) bestSnippet = field.text;
      }
    }
  }

  return { score: totalScore, snippet: bestSnippet };
}

function getQuoteStatusVariant(
  status: string
): "default" | "success" | "warning" | "info" | "secondary" | "danger" {
  switch (status) {
    case "Zrobione":
      return "success";
    case "Pomiary i uzgodnienia":
      return "info";
    case "Kontakt z klientem":
      return "warning";
    case "Do zrobienia":
    default:
      return "secondary";
  }
}

function getOrderStatusVariant(
  status: string
): "default" | "success" | "warning" | "info" | "secondary" | "danger" {
  switch (status) {
    case "gotowe":
      return "success";
    case "produkcja":
    case "montaz":
      return "info";
    case "akceptacja":
    case "kompletacja":
      return "warning";
    case "wstrzymane":
      return "danger";
    case "nowe":
    default:
      return "secondary";
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export const querySearch = query({
  args: {
    query: v.string(),
    types: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const rawQuery = args.query.trim();
    if (!rawQuery) {
      return [];
    }

    // Check permissions
    const canReadQuotes = await hasPermission(ctx, "wyceny", "read");
    if (!canReadQuotes) {
      return [];
    }

    // Check prefix filtering e.g. "w: pergola" or "z: 2026"
    let searchTypes: string[] = args.types ?? ["wyceny", "zlecenia"];
    let cleanQuery = rawQuery;

    if (rawQuery.toLowerCase().startsWith("w:")) {
      searchTypes = ["wyceny"];
      cleanQuery = rawQuery.slice(2).trim();
    } else if (rawQuery.toLowerCase().startsWith("z:")) {
      searchTypes = ["zlecenia"];
      cleanQuery = rawQuery.slice(2).trim();
    }

    if (!cleanQuery) {
      return [];
    }

    const queryNorm = normalizeText(cleanQuery);
    const digitsNorm = normalizeDigitsOnly(cleanQuery);
    const maxLimit = args.limit ?? 20;

    const results: SearchResultItem[] = [];

    // 1. Search Quotes
    if (searchTypes.includes("wyceny")) {
      const quotes = await ctx.db.query("quotes").collect();
      const activeQuotes = quotes.filter((q) => !q.archived);

      for (const q of activeQuotes) {
        const fields = [
          { text: q.code, weight: 10 },
          { text: q.customLabel ?? "", weight: 8 },
          { text: q.contact?.name ?? "", weight: 9 },
          { text: q.contact?.phone ?? "", weight: 7, isDigits: true },
          { text: q.contact?.email ?? "", weight: 7 },
          { text: q.contact?.nip ?? "", weight: 7, isDigits: true },
          { text: q.contact?.contactPerson ?? "", weight: 6 },
          { text: q.investment?.name ?? "", weight: 5 },
          { text: q.investment?.address ?? "", weight: 5 },
          { text: q.notes ?? "", weight: 3 },
        ];

        const { score, snippet } = calculateScore(queryNorm, digitsNorm, fields);

        if (score > 0) {
          const clientName = q.contact?.name ?? "Brak klienta";
          const cityOrAddr = q.contact?.postalCity || q.investment?.address || "";
          const valStr = formatCurrency(q.value);

          results.push({
            id: q._id,
            type: "wyceny",
            title: q.code + (q.customLabel ? ` (${q.customLabel})` : ""),
            subtitle: clientName + (cityOrAddr ? ` • ${cityOrAddr}` : ""),
            details: valStr ? `Wartość: ${valStr}` : undefined,
            status: {
              label: q.status,
              variant: getQuoteStatusVariant(q.status),
            },
            url: `/admin/wyceny?id=${q._id}`,
            score,
            snippet,
            sharepointWebUrl: q.sharepoint?.webUrl,
          });
        }
      }
    }

    // 2. Search Orders
    if (searchTypes.includes("zlecenia")) {
      const orders = await ctx.db.query("orders").collect();
      const activeOrders = orders.filter((o) => !o.archived);

      for (const o of activeOrders) {
        const itemsText = (o.items || [])
          .map((item) => item.description)
          .join(" ");

        const fields = [
          { text: o.orderNumber, weight: 10 },
          { text: o.customLabel ?? "", weight: 8 },
          { text: o.clientName ?? "", weight: 9 },
          { text: o.clientPhone ?? "", weight: 7, isDigits: true },
          { text: o.clientEmail ?? "", weight: 7 },
          { text: o.investment?.address ?? "", weight: 5 },
          { text: o.notes ?? "", weight: 3 },
          { text: itemsText, weight: 4 },
        ];

        const { score, snippet } = calculateScore(queryNorm, digitsNorm, fields);

        if (score > 0) {
          const clientName = o.clientName || "Brak klienta";
          const addr = o.investment?.address || "";
          const valStr = formatCurrency(o.valueBrutto);

          results.push({
            id: o._id,
            type: "zlecenia",
            title: o.orderNumber + (o.customLabel ? ` (${o.customLabel})` : ""),
            subtitle: clientName + (addr ? ` • ${addr}` : ""),
            details: valStr ? `Wartość: ${valStr} brutto` : undefined,
            status: {
              label: o.status,
              variant: getOrderStatusVariant(o.status),
            },
            url: `/admin/zlecenia?id=${o._id}`,
            score,
            snippet,
            sharepointWebUrl: o.sharepoint?.webUrl,
          });
        }
      }
    }

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxLimit);
  },
});

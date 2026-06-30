import type { Id } from "@/convex/_generated/dataModel";

export type SharepointInfo = {
  webUrl: string;
  driveId: string;
  parentFolderItemId?: string;
  subfolderItemId?: string;
  status: "pending" | "created" | "failed";
  error?: string;
  attempts: number;
  lastTriedAt: number;
};

export type QuoteStatus =
  | "Do zrobienia"
  | "Kontakt z klientem"
  | "Pomiary i uzgodnienia"
  | "Zrobione";

export type ProjectType = string;

export type ContactInfo = {
  name: string;
  street?: string;
  postalCity?: string;
  phone?: string;
  email?: string;
};

export type InvestmentInfo = {
  name?: string;
  address?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  notes?: string;
};

export type Quote = {
  _id: Id<"quotes">;
  /** Kod wyświetlany, np. WC-2026-0730 */
  id: string;
  contact: ContactInfo;
  investment?: InvestmentInfo;
  value: number | null;
  status: QuoteStatus;
  deadline: string;
  projectType: ProjectType[];
  ownerId: Id<"users"> | null;
  /** Legacy snapshot — wpisy sprzed migracji owner→ownerId. Tylko do odczytu. */
  ownerLegacy?: string;
  archived?: boolean;
  sharepoint?: SharepointInfo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuration?: any;
};

export const QUOTE_STATUSES: QuoteStatus[] = [
  "Do zrobienia",
  "Kontakt z klientem",
  "Pomiary i uzgodnienia",
  "Zrobione",
];

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  "Do zrobienia": "#8b949e",
  "Kontakt z klientem": "#79c0ff",
  "Pomiary i uzgodnienia": "#79c0ff",
  Zrobione: "#3fb950",
};

const FALLBACK_TYPE_STYLE = {
  bg: "rgba(139,148,158,0.16)",
  fg: "#c9d1d9",
  border: "rgba(139,148,158,0.5)",
};

export function hexToTypeStyle(hex: string): { bg: string; fg: string; border: string } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return FALLBACK_TYPE_STYLE;
  return {
    bg: `rgba(${r},${g},${b},0.18)`,
    fg: hex,
    border: `rgba(${r},${g},${b},0.55)`,
  };
}

export function getProjectTypeStyle(
  types: Array<{ name: string; color: string }>,
  typeName: string,
): { bg: string; fg: string; border: string } {
  const found = types.find((t) => t.name === typeName);
  return found ? hexToTypeStyle(found.color) : FALLBACK_TYPE_STYLE;
}


const TODAY = new Date("2026-05-11");

export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

export function deadlineTone(iso: string): "overdue" | "soon" | "ok" {
  const d = new Date(iso);
  const diff = Math.round((d.getTime() - TODAY.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "soon";
  return "ok";
}

export function deadlineDaysFromToday(iso: string): number {
  const d = new Date(iso);
  return Math.round((d.getTime() - TODAY.getTime()) / 86_400_000);
}

export function ownerInitials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";
}


import type { Id } from "@/convex/_generated/dataModel";

export type SharepointInfo = {
  folderId: string;
  driveId: string;
  itemId: string;
  webUrl: string;
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

export type ProjectType =
  | "Zadaszenia"
  | "Pergola"
  | "Stolarka"
  | "Ogrodzenie"
  | "Osłony okienne"
  | "Inne";

export type ContactInfo = {
  name: string;
  street?: string;
  postalCity?: string;
  phone?: string;
  email?: string;
};

export type Quote = {
  _id: Id<"quotes">;
  /** Kod wyświetlany, np. WC-2026-0730 */
  id: string;
  contact: ContactInfo;
  value: number | null;
  status: QuoteStatus;
  deadline: string;
  projectType: ProjectType[];
  ownerId: Id<"users"> | null;
  /** Legacy snapshot — wpisy sprzed migracji owner→ownerId. Tylko do odczytu. */
  ownerLegacy?: string;
  archived?: boolean;
  sharepoint?: SharepointInfo;
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

export const PROJECT_TYPE_STYLES: Record<
  ProjectType,
  { bg: string; fg: string; border: string }
> = {
  Zadaszenia: { bg: "rgba(56, 139, 253, 0.18)", fg: "#79c0ff", border: "rgba(56, 139, 253, 0.55)" },
  Pergola: { bg: "rgba(63, 185, 80, 0.18)", fg: "#56d364", border: "rgba(63, 185, 80, 0.55)" },
  Stolarka: { bg: "rgba(255, 166, 87, 0.18)", fg: "#ffa657", border: "rgba(255, 166, 87, 0.55)" },
  Ogrodzenie: { bg: "rgba(188, 140, 255, 0.18)", fg: "#d2a8ff", border: "rgba(188, 140, 255, 0.55)" },
  "Osłony okienne": { bg: "rgba(57, 211, 191, 0.18)", fg: "#56d4c1", border: "rgba(57, 211, 191, 0.55)" },
  Inne: { bg: "rgba(139, 148, 158, 0.16)", fg: "#c9d1d9", border: "rgba(139, 148, 158, 0.5)" },
};


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


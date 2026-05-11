export type QuoteStatus =
  | "Do zrobienia"
  | "Kontakt z klientem"
  | "Pomiary"
  | "Szykowanie produkcji"
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
  id: string;
  contact: ContactInfo;
  value: number | null;
  status: QuoteStatus;
  deadline: string;
  projectType: ProjectType;
  owner: string;
};

export const QUOTE_STATUSES: QuoteStatus[] = [
  "Do zrobienia",
  "Kontakt z klientem",
  "Pomiary",
  "Szykowanie produkcji",
  "Zrobione",
];

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  "Do zrobienia": "#8b949e",
  "Kontakt z klientem": "#79c0ff",
  Pomiary: "#79c0ff",
  "Szykowanie produkcji": "#ffa657",
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

export const INITIAL_QUOTES: Quote[] = [
  { id: "WC-2026-0730", contact: { name: "ProBud Inwestycje" }, value: 642800, status: "Do zrobienia", deadline: "2026-05-20", projectType: "Zadaszenia", owner: "Adam Borowski" },
  { id: "WC-2026-0732", contact: { name: "Lewandowski Development" }, value: null, status: "Do zrobienia", deadline: "2026-05-25", projectType: "Pergola", owner: "Adam Borowski" },
  { id: "WC-2026-0721", contact: { name: "Vistula Dev." }, value: 384000, status: "Do zrobienia", deadline: "2026-06-02", projectType: "Pergola", owner: "Joanna Krawczyk" },
  { id: "WC-2026-0729", contact: { name: "Anna Kowalska" }, value: 92400, status: "Kontakt z klientem", deadline: "2026-05-10", projectType: "Stolarka", owner: "Marek Wiśniewski" },
  { id: "WC-2026-0727", contact: { name: "Studio Architektury MW" }, value: 412000, status: "Kontakt z klientem", deadline: "2026-05-09", projectType: "Ogrodzenie", owner: "Ewa Bielecka" },
  { id: "WC-2026-0731", contact: { name: "Marwit Sp. z o.o." }, value: 184200, status: "Pomiary", deadline: "2026-05-15", projectType: "Osłony okienne", owner: "Joanna Krawczyk" },
  { id: "WC-2026-0733", contact: { name: "Pawlak & Synowie" }, value: null, status: "Pomiary", deadline: "2026-05-14", projectType: "Stolarka", owner: "Ewa Bielecka" },
  { id: "WC-2026-0728", contact: { name: "Gmina Brzesko" }, value: 218600, status: "Pomiary", deadline: "2026-05-12", projectType: "Zadaszenia", owner: "Adam Borowski" },
  { id: "WC-2026-0725", contact: { name: "Hotel Nadwiślański" }, value: 78400, status: "Szykowanie produkcji", deadline: "2026-05-18", projectType: "Pergola", owner: "Marek Wiśniewski" },
  { id: "WC-2026-0718", contact: { name: "Bartolini S.A." }, value: 296400, status: "Szykowanie produkcji", deadline: "2026-05-22", projectType: "Stolarka", owner: "Joanna Krawczyk" },
  { id: "WC-2026-0712", contact: { name: "Nowak Bud Sp.j." }, value: 488200, status: "Zrobione", deadline: "2026-04-28", projectType: "Ogrodzenie", owner: "Ewa Bielecka" },
  { id: "WC-2026-0705", contact: { name: "Architekci Pracownia 7" }, value: 96400, status: "Zrobione", deadline: "2026-04-22", projectType: "Inne", owner: "Adam Borowski" },
];

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

export function ownerInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function findQuote(id: string): Quote | undefined {
  return INITIAL_QUOTES.find((q) => q.id === id);
}

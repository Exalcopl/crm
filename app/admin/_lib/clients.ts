export type Client = {
  id: string;
  name: string;
  street?: string;
  postalCity?: string;
  phone?: string;
  email?: string;
};

export const INITIAL_CLIENTS: Client[] = [];

export function nextClientId(clients: Client[]): string {
  const used = clients
    .map((c) => {
      const m = /^KL-(\d+)$/.exec(c.id);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1;
  return `KL-${String(next).padStart(4, "0")}`;
}

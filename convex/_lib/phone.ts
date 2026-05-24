export function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return undefined;
  return digits.slice(-9);
}

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const USER_PALETTE = [
  "#d41d3c", // Czerwony
  "#3b82f6", // Niebieski
  "#22a06b", // Zielony
  "#d97706", // Pomarańczowy
  "#8b5cf6", // Fioletowy
  "#06b6d4", // Turkusowy
];

export function getUserColor(userId?: string): string {
  if (!userId) return USER_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return USER_PALETTE[hash % USER_PALETTE.length];
}

export function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

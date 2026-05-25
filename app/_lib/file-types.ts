export const ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "dwg",
  "dxf",
] as const;

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_FILES = 10;

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

export function isImage(nameOrMime: string): boolean {
  if (nameOrMime.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(getExtension(nameOrMime));
}

export function isPdf(nameOrMime: string): boolean {
  if (nameOrMime === "application/pdf") return true;
  return getExtension(nameOrMime) === "pdf";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileValidationError =
  | { kind: "tooLarge"; name: string }
  | { kind: "badType"; name: string }
  | { kind: "tooMany"; count: number };

export function validateFiles(
  existingCount: number,
  incoming: File[],
  opts: { maxFiles?: number; maxSizeBytes?: number } = {},
): { accepted: File[]; errors: FileValidationError[] } {
  const maxFiles = opts.maxFiles ?? MAX_FILES;
  const maxSize = opts.maxSizeBytes ?? MAX_FILE_BYTES;
  const errors: FileValidationError[] = [];
  const accepted: File[] = [];

  const allowed = new Set<string>(ALLOWED_EXTENSIONS as readonly string[]);

  for (const f of incoming) {
    if (f.size > maxSize) {
      errors.push({ kind: "tooLarge", name: f.name });
      continue;
    }
    const ext = getExtension(f.name);
    if (!allowed.has(ext)) {
      errors.push({ kind: "badType", name: f.name });
      continue;
    }
    accepted.push(f);
  }

  const room = maxFiles - existingCount;
  if (accepted.length > room) {
    errors.push({ kind: "tooMany", count: accepted.length - Math.max(0, room) });
    return { accepted: accepted.slice(0, Math.max(0, room)), errors };
  }

  return { accepted, errors };
}

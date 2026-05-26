const COVER_COLORS = [
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
] as const;

export const collectionCoverShellClassName =
  "rounded-[2px] ring-1 ring-white/10";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function collectionCoverColor(name: string): string {
  return COVER_COLORS[hashString(name) % COVER_COLORS.length]!;
}

export function collectionCoverInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

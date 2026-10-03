export interface CommunityTheme {
  id: string;
  name: string;
  author: string;
  mode: "dark" | "light";
  colors: { dark: Record<string, string>; light: Record<string, string> };
  createdAt?: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizePalette(p: unknown): Record<string, string> | null {
  if (!p || typeof p !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (typeof v === "string" && HEX_RE.test(v)) out[k] = v.toLowerCase();
  }
  return Object.keys(out).length > 0 ? out : null;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Validate + normalize a raw theme payload; returns null if unusable. */
export function sanitizeTheme(raw: unknown): CommunityTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const name = typeof t.name === "string" ? t.name.trim().slice(0, 40) : "";
  const author =
    typeof t.author === "string" ? t.author.trim().slice(0, 24) : "";
  if (!name || !author) return null;

  const colors = t.colors as Record<string, unknown> | undefined;
  const dark = sanitizePalette(colors?.dark);
  const light = sanitizePalette(colors?.light);
  if (!dark && !light) return null;

  const id =
    typeof t.id === "string" && t.id.trim()
      ? t.id.trim().slice(0, 64)
      : `${slug(name)}-${Date.now().toString(36)}`;

  return {
    id,
    name,
    author,
    mode: t.mode === "light" ? "light" : "dark",
    colors: { dark: dark ?? {}, light: light ?? {} },
    createdAt: typeof t.createdAt === "number" ? t.createdAt : undefined,
  };
}
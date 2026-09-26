export interface MergeResult {
  apply: Record<string, unknown>;
  conflicts: string[];
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function normalize(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(sortValue(value));
  return String(value);
}

export function mergeSettings(
  base: Record<string, unknown> | null,
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): MergeResult {
  const apply: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  for (const key of keys) {
    const l = normalize(local[key]);
    const c = normalize(cloud[key]);
    if (l === c) continue;

    if (!base) {
      if (local[key] === undefined) apply[key] = cloud[key];
      continue;
    }

    const b = normalize(base[key]);
    const localChanged = l !== b;
    const cloudChanged = c !== b;

    if (!localChanged && cloudChanged) {
      apply[key] = cloud[key];
    } else if (localChanged && cloudChanged) {
      conflicts.push(key);
    }
  }

  return { apply, conflicts };
}

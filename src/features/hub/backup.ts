import { CONFIG_DEFAULT, type ConfigKey } from "../../config.ts";

/**
 * Keys that must never leave the browser in a backup file, nor be written
 * back from one: credentials, session state and caches.
 */
export const BACKUP_EXCLUDED_KEYS: ReadonlySet<string> = new Set<ConfigKey>([
  "CLOUD_TOKEN",
  "CLOUD_LOGIN",
  "CLOUD_AUTH_FAILED",
  "LAST_CLOUD_SYNC",
  "ACCOUNT",
  "CALENDAR_SYNC_TOKEN",
  "CALENDAR_EVENTS_HASH",
  "FRIENDS_DATA_CACHE",
  "GENERAL_FONT_FILE",
  "GENERAL_FONT_FILE_NAME",
]);

/**
 * Several UI paths store arrays as JSON strings (FRIENDS_LIST, SHORTCUTS_LINKS,
 * ACTIVE_SCRIPTS); getConfig() parses them back. Do the same here so that the
 * shape check below compares the real value.
 */
function parseLegacyJson(value: unknown): unknown {
  if (typeof value === "string" && /^\s*[\[{]/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function sameShape(value: unknown, reference: unknown): boolean {
  if (reference === null) {
    return value === null || typeof value === "object";
  }
  if (Array.isArray(reference)) return Array.isArray(value);
  return typeof value === typeof reference && !Array.isArray(value);
}

/**
 * Keep only known, non-sensitive settings from a raw storage dump.
 * Used when exporting.
 */
export function exportableSettings(
  items: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(items)) {
    if (!(key in CONFIG_DEFAULT)) continue;
    if (BACKUP_EXCLUDED_KEYS.has(key)) continue;
    out[key] = parseLegacyJson(value);
  }
  return out;
}

/**
 * Validate an imported backup before it is written to storage.
 * Unknown keys, sensitive keys and values whose type does not match the
 * default are dropped instead of being blindly persisted.
 *
 * @throws if the payload is not a plain object.
 */
export function sanitizeBackup(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Backup must be a JSON object");
  }
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (!(key in CONFIG_DEFAULT)) continue;
    if (BACKUP_EXCLUDED_KEYS.has(key)) continue;
    const value = parseLegacyJson(raw);
    const reference = CONFIG_DEFAULT[key as ConfigKey];
    if (!sameShape(value, reference)) continue;
    out[key] = value;
  }
  return out;
}

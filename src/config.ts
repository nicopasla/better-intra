/**
 * Manages all configuration for the Better Intra extension.
 * This file serves as the single source of truth for configuration keys,
 * their types, default values, and the logic for retrieving them from storage.
 */

/**
 * Defines the complete shape and types for all configuration options.
 * Using a strict interface ensures type safety across the application
 * and provides excellent autocompletion in the IDE.
 */
export interface BetterIntraConfig {
  // General Settings
  ACTIVE_SCRIPTS: string[];
  BETTER_INTRA_THEME: "dark" | "light" | "system";
  DISABLE_ANIMATIONS: boolean;

  // Cloud Sync Settings
  CLOUD_SYNC_ENABLED: boolean;
  LAST_CLOUD_SYNC: number | null;
  CLOUD_TOKEN: string;
  CLOUD_LOGIN: string;
  ACCOUNT: object | null; // Stores user account info from 42 API

  // Logtime Feature Settings
  LOGTIME_GOAL_HOURS: number;
  LOGTIME_SHOW_AVERAGE: boolean;
  LOGTIME_SHOW_GOAL: boolean;
  LOGTIME_SHOW_TACOS: boolean;
  LOGTIME_EMOJI: string;
  LOGTIME_EMOJI_DIVISOR: number;
  LOGTIME_EMOJI_RATE: number;
  LOGTIME_SHOW_DAYS_MODE: "date" | "days" | "both";
  LOGTIME_CALENDAR_COLOR: string;
  LOGTIME_LABELS_COLOR: string;

  // Clusters Feature Settings
  CLUSTERS_SHOW_MARKERS: boolean;
  CLUSTERS_DEFAULT_ID: string;

  // Profile Feature Settings
  PROFILE_CAMPUS_FILTER: string;
  PROFILE_EVENT_TYPE_FILTER: string;
  PROFILE_IMAGE_URL: string;
  PROFILE_BANNER_URL: string;
  PROFILE_BANNER_MODE: "fill" | "fit";
  PROFILE_BACKGROUND_URL: string;
  PROFILE_BACKGROUND_MODE: "fill" | "fit";
  PROFILE_SLOTS_REDIRECTION: boolean;
  PROFILE_ALT_LAYOUT: boolean;
  PROFILE_CARD_ORDER: string[];

  // Shortcuts Feature Settings
  SHORTCUTS_LINKS: { name: string; url: string }[];
}

/**
 * Provides the default values for every configuration key.
 * This object is used as a fallback if a value is not found in chrome.storage.local.
 * It must implement the BetterIntraConfig interface to ensure all keys have a default.
 */
export const CONFIG_DEFAULT: BetterIntraConfig = {
  ACTIVE_SCRIPTS: ["logtime", "clusters", "profile", "shortcuts", "account"],
  CLOUD_SYNC_ENABLED: false,
  LAST_CLOUD_SYNC: null,
  CLOUD_TOKEN: "",
  CLOUD_LOGIN: "",
  ACCOUNT: null,

  LOGTIME_GOAL_HOURS: 140,
  LOGTIME_SHOW_AVERAGE: true,
  LOGTIME_SHOW_GOAL: true,
  DISABLE_ANIMATIONS: false,
  LOGTIME_SHOW_TACOS: false,
  LOGTIME_EMOJI: "🌮",
  LOGTIME_EMOJI_DIVISOR: 8.7,
  LOGTIME_EMOJI_RATE: 2,
  LOGTIME_SHOW_DAYS_MODE: "date",
  LOGTIME_CALENDAR_COLOR: "#00BCBA",
  LOGTIME_LABELS_COLOR: "#26a641",

  CLUSTERS_SHOW_MARKERS: true,
  CLUSTERS_DEFAULT_ID: "",

  PROFILE_CAMPUS_FILTER: "all",
  PROFILE_EVENT_TYPE_FILTER: "all",
  PROFILE_IMAGE_URL: "",
  PROFILE_BANNER_URL: "",
  PROFILE_BANNER_MODE: "fill",
  PROFILE_BACKGROUND_URL: "",
  PROFILE_BACKGROUND_MODE: "fill",
  PROFILE_SLOTS_REDIRECTION: true,
  PROFILE_ALT_LAYOUT: false,
  PROFILE_CARD_ORDER: [
    "LOGTIME",
    "AGENDA",
    "EVALUATIONS",
    "ACHIEVEMENTS",
    "PROJECTS",
  ],

  BETTER_INTRA_THEME: "dark",
  SHORTCUTS_LINKS: [],
};

/**
 * A type representing all possible configuration keys, derived directly
 * from the BetterIntraConfig interface to prevent any mismatches.
 */
export type ConfigKey = keyof BetterIntraConfig;

/**
 * Asynchronously retrieves a configuration value from storage.
 *
 * This generic function is the primary way to access configuration throughout the extension.
 * It fetches the value for the given `key` from `chrome.storage.local`.
 * If the value is not found in storage, it returns the corresponding default value
 * from the `CONFIG_DEFAULT` object.
 *
 * It also includes a helpful feature to automatically parse stringified JSON
 * for values that are objects or arrays.
 *
 * @param key The configuration key to retrieve.
 * @returns A promise that resolves to the value of the requested configuration key,
 *          with the correct type inferred from the BetterIntraConfig interface.
 */
export const getConfig = async <T extends ConfigKey>(
  key: T,
): Promise<BetterIntraConfig[T]> => {
  // Attempt to get the value from browser storage.
  const res = await chrome.storage.local.get(key);

  // If a value exists in storage, use it; otherwise, fall back to the default.
  let value = res && res[key] !== undefined ? res[key] : CONFIG_DEFAULT[key];

  // For convenience, automatically try to parse string values that look like JSON.
  if (typeof value === "string") {
    try {
      if (value.startsWith("[") || value.startsWith("{")) {
        value = JSON.parse(value);
      }
    } catch {
      // If parsing fails, it's not valid JSON, so we just use the original string.
    }
  }

  // Return the final value, asserting its type to match the function's generic promise.
  return value as BetterIntraConfig[T];
};

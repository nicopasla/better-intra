import {
  getConfig,
  type CustomTheme,
  type CustomThemeEntry,
} from "../../../config.ts";
import { resolvePalette } from "./custom-theme.ts";
import { applyThemePreset } from "./theme-manager.ts";

const CUSTOMS_MAX = 60;

export async function getCustoms(): Promise<CustomThemeEntry[]> {
  return (await getConfig("PROFILE_THEME_CUSTOMS")) ?? [];
}

export async function getCustomById(
  id: string,
): Promise<CustomThemeEntry | undefined> {
  return (await getCustoms()).find((c) => c.id === id);
}

async function setCustoms(list: CustomThemeEntry[]): Promise<void> {
  await chrome.storage.local.set({
    PROFILE_THEME_CUSTOMS: list.slice(0, CUSTOMS_MAX),
  });
}

/** Resolve a built-in preset's full palette (both modes) to seed a new theme. */
export function seedColorsFromPreset(presetKey: string): CustomTheme {
  const base = presetKey === "custom" ? undefined : presetKey;
  return {
    dark: resolvePalette(undefined, true, base),
    light: resolvePalette(undefined, false, base),
  };
}

function newId(): string {
  return `mine-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function createCustom(
  name: string,
  colors: CustomTheme,
  author?: string,
  mode?: "dark" | "light",
): Promise<CustomThemeEntry> {
  const entry: CustomThemeEntry = { id: newId(), name, colors, author, mode };
  const list = await getCustoms();
  await setCustoms([entry, ...list]);
  return entry;
}

export async function upsertCustom(entry: CustomThemeEntry): Promise<void> {
  const list = await getCustoms();
  await setCustoms([entry, ...list.filter((c) => c.id !== entry.id)]);
}

export async function renameCustom(id: string, name: string): Promise<void> {
  const list = await getCustoms();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], name };
  await setCustoms(list);
}

export async function deleteCustom(id: string): Promise<void> {
  const list = await getCustoms();
  await setCustoms(list.filter((c) => c.id !== id));
  if ((await getConfig("PROFILE_THEME_PRESET")) === id) {
    await chrome.storage.local.set({ PROFILE_THEME_PRESET: "dark" });
    await applyThemePreset();
  }
}

/** Select a theme (built-in id or mine id) and apply it. */
export async function applyTheme(id: string): Promise<void> {
  await chrome.storage.local.set({ PROFILE_THEME_PRESET: id });
  await applyThemePreset();
}

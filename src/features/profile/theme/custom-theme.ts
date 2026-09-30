import { colord } from "colord";
import { contrastText } from "../../../utils/color.ts";
import type { CustomThemePalette } from "../../../config.ts";
import themesJson from "./themes.json";

type ModeVars = {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  popover: string;
  popoverForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
};

type ThemePreset = {
  primary: string;
  primaryForeground: string;
  ring: string;
  dark?: ModeVars;
  light?: ModeVars;
};

const THEMES = themesJson as Record<string, ThemePreset>;

export type CustomThemeRole = {
  id: string;
  label: string;
  desc: string;
  group: string;
  /** CSS custom properties this role drives (first one is the dedicated slot). */
  vars: string[];
};

export const CUSTOM_THEME_GROUPS = [
  "Backgrounds",
  "Text",
  "Accent",
  "Lines",
  "Surfaces",
] as const;

export const CUSTOM_THEME_ROLES: readonly CustomThemeRole[] = [
  {
    id: "page",
    label: "Page background",
    desc: "The main area behind everything.",
    group: "Backgrounds",
    vars: ["--background"],
  },
  {
    id: "header",
    label: "Header / top bar",
    desc: "The bar at the top with your picture and the search.",
    group: "Backgrounds",
    vars: ["--bi-header"],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    desc: "The left navigation column.",
    group: "Backgrounds",
    vars: ["--bi-sidebar"],
  },
  {
    id: "card",
    label: "Cards & panels",
    desc: "Profile cards, sections and boxes.",
    group: "Backgrounds",
    vars: ["--bi-card", "--card"],
  },
  {
    id: "input",
    label: "Search & inputs",
    desc: "Search bar, text fields and selects.",
    group: "Backgrounds",
    vars: ["--bi-input", "--input"],
  },
  {
    id: "popover",
    label: "Menus & popovers",
    desc: "Floating menus, tooltips and dialogs.",
    group: "Backgrounds",
    vars: ["--popover"],
  },
  {
    id: "text",
    label: "Text",
    desc: "Main text color across the page.",
    group: "Text",
    vars: [
      "--foreground",
      "--card-foreground",
      "--popover-foreground",
      "--accent-foreground",
    ],
  },
  {
    id: "textMuted",
    label: "Secondary text",
    desc: "Faded labels, dates and hints.",
    group: "Text",
    vars: ["--muted-foreground"],
  },
  {
    id: "accent",
    label: "Accent",
    desc: "Buttons, links and active highlights.",
    group: "Accent",
    vars: ["--primary", "--ring", "--legacy-main"],
  },
  {
    id: "accentText",
    label: "Text on accent",
    desc: "Text drawn on top of the accent color.",
    group: "Accent",
    vars: ["--primary-foreground"],
  },
  {
    id: "border",
    label: "Borders",
    desc: "Lines around cards, inputs and dividers.",
    group: "Lines",
    vars: ["--border"],
  },
  {
    id: "hover",
    label: "Hover & highlight",
    desc: "Background of hovered rows and selected items.",
    group: "Surfaces",
    vars: ["--muted", "--accent"],
  },
];

/** Which role draws from which variable of a preset/mode by default. */
const ROLE_SOURCE: Record<string, keyof ModeVars> = {
  page: "background",
  header: "background",
  sidebar: "card",
  card: "card",
  input: "input",
  popover: "popover",
  text: "foreground",
  textMuted: "mutedForeground",
  border: "border",
  hover: "muted",
};

function tripletToHex(triplet: string): string {
  return colord(`hsl(${triplet})`).toHex();
}

export function hexToTriplet(hex: string): string {
  const { h, s, l } = colord(hex).toHsl();
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function presetBase(
  presetKey: string | undefined,
  isDark: boolean,
): { mode: ModeVars; preset: ThemePreset } {
  const named =
    presetKey && presetKey !== "custom" ? THEMES[presetKey] : undefined;
  const preset = named || THEMES[isDark ? "dark" : "light"];
  const fallback = THEMES[isDark ? "dark" : "light"];
  const mode =
    (isDark ? preset.dark : preset.light) ??
    (isDark ? fallback.dark : fallback.light)!;
  return { mode, preset };
}

/**
 * Merge the user's stored hex colors over the defaults of a preset/mode,
 * returning a hex color for every role.
 */
export function resolvePalette(
  palette: CustomThemePalette | undefined,
  isDark: boolean,
  presetKey?: string,
): Record<string, string> {
  const { mode, preset } = presetBase(presetKey, isDark);
  const out: Record<string, string> = {};
  for (const role of CUSTOM_THEME_ROLES) {
    const stored = palette?.[role.id];
    if (stored && colord(stored).isValid()) {
      out[role.id] = colord(stored).toHex();
      continue;
    }
    if (role.id === "accent") {
      out[role.id] = tripletToHex(preset.primary);
    } else if (role.id === "accentText") {
      out[role.id] = tripletToHex(preset.primaryForeground);
    } else {
      out[role.id] = tripletToHex(mode[ROLE_SOURCE[role.id]]);
    }
  }
  return out;
}

/** `--var: H S% L% !important` declarations for the Intra page. */
export function buildIntraVars(
  palette: CustomThemePalette | undefined,
  isDark: boolean,
  presetKey?: string,
): string[] {
  const resolved = resolvePalette(palette, isDark, presetKey);
  const declarations: string[] = [];
  for (const role of CUSTOM_THEME_ROLES) {
    const value = hexToTriplet(resolved[role.id]);
    for (const variable of role.vars) {
      declarations.push(`${variable}: ${value} !important`);
    }
  }
  return declarations;
}

/** camelCase mode vars for the runtime `THEMES.custom` entry. */
export function modeVarsFromResolved(
  resolved: Record<string, string>,
): ModeVars {
  return {
    background: hexToTriplet(resolved.page),
    card: hexToTriplet(resolved.card),
    foreground: hexToTriplet(resolved.text),
    muted: hexToTriplet(resolved.hover),
    mutedForeground: hexToTriplet(resolved.textMuted),
    popover: hexToTriplet(resolved.popover),
    popoverForeground: hexToTriplet(resolved.text),
    accent: hexToTriplet(resolved.hover),
    accentForeground: hexToTriplet(resolved.text),
    border: hexToTriplet(resolved.border),
    input: hexToTriplet(resolved.input),
  };
}

/** Runtime `[data-theme="<name>"]` palette for Better Intra's own panels. */
export function buildDaisyThemeCss(
  palette: CustomThemePalette | undefined,
  isDark: boolean,
  presetKey?: string,
  themeName = "custom",
): string {
  const r = resolvePalette(palette, isDark, presetKey);
  return `[data-theme="${themeName}"] {
  color-scheme: ${isDark ? "dark" : "light"};
  --color-base-100: ${r.page};
  --color-base-200: ${r.card};
  --color-base-300: ${r.border};
  --color-base-content: ${r.text};
  --color-primary: ${r.accent};
  --color-primary-content: ${r.accentText};
  --color-secondary: ${r.hover};
  --color-secondary-content: ${r.text};
  --color-accent: ${r.hover};
  --color-accent-content: ${r.text};
  --color-neutral: ${r.card};
  --color-neutral-content: ${r.text};
  --color-info: #3b82f6;
  --color-info-content: ${contrastText("#3b82f6")};
  --color-success: #22c55e;
  --color-success-content: ${contrastText("#22c55e")};
  --color-warning: #f59e0b;
  --color-warning-content: ${contrastText("#f59e0b")};
  --color-error: #ef4444;
  --color-error-content: ${contrastText("#ef4444")};
  --radius-selector: 1rem;
  --radius-field: 0.5rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}`;
}

/** Seed a palette from an existing named preset, so users can tweak it. */
export function seedPaletteFromPreset(
  presetKey: string,
  isDark: boolean,
): CustomThemePalette {
  return resolvePalette(undefined, isDark, presetKey);
}

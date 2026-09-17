import { getConfigMany } from "../config.ts";
import {
  DEFAULT_GENERAL_FONT,
  GENERAL_FONT_IMPORT_URL,
  IMPORTED_FONT_FAMILY,
  resolveSansStack,
  SYSTEM_SANS_STACK,
} from "./fonts.ts";

const STYLE_ID = "ft-font-base";
const FILE_STYLE_ID = "ft-font-file";

/**
 * Defines the extension font variables on the document root so that the
 * light-DOM elements (roulette, marks, evaluations, native profile stats…)
 * can use `var(--font-sans)`. The value follows `--bi-font-sans`, which
 * `initFontManager` sets on the root element; custom properties inherit into
 * shadow roots, so this also drives the Tailwind `--font-sans` defined in
 * style.css. Intra's own `--font-mono` is intentionally left untouched.
 */
function ensureGlobalStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `@import url("${GENERAL_FONT_IMPORT_URL}");
:root {
  --font-sans: var(--bi-font-sans, ${SYSTEM_SANS_STACK}) !important;
}
html, body {
  font-family: var(--bi-font-sans, ${SYSTEM_SANS_STACK}) !important;
  font-variant-numeric: tabular-nums;
}`;
  (document.head || document.documentElement).appendChild(style);
}

function applyGeneralFont(id: string): void {
  document.documentElement.style.setProperty(
    "--bi-font-sans",
    resolveSansStack(id),
  );
}

function syncFontFile(dataUri: string): void {
  const existing = document.getElementById(FILE_STYLE_ID);
  if (!dataUri) {
    existing?.remove();
    return;
  }
  const style =
    (existing as HTMLStyleElement | null) ?? document.createElement("style");
  style.id = FILE_STYLE_ID;
  style.textContent = `@font-face {
  font-family: "${IMPORTED_FONT_FAMILY}";
  src: url(${JSON.stringify(dataUri)});
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}`;
  if (!existing) (document.head || document.documentElement).appendChild(style);
}

let initialized = false;

export async function initFontManager(): Promise<void> {
  ensureGlobalStyle();

  const { GENERAL_FONT, GENERAL_FONT_FILE } = await getConfigMany([
    "GENERAL_FONT",
    "GENERAL_FONT_FILE",
  ] as const);
  syncFontFile(GENERAL_FONT_FILE);
  applyGeneralFont(GENERAL_FONT || DEFAULT_GENERAL_FONT);

  if (initialized) return;
  initialized = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.GENERAL_FONT_FILE) {
      syncFontFile(String(changes.GENERAL_FONT_FILE.newValue || ""));
    }
    if (changes.GENERAL_FONT) {
      applyGeneralFont(
        String(changes.GENERAL_FONT.newValue || DEFAULT_GENERAL_FONT),
      );
    }
  });
}

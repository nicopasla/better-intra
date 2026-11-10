import { colord } from "colord";
import { ensureContrast } from "../../../utils/color.ts";

/**
 * Intra paints chips (the calendar's today/selected/event blocks, some buttons)
 * with an inline background colour plus Tailwind's `text-white`. Our dark theme
 * repaints `.text-white` with `--foreground`, which is unreadable on those
 * mid-tone backgrounds, so this guard measures each chip's real background and
 * keeps the theme's text colour, only darkening/lightening it as far as AA
 * needs. CSS cannot compare two colours, hence the runtime pass.
 */
const SELECTOR = '[class~="text-white"][style*="background"]';

/** WCAG AA for the small text Intra puts inside these chips. */
const MIN_CONTRAST = 4.5;

const applied = new Set<HTMLElement>();
let observer: MutationObserver | null = null;
let started = false;

/** The page's text colour as hex, read from the active preset's `--foreground`. */
function themeForeground(): string | null {
  // The theme stylesheet paints the root with the preset's foreground, so the
  // computed `color` is the resolved value (works even when custom properties
  // are unavailable, e.g. in tests).
  const color = colord(getComputedStyle(document.documentElement).color);
  return color.isValid() ? color.toHex() : null;
}

function clear(el: HTMLElement): void {
  if (!applied.delete(el)) return;
  el.style.removeProperty("color");
}

function update(el: Element): void {
  if (!(el instanceof HTMLElement) || !el.isConnected) return;

  const foreground = themeForeground();
  const background = colord(getComputedStyle(el).backgroundColor);
  // Translucent chips would need blending with what shows through, which the
  // computed value does not tell us; leave those to the stylesheet fallback.
  if (!foreground || !background.isValid() || background.alpha() < 0.99) {
    clear(el);
    return;
  }

  const color = ensureContrast(foreground, background.toHex(), MIN_CONTRAST);
  applied.add(el);
  if (
    el.style.getPropertyValue("color") !== color ||
    el.style.getPropertyPriority("color") !== "important"
  ) {
    el.style.setProperty("color", color, "important");
  }
}

/** Recomputes every chip on the page; call after a theme/mode change. */
export function refreshChipContrasts(): void {
  const found = new Set<HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
    found.add(el);
    if (document.documentElement.classList.contains("dark")) update(el);
    else clear(el);
  }
  for (const el of [...applied]) {
    if (!found.has(el) || !el.isConnected) clear(el);
  }
}

function handle(records: MutationRecord[]): void {
  if (applied.size > 32) {
    for (const el of applied) if (!el.isConnected) applied.delete(el);
  }
  const isDark = document.documentElement.classList.contains("dark");
  for (const record of records) {
    if (record.type === "attributes") {
      const el = record.target;
      if (
        el instanceof HTMLElement &&
        (el.matches(SELECTOR) || applied.has(el))
      ) {
        if (isDark && el.matches(SELECTOR)) update(el);
        else clear(el);
      }
      continue;
    }
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (el.matches(SELECTOR)) update(el);
      for (const child of el.querySelectorAll(SELECTOR)) update(child);
    }
  }
}

/** Starts the guard on the current page. Safe to call more than once. */
export function startChipContrasts(): void {
  const root = document.documentElement;
  if (started || !root) return;
  started = true;
  refreshChipContrasts();
  observer = new MutationObserver(handle);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}

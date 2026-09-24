import { sharedCSS } from "../assets/shared-styles.ts";

let sharedSheet: CSSStyleSheet | null = null;

function canConstructSheets(): boolean {
  try {
    if (typeof CSSStyleSheet === "undefined") return false;
    const sheet = new CSSStyleSheet();
    return typeof sheet.replaceSync === "function";
  } catch {
    return false;
  }
}

const CONSTRUCTABLE = canConstructSheets();

function getSharedSheet(): CSSStyleSheet | null {
  if (!CONSTRUCTABLE) return null;
  if (!sharedSheet) {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(sharedCSS);
  }
  return sharedSheet;
}

function ensureShared(root: ShadowRoot): void {
  const sheet = getSharedSheet();
  if (sheet) {
    const adopted = root.adoptedStyleSheets ?? [];
    if (!adopted.includes(sheet)) {
      try {
        root.adoptedStyleSheets = [sheet, ...adopted];
        return;
      } catch {
        /* fall through to style element */
      }
    } else {
      return;
    }
  }
  if (root.querySelector("style[data-ft-shared]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ft-shared", "1");
  style.textContent = sharedCSS;
  root.prepend(style);
}

export function adoptSharedStyles(root: ShadowRoot): void {
  ensureShared(root);
}

export function adoptShadowCss(root: ShadowRoot, cssText: string): void {
  ensureShared(root);
  if (CONSTRUCTABLE) {
    const shared = getSharedSheet();
    if (shared) {
      try {
        const featureSheet = new CSSStyleSheet();
        featureSheet.replaceSync(cssText);
        root.adoptedStyleSheets = [shared, featureSheet];
        return;
      } catch {
        /* fall through to style element */
      }
    }
  }
  if (cssText.trim()) {
    const style = document.createElement("style");
    style.textContent = cssText;
    root.appendChild(style);
  }
}

export function adoptShadowStyles(root: ShadowRoot): void {
  ensureShared(root);
  if (!CONSTRUCTABLE) return;
  const styles = [...root.querySelectorAll("style")];
  if (styles.length === 0) return;
  const shared = getSharedSheet();
  if (!shared) return;
  try {
    const featureSheets = styles.map((el) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(el.textContent ?? "");
      el.remove();
      return sheet;
    });
    root.adoptedStyleSheets = [shared, ...featureSheets];
  } catch {
    /* keep tree <style> elements as-is */
  }
}
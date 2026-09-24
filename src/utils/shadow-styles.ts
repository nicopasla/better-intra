import { sharedCSS } from "../assets/shared-styles.ts";

type CssMode = "sheet" | "style";

let mode: CssMode | "unknown" = "unknown";
let sharedSheet: CSSStyleSheet | null = null;

function logDebug(msg: string): void {
  try {
    if (localStorage.getItem("ft-css-debug") === "1") {
      console.warn(`[ft-css] ${msg}`);
    }
  } catch {
    /* ignore */
  }
}

function isForcedStyle(): boolean {
  try {
    return localStorage.getItem("ft-css-off") === "1";
  } catch {
    return false;
  }
}

function detect(): void {
  if (mode !== "unknown") return;
  if (isForcedStyle()) {
    mode = "style";
    logDebug("style mode (forced)");
    return;
  }
  try {
    if (typeof CSSStyleSheet === "undefined") {
      mode = "style";
      logDebug("style mode (no CSSStyleSheet)");
      return;
    }
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sharedCSS);
    if (!sheet.cssRules || sheet.cssRules.length === 0) {
      mode = "style";
      logDebug("style mode (empty sheet)");
      return;
    }

    const host = document.createElement("div");
    host.style.cssText =
      "position:absolute;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;";
    const root = host.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [sheet];
    const probe = document.createElement("span");
    probe.className = "badge";
    root.appendChild(probe);
    (document.documentElement || document.body).appendChild(host);
    const cs = getComputedStyle(probe);
    const radius = cs.borderRadius;
    const padding = cs.paddingLeft;
    host.remove();

    const worked =
      radius !== "0px" && radius !== "" && padding !== "0px" && padding !== "";
    if (worked) {
      sharedSheet = sheet;
      mode = "sheet";
      logDebug(
        `sheet mode (self-test ok, rules=${sheet.cssRules.length}, radius=${radius}, padding=${padding})`,
      );
    } else {
      mode = "style";
      logDebug(
        `style mode (self-test failed, rules=${sheet.cssRules.length}, radius=${radius}, padding=${padding})`,
      );
    }
  } catch {
    mode = "style";
    logDebug("style mode (exception)");
  }
}

function ensureSharedStyle(root: ShadowRoot): void {
  if (root.querySelector("style[data-ft-shared]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ft-shared", "1");
  style.textContent = sharedCSS;
  root.prepend(style);
}

function ensureShared(root: ShadowRoot): void {
  detect();
  if (mode === "sheet" && sharedSheet) {
    const adopted = root.adoptedStyleSheets ?? [];
    if (!adopted.includes(sharedSheet)) {
      try {
        root.adoptedStyleSheets = [sharedSheet, ...adopted];
        return;
      } catch {
        /* fall through to style element */
      }
    } else {
      return;
    }
  }
  ensureSharedStyle(root);
}

export function adoptSharedStyles(root: ShadowRoot): void {
  ensureShared(root);
}

export function adoptShadowCss(root: ShadowRoot, cssText: string): void {
  ensureShared(root);
  if (mode === "sheet" && sharedSheet) {
    try {
      const featureSheet = new CSSStyleSheet();
      featureSheet.replaceSync(cssText);
      root.adoptedStyleSheets = [sharedSheet, featureSheet];
      return;
    } catch {
      /* fall through to style element */
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
  if (mode !== "sheet" || !sharedSheet) return;
  const styles = [...root.querySelectorAll("style")];
  if (styles.length === 0) return;
  try {
    const featureSheets = styles.map((el) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(el.textContent ?? "");
      el.remove();
      return sheet;
    });
    root.adoptedStyleSheets = [sharedSheet, ...featureSheets];
  } catch {
    /* keep tree <style> elements as-is */
  }
}
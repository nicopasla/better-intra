import { sharedCSS } from "../assets/shared-styles.ts";

function ensureSharedStyle(root: ShadowRoot): void {
  if (root.querySelector("style[data-ft-shared]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ft-shared", "1");
  style.textContent = sharedCSS;
  root.prepend(style);
}

export function adoptSharedStyles(root: ShadowRoot): void {
  ensureSharedStyle(root);
}

export function adoptShadowCss(root: ShadowRoot, cssText: string): void {
  ensureSharedStyle(root);
  if (cssText.trim()) {
    const style = document.createElement("style");
    style.textContent = cssText;
    root.appendChild(style);
  }
}

export function adoptShadowStyles(root: ShadowRoot): void {
  ensureSharedStyle(root);
}
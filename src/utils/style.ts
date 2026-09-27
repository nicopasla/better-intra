/**
 * Inject a <style id> into the document once. Subsequent calls with the same
 * id are no-ops, matching the `if (!document.getElementById(id))` guard used
 * across the features.
 */
export function ensureDocumentStyle(id: string, cssText: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
}

/** Same as ensureDocumentStyle but scoped to a shadow root. */
export function ensureShadowStyle(
  root: ShadowRoot,
  id: string,
  cssText: string,
): void {
  if (root.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = cssText;
  root.appendChild(style);
}

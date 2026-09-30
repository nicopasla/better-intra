let customThemesCss: string | null = null;
let loadPromise: Promise<void> | null = null;
let customDaisyCss: string | null = null;
const pendingRoots = new Set<ShadowRoot>();
const knownRoots = new Set<ShadowRoot>();

function injectThemeStyle(root: ShadowRoot): void {
  if (!customThemesCss) return;
  if (root.querySelector("style[data-ft-themes]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ft-themes", "1");
  style.textContent = customThemesCss;
  root.appendChild(style);
}

function syncCustomDaisy(root: ShadowRoot): void {
  const existing = root.querySelector<HTMLStyleElement>(
    "style[data-ft-custom-theme]",
  );
  if (!customDaisyCss) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.createElement("style");
  style.setAttribute("data-ft-custom-theme", "1");
  style.textContent = customDaisyCss;
  if (!existing) root.appendChild(style);
}

export function ensureThemeStyle(root: ShadowRoot): void {
  knownRoots.add(root);
  syncCustomDaisy(root);
  if (customThemesCss) {
    injectThemeStyle(root);
    return;
  }
  pendingRoots.add(root);
}

/** Install (or clear) the runtime daisyUI palette (`[data-theme="…"]`) in all known roots. */
export function setCustomDaisyTheme(css: string | null): void {
  customDaisyCss = css;
  for (const root of knownRoots) {
    if (!root.host || !root.host.isConnected) {
      knownRoots.delete(root);
      continue;
    }
    syncCustomDaisy(root);
  }
}

export function setCustomThemesEnabled(value: boolean): void {
  if (value) void loadCustomThemes();
}

function loadCustomThemes(): Promise<void> {
  if (customThemesCss) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = import("../assets/themes.css?inline").then((m) => {
      customThemesCss = m.default;
      for (const root of pendingRoots) injectThemeStyle(root);
      pendingRoots.clear();
    });
  }
  return loadPromise;
}

let customThemesCss: string | null = null;
let loadPromise: Promise<void> | null = null;
let enabled = false;
const pendingRoots = new Set<ShadowRoot>();

function injectThemeStyle(root: ShadowRoot): void {
  if (!customThemesCss) return;
  if (root.querySelector("style[data-ft-themes]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ft-themes", "1");
  style.textContent = customThemesCss;
  root.appendChild(style);
}

export function ensureThemeStyle(root: ShadowRoot): void {
  if (customThemesCss) {
    injectThemeStyle(root);
    return;
  }
  if (enabled) pendingRoots.add(root);
}

export function setCustomThemesEnabled(value: boolean): void {
  enabled = value;
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

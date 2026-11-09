/* Better Intra — pre-paint theme boot.
 *
 * Intra pages are full navigations, and the content app (which loads the theme
 * from chrome.storage) only runs after an async import. Until it does, the
 * browser paints the light, server-rendered page. chrome.storage cannot be read
 * synchronously, so theme-manager.ts mirrors the last resolved theme to
 * localStorage; this script reads it at document_start and paints the dark
 * surface (and hides the light body behind it) before the page is shown.
 */
(function () {
  "use strict";

  var CACHE_KEY = "ft_intra_theme_boot";
  var LEGACY_KEY = "intra-theme";
  var GATE_CLASS = "ft-theme-pending";
  var STYLE_ID = "ft-theme-boot";
  var FALLBACK_MS = 1000;
  var DEFAULT_BG = "#12141a";
  var DEFAULT_FG = "#f2f2f2";

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && (parsed.theme === "dark" || parsed.theme === "light")) {
        return parsed;
      }
    } catch (e) {
      /* storage disabled or corrupt */
    }
    try {
      var legacy = sessionStorage.getItem(LEGACY_KEY);
      if (legacy === "dark" || legacy === "light") return { theme: legacy };
    } catch (e) {
      /* storage disabled */
    }
    return null;
  }

  function boot() {
    var root = document.documentElement;
    if (!root) return false;

    var cache = readCache();
    // Light mode already matches Intra's own colours, so there is nothing to
    // hide. Without a cache the mode is unknown synchronously; theme-manager.ts
    // resolves and applies it as soon as it can.
    if (!cache || cache.theme !== "dark") return true;

    var bg =
      typeof cache.background === "string" && cache.background
        ? cache.background
        : DEFAULT_BG;
    var fg =
      typeof cache.foreground === "string" && cache.foreground
        ? cache.foreground
        : DEFAULT_FG;

    root.classList.add("dark");
    if (location.hostname === "profile-v3.intra.42.fr") {
      root.setAttribute("data-theme", "dark");
    }

    var css =
      "html{color-scheme:dark;background-color:" +
      bg +
      "!important;}\n" +
      "html,html body,html #root,html [class*=\"min-h-screen\"]{" +
      "background-color:" +
      bg +
      "!important;color:" +
      fg +
      "!important;}\n" +
      // Intra v3 reads these tokens during hydration; seeding them keeps its
      // own components dark even before the full stylesheet is injected.
      "html.dark{--background:225 17% 14%;--card:220 20% 10%;" +
      "--foreground:213 31% 91%;--muted:220 20% 15%;" +
      "--muted-foreground:220 10% 60%;--popover:220 20% 14%;" +
      "--popover-foreground:213 31% 91%;--accent:220 20% 18%;" +
      "--accent-foreground:213 31% 91%;--border:220 20% 18%;" +
      "--input:220 20% 12%;}\n" +
      // Keep the still-light server HTML from painting; the html background
      // above stays visible, so the wait is a dark surface, not a white flash.
      "html." +
      GATE_CLASS +
      " body{visibility:hidden!important;}";

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || root).appendChild(style);

    root.classList.add(GATE_CLASS);

    // theme-manager.ts clears the gate once the real stylesheet is in. The
    // timeout is the safety net if the content app never loads (failed update).
    var lifted = false;
    var lift = function () {
      if (lifted) return;
      lifted = true;
      root.classList.remove(GATE_CLASS);
      var el = document.getElementById(STYLE_ID);
      if (el) el.remove();
    };
    window.setTimeout(lift, FALLBACK_MS);
    return true;
  }

  if (boot()) return;

  // Firefox can inject document_start before <html> exists.
  var observer = new MutationObserver(function () {
    if (boot()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
})();

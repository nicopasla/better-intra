import { getConfig } from "../../config.ts";
import { getStoredLinks, renderShortcutsDisplay } from "./shortcuts.ui.ts";
import { render, html } from "lit-html";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";

const CONTAINER_ID = "shortcuts-shadow-wrapper";
const WRAPPER_ATTR = "data-shortcuts-wrapper";

/** Intra renders every dashboard notice/link block with this container. */
const BANNER_SELECTOR = ".w-full.flex.flex-row.gap-8.py-4.px-8.items-center";
const TITLE_SELECTOR = ".text-legacy-main.font-bold.uppercase";
const NOTICE_RE = /maintenance/i;
const LINKS_RE = /important|links|liens/i;

/**
 * The "Important links" blocks (one per carousel slide, clones included).
 *
 * Intra puts notices and the link list in the same carousel with identical
 * container classes, so matching on the class alone picked the maintenance
 * notice. The slide title tells them apart; `a[href]` is the fallback when the
 * instance is localised.
 */
export function findLinksBanners(root: ParentNode = document): HTMLElement[] {
  const banners: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(BANNER_SELECTOR)) {
    const title =
      el.querySelector<HTMLElement>(TITLE_SELECTOR)?.textContent?.trim() ?? "";
    if (NOTICE_RE.test(title)) continue;
    if (LINKS_RE.test(title) || el.querySelector("a[href]")) banners.push(el);
  }
  return banners;
}

const wrapperIn = (banner: HTMLElement): HTMLElement | null =>
  banner.querySelector<HTMLElement>(`:scope > [${WRAPPER_ATTR}]`);

/** Removes wrappers that ended up in a notice slide (older builds did that). */
function dropStrayWrappers(banners: HTMLElement[]): void {
  document
    .querySelectorAll<HTMLElement>(`[${WRAPPER_ATTR}]`)
    .forEach((wrapper) => {
      const parent = wrapper.parentElement;
      if (!parent || !banners.includes(parent)) wrapper.remove();
    });
}

const justifyMap: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

function applyWrapperLayout(
  wrapper: HTMLElement,
  hideImportantLinks: boolean,
  alignment: string,
): void {
  wrapper.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: ${hideImportantLinks ? justifyMap[alignment] || "flex-start" : "flex-start"};
    gap: 16px;
    width: ${hideImportantLinks ? "100%" : "50%"};
    margin-right: 20px;
    padding: 8px 0;
    box-sizing: border-box;
  `;
}

/** Last applied state, so the observer only reacts to real drift. */
let appliedHasLinks: boolean | null = null;
let appliedHide = false;
let injecting = false;
let injectAgain = false;

const infoBlockIn = (banner: HTMLElement): HTMLElement | null =>
  banner.querySelector<HTMLElement>(".flex.flex-col.text-sm.w-full.gap-1");

const isBannerHidden = (banner: HTMLElement): boolean => {
  if (banner.style.display === "none") return true;
  const infoBlock = infoBlockIn(banner);
  return !!infoBlock && infoBlock.style.display === "none";
};

async function applyShortcuts(): Promise<void> {
  const activeFeatures = await getConfig("ACTIVE_SCRIPTS");
  const active = Array.isArray(activeFeatures) ? activeFeatures : [];

  if (!active.includes("shortcuts")) {
    document
      .querySelectorAll<HTMLElement>(`[${WRAPPER_ATTR}]`)
      .forEach((wrapper) => wrapper.remove());
    appliedHasLinks = false;
    appliedHide = false;
    return;
  }

  const banners = findLinksBanners();
  dropStrayWrappers(banners);
  if (banners.length === 0) return;

  const [hideImportantLinks, alignment, links, openNewTab] = await Promise.all([
    getConfig("SHORTCUTS_HIDE_IMPORTANT_LINKS"),
    getConfig("SHORTCUTS_ALIGNMENT"),
    getStoredLinks(),
    getConfig("ADVANCED_OPEN_LINKS_NEW_TAB"),
  ]);

  const displayLinks = links.filter((l) => l.url && l.name);
  const hasLinks = displayLinks.length > 0;

  for (const banner of banners) {
    const infoBlock = infoBlockIn(banner);
    const icon = banner.querySelector<HTMLElement>("svg.hidden.lg\\:block");

    if (hideImportantLinks) {
      if (icon) icon.style.display = "none";
      if (infoBlock) infoBlock.style.display = "none";
      // Without shortcuts nothing replaces the links, so drop the empty block.
      if (!hasLinks) banner.style.display = "none";
    } else {
      banner.style.display = "";
      if (icon) icon.style.display = "";
      if (infoBlock) {
        infoBlock.style.display = "";
        infoBlock.style.width = hasLinks ? "50%" : "";
        infoBlock.classList.toggle("w-full", !hasLinks);
      }
    }

    if (!hasLinks) {
      wrapperIn(banner)?.remove();
      continue;
    }

    let wrapper = wrapperIn(banner);
    if (!wrapper) {
      wrapper = document.createElement("div");
      // Keep the historical id on the first wrapper: the welcome tour targets
      // it and the page stylesheet excludes injected nodes by id.
      if (!document.getElementById(CONTAINER_ID)) wrapper.id = CONTAINER_ID;
      wrapper.setAttribute(WRAPPER_ATTR, "");
      const shadowRoot = wrapper.attachShadow({ mode: "open" });
      banner.appendChild(wrapper);
      render(
        html`
          <style>
            .separator {
              width: 3px;
              height: 100px;
              background-color: var(--base-300, #cbd5e1);
              margin: 0 8px;
              flex-shrink: 0;
            }
          </style>
          ${hideImportantLinks ? "" : html`<div class="separator"></div>`}
          ${renderShortcutsDisplay(links, openNewTab)}
        `,
        shadowRoot,
      );
      adoptShadowStyles(shadowRoot);
    }
    applyWrapperLayout(wrapper, hideImportantLinks, alignment);
  }

  appliedHasLinks = hasLinks;
  appliedHide = hideImportantLinks;
}

export async function injectShortcutsDisplay(): Promise<void> {
  if (injecting) {
    injectAgain = true;
    return;
  }

  injecting = true;
  try {
    do {
      injectAgain = false;
      await applyShortcuts();
    } while (injectAgain);
  } finally {
    injecting = false;
  }
}

let shortcutsObserver: MutationObserver | null = null;

/**
 * Re-inject only when the page drifted from what we applied: a link slide lost
 * its shortcuts, or Intra re-rendered the block and dropped our hiding styles.
 * Without shortcuts the wrapper never exists, so a plain "wrapper missing"
 * check would re-run on every mutation.
 */
function needsInjection(): boolean {
  const banners = findLinksBanners();
  if (banners.length === 0) return false;
  if (appliedHasLinks === null) return true;

  return banners.some(
    (banner) =>
      (appliedHasLinks && !wrapperIn(banner)) ||
      (appliedHide && !isBannerHidden(banner)),
  );
}

export function setupShortcutsObserver() {
  if (!document.body) {
    setTimeout(setupShortcutsObserver, 100);
    return;
  }
  if (shortcutsObserver) return;

  let timer: ReturnType<typeof setTimeout> | undefined;

  shortcutsObserver = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      // The carousel clones its slides during init, so keep injecting while a
      // link slide is still missing its shortcuts.
      if (needsInjection()) void injectShortcutsDisplay();
    }, 300);
  });

  shortcutsObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener(
    "pagehide",
    () => {
      shortcutsObserver?.disconnect();
      shortcutsObserver = null;
    },
    { once: true },
  );
}

export async function initShortcuts() {
  setupShortcutsObserver();
  await injectShortcutsDisplay();
}

import { getConfig } from "../../config.ts";
import { loadCampusData } from "../campus/campus.ts";
import { NAME_BADGE_SELECTOR, TITLE_BADGE_SELECTOR } from "./selectors.ts";

interface CampusBadgeData {
  badgeBaseUrl: string;
  badges: Record<string, string>;
}

let badgeData: CampusBadgeData | null | undefined;
let fetchPromise: Promise<CampusBadgeData | null> | undefined;

async function getCampusBadgeData(): Promise<CampusBadgeData | null> {
  if (badgeData !== undefined) return badgeData;

  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const campusId = await getConfig("CLUSTERS_CAMPUS");
    if (!campusId) return null;

    try {
      const data = await loadCampusData(campusId);
      if (typeof data.badgeBaseUrl === "string") {
        return {
          badgeBaseUrl: data.badgeBaseUrl,
          badges:
            data.badges && typeof data.badges === "object" ? data.badges : {},
        };
      }
    } catch {}

    return null;
  })();

  badgeData = await fetchPromise;
  fetchPromise = undefined;
  return badgeData;
}

export async function getBadgeUrl(name: string): Promise<string | null> {
  const data = await getCampusBadgeData();
  if (!data) return null;

  const resolved =
    data.badges[name] ??
    Object.entries(data.badges).find(([key]) => name.endsWith(key))?.[1];
  if (!resolved) return null;
  return data.badgeBaseUrl.replace("{name}", resolved);
}

export function wrapTitleBadges(root: ParentNode): void {
  const badgeEls = root.querySelectorAll<HTMLElement>(TITLE_BADGE_SELECTOR);
  if (!badgeEls.length) return;

  const containers = new Set<HTMLElement>();
  for (const el of badgeEls) {
    if (el.parentElement) containers.add(el.parentElement);
  }

  for (const container of containers) {
    container.style.setProperty("flex-wrap", "wrap", "important");
  }
}

export function getTitleBadges(
  root: ParentNode,
): { title: string; el: HTMLElement }[] {
  const list: { title: string; el: HTMLElement }[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(TITLE_BADGE_SELECTOR)) {
    if (el.closest("[data-ft-badge-menu], [data-ft-badge-more]")) continue;
    const title = el.textContent?.trim() || "";
    if (title) list.push({ title, el });
  }
  return list;
}

/** Marks a badge row that fits on one line, so the stylesheet can drop the
 *  scroll-hint reservation and keep it close to the separator below. */
const SINGLE_LINE_ATTR = "data-ft-badges-single";

/**
 * True when every visible badge sits on the same line. Compares the badges'
 * top offsets rather than their heights, so it holds whatever size they are.
 */
function isSingleLine(row: HTMLElement): boolean {
  let minTop = Infinity;
  let maxTop = -Infinity;
  let minHeight = Infinity;
  for (const child of Array.from(row.children) as HTMLElement[]) {
    const { top, height } = child.getBoundingClientRect();
    if (!height) continue;
    minTop = Math.min(minTop, top);
    maxTop = Math.max(maxTop, top);
    minHeight = Math.min(minHeight, height);
  }
  if (!Number.isFinite(minTop) || !Number.isFinite(minHeight)) return false;
  return maxTop - minTop < minHeight * 0.5;
}

function syncBadgesDensity(row: HTMLElement): void {
  const single = isSingleLine(row);
  if (single !== row.hasAttribute(SINGLE_LINE_ATTR)) {
    row.toggleAttribute(SINGLE_LINE_ATTR, single);
  }
}

let measuredRow: HTMLElement | null = null;
let measuredRowChildren = -1;
let observedRow: HTMLElement | null = null;
let lastRowWidth = -1;
let rowResizeObserver: ResizeObserver | null = null;

/** Badges rewrap when the row's width changes, so re-measure then. The width
 *  guard stops our own height change from re-triggering the observer. */
function observeBadgesWidth(row: HTMLElement): void {
  if (typeof ResizeObserver === "undefined" || row === observedRow) return;
  rowResizeObserver ??= new ResizeObserver((entries) => {
    const target = entries[entries.length - 1]?.target as
      | HTMLElement
      | undefined;
    if (!target) return;
    const width = Math.round(target.getBoundingClientRect().width);
    if (Math.abs(width - lastRowWidth) < 2) return;
    lastRowWidth = width;
    syncBadgesDensity(target);
    applyBadgeIndent(target);
  });
  rowResizeObserver.disconnect();
  rowResizeObserver.observe(row);
  observedRow = row;
  lastRowWidth = Math.round(row.getBoundingClientRect().width);
}

/** Re-measures only when the row or its badge count changed, so the mutation
 *  pass does not force a layout on every unrelated page change. */
function trackBadgesRow(row: HTMLElement): void {
  observeBadgesWidth(row);
  if (row === measuredRow && row.children.length === measuredRowChildren)
    return;
  measuredRow = row;
  measuredRowChildren = row.children.length;
  syncBadgesDensity(row);
}

/**
 * Moves the native role-badge row so it sits directly above the level/cursus
 * bar. Idempotent: the insert is skipped once the row is already in place, so
 * it does not churn the DOM (and re-trigger the observer).
 */
export function relocateBadges(root: ParentNode = document): void {
  const badges = getTitleBadges(root);
  if (!badges.length) return;

  const row = badges[0].el.parentElement;
  if (!row) return;

  const levelEl =
    root.querySelector<HTMLElement>(".ft-profile-card h1.text-4xl") ??
    root.querySelector<HTMLElement>("h1.text-4xl");
  const levelBar = levelEl?.parentElement;
  if (!levelBar || !levelBar.parentElement) return;

  row.setAttribute("data-ft-badges-row", "true");

  if (row.nextElementSibling !== levelBar) {
    levelBar.parentElement.insertBefore(row, levelBar);
  }

  trackBadgesRow(row);
  applyBadgeIndent(row);
}

const BADGE_INDENT_VAR = "--ft-badges-indent";
const DESKTOP_QUERY = "(min-width: 1024px)";
let badgeAfterAvatar = false;

/** Distance from the row's left edge to the info column, clamped so the
 *  badges never touch the avatar. */
export function badgeIndentPx(infoLeft: number, rowLeft: number): number {
  return Math.max(16, Math.round(infoLeft - rowLeft));
}

/**
 * Starts the badge row at the avatar's right edge (the info column's left
 * edge) while keeping it on its own line. Stacked/mobile layouts keep the
 * normal card-edge padding.
 */
export function applyBadgeIndent(
  row: HTMLElement,
  afterAvatar = badgeAfterAvatar,
): void {
  const desktop =
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia(DESKTOP_QUERY).matches;
  if (!afterAvatar || !desktop) {
    row.style.removeProperty(BADGE_INDENT_VAR);
    return;
  }

  const info = document.querySelector<HTMLElement>(
    NAME_BADGE_SELECTOR,
  )?.parentElement;
  if (!info) {
    row.style.removeProperty(BADGE_INDENT_VAR);
    return;
  }

  const rowRect = row.getBoundingClientRect();
  const infoRect = info.getBoundingClientRect();
  // No measurable offset: stacked layout, or the info column already starts
  // at the row's left edge.
  if (!rowRect.width || infoRect.left <= rowRect.left + 1) {
    row.style.removeProperty(BADGE_INDENT_VAR);
    return;
  }

  row.style.setProperty(
    BADGE_INDENT_VAR,
    `${badgeIndentPx(infoRect.left, rowRect.left)}px`,
  );
}

let relocationObserver: MutationObserver | null = null;
let relocationRaf: number | null = null;

function scheduleRelocation(): void {
  if (relocationRaf !== null) return;
  relocationRaf = requestAnimationFrame(() => {
    relocationRaf = null;
    relocateBadges();
  });
}

/**
 * Moved-badge persistence. The profile's own observer disconnects a few
 * seconds after load (and its first pass often runs before React has rendered
 * the badges/level bar), which used to delay the move by several seconds. This
 * dedicated observer re-applies it as soon as the nodes appear, then stops:
 * watching the whole body for the lifetime of the page cost a scan on every
 * unrelated DOM change.
 */
const RELOCATION_WINDOW_MS = 15_000;

export function initBadgeRelocation(): void {
  relocateBadges();
  if (relocationObserver) return;
  relocationObserver = new MutationObserver(scheduleRelocation);
  relocationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.setTimeout(() => {
    relocationObserver?.disconnect();
    relocationObserver = null;
  }, RELOCATION_WINDOW_MS);
  window.addEventListener(
    "pagehide",
    () => {
      relocationObserver?.disconnect();
      relocationObserver = null;
    },
    { once: true },
  );
  window.addEventListener(
    "resize",
    () => {
      const row = document.querySelector<HTMLElement>(
        "[data-ft-badges-row]",
      );
      if (row) applyBadgeIndent(row);
    },
    { passive: true },
  );
}

export interface BadgeLayoutOpts {
  order: string[];
  wrap: boolean;
  align: "left" | "center" | "right";
  afterAvatar?: boolean;
}

export function applyBadgeLayout(
  root: ParentNode,
  opts: BadgeLayoutOpts,
): void {
  const badges = getTitleBadges(root);
  if (!badges.length) return;

  const container = badges[0].el.parentElement;
  if (!container) return;

  badgeAfterAvatar = opts.afterAvatar === true;
  applyBadgeIndent(container);

  const hiddenSet = new Set(
    opts.order
      .filter((name) => name.startsWith("-"))
      .map((name) => name.substring(1).trim().toLowerCase()),
  );

  const desiredWrap = opts.wrap ? "wrap" : "nowrap";
  if (container.style.getPropertyValue("flex-wrap") !== desiredWrap) {
    container.style.setProperty("flex-wrap", desiredWrap, "important");
  }

  const desiredAlign = opts.align || "center";
  if (container.style.getPropertyValue("justify-content") !== desiredAlign) {
    container.style.setProperty("justify-content", desiredAlign, "important");
  }

  for (const { title, el } of badges) {
    const hidden = hiddenSet.has(title.toLowerCase());
    const display = hidden ? "none" : "";
    if (
      el.style.getPropertyValue("display") !== display ||
      el.style.getPropertyPriority("display") !==
        (display === "none" ? "important" : "")
    ) {
      el.style.setProperty(
        "display",
        display,
        display === "none" ? "important" : "",
      );
    }
  }

  const ordered = opts.order
    .filter((name) => !name.startsWith("-"))
    .map((name) => name.trim().toLowerCase());
  if (ordered.length) {
    const byTitle = new Map(badges.map((b) => [b.title.toLowerCase(), b.el]));

    const orderedEls: HTMLElement[] = [];
    for (const name of ordered) {
      const el = byTitle.get(name);
      if (el) orderedEls.push(el);
    }
    for (const { title, el } of badges) {
      if (!byTitle.has(title.toLowerCase())) continue;
      if (!orderedEls.includes(el)) orderedEls.push(el);
    }
    const namedSet = new Set(ordered);
    for (const { el } of badges) {
      const name = el.textContent?.trim().toLowerCase() || "";
      if (!namedSet.has(name)) orderedEls.push(el);
    }

    const currentEls = [...container.children] as HTMLElement[];

    const sameOrder =
      orderedEls.length === currentEls.length &&
      orderedEls.every((el, i) => el === currentEls[i]);

    if (!sameOrder) {
      const fragment = document.createDocumentFragment();
      for (const el of orderedEls) fragment.appendChild(el);
      container.appendChild(fragment);
    }
  }
}

let lastAppliedKey = "";

export function refreshBadgeLayout(): void {
  lastAppliedKey = "";
  applyTitleBadgeWrap();
}

export function applyTitleBadgeWrap() {
  if (location.hostname !== "profile-v3.intra.42.fr") return;
  if (!(location.pathname === "/" || location.pathname.startsWith("/users")))
    return;
  void (async () => {
    const order = (await getConfig("PROFILE_BADGE_ORDER")) as string[];
    const wrap = await getConfig("PROFILE_BADGE_WRAP");
    const align = await getConfig("PROFILE_BADGE_ALIGN");
    const afterAvatar = await getConfig("PROFILE_BADGE_AFTER_AVATAR");
    const key = `${JSON.stringify(order || [])}|${wrap}|${align}|${afterAvatar}`;
    if (key === lastAppliedKey) return;
    lastAppliedKey = key;
    applyBadgeLayout(document, {
      order: order || [],
      wrap,
      align,
      afterAvatar,
    });
  })();
}

// Badge order/wrap/align can change from the profile modal or arrive from cloud
// sync; re-apply whenever they do instead of waiting for a page reload.
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    changes.PROFILE_BADGE_ORDER ||
    changes.PROFILE_BADGE_WRAP ||
    changes.PROFILE_BADGE_ALIGN ||
    changes.PROFILE_BADGE_AFTER_AVATAR
  ) {
    refreshBadgeLayout();
  }
});

let badgesInitialized = false;

export async function initBadges() {
  if (badgesInitialized) return;
  badgesInitialized = true;

  if (location.pathname !== "/") return;

  const badgeEls = document.querySelectorAll<HTMLElement>(TITLE_BADGE_SELECTOR);

  for (const el of badgeEls) {
    const name = el.textContent?.trim() || "";
    if (!name) continue;

    const url = await getBadgeUrl(name);
    if (!url) continue;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = el.className;
    anchor.setAttribute("style", el.getAttribute("style") || "");
    anchor.textContent = el.textContent;
    el.replaceWith(anchor);
  }
}

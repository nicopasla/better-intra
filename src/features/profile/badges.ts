import { getConfig } from "../../config.ts";
import { loadCampusData } from "../campus/campus.ts";
import { TITLE_BADGE_SELECTOR } from "./selectors.ts";

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

/**
 * Moves the native role-badge row so it sits directly above the level/cursus
 * bar. Idempotent: the early return keeps it from churning the DOM (and
 * re-triggering the observer) once the row is already in place.
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

  if (row.nextElementSibling === levelBar) return;
  levelBar.parentElement.insertBefore(row, levelBar);
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
 * dedicated observer re-applies it as soon as the nodes appear.
 */
export function initBadgeRelocation(): void {
  relocateBadges();
  if (relocationObserver) return;
  relocationObserver = new MutationObserver(scheduleRelocation);
  relocationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export interface BadgeLayoutOpts {
  order: string[];
  wrap: boolean;
  align: "left" | "center" | "right";
}

export function applyBadgeLayout(
  root: ParentNode,
  opts: BadgeLayoutOpts,
): void {
  const badges = getTitleBadges(root);
  if (!badges.length) return;

  const container = badges[0].el.parentElement;
  if (!container) return;

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
    const key = `${JSON.stringify(order || [])}|${wrap}|${align}`;
    if (key === lastAppliedKey) return;
    lastAppliedKey = key;
    applyBadgeLayout(document, {
      order: order || [],
      wrap,
      align,
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
    changes.PROFILE_BADGE_ALIGN
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

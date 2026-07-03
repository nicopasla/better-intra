import { getConfig } from "../../config.ts";
import { CLUSTERS } from "../clusters/clusters.data.ts";
import { sharedCSS } from "../../assets/shared-styles.ts";
import ARROW_SHARE_SVG from "../../assets/svg/arrow_share.svg?raw";

const PROFILE_CARD_CLASS = "ft-profile-card";
const SHADOW_HOST_ID = "profile-badges-shadow";
const INFO_CARD_ID = "ft-info-card";

let _badgeTheme: string = "dark";
let _cursusListenerInitialized = false;

function extractItems(statsBar: HTMLElement) {
  const items: { label: string; value: string }[] = [];
  for (const child of statsBar.children) {
    const el = child as HTMLElement;
    const children = Array.from(el.querySelectorAll("b, span, strong"));
    if (children.length < 2) continue;
    const label = children[0].textContent?.trim() ?? "";
    const value = children[children.length - 1].textContent?.trim() ?? "";
    if (!label || !value) continue;
    items.push({ label, value });
  }
  return items;
}

function populateMainBadges(
  container: HTMLElement,
  items: { label: string; value: string }[],
) {
  container
    .querySelectorAll("[data-ft-badge]:not([data-ft-seat])")
    .forEach((b) => b.remove());

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const badge = document.createElement("div");
    badge.setAttribute("data-ft-badge", "");
    badge.className =
      "badge badge-lg h-auto flex w-full justify-between gap-4 px-5 py-2 bg-base-200 text-lg";

    badge.style.setProperty("border", "3px solid", "important");
    badge.style.setProperty(
      "border-color",
      "var(--user-color, hsl(var(--primary)))",
      "important",
    );
    badge.style.setProperty(
      "background",
      "hsl(var(--background))",
      "important",
    );

    const label = document.createElement("span");
    label.className = "label text-base-content/80 text-lg font-medium";
    label.textContent = item.label;

    const value = document.createElement("span");
    value.className = "value text-base-content text-lg font-semibold";
    value.textContent = item.value;
    badge.title = `${item.label}: ${item.value}`;

    badge.appendChild(label);
    badge.appendChild(value);
    container.appendChild(badge);
  }

  const seatBadge = container.querySelector<HTMLElement>("[data-ft-seat]");
  if (seatBadge) container.appendChild(seatBadge);
}

function injectSeatBadge(profileCard: HTMLElement) {
  const shadowHost = document.getElementById(SHADOW_HOST_ID);
  if (!shadowHost) return;
  const shadowRoot = shadowHost.shadowRoot;
  if (!shadowRoot) return;
  const wrapper = shadowRoot.getElementById(INFO_CARD_ID);
  if (!wrapper) return;

  const seatEl = profileCard.querySelector<HTMLElement>(
    ".absolute.px-2.py-1.border.rounded-full.border-neutral-600.bg-ft-gray.top-2.right-4",
  );
  const seatText = seatEl?.textContent?.trim() || null;
  if (!seatText || !seatEl) return;

  seatEl.style.setProperty("display", "none", "important");

  const existing = wrapper.querySelector<HTMLElement>("[data-ft-seat]");
  if (existing) {
    existing.querySelector(".value")!.textContent = seatText;
    return;
  }

  const isUnavailable = seatText.toLowerCase() === "unavailable";

  if (isUnavailable) {
    const badge = document.createElement("div");
    badge.setAttribute("data-ft-badge", "");
    badge.setAttribute("data-ft-seat", "");
    badge.setAttribute("data-ft-unavailable", "");
    badge.className =
      "badge badge-lg h-auto flex w-full justify-center px-5 py-2 bg-base-200 text-lg text-base-content/80";
    badge.style.border = "3px solid transparent";
    badge.style.cursor = "default";
    badge.textContent = "unavailable";
    badge.title = "Seat unavailable";
    wrapper.appendChild(badge);
    return;
  }

  const badge = document.createElement("div");
  badge.setAttribute("data-ft-badge", "");
  badge.setAttribute("data-ft-seat", "");
  badge.className =
    "badge badge-lg h-auto flex items-center justify-between w-full px-5 py-2 bg-base-200 text-lg";
  badge.style.border = "3px solid transparent";
  badge.style.color = "inherit";
  badge.style.fontWeight = "600";
  badge.style.cursor = "pointer";
  badge.title = "View on cluster map";

  const cluster = CLUSTERS.find((c) =>
    seatText.toLowerCase().startsWith(c.name.toLowerCase()),
  );
  if (cluster) {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(
        `https://meta.intra.42.fr/clusters?seat=${seatText}#cluster-${cluster.id}`,
        "_blank",
      );
    });
  }

  const value = document.createElement("span");
  value.className = "value text-base-content text-lg font-semibold";
  value.textContent = seatText;
  badge.appendChild(value);

  const linkIcon = document.createElement("span");
  linkIcon.className = "size-3.5 flex items-center justify-center fill-current";
  linkIcon.insertAdjacentHTML("beforeend", ARROW_SHARE_SVG);
  badge.appendChild(linkIcon);

  wrapper.appendChild(badge);
}

function pollForUpdatedStats(attempts = 0) {
  const shadowHost = document.getElementById(SHADOW_HOST_ID);
  if (!shadowHost?.shadowRoot) return;
  const wrapper = shadowHost.shadowRoot.getElementById(INFO_CARD_ID);
  if (!wrapper) return;
  const statsBar = document.querySelector<HTMLElement>(".border-t-neutral-600");
  if (!statsBar) return;
  const items = extractItems(statsBar);
  if (items.length >= 3) {
    populateMainBadges(wrapper, items);
    return;
  }
  if (attempts < 30) {
    setTimeout(() => pollForUpdatedStats(attempts + 1), 100);
  }
}

function listenForCursusChange() {
  if (_cursusListenerInitialized) return;
  _cursusListenerInitialized = true;
  document.addEventListener("42_CURSUS_ID", (() => {
    pollForUpdatedStats();
  }) as EventListener);
}

function createInfoCard(
  items: { label: string; value: string }[],
  profileCard: HTMLElement,
) {
  const shadowHost = document.createElement("div");
  shadowHost.id = SHADOW_HOST_ID;

  const shadowRoot = shadowHost.attachShadow({ mode: "open" });

  const seatStyles = `
    [data-ft-seat]:not([data-ft-unavailable]) {
      border-color: #10b981 !important;
      box-shadow: 0 0 10px rgba(16,185,129,0.25);
    }
    [data-ft-seat][data-ft-unavailable] {
      border-color: #ef4444 !important;
      box-shadow: 0 0 10px rgba(239,68,68,0.25);
    }
    [data-ft-seat] {
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    [data-ft-seat]:not([data-ft-unavailable]):hover {
      box-shadow: 0 0 22px 4px rgba(16,185,129,0.35);
      border-color: #34d399 !important;
    }
  `;

  const style = document.createElement("style");
  style.textContent = `${sharedCSS}\n${seatStyles}`;
  shadowRoot.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.id = INFO_CARD_ID;
  wrapper.setAttribute("data-theme", _badgeTheme);
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "4px";
  wrapper.style.marginLeft = "-20px";
  wrapper.style.marginRight = "-20px";
  wrapper.style.height = "100%";
  wrapper.style.justifyContent = "space-between";

  populateMainBadges(wrapper, items);
  shadowRoot.appendChild(wrapper);
  profileCard.insertAdjacentElement("afterend", shadowHost);
}

function startStatsPolling(profileCard: HTMLElement, attempts: number) {
  if (document.getElementById(SHADOW_HOST_ID)) return;
  const statsBar = profileCard.querySelector<HTMLElement>(
    ".border-t-neutral-600",
  );
  if (statsBar) {
    const items = extractItems(statsBar);
    if (items.length >= 3) {
      createInfoCard(items, profileCard);
      injectSeatBadge(profileCard);
      return;
    }
  }
  if (attempts < 20) {
    setTimeout(() => startStatsPolling(profileCard, attempts + 1), 50);
  }
}

function moveStatsBar(profileCard: HTMLElement | null) {
  if (!profileCard) return;
  if (document.getElementById(SHADOW_HOST_ID)) return;
  startStatsPolling(profileCard, 0);
}

function injectProfileCardStyles() {
  const STYLE_ID = "ft-profile-card-styles";
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* --- Main Card Container --- */
    .ft-profile-card {
      border: 1px solid var(--user-color-translucent, rgba(255, 255, 255, 0.1)) !important;
      border-radius: 1rem !important;
      transition: border-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
    }

    .ft-profile-card:hover {
      border-color: var(--user-color, rgba(255, 255, 255, 0.3)) !important;
      box-shadow: 0 0 20px var(--user-color-translucent, rgba(255,255,255,0.1));
    }

    /* --- Profile Picture --- */
    .ft-profile-card .bg-cover.rounded-full {
      border-color: var(--user-color, #00babc) !important;
    }

    /* --- User Name --- */
    .ft-profile-card h2.text-2xl {
      text-shadow: 0 1px 5px rgba(0,0,0,0.5);
    }

    /* Level & Progress Bar Section */
    .ft-profile-card .px-8.flex.flex-row {
      align-items: center !important;
      padding-left: 1rem !important;
      padding-right: 1rem !important;
      gap: 0.75rem !important;
    }

    /* Level Number (e.g., "01") */
    .ft-profile-card h1.text-4xl {
      font-size: 2.5rem !important;
      line-height: 1 !important;
      height: auto !important;
      color: var(--user-color, hsl(var(--primary)));
    }

    /* Progress bar container - now the liquid container */
    .ft-profile-card div[role="progressbar"] {
      height: 12px !important;
      background-color: rgba(0,0,0,0.4) !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      position: relative !important;
    }

    /* Progress bar fill - now the liquid fill */
    .ft-profile-card div[role="progressbar"] > div {
      background-color: var(--user-color, #00babc) !important;
      position: relative !important;
      transition: width 1s ease-in-out !important;
    }

    /* --- Cursus Dropdown & Percentage --- */
    .ft-profile-card .font-bold.justify-between {
      color: hsl(var(--muted-foreground));
    }

    .ft-profile-card .font-bold.justify-between > div:first-child {
      color: var(--user-color, hsl(var(--primary)));
      font-weight: 700;
    }

    .ft-profile-card .font-bold.justify-between > div:last-child {
      color: var(--user-color, hsl(var(--primary)));
    }

    .ft-profile-card button[role="combobox"] {
      background-color: transparent !important;
      font-size: 0.8rem;
      padding: 2px 4px !important;
      border-radius: 4px;
      color: var(--user-color, hsl(var(--primary)));
    }

    [role="option"]:hover,
    [role="option"]:focus,
    [role="option"][data-highlighted] {
      background-color: var(--user-color, hsl(var(--primary))) !important;
      color: #fff !important;
    }
  `;
  document.head.appendChild(style);
}

function rgbToHex(color: string): string {
  const m = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return color;
  const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0");
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

function extractLevelColor(profileCard: HTMLElement | null): string | null {
  if (!profileCard) return null;
  const levelEl = profileCard.querySelector<HTMLElement>("h1.text-4xl");
  if (!levelEl) return null;
  return rgbToHex(getComputedStyle(levelEl).color);
}

function findProfileCard(): HTMLElement | null {
  const loginElement =
    document.querySelector<HTMLElement>('p[class="text-sm"]');
  if (!loginElement) return null;
  const card = loginElement.closest(
    ".flex.flex-col.lg\\:flex-row",
  )?.parentElement;
  return (card as HTMLElement) || null;
}

export function applyThemeToProfileCard(theme: { profileColor?: string }) {
  const profileCard = findProfileCard();
  if (!profileCard || !theme?.profileColor) return;

  profileCard.style.setProperty("--user-color", theme.profileColor);
  profileCard.style.setProperty(
    "--user-color-translucent",
    `${theme.profileColor}33`,
  );

  const shadowHost = document.getElementById(SHADOW_HOST_ID);
  if (shadowHost) {
    shadowHost.style.setProperty("--user-color", theme.profileColor);
    shadowHost.style.setProperty(
      "--user-color-translucent",
      `${theme.profileColor}33`,
    );
  }
}

export async function initProfileCardStyling() {
  injectProfileCardStyles();

  const effectiveTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const presetKey = await getConfig("PROFILE_THEME_PRESET");
  _badgeTheme =
    effectiveTheme === "light"
      ? "light"
      : presetKey && presetKey !== "dark"
        ? presetKey
        : "dark";

  const profileCard = findProfileCard();
  if (profileCard && !profileCard.classList.contains(PROFILE_CARD_CLASS)) {
    profileCard.classList.add(PROFILE_CARD_CLASS);
  }

  const useModern = await getConfig("PROFILE_USE_MODERN_INFO_CARD");
  if (useModern) {
    profileCard
      ?.querySelector<HTMLElement>(".border-t-neutral-600")
      ?.style.setProperty("display", "none", "important");
    moveStatsBar(profileCard);
    listenForCursusChange();
  }

  const pathParts = location.pathname.split("/").filter(Boolean);
  const isOtherUser = pathParts[0] === "users" && !!pathParts[1];

  let color: string | null = null;

  if (!isOtherUser) {
    const useCustomColor = await getConfig("PROFILE_USE_CUSTOM_COLOR");
    if (useCustomColor) {
      color = await getConfig("LOGTIME_CALENDAR_COLOR");
    }
  }

  if (!color) {
    color = extractLevelColor(profileCard);
  }

  if (color) {
    applyThemeToProfileCard({ profileColor: color });
  }
}

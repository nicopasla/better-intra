import { getConfig } from "../../config.ts";
import { CLUSTERS } from "../clusters/clusters.data.ts";

const PROFILE_CARD_CLASS = "ft-profile-card";
const INFO_CARD_ID = "ft-info-card";

function injectInfoCardStyles() {
  const STYLE_ID = "ft-info-card-styles";
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #ft-info-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-left: -20px;
      justify-content: center;
    }
    #ft-info-card .value {
      font-size: 1rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }
    #ft-info-card .label {
      font-size: 1rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.55);
    }
    #ft-info-card [data-ft-seat] {
      transition: background-color 0.15s ease, border-color 0.15s ease;
      cursor: pointer;
    }
    #ft-info-card [data-ft-seat]:hover {
      background-color: rgba(255, 255, 255, 0.1) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
  `;
  document.head.appendChild(style);
}

function extractItems(statsBar: HTMLElement) {
  const items: { label: string; value: string; coalition: boolean }[] = [];
  for (const child of statsBar.children) {
    const el = child as HTMLElement;
    const children = Array.from(el.querySelectorAll("b, span, strong"));
    if (children.length < 2) continue;
    const label = children[0].textContent?.trim() ?? "";
    const value = children[children.length - 1].textContent?.trim() ?? "";
    if (!label || !value) continue;
    items.push({
      label,
      value,
      coalition: label === "Rank" || label === "Score",
    });
  }
  return items;
}

function populateMainBadges(
  container: HTMLElement,
  items: { label: string; value: string; coalition: boolean }[],
) {
  container
    .querySelectorAll("[data-ft-badge]:not([data-ft-seat])")
    .forEach((b) => b.remove());

  for (const item of items) {
    const badge = document.createElement("div");
    badge.setAttribute("data-ft-badge", "");
    badge.className =
      "border border-ft-gray-border bg-ft-gray/50 rounded-xl flex flex-row items-center justify-between px-3 py-2 gap-4";
    if (item.coalition) badge.setAttribute("data-ft-coalition", "");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.label;

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = item.value;

    badge.appendChild(label);
    badge.appendChild(value);
    container.appendChild(badge);
  }

  const seatBadge = container.querySelector<HTMLElement>("[data-ft-seat]");
  if (seatBadge) container.appendChild(seatBadge);
}

function injectSeatBadge(profileCard: HTMLElement) {
  const container = document.getElementById(INFO_CARD_ID);
  if (!container) return;

  const seatEl = profileCard.querySelector<HTMLElement>(
    ".absolute.px-2.py-1.border.rounded-full.border-neutral-600.bg-ft-gray.top-2.right-4",
  );
  const seatText = seatEl?.textContent?.trim() || null;
  if (!seatText || !seatEl) return;

  seatEl.style.setProperty("display", "none", "important");

  const existing = container.querySelector<HTMLElement>("[data-ft-seat]");
  if (existing) {
    existing.querySelector(".value")!.textContent = seatText;
    return;
  }

  const isUnavailable = seatText.toLowerCase() === "unavailable";

  if (isUnavailable) {
    const badge = document.createElement("div");
    badge.setAttribute("data-ft-badge", "");
    badge.setAttribute("data-ft-seat", "");
    badge.className =
      "border border-ft-gray-border bg-ft-gray/50 rounded-xl flex flex-row items-center justify-center px-3 py-2";
    badge.style.fontSize = "1rem";
    badge.style.fontWeight = "500";
    badge.style.color = "rgba(255, 255, 255, 0.55)";
    badge.style.cursor = "default";
    badge.textContent = "unavailable";
    container.appendChild(badge);
    return;
  }

  const badge = document.createElement("div");
  badge.setAttribute("data-ft-badge", "");
  badge.setAttribute("data-ft-seat", "");
  badge.className =
    "border border-ft-gray-border bg-ft-gray/50 rounded-xl flex flex-row items-center justify-center gap-2 px-3 py-2";
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
  value.className = "value";
  value.textContent = seatText;

  badge.appendChild(value);
  container.appendChild(badge);
}

function createInfoCard(
  items: { label: string; value: string; coalition: boolean }[],
  profileCard: HTMLElement,
) {
  const wrapper = document.createElement("div");
  wrapper.id = INFO_CARD_ID;
  populateMainBadges(wrapper, items);
  profileCard.insertAdjacentElement("afterend", wrapper);
  return wrapper;
}

function startStatsPolling(profileCard: HTMLElement, attempts: number) {
  if (document.getElementById(INFO_CARD_ID)) return;
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
  if (document.getElementById(INFO_CARD_ID)) return;
  startStatsPolling(profileCard, 0);
}

function injectProfileCardStyles() {
  const STYLE_ID = "ft-profile-card-styles";
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
  /* --- Keyframes for Liquid Fill --- */
    @keyframes ft-wave-move {
      0% {
        transform: translate(-50%, -50%) rotate(0deg);
      }
      100% {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

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
      color: var(--user-color, #fff);
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

    /* The 'wave' pseudo-element */
    .ft-profile-card div[role="progressbar"] > div::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 100%;
      width: 40px;
      height: 40px;
      background: var(--user-color, #00babc);
      border-radius: 38%;
      animation: ft-wave-move 3s linear infinite;
      display: block;
      transform-origin: center;
      opacity: 1;
    }

    /* Hide wave if progress is 0 (translateX is -100%) */
    .ft-profile-card div[role="progressbar"] > div[style*="transform: translateX(-100%)"]::after {
      display: none;
    }

    /* --- Cursus Dropdown & Percentage --- */
    .ft-profile-card .font-bold.justify-between {
      color: hsl(var(--muted-foreground));
    }

    .ft-profile-card .font-bold.justify-between > div:first-child {
      color: var(--user-color, #fff);
      font-weight: 700;
    }

    .ft-profile-card button[role="combobox"] {
      background-color: transparent !important;
      font-size: 0.8rem;
      padding: 2px 4px !important;
      border-radius: 4px;
    }

    html.dark [role="option"]:hover,
    html.dark [role="option"]:focus,
    html.dark [role="option"][data-highlighted] {
      background-color: hsl(var(--muted)) !important;
    }
  `;
  document.head.appendChild(style);
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
}

export async function initProfileCardStyling() {
  injectProfileCardStyles();
  injectInfoCardStyles();

  const profileCard = findProfileCard();
  if (profileCard && !profileCard.classList.contains(PROFILE_CARD_CLASS)) {
    profileCard.classList.add(PROFILE_CARD_CLASS);
  }
  profileCard
    ?.querySelector<HTMLElement>(".border-t-neutral-600")
    ?.style.setProperty("display", "none", "important");
  moveStatsBar(profileCard);

  const pathParts = location.pathname.split("/").filter(Boolean);
  const isOtherUser = pathParts[0] === "users" && !!pathParts[1];
  if (isOtherUser) return;

  const useCustomColor = await getConfig("PROFILE_USE_CUSTOM_COLOR");
  if (useCustomColor) {
    const color = await getConfig("LOGTIME_CALENDAR_COLOR");
    applyThemeToProfileCard({ profileColor: color });
  }
}

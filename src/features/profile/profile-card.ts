import { getConfig } from "../../config.ts";

/**
 * The CSS class to apply to the main profile card for custom styling.
 */
const PROFILE_CARD_CLASS = "ft-profile-card";

/**
 * Injects the CSS for the custom profile card styling.
 */
function injectProfileCardStyles() {
  const STYLE_ID = "ft-profile-card-styles";
  if (document.getElementById(STYLE_ID)) return;

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
      border-color: var(--user-color, #52ff52) !important;
    }

    /* --- User Name --- */
    .ft-profile-card h2.text-2xl {
      text-shadow: 0 1px 5px rgba(0,0,0,0.5), 0 0 8px var(--user-color-translucent, rgba(255,255,255,0.5));
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
      text-shadow: 0 0 8px var(--user-color-translucent, rgba(255,255,255,0.5));
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
      background-color: var(--user-color, #52ff52) !important;
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
      background: var(--user-color, #52ff52);
      border-radius: 38%;
      animation: ft-wave-move 3s linear infinite;
      display: block;
      transform-origin: center;
      opacity: 1;
    }

    /* Hide wave if progress is 0 */
    .ft-profile-card div[role="progressbar"] > div[style*="width: 0%"]::after,
    .ft-profile-card div[role="progressbar"] > div[style*="width:0%"]::after {
      display: none;
    }

    /* --- Cursus Dropdown & Percentage --- */
    .ft-profile-card .font-bold.justify-between {
      color: #a0aec0;
    }

    /* Apply user color to the percentage text */
    .ft-profile-card .font-bold.justify-between > div:first-child {
      color: var(--user-color, #a0aec0);
      font-weight: 700;
    }

    /* Cursus dropdown button */
    .ft-profile-card button[role="combobox"] {
      font-size: 0.8rem;
      padding: 2px 4px !important;
      border-radius: 4px;
      background-color: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.1) !important;
    }
    .ft-profile-card button[role="combobox"]:hover {
      background-color: rgba(0,0,0,0.4);
      border-color: var(--user-color-translucent) !important;
    }

    /* --- Bottom Stats Bar (Wallets, Rank, Score) --- */
    .ft-profile-card .border-t-neutral-600 {
      background-color: rgba(0,0,0,0.25) !important;
      border-top: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 0 !important;
      padding: 0.5rem 1rem !important;
    }

    .ft-profile-card .border-t-neutral-600 > div {
      text-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .ft-profile-card .border-t-neutral-600 b {
      color: #a0aec0;
      font-weight: 600;
    }

    .ft-profile-card .border-t-neutral-600 span {
      color: #e2e8f0;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Finds the main profile card element on the page.
 * @returns The HTMLElement of the profile card, or null if not found.
 */
function findProfileCard(): HTMLElement | null {
  const loginElement =
    document.querySelector<HTMLElement>('p[class="text-sm"]');
  if (!loginElement) return null;
  const card = loginElement.closest(
    ".flex.flex-col.lg\\:flex-row",
  )?.parentElement;
  return (card as HTMLElement) || null;
}

/**
 * Applies a theme object to the profile card by setting CSS variables.
 * @param theme The theme object, which should contain a profileColor.
 */
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
  const profileCard = findProfileCard();

  if (!profileCard || profileCard.classList.contains(PROFILE_CARD_CLASS)) {
    return;
  }
  profileCard.classList.add(PROFILE_CARD_CLASS);

  // Set the color for the progress bar and other elements from the central config
  const useCustomColor = await getConfig("PROFILE_USE_CUSTOM_COLOR");
  if (useCustomColor) {
    const calendarColor = await getConfig("LOGTIME_CALENDAR_COLOR");
    applyThemeToProfileCard({ profileColor: calendarColor });
  }
}

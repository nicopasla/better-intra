import { getConfig } from "../../config.ts";

let cachedCards: HTMLElement[] | null = null;
let cachedGrid: HTMLElement | null = null;

function getCards(): HTMLElement[] {
  const current = document.querySelectorAll<HTMLElement>(".lt-box-container");

  if (
    !cachedCards ||
    cachedCards.length !== current.length ||
    cachedCards[0] !== current[0]
  ) {
    cachedCards = Array.from(current);
    cachedGrid = current[0]?.parentElement || null;
  }

  return cachedCards;
}

function injectStyles(): void {
  if (document.getElementById("42-alt-layout-styles")) return;
  const style = document.createElement("style");
  style.id = "42-alt-layout-styles";
  style.textContent = `
    .alt-layout-grid {
      grid-template-columns: repeat(auto-fit, minmax(400px, max-content)) !important;
      grid-auto-flow: row dense !important;
      justify-content: start !important;
      gap: 16px !important;
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
    .alt-card-logtime {
      grid-column: span 1 !important;
      width: 690px !important; min-width: 690px !important; max-width: 690px !important;
    }
    .alt-card-fixed-400 {
      grid-column: span 1 !important;
      width: 400px !important; min-width: 400px !important; max-width: 400px !important;
    }
    .alt-card-fixed-400 > * {
      width: 100% !important; max-width: 100% !important;
    }
  `;
  document.head.appendChild(style);
}

function getCardTitle(card: HTMLElement): string {
  const titleEl = card.querySelector("[class*='uppercase']");
  return titleEl?.textContent?.trim().toUpperCase() || "";
}

export async function optimizeLayout() {
  injectStyles();

  const altLayoutEnabled = await getConfig("PROFILE_ALT_LAYOUT");
  const hideAchievementsEnabled = await getConfig("PROFILE_HIDE_ACHIEVEMENTS");

  const shouldHideAchievements = hideAchievementsEnabled || altLayoutEnabled;
  document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96").forEach((c) => {
    if ((c.textContent || "").toUpperCase().includes("LAST ACHIEVEMENTS")) {
      c.style.display = shouldHideAchievements ? "none" : "";
    }
  });

  const cards = getCards();
  if (!cards.length) return;

  if (cachedGrid) {
    cachedGrid.classList.toggle("alt-layout-grid", !!altLayoutEnabled);

    if (altLayoutEnabled) {
      const liveChildren = Array.from(cachedGrid.children) as HTMLElement[];
      const agendaCard = liveChildren.find((c) => getCardTitle(c) === "AGENDA");
      const pendingCard = liveChildren.find(
        (c) => getCardTitle(c) === "PENDING EVALUATIONS",
      );

      if (
        agendaCard &&
        pendingCard &&
        agendaCard.previousElementSibling !== pendingCard
      ) {
        agendaCard.insertAdjacentElement("beforebegin", pendingCard);
        cachedCards = null;
      }
    }
  }

  cards.forEach((card) => {
    const title = getCardTitle(card);
    const isLogtime = title.includes("LOGTIME") && !!altLayoutEnabled;
    const isFixed400 =
      (title === "PENDING EVALUATIONS" || title === "AGENDA") &&
      !!altLayoutEnabled;

    card.classList.toggle("alt-card-logtime", isLogtime);
    card.classList.toggle("alt-card-fixed-400", isFixed400);
  });
}

export async function initLayoutManager() {
  const isProfilePage =
    location.hostname === "profile-v3.intra.42.fr" &&
    (location.pathname === "/" ||
      location.pathname === "" ||
      /^\/users\/[^/]+\/?$/.test(location.pathname));

  if (!isProfilePage) return;

  void optimizeLayout();
  window.addEventListener("resize", () => void optimizeLayout());

  let isUpdating = false;

  const observer = new MutationObserver(() => {
    if (isUpdating) return;
    isUpdating = true;

    requestAnimationFrame(() => {
      optimizeLayout().finally(() => {
        isUpdating = false;
      });
    });
  });

  const targetNode = document.querySelector(".dash-main") || document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}

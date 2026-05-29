import { getConfig } from "../../config.ts";

let cachedCards: HTMLElement[] | null = null;
let cachedGrid: HTMLElement | null = null;

function getCards(): HTMLElement[] {
  const currentElements = document.querySelectorAll<HTMLElement>(
    ".dash-main > div, .lt-box-container",
  );
  const validCards: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  currentElements.forEach((el) => {
    if (el.classList.contains("dash-main") || seen.has(el)) return;

    const title = getCardTitle(el);
    const validTitles = [
      "LOGTIME",
      "AGENDA",
      "PENDING EVALUATIONS",
      "PROJECTS",
    ];

    if (
      el.classList.contains("lt-box-container") ||
      validTitles.includes(title)
    ) {
      seen.add(el);
      validCards.push(el);
    }
  });

  if (
    !cachedCards ||
    cachedCards.length !== validCards.length ||
    cachedCards[0] !== validCards[0]
  ) {
    cachedCards = validCards;
    cachedGrid =
      document.querySelector(".dash-main") ||
      validCards[0]?.parentElement ||
      null;
  }

  return cachedCards;
}

function getCardTitle(card: HTMLElement): string {
  const titleEl = card.querySelector("[class*='uppercase']");
  if (titleEl?.textContent) return titleEl.textContent.trim().toUpperCase();

  const text = (card.textContent || "").toUpperCase();
  for (const token of [
    "LOGTIME",
    "AGENDA",
    "PENDING EVALUATIONS",
    "PROJECTS",
  ]) {
    if (text.includes(token)) return token;
  }
  return "";
}

function reorderCards(grid: HTMLElement, customOrder: string[]): boolean {
  const liveChildren = Array.from(grid.children) as HTMLElement[];
  if (!liveChildren.length) return false;

  const normalizedOrder = customOrder.map((name) => {
    const clean = name.trim().toUpperCase();
    return clean.startsWith("-") ? clean.substring(1) : clean;
  });

  const sortedChildren = [...liveChildren].sort((a, b) => {
    const posA = normalizedOrder.findIndex((name) =>
      getCardTitle(a).includes(name),
    );
    const posB = normalizedOrder.findIndex((name) =>
      getCardTitle(b).includes(name),
    );
    return (posA === -1 ? Infinity : posA) - (posB === -1 ? Infinity : posB);
  });

  const hasMoved = sortedChildren.some(
    (child, idx) => grid.children[idx] !== child,
  );
  if (hasMoved) sortedChildren.forEach((child) => grid.appendChild(child));

  return hasMoved;
}

export async function optimizeLayout() {
  const cardOrder = (await getConfig("PROFILE_CARD_ORDER")) as string[] | null;

  const hideCardByText = (searchText: string, shouldHide: boolean) => {
    const cleanSearch = searchText.toUpperCase().trim();

    if (cleanSearch === "LOGTIME") {
      document
        .querySelectorAll<HTMLElement>(".lt-box-container")
        .forEach((c) => {
          c.style.display = shouldHide ? "none" : "";
        });
    }

    document
      .querySelectorAll<HTMLElement>(".bg-white.md\\:h-96")
      .forEach((c) => {
        if ((c.textContent || "").toUpperCase().includes(cleanSearch)) {
          c.style.display = shouldHide ? "none" : "";
        }
      });
  };

  const hiddenCards = cardOrder
    ? cardOrder
        .filter((name) => name.startsWith("-"))
        .map((name) => name.substring(1).trim().toUpperCase())
    : [];

  hiddenCards.forEach((cardTitle) => {
    hideCardByText(cardTitle, true);
  });

  const cards = getCards();
  if (!cards.length) return;

  if (cachedGrid && cardOrder && cardOrder.length > 0) {
    if (reorderCards(cachedGrid, cardOrder)) cachedCards = null;
  }
}

export async function initLayoutManager() {
  const isProfilePage =
    location.hostname === "profile-v3.intra.42.fr" &&
    (/^\/(\??.*)?$/.test(location.pathname) ||
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

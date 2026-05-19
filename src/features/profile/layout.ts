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

function injectStyles(): void {
  if (document.getElementById("42-alt-layout-styles")) return;
  const style = document.createElement("style");
  style.id = "42-alt-layout-styles";
  style.textContent = `
    .alt-layout-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(400px, max-content)) !important;
      grid-auto-flow: row dense !important;
      justify-content: start !important;
      gap: 16px !important;
      padding: 0 16px !important;
    }
    .alt-card-logtime {
      grid-column: span 1 !important;
      width: 690px !important; min-width: 690px !important; max-width: 690px !important;
      overflow-x: auto !important;
    }
    .alt-card-fixed-400 {
      grid-column: span 1 !important;
      width: 400px !important; min-width: 400px !important; max-width: 400px !important;
    }
    .alt-card-fixed-400 > * { width: 100% !important; max-width: 100% !important; }
  `;
  document.head.appendChild(style);
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
  injectStyles();

  const [altLayoutEnabled, cardOrder] = await Promise.all([
    getConfig("PROFILE_ALT_LAYOUT"),
    getConfig("PROFILE_CARD_ORDER") as Promise<string[] | null>,
  ]);

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

  if (cachedGrid) {
    cachedGrid.classList.toggle("alt-layout-grid", !!altLayoutEnabled);

    if (cardOrder && cardOrder.length > 0) {
      if (reorderCards(cachedGrid, cardOrder)) cachedCards = null;
    } else if (altLayoutEnabled) {
      const liveChildren = Array.from(cachedGrid.children) as HTMLElement[];
      const agenda = liveChildren.find((c) => getCardTitle(c) === "AGENDA");
      const pending = liveChildren.find(
        (c) => getCardTitle(c) === "PENDING EVALUATIONS",
      );

      if (agenda && pending && agenda.previousElementSibling !== pending) {
        agenda.insertAdjacentElement("beforebegin", pending);
        cachedCards = null;
      }
    }
  }

  cards.forEach((card) => {
    const title = getCardTitle(card);
    const isLogtime = title.includes("LOGTIME") && !!altLayoutEnabled;
    const isFixed400 =
      ["PENDING EVALUATIONS", "AGENDA"].includes(title) && !!altLayoutEnabled;

    card.classList.toggle("alt-card-logtime", isLogtime);
    card.classList.toggle("alt-card-fixed-400", isFixed400);
  });
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

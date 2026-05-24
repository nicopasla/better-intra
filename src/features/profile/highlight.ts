import { html, render } from "lit-html";
import { CLUSTERS } from "../clusters/clusters.data.ts";
import ARROW from "../../assets/svg/arrow_share.svg";

/** The unique ID for the injected stylesheet. */
const GLOW_STYLE_ID = "ft-glow-styles";
/** The CSS class applied to a highlighted seat. */
const GLOWING_CLASS = "ft-glowing-seat";
/** A data attribute to mark an element as highlighted. */
const HIGHLIGHT_ATTR = "data-highlighted";
/** The URL query parameter used to specify a seat to highlight. */
const SEAT_PARAM = "seat";
/** The path for the cluster map pages. */
const CLUSTERS_PATH = "/clusters";
/** The scale factor to apply to a highlighted seat. */
const HIGHLIGHT_SCALE = 1.4;

/**
 * Injects the CSS styles for the seat highlight animation into the document head.
 * The styles are only injected once.
 */
function injectHighlightStyles() {
  if (document.getElementById(GLOW_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = GLOW_STYLE_ID;
  style.textContent = `
    @keyframes ft-pulsate {
      0%, 100% {
        filter: drop-shadow(0 0 2px #ff0055) drop-shadow(0 0 5px #ff0055);
      }
      50% {
        filter: drop-shadow(0 0 8px #ff0055) drop-shadow(0 0 15px #ff0055);
      }
    }
    .${GLOWING_CLASS} {
      animation: ft-pulsate 2s infinite ease-in-out !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Finds and removes all active highlight effects from any seat on the page.
 */
function clearExistingHighlight() {
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}='true']`).forEach((el) => {
    el.removeAttribute(HIGHLIGHT_ATTR);
    el.removeAttribute("transform");
    el.classList.remove(GLOWING_CLASS);
  });
}

/**
 * Retrieves the SVG elements corresponding to a given seat identifier.
 * It checks for both standard and alternative (`shi-`) prefixes.
 * @param seatId The seat identifier (e.g., "e1r1p1").
 * @returns A NodeListOf<SVGGraphicsElement> containing the found elements.
 */
function getSeatElements(seatId: string): NodeListOf<SVGGraphicsElement> {
  let elements = document.querySelectorAll<SVGGraphicsElement>(
    `[id="${seatId}"]`,
  );
  if (elements.length === 0) {
    elements = document.querySelectorAll<SVGGraphicsElement>(
      `[id="shi-${seatId}"]`,
    );
  }
  return elements;
}

/**
 * Reads the 'seat' URL parameter and applies the highlight effect to the corresponding seat.
 * If no parameter is found, it clears any existing highlight.
 */
export function highlightSeatFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetSeat = urlParams.get(SEAT_PARAM)?.toLowerCase();

  if (!targetSeat) {
    clearExistingHighlight();
    return;
  }

  const elements = getSeatElements(targetSeat);
  if (elements.length === 0) return;

  const firstEl = elements[0];
  if (firstEl.classList.contains(GLOWING_CLASS)) return;

  clearExistingHighlight();

  const x = parseFloat(firstEl.getAttribute("x") || "0");
  const y = parseFloat(firstEl.getAttribute("y") || "0");
  const w = parseFloat(firstEl.getAttribute("width") || "30");
  const h = parseFloat(firstEl.getAttribute("height") || "30");

  const transX = (x + w / 2) * (1 - HIGHLIGHT_SCALE);
  const transY = (y + h / 2) * (1 - HIGHLIGHT_SCALE);
  const transformString = `translate(${transX}, ${transY}) scale(${HIGHLIGHT_SCALE})`;

  elements.forEach((el) => {
    el.setAttribute(HIGHLIGHT_ATTR, "true");
    el.setAttribute("transform", transformString);
    el.classList.add(GLOWING_CLASS);
    el.parentNode?.appendChild(el); // Bring to front
  });

  setTimeout(() => {
    firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 200);
}

/**
 * Removes the 'seat' parameter from the URL in the browser's history.
 */
function cleanUrlParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has(SEAT_PARAM)) {
    url.searchParams.delete(SEAT_PARAM);
    window.history.replaceState({}, document.title, url.toString());
  }
}

/**
 * Checks if the current page is a cluster map and triggers the highlight logic.
 * It also polls for a short duration to handle dynamically loaded map elements.
 */
function checkRouteAndHighlight() {
  if (!window.location.pathname.includes(CLUSTERS_PATH)) {
    clearExistingHighlight();
    return;
  }

  highlightSeatFromURL();

  // Poll for dynamically loaded seats
  let attempts = 0;
  const interval = setInterval(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetSeat = urlParams.get(SEAT_PARAM)?.toLowerCase();

    if (!targetSeat || attempts++ > 30) {
      clearInterval(interval);
      return;
    }

    if (getSeatElements(targetSeat).length > 0) {
      highlightSeatFromURL();
      clearInterval(interval);
    }
  }, 500);
}

/** A WeakSet to keep track of labels that have already been processed. */
const processedLabels = new WeakSet<HTMLElement>();

/**
 * Enhances the user profile page by making the seat location label a clickable link
 * that opens the corresponding cluster map in a new tab.
 */
export async function handleProfileRedirect() {
  const label = document.querySelector<HTMLElement>(
    ".absolute.px-2.py-1.border.rounded-full.border-neutral-600.bg-ft-gray.top-2.right-4",
  );

  if (!label || processedLabels.has(label)) return;

  const seatText = label.textContent?.trim().toLowerCase();
  if (!seatText || seatText === "unavailable") return;

  processedLabels.add(label);

  const onLabelClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cluster = CLUSTERS.find((c) =>
      seatText.startsWith(c.name.toLowerCase()),
    );
    if (cluster) {
      const targetUrl = `https://meta.intra.42.fr/clusters?seat=${seatText}#cluster-${cluster.id}`;
      window.open(targetUrl, "_blank");
    }
  };

  const template = html`
    <div
      style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s ease-in-out;"
      title="View seat ${seatText} on the cluster map"
      @mouseenter=${(e: MouseEvent) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
        label.style.borderColor = "#ff0055";
      }}
      @mouseleave=${(e: MouseEvent) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        label.style.borderColor = "";
      }}
      @click=${onLabelClick}
    >
      ${Array.from(label.childNodes)}
      <img
        src="${ARROW}"
        alt="Share icon"
        style="width: 12px; height: 12px; filter: invert(1); opacity: 0.7;"
      />
    </div>
  `;
  render(template, label);
}

/**
 * Initializes all features related to seat highlighting and profile redirection.
 * Sets up event listeners to handle navigation and dynamic content.
 */
function init() {
  injectHighlightStyles();

  if (
    window.location.pathname.includes(CLUSTERS_PATH) &&
    window.location.search.includes(`${SEAT_PARAM}=`)
  ) {
    setTimeout(cleanUrlParam, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkRouteAndHighlight);
  } else {
    checkRouteAndHighlight();
  }

  window.addEventListener("popstate", checkRouteAndHighlight);
  window.addEventListener("hashchange", checkRouteAndHighlight);
  document.addEventListener(
    "click",
    () => setTimeout(checkRouteAndHighlight, 100),
    true,
  );
}

init();

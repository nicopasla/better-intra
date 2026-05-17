import { html, render } from "lit-html";
import { CLUSTERS } from "../clusters/clusters.data.ts";
import ARROW from "../../assets/svg/arrow_share.svg";

if (!document.getElementById("ft-glow-styles")) {
  const style = document.createElement("style");
  style.id = "ft-glow-styles";
  style.textContent = `
    @keyframes ft-pulsate {
      0% {
        filter: drop-shadow(0 0 2px #ff0055) drop-shadow(0 0 5px #ff0055);
      }
      50% {
        filter: drop-shadow(0 0 8px #ff0055) drop-shadow(0 0 15px #ff0055);
      }
      100% {
        filter: drop-shadow(0 0 2px #ff0055) drop-shadow(0 0 5px #ff0055);
      }
    }
    .ft-glowing-seat {
      animation: ft-pulsate 1.5s infinite ease-in-out !important;
      transition: transform 0.3s ease-out !important;
    }
  `;
  document.head.appendChild(style);
}

function clearExistingHighlight() {
  const activeElements = document.querySelectorAll("[data-highlighted='true']");
  activeElements.forEach((el) => {
    const htmlEl = el as HTMLElement;

    htmlEl.removeAttribute("data-highlighted");
    htmlEl.removeAttribute("transform");
    htmlEl.classList.remove("ft-glowing-seat");
    htmlEl.style.removeProperty("filter");
  });
}

function cleanUrlParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has("seat")) {
    url.searchParams.delete("seat");
    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash,
    );
  }
}

export function highlightSeatFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetSeat = urlParams.get("seat")?.toLowerCase();

  if (!targetSeat) {
    clearExistingHighlight();
    return;
  }

  const seatPrefix = targetSeat.split("-")[0];
  const targetCluster = CLUSTERS.find(
    (c) => c.name.toLowerCase() === seatPrefix,
  );

  if (targetCluster) {
    const activeClusterHash = window.location.hash;
    if (
      activeClusterHash &&
      activeClusterHash !== `#cluster-${targetCluster.id}`
    ) {
      clearExistingHighlight();
      return;
    }
  }

  let elements = document.querySelectorAll(`[id="${targetSeat}"]`);
  if (elements.length === 0) {
    elements = document.querySelectorAll(`[id="shi-${targetSeat}"]`);
  }

  if (elements.length === 0) return;

  const firstEl = elements[0] as SVGGraphicsElement;
  if (firstEl.classList.contains("ft-glowing-seat")) return;

  clearExistingHighlight();

  const x = parseFloat(firstEl.getAttribute("x") || "0");
  const y = parseFloat(firstEl.getAttribute("y") || "0");
  const w = parseFloat(firstEl.getAttribute("width") || "30");
  const h = parseFloat(firstEl.getAttribute("height") || "30");

  const scale = 1.4;
  const transX = (x + w / 2) * (1 - scale);
  const transY = (y + h / 2) * (1 - scale);
  const transformString = `translate(${transX}, ${transY}) scale(${scale})`;

  elements.forEach((el) => {
    el.setAttribute("data-highlighted", "true");
    el.setAttribute("transform", transformString);
    el.classList.add("ft-glowing-seat");
    el.parentNode?.appendChild(el);
  });

  setTimeout(() => {
    firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 200);
}

function checkRouteAndHighlight() {
  if (window.location.pathname.includes("/clusters")) {
    highlightSeatFromURL();

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const urlParams = new URLSearchParams(window.location.search);
      const targetSeat = urlParams.get("seat")?.toLowerCase();

      if (!targetSeat) {
        clearInterval(interval);
        return;
      }

      const found =
        document.getElementById(targetSeat) ||
        document.getElementById(`shi-${targetSeat}`);
      if (found) {
        highlightSeatFromURL();
        clearInterval(interval);
      }

      if (attempts > 30) clearInterval(interval);
    }, 500);
  } else {
    clearExistingHighlight();
  }
}

if (
  window.location.pathname.includes("/clusters") &&
  window.location.search.includes("seat=")
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
  () => {
    setTimeout(checkRouteAndHighlight, 100);
  },
  true,
);

export async function handleProfileRedirect() {
  const label = document.querySelector<HTMLElement>(
    ".absolute.px-2.py-1.border.rounded-full.border-neutral-600.bg-ft-gray.top-2.right-4",
  );

  if (label && !(label as any)._hasListener) {
    const textElement = label.querySelector(".drop-shadow-md");
    const seatText = textElement?.textContent?.trim().toLowerCase() || "";

    if (seatText && seatText !== "unavailable") {
      (label as any)._hasListener = true;

      const onMouseEnter = () => {
        label.style.borderColor = "#ff0055";
        label.style.transform = "scale(1.05)";
      };

      const onMouseLeave = () => {
        label.style.borderColor = "#525252";
        label.style.transform = "scale(1)";
      };

      const onLabelClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const clusterPrefix = seatText.split("-")[0];
        const cluster = CLUSTERS.find(
          (c) => c.name.toLowerCase() === clusterPrefix,
        );

        if (cluster) {
          const targetUrl = `https://meta.intra.42.fr/clusters?seat=${seatText}#cluster-${cluster.id}`;
          window.open(targetUrl, "_blank");
        }
      };

      const labelTemplate = html`
        <div
          style="
            display: inline-flex; 
            align-items: center; 
            gap: 6px; 
            cursor: pointer; 
            transition: all 0.2s ease-in-out;
          "
          title="View seat ${seatText} on the cluster map"
          @mouseenter=${onMouseEnter}
          @mouseleave=${onMouseLeave}
          @click=${{ handleEvent: onLabelClick, capture: true }}
        >
          ${Array.from(label.childNodes)}
          <img
            src="${ARROW}"
            alt="Share icon"
            style="
              width: 12px; 
              height: 12px; 
              display: block;
              filter: invert(1);
              opacity: 0.7;
              transition: opacity 0.2s ease;
            "
            @mouseenter=${(e: MouseEvent) =>
              ((e.currentTarget as HTMLElement).style.opacity = "1")}
            @mouseleave=${(e: MouseEvent) =>
              ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
          />
        </div>
      `;

      render(labelTemplate, label);
    }
  }
}

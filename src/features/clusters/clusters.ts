import { gmGetValue, gmSetValue } from "../../lib/gm.ts";
import { SCREENS, CLUSTERS, CLUSTER_CONFIG } from "./clusters.data.ts";

type Config = {
  show_markers: boolean;
  default_id: string;
};

export async function initClusters() {
  "use strict";

  let CONFIG: Config;
  let refreshQueued = false;
  let svgObserver: MutationObserver | null = null;
  let bodyObserver: MutationObserver | null = null;
  let observedSvgRoot: SVGSVGElement | null = null;

  function applyMarkersVisibility() {
    if (!CONFIG) return;
    const hidden = !CONFIG.show_markers;
    document.documentElement.classList.toggle("markers-hidden", hidden);
    document.body?.classList.toggle("markers-hidden", hidden);

    document.querySelectorAll<SVGElement>(".custom-screen").forEach((el) => {
      if (hidden) {
        el.style.setProperty("display", "none", "important");
      } else {
        el.style.removeProperty("display");
      }
    });
  }

  function applyManualScreens() {
    if (!CONFIG) return;
    for (const [id, dir] of Object.entries(SCREENS)) {
      const el = document.getElementById(id);
      if (!el?.parentNode) continue;
      if (el.parentNode.querySelector(`.custom-screen[data-for="${id}"]`))
        continue;

      const x = Number(el.getAttribute("x"));
      const y = Number(el.getAttribute("y"));
      const width = Number(el.getAttribute("width")) || 30;
      const height = Number(el.getAttribute("height")) || 30;
      const direction = String(dir).toUpperCase();

      if (Number.isNaN(x) || Number.isNaN(y) || direction === "NONE") continue;

      const chair = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      chair.setAttribute("class", "custom-screen");
      chair.dataset.for = id;

      const chairW = 22;
      const chairH = 4;
      let cx, cy, finalW, finalH;

      if (direction === "UP" || direction === "DOWN") {
        finalW = chairW;
        finalH = chairH;
        cx = x + width / 2 - chairW / 2;
        cy = direction === "DOWN" ? y - chairH : y + height;
      } else {
        finalW = chairH;
        finalH = chairW;
        cx = direction === "RIGHT" ? x - chairH : x + width;
        cy = y + height / 2 - chairW / 2;
      }

      chair.setAttribute("width", String(finalW));
      chair.setAttribute("height", String(finalH));
      chair.setAttribute("x", String(cx));
      chair.setAttribute("y", String(cy));
      chair.setAttribute("rx", "1");
      chair.style.setProperty("fill", CLUSTER_CONFIG.COLOR, "important");
      chair.style.opacity = CLUSTER_CONFIG.OPACITY;
      chair.style.pointerEvents = "none";

      const t = el.getAttribute("transform");
      if (t) chair.setAttribute("transform", t);
      if (!CONFIG.show_markers) chair.style.display = "none";

      el.parentNode.appendChild(chair);
    }
  }

  function refreshMarkersSoon() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      applyManualScreens();
      applyMarkersVisibility();
      requestAnimationFrame(() => {
        applyManualScreens();
        applyMarkersVisibility();
        setTimeout(() => {
          refreshQueued = false;
        }, 160);
      });
    }, 0);
  }

  function getClusterTabsList() {
    const links = document.querySelectorAll('a[href^="#cluster-"]');
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (/^#cluster-\d+$/.test(href)) {
        return link.closest("ul, ol");
      }
    }
    return null;
  }

  function injectClusterPicker() {
    const list = getClusterTabsList();
    if (!list || list.querySelector("#cluster-li-container")) return;

    const li = document.createElement("li");
    li.id = "cluster-li-container";
    Object.assign(li.style, {
      float: "left",
      marginLeft: "-16px",
      display: "inline-flex",
      alignItems: "center",
      height: "100%",
    });

    const currentId = CONFIG.default_id;
    const currentCluster =
      CLUSTERS.find((c) => String(c.id) === String(currentId)) || CLUSTERS[0];

    li.innerHTML = `
      <div style="display: flex; align-items: center; padding: 10px 15px; line-height: 1.42857143; font-family: inherit;">
        <div style="width: 1px; height: 16px; background: #ddd; margin-right: 16px;"></div>
        <div style="position: relative; display: flex; align-items: center; margin-right: 14px; gap: 6px; cursor: pointer;">
          <span style="color: #888; font-size: 13px;">default:</span>
          <span id="current-cluster-display" style="color: #00a8a8; font-size: 14px;">${currentCluster.name.toLowerCase()}</span>
          <select id="cluster-select" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
            ${CLUSTERS.map((c) => `<option value="${c.id}" ${currentId === c.id ? "selected" : ""}>${c.name.toLowerCase()}</option>`).join("")}
          </select>
        </div>
        <div style="width: 1px; height: 16px; background: #ddd; margin-right: 15px;"></div>
        <span id="marker-toggle" style="font-size: 13px; cursor: pointer; padding: 2px 6px; border-radius: 3px;">markers</span>
      </div>`;

    list.appendChild(li);

    const select = li.querySelector<HTMLSelectElement>("#cluster-select");
    const markerToggle = li.querySelector<HTMLElement>("#marker-toggle");

    select?.addEventListener("change", (e) => {
      const val = (e.target as HTMLSelectElement).value;
      gmSetValue("CLUSTERS_DEFAULT_ID", val);
      CONFIG.default_id = val;
      window.location.hash = `#cluster-${val}`;
      location.reload();
    });

    const updateToggleUI = () => {
      if (!markerToggle) return;
      markerToggle.style.backgroundColor = CONFIG.show_markers
        ? "#d4edda"
        : "transparent";
      markerToggle.style.color = CONFIG.show_markers ? "#155724" : "#ccc";
    };

    updateToggleUI();
    markerToggle?.addEventListener("click", () => {
      CONFIG.show_markers = !CONFIG.show_markers;
      gmSetValue("CLUSTERS_SHOW_MARKERS", CONFIG.show_markers);
      updateToggleUI();
      refreshMarkersSoon();
    });
  }

  async function start() {
    CONFIG = {
      show_markers: await gmGetValue("CLUSTERS_SHOW_MARKERS", true),
      default_id: await gmGetValue("CLUSTERS_DEFAULT_ID", ""),
    };

    const findAndAttach = () => {
      const svg = document.querySelector<SVGSVGElement>("svg");
      if (svg && svg !== observedSvgRoot) {
        if (svgObserver) svgObserver.disconnect();
        observedSvgRoot = svg;
        svgObserver = new MutationObserver(refreshMarkersSoon);
        svgObserver.observe(svg, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["x", "y", "transform"],
        });
        refreshMarkersSoon();
      }
    };

    bodyObserver = new MutationObserver(() => {
      findAndAttach();
      injectClusterPicker();
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });

    const hashMatch = window.location.hash.match(/cluster-(\d+)/);
    const targetId = hashMatch ? hashMatch[1] : CONFIG.default_id;
    if (targetId) {
      const checkInterval = setInterval(() => {
        const el = document.querySelector<HTMLAnchorElement>(
          `a[href="#cluster-${targetId}"]`,
        );
        if (el) {
          el.click();
          clearInterval(checkInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 3000);
    }

    console.log("Clusters loaded!");
  }

  start();
}

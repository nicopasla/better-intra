import { gmGetValue, gmSetValue } from "../../lib/gm.ts";
import { SCREENS, CLUSTERS, CLUSTER_CONFIG } from "./clusters.data.ts";
import { MARKERS_VISIBLE_KEY, DEFAULT_ID_KEY, getBoolValue, getClusterTabsList } from "./clusters.utils.ts";

export async function initClusters() {
  "use strict";

  let markersVisible = getBoolValue(MARKERS_VISIBLE_KEY, true);
  const savedId = gmGetValue(DEFAULT_ID_KEY, null);

  let rafId: number | null = null;
  let refreshQueued = false;
  let svgObserver: MutationObserver | null = null;
  let bodyObserver: MutationObserver | null = null;
  let observedSvgRoot: SVGSVGElement | null = null;


  function applyMarkersVisibility() {
    const hidden = !markersVisible;
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
    for (const [id, dir] of Object.entries(SCREENS)) {
      const el = document.getElementById(id);
      if (!el?.parentNode) continue;
      if (el.parentNode.querySelector(`.custom-screen[data-for="${id}"]`)) continue;

      const x = Number(el.getAttribute("x"));
      const y = Number(el.getAttribute("y"));
      const width = Number(el.getAttribute("width")) || 30;
      const height = Number(el.getAttribute("height")) || 30;
      const direction = String(dir).toUpperCase();

      if (Number.isNaN(x) || Number.isNaN(y) || direction === "NONE") continue;

      const chairW = 22;
      const chairH = 4;
      const gap = 0;

      const chair = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      chair.setAttribute("class", "custom-screen");
      chair.dataset.for = id;

      let cx, cy, finalW, finalH;
      if (direction === "UP" || direction === "DOWN") {
        finalW = chairW;
        finalH = chairH;
        cx = x + width / 2 - chairW / 2;
        cy = direction === "DOWN" ? y - chairH - gap : y + height + gap;
      } else {
        finalW = chairH;
        finalH = chairW;
        cx = direction === "RIGHT" ? x - chairH - gap : x + width + gap;
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
      if (!markersVisible) chair.style.display = "none";

      el.parentNode.appendChild(chair);
    }
  }

  function hookClusterTabClicks() {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="#cluster-"]');
    links.forEach((link) => {
      if (link.dataset.markersHooked === "1") return;
      link.dataset.markersHooked = "1";
      link.addEventListener("click", () => refreshMarkersSoon());
    });
  }

  function forceTab(id: string) {
    const el = document.querySelector<HTMLAnchorElement>(`a[href="#cluster-${id}"]`);
    if (!el) return false;
    el.click();
    const parent = el.parentElement;
    const list = parent?.parentElement;
    if (parent && list) {
      list.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
      parent.classList.add("active");
    }
    return true;
  }

  function injectClusterPicker() {
    const list = getClusterTabsList();
    if (!list || list.querySelector("#cluster-li-container")) return;

    hookClusterTabClicks();
    const li = document.createElement("li");
    li.id = "cluster-li-container";
    Object.assign(li.style, { float: "left", marginLeft: "-16px", display: "inline-flex", alignItems: "center", height: "100%" });

    const currentId = gmGetValue(DEFAULT_ID_KEY, null);
    const currentCluster = CLUSTERS.find((c) => String(c.id) === String(currentId)) || CLUSTERS[0];

    li.innerHTML = `
      <div style="display: flex; align-items: center; padding: 10px 15px; line-height: 1.42857143; font-family: inherit;">
        <div style="width: 1px; height: 16px; background: #ddd; margin-right: 16px;"></div>
        <div style="position: relative; display: flex; align-items: center; margin-right: 14px; gap: 6px; cursor: pointer;">
          <span style="color: #888; font-size: 13px; text-transform: lowercase; pointer-events: none;">default:</span>
          <span id="current-cluster-display" style="color: #00a8a8; font-size: 14px; text-transform: lowercase; pointer-events: none;">
            ${currentCluster.name.toLowerCase()}
          </span>
          <select id="cluster-select" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; appearance: none;">
            ${CLUSTERS.map((c, i) => `<option value="${c.id}" ${currentId === c.id || (!currentId && i === 0) ? "selected" : ""}>${c.name.toLowerCase()}</option>`).join("")}
          </select>
        </div>
        <div style="width: 1px; height: 16px; background: #ddd; margin-right: 15px;"></div>
        <span id="marker-toggle" style="margin-left: -16px; font-size: 13px; cursor: pointer; text-transform: lowercase; user-select: none; transition: all 0.2s; padding: 2px 6px; border-radius: 3px;">markers</span>
      </div>`;

    list.appendChild(li);

    const select = li.querySelector<HTMLSelectElement>("#cluster-select");
    const display = li.querySelector<HTMLElement>("#current-cluster-display");
    const markerToggle = li.querySelector<HTMLElement>("#marker-toggle");

    select?.addEventListener("change", (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (val) {
        if (display) display.textContent = select.options[select.selectedIndex].text.toLowerCase();
        gmSetValue(DEFAULT_ID_KEY, val);
        window.location.hash = `#cluster-${val}`;
        forceTab(val);
      }
    });

    const updateToggleUI = () => {
      if (!markerToggle) return;
      markerToggle.style.backgroundColor = markersVisible ? "#d4edda" : "transparent";
      markerToggle.style.color = markersVisible ? "#155724" : "#ccc";
    };

    updateToggleUI();
    markerToggle?.addEventListener("click", () => {
      markersVisible = !markersVisible;
      gmSetValue(MARKERS_VISIBLE_KEY, markersVisible);
      updateToggleUI();
      refreshMarkersSoon();
    });
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
          applyManualScreens();
          applyMarkersVisibility();
          refreshQueued = false;
        }, 160);
      });
    }, 0);
  }

  function scheduleApplyManualScreens() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      applyManualScreens();
    });
  }

  function attachSvgObserver(svgRoot: SVGSVGElement) {
    if (!svgRoot || svgRoot === observedSvgRoot) return;
    if (svgObserver) svgObserver.disconnect();
    observedSvgRoot = svgRoot;
    svgObserver = new MutationObserver(() => {
      scheduleApplyManualScreens();
      refreshMarkersSoon();
    });
    svgObserver.observe(svgRoot, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["id", "class", "x", "y", "width", "height", "transform"],
    });
    refreshMarkersSoon();
  }

  function initObserver() {
    const findAndAttach = () => {
      const svgRoot = document.querySelector<SVGSVGElement>("svg");
      if (svgRoot) attachSvgObserver(svgRoot);
    };
    findAndAttach();
    if (!bodyObserver) {
      bodyObserver = new MutationObserver(() => {
        findAndAttach();
        hookClusterTabClicks();
        injectClusterPicker();
        refreshMarkersSoon();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function initClusterFixer() {
    const checkInterval = setInterval(() => {
      injectClusterPicker();
      const hashMatch = window.location.hash.match(/cluster-(\d+)/);
      const targetId = hashMatch ? hashMatch[1] : savedId;
      if (targetId && forceTab(targetId)) clearInterval(checkInterval);
    }, 100);
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  initObserver();
  initClusterFixer();
  console.log("Clusters loaded!");
}
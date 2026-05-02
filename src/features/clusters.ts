import { gmGetValue, gmSetValue } from "../lib/gm.ts";
import { SCREENS, CLUSTERS, CLUSTER_CONFIG } from "./clusters.data.ts";

import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/card/card.js";

export async function initClusters() {
  (function () {
    "use strict";

    const MARKERS_VISIBLE_KEY = "CLUSTERS_SHOW_MARKERS";
    const DEFAULT_ID_KEY = "CLUSTERS_DEFAULT_ID";

    const getBoolValue = (key: string, fallback: boolean) => {
      const raw = gmGetValue(key, fallback);
      if (typeof raw === "boolean") return raw;
      if (raw === null || raw === undefined) return fallback;
      return raw === "true" || raw === "1" || raw === 1;
    };

    let markersVisible = getBoolValue(MARKERS_VISIBLE_KEY, true);
    const savedId = gmGetValue(DEFAULT_ID_KEY, null);

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

    function updateMarkerToggleButton(btn: any) {
      if (!btn) return;

      if (markersVisible) {
        btn.variant = "success";
      } else {
        btn.variant = "danger";
      }

      btn.setAttribute("aria-pressed", String(markersVisible));
    }

    function hookClusterTabClicks() {
      const links = document.querySelectorAll<HTMLAnchorElement>(
        'a[href^="#cluster-"]',
      );
      links.forEach((link) => {
        if (link.dataset.markersHooked === "1") return;
        link.dataset.markersHooked = "1";
        link.addEventListener("click", () => refreshMarkersSoon());
      });
    }

    function injectClusterPicker() {
      const list = getClusterTabsList();
      if (!list || list.querySelector("#cluster-li-container")) return;

      hookClusterTabClicks();

      const li = document.createElement("li");
      li.id = "cluster-li-container";
      li.style.float = "left";
      li.style.marginLeft = "10px";
      li.style.marginBottom = "-1px";
      li.style.border = "1px solid transparent";
      li.style.borderBottom = "1px solid transparent";
      li.style.position = "relative";
      li.style.top = "-1px";

      const currentId = gmGetValue(DEFAULT_ID_KEY, null);
      const currentCluster = CLUSTERS.find((c) => c.id === currentId);

      li.innerHTML = `
        <a style="
          display: block;
          padding: 10px 15px;
          line-height: 1.42857143;
        ">
          <div class="cluster-picker" style="display: flex; align-items: center; gap: 10px;">
            <span>Default</span>

            <wa-dropdown hoist id="cluster-dropdown">
              <wa-button slot="trigger" appearance="filled" size="m" with-caret>
                ${currentCluster ? currentCluster.name.toUpperCase() : "Cluster"}
              </wa-button>

              ${CLUSTERS.map(
                (c) => `
                <wa-dropdown-item
                  value="${c.id}"
                  ${currentId === c.id ? "checked" : ""}
                >
                  ${c.name.toUpperCase()}
                </wa-dropdown-item>
              `,
              ).join("")}

            </wa-dropdown>

            <div style="width: 1px; height: 18px; background: #ddd;"></div>

            <wa-button id="marker-toggle" size="m">
              Markers
            </wa-button>
          </div>
        </a>
      `;

      list.appendChild(li);

      const dropdown = li.querySelector("#cluster-dropdown");
      dropdown?.addEventListener("wa-select", (e: any) => {
        const item = e.detail.item;
        const val = item.value;
        if (!val) return;

        gmSetValue(DEFAULT_ID_KEY, val);
        window.location.hash = `#cluster-${val}`;

        const btn = li.querySelector("wa-button[slot='trigger']");
        if (btn) btn.textContent = item.textContent;

        forceTab(val);
      });

      const markerToggle = li.querySelector<HTMLElement>("#marker-toggle");
      updateMarkerToggleButton(markerToggle);

      markerToggle?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        markersVisible = !markersVisible;
        gmSetValue(MARKERS_VISIBLE_KEY, markersVisible);
        refreshMarkersSoon();
        updateMarkerToggleButton(markerToggle);
      });
    }

    function initClusterFixer() {
      const checkInterval = setInterval(() => {
        injectClusterPicker();
        const hashMatch = window.location.hash.match(/cluster-(\d+)/);
        const targetId = hashMatch ? hashMatch[1] : savedId;
        if (targetId && forceTab(targetId)) {
          clearInterval(checkInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 5000);
    }

    let rafId: number | null = null;
    let refreshQueued = false;
    let svgObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let observedSvgRoot: SVGSVGElement | null = null;

    function scheduleApplyManualScreens() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applyManualScreens();
      });
    }

    function refreshMarkersNow() {
      applyManualScreens();
      applyMarkersVisibility();
    }

    function refreshMarkersSoon() {
      if (refreshQueued) return;
      refreshQueued = true;
      setTimeout(() => {
        refreshMarkersNow();
        requestAnimationFrame(() => {
          refreshMarkersNow();
          setTimeout(() => {
            refreshMarkersNow();
            refreshQueued = false;
          }, 160);
        });
      }, 0);
    }

    function applyManualScreens() {
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

        if (Number.isNaN(x) || Number.isNaN(y) || direction === "NONE")
          continue;

        const d = buildCurvePath(x, y, width, height, direction);
        if (!d) continue;

        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("class", "custom-screen");
        path.dataset.for = id;
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", CLUSTER_CONFIG.COLOR);
        path.setAttribute("stroke-width", String(CLUSTER_CONFIG.THICKNESS));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("vector-effect", "non-scaling-stroke");

        const t = el.getAttribute("transform");
        if (t) path.setAttribute("transform", t);

        path.style.opacity = CLUSTER_CONFIG.OPACITY;
        path.style.pointerEvents = "none";
        if (!markersVisible) path.style.display = "none";

        el.parentNode.appendChild(path);
      }
    }

    function buildCurvePath(
      x: number,
      y: number,
      width: number,
      height: number,
      direction: string,
    ) {
      const ox = (width - CLUSTER_CONFIG.BAR_SIZE) / 2;
      const midX = x + width / 2;
      const midY = y + height / 2;

      if (direction === "UP") {
        const yPos = y + 1;
        return `M ${x + ox} ${yPos} Q ${midX} ${yPos - CLUSTER_CONFIG.CURVE_DEPTH} ${x + ox + CLUSTER_CONFIG.BAR_SIZE} ${yPos}`;
      }
      if (direction === "DOWN") {
        const yPos = y + height - 1;
        return `M ${x + ox} ${yPos} Q ${midX} ${yPos + CLUSTER_CONFIG.CURVE_DEPTH} ${x + ox + CLUSTER_CONFIG.BAR_SIZE} ${yPos}`;
      }
      if (direction === "LEFT") {
        const xPos = x + 1;
        const oy = (height - CLUSTER_CONFIG.BAR_SIZE) / 2;
        return `M ${xPos} ${y + oy} Q ${xPos - CLUSTER_CONFIG.CURVE_DEPTH} ${midY} ${xPos} ${y + oy + CLUSTER_CONFIG.BAR_SIZE}`;
      }
      if (direction === "RIGHT") {
        const xPos = x + width - 1;
        const oy = (height - CLUSTER_CONFIG.BAR_SIZE) / 2;
        return `M ${xPos} ${y + oy} Q ${xPos + CLUSTER_CONFIG.CURVE_DEPTH} ${midY} ${xPos} ${y + oy + CLUSTER_CONFIG.BAR_SIZE}`;
      }
      return "";
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

    function forceTab(id: string) {
      const el = document.querySelector<HTMLAnchorElement>(
        `a[href="#cluster-${id}"]`,
      );
      if (!el) return false;
      el.click();
      const parent = el.parentElement;
      const list = parent?.parentElement;
      if (parent && list) {
        list
          .querySelectorAll("li")
          .forEach((li) => li.classList.remove("active"));
        parent.classList.add("active");
      }
      return true;
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
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "id",
          "class",
          "x",
          "y",
          "width",
          "height",
          "transform",
        ],
      });
      refreshMarkersSoon();
    }

    initObserver();
    initClusterFixer();
  })();
  console.log("Clusters loaded!");
}

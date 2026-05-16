import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import { SCREENS, CLUSTERS, CLUSTER_CONFIG } from "./clusters.data.ts";
import CSS from "../../assets/style.css?inline";

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
    requestAnimationFrame(() => {
      applyManualScreens();
      applyMarkersVisibility();
      refreshQueued = false;
    });
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

  function renderClusterPicker(
    currentId: string,
    showMarkers: boolean,
    onClusterChange: (value: string) => void,
    onMarkerToggle: () => void,
  ) {
    const openSelectDropdown = (e: Event) => {
      e.preventDefault();
      const host = (e.currentTarget as HTMLElement).getRootNode() as ShadowRoot;
      const select = host.getElementById(
        "cluster-select",
      ) as HTMLSelectElement | null;
      if (select) {
        try {
          select.showPicker();
        } catch (err) {
          select.focus();
        }
      }
    };

    return html`
      <div
        class="flex items-center gap-5 px-4 py-1 text-base-content bg-transparent"
      >
        <div class="tooltip">
          <div class="tooltip-content">
            <div class="text-lg whitespace-nowrap">
              Choose a default cluster
            </div>
          </div>

          <div
            class="flex items-center gap-3 cursor-pointer select-none py-1"
            @click="${openSelectDropdown}"
          >
            <select
              id="cluster-select"
              class="select select-lg select-ghost text-primary font-black uppercase min-w-32 text-xl focus:bg-transparent px-2"
              @change="${(e: Event) =>
                onClusterChange((e.target as HTMLSelectElement).value)}"
              @click="${(e: Event) => e.stopPropagation()}"
            >
              ${CLUSTERS.map(
                (c) => html`
                  <option
                    value="${c.id}"
                    ?selected="${String(currentId) === String(c.id)}"
                  >
                    ${c.name.toLowerCase()}
                  </option>
                `,
              )}
            </select>
          </div>
        </div>

        <div class="h-8 w-px bg-base-content/20"></div>

        <button
          class="btn btn-lg px-8 text-base font-bold uppercase tracking-wider ${showMarkers
            ? "btn-primary"
            : "btn-outline opacity-70"}"
          @click="${onMarkerToggle}"
        >
          markers
        </button>
      </div>
    `;
  }

  function injectClusterPicker() {
    const list = getClusterTabsList() as HTMLElement | null;
    if (!list || document.querySelector("#cluster-shadow-host")) return;

    list.style.setProperty("position", "relative", "important");

    const shadowHost = document.createElement("div");
    shadowHost.id = "cluster-shadow-host";

    shadowHost.style.setProperty("position", "absolute", "important");
    shadowHost.style.setProperty("top", "50%", "important");
    shadowHost.style.setProperty("transform", "translateY(-50%)", "important");
    shadowHost.style.setProperty("right", "0px", "important");
    shadowHost.style.setProperty("z-index", "10", "important");
    shadowHost.style.setProperty("display", "inline-flex", "important");
    shadowHost.style.setProperty("align-items", "center", "important");
    shadowHost.style.setProperty("height", "64px", "important");

    const shadowRoot = shadowHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      ${CSS}
      :host {
        display: inline-flex !important;
        align-items: center !important;
      }
      .tooltip {
        position: relative;
        display: inline-block;
      }
      .tooltip .tooltip-content {
        position: absolute;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s ease, visibility 0.15s ease;
        z-index: 50;
      }
      .tooltip:hover .tooltip-content {
        opacity: 1 !important;
        visibility: visible !important;
      }
    `;
    shadowRoot.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.id = "cluster-li-container";
    wrapper.setAttribute("data-theme", "light");
    shadowRoot.appendChild(wrapper);

    const handleClusterChange = async (value: string) => {
      await browser.storage.local.set({ CLUSTERS_DEFAULT_ID: value });
      CONFIG.default_id = value;
      window.location.hash = `#cluster-${value}`;

      const nativeTab = document.querySelector<HTMLAnchorElement>(
        `a[href="#cluster-${value}"]`,
      );
      if (nativeTab) nativeTab.click();

      reRender();
    };

    const handleMarkerToggle = async () => {
      CONFIG.show_markers = !CONFIG.show_markers;
      await browser.storage.local.set({
        CLUSTERS_SHOW_MARKERS: CONFIG.show_markers,
      });
      reRender();
      refreshMarkersSoon();
    };

    const reRender = () => {
      render(
        renderClusterPicker(
          CONFIG.default_id,
          CONFIG.show_markers,
          handleClusterChange,
          handleMarkerToggle,
        ),
        wrapper,
      );
    };

    reRender();
    list.appendChild(shadowHost);
  }

  async function start() {
    const show_markers = await getConfig("CLUSTERS_SHOW_MARKERS");
    const default_id = await getConfig("CLUSTERS_DEFAULT_ID");
    CONFIG = { show_markers, default_id };

    refreshMarkersSoon();

    const findAndAttach = () => {
      const svg = document.querySelector<SVGSVGElement>("svg");
      if (svg && svg !== observedSvgRoot) {
        if (svgObserver) svgObserver.disconnect();
        observedSvgRoot = svg;

        svgObserver = new MutationObserver(() => {
          refreshMarkersSoon();
        });

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

    findAndAttach();
    injectClusterPicker();

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

    setInterval(() => {
      findAndAttach();
      injectClusterPicker();
      refreshMarkersSoon();
    }, 500);

    console.log("Clusters loaded!");
  }

  start();
}

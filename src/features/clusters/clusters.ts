import { getConfig } from "../../config.ts";
import { applyManualScreens, applyMarkersVisibility, injectUI } from "./dom.ts";
import { createShadowUI } from "./ui.ts";
import { ensureCampusData } from "../campus/campus.ts";

type Config = {
  show_markers: boolean;
  default_id: string;
};

export async function initClusters() {
  "use strict";

  let CONFIG: Config;
  let refreshQueued = false;
  let svgObserver: MutationObserver | null = null;
  let observedSvgRoot: SVGSVGElement | null = null;

  function refreshMarkersSoon() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      applyManualScreens(CONFIG.show_markers);
      applyMarkersVisibility(CONFIG.show_markers);
      refreshQueued = false;
    });
  }

  const handleClusterChange = async (value: string) => {
    await chrome.storage.local.set({ CLUSTERS_DEFAULT_ID: value });
    CONFIG.default_id = value;
    window.location.hash = `#cluster-${value}`;

    const nativeTab = document.querySelector<HTMLAnchorElement>(
      `a[href="#cluster-${value}"]`,
    );
    if (nativeTab) nativeTab.click();

    reRenderUI();
  };

  const handleMarkerToggle = async () => {
    CONFIG.show_markers = !CONFIG.show_markers;
    await chrome.storage.local.set({
      CLUSTERS_SHOW_MARKERS: CONFIG.show_markers,
    });
    reRenderUI();
    refreshMarkersSoon();
  };

  const { shadowHost, reRender } = createShadowUI(
    handleClusterChange,
    handleMarkerToggle,
  );

  const reRenderUI = () => {
    reRender(CONFIG.default_id, CONFIG.show_markers);
  };

  async function start() {
    await ensureCampusData();
    CONFIG = {
      show_markers: await getConfig("CLUSTERS_SHOW_MARKERS"),
      default_id: await getConfig("CLUSTERS_DEFAULT_ID"),
    };

    reRenderUI();
    refreshMarkersSoon();

    if (await getConfig("CLUSTERS_OPEN_NEW_TAB")) {
      document.addEventListener("click", onClusterProfileClick, true);
    }

    const findAndAttach = () => {
      const svg = document.querySelector<SVGSVGElement>("svg");
      if (svg && svg !== observedSvgRoot) {
        if (svgObserver) svgObserver.disconnect();
        observedSvgRoot = svg;

        svgObserver = new MutationObserver(() => refreshMarkersSoon());
        svgObserver.observe(svg, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["x", "y", "transform"],
        });
        refreshMarkersSoon();
      }
    };

    findAndAttach();
    injectUI(shadowHost);

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

    const pollTimer = setInterval(() => {
      findAndAttach();
      injectUI(shadowHost);
      refreshMarkersSoon();
      if (observedSvgRoot && document.getElementById("ft-cluster-ui")) {
        clearInterval(pollTimer);
      }
    }, 500);
    addEventListener(
      "pagehide",
      () => {
        clearInterval(pollTimer);
        if (svgObserver) svgObserver.disconnect();
      },
      { once: true },
    );
  }

  function onClusterProfileClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    const svgImage = target.closest("image[data-tooltip-login]");
    if (svgImage) {
      const login = svgImage.getAttribute("data-tooltip-login");
      if (login) {
        e.preventDefault();
        e.stopPropagation();
        window.open(`https://profile.intra.42.fr/users/${login}`, "_blank");
        return;
      }
    }

    const link = target.closest(
      "a[href*='profile.intra.42.fr/users/']",
    ) as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, "_blank");
    }
  }

  start();
}

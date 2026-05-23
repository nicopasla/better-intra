import { SCREENS } from "./clusters.data.ts";

export function applyMarkersVisibility(showMarkers: boolean) {
  const hidden = !showMarkers;
  document.documentElement.classList.toggle("markers-hidden", hidden);
  document.body?.classList.toggle("markers-hidden", hidden);

  document.querySelectorAll<SVGElement>(".custom-screen").forEach((el) => {
    el.style.display = hidden ? "none" : "";
  });
}

export function applyManualScreens(showMarkers: boolean) {
  for (const [id, dir] of Object.entries(SCREENS)) {
    const el = document.getElementById(id);
    if (
      !el?.parentNode ||
      el.parentNode.querySelector(`.custom-screen[data-for="${id}"]`)
    ) {
      continue;
    }

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

    const chairW = 22,
      chairH = 4;
    let cx: number, cy: number, finalW: number, finalH: number;

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
    Object.assign(chair.style, {
      fill: "#00babc",
      opacity: "0.9",
      pointerEvents: "none",
      display: showMarkers ? "" : "none",
    });

    const t = el.getAttribute("transform");
    if (t) chair.setAttribute("transform", t);

    el.parentNode.appendChild(chair);
  }
}

export function getClusterTabsList(): HTMLElement | null {
  const links = document.querySelectorAll('a[href^="#cluster-"]');
  for (const link of links) {
    if (/^#cluster-\d+$/.test(link.getAttribute("href") || "")) {
      return link.closest("ul, ol");
    }
  }
  return null;
}

export function injectUI(shadowHost: HTMLElement) {
  const list = getClusterTabsList();
  if (list && !document.querySelector("#cluster-shadow-host")) {
    list.style.position = "relative";
    list.appendChild(shadowHost);
  }
}

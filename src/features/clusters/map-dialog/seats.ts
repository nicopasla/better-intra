import { SeatPos } from "./crop";
import { SCREENS } from "../clusters.data.ts";

const SEAT_ID_PATTERN = /[a-z]\d+[-_ ]?[ps]\d+$/i;
const DANGEROUS_ATTR = /^on/i;

export function normalizeSeatId(id: string): string {
  return id.toLowerCase().replace(/[-\s_]/g, "");
}

export function getSvgTitle(svgDoc: Document): string {
  return svgDoc.querySelector("svg > title")?.textContent?.trim() || "";
}

// Elements that can embed active or remote content inside the intra page once
// the SVG is imported into the document.
const FORBIDDEN_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "form",
]);

/** url(...) whose target is not a local fragment reference (#id). */
const REMOTE_URL_RE = /url\s*\(\s*(?!['"]?#)[^)]*\)/gi;

/** True for hrefs that stay inside the document or the data itself. */
function isLocalHref(href: string): boolean {
  const v = href.trim();
  return v === "" || v.startsWith("#") || /^data:image\//i.test(v);
}

export function sanitizeAndParseSeats(svgDoc: Document): Map<string, SeatPos> {
  for (const el of svgDoc.querySelectorAll("*")) {
    const tagName = el.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tagName)) {
      el.remove();
      continue;
    }
    if (tagName === "use") {
      const href =
        el.getAttribute("href") || el.getAttribute("xlink:href") || "";
      if (!href.startsWith("#")) {
        el.remove();
        continue;
      }
    }
    if (tagName === "style") {
      // keep local styling (url(#gradient) etc.) but strip remote loads
      const css = el.textContent || "";
      if (/@import|url\s*\(/i.test(css)) {
        el.textContent = css
          .replace(/@import[^;]*;?/gi, "")
          .replace(REMOTE_URL_RE, "none");
      }
      continue;
    }
    for (const attr of [...el.attributes]) {
      if (DANGEROUS_ATTR.test(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === "href" || attr.name === "xlink:href") {
        if (/^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        } else if (tagName === "image" && !isLocalHref(attr.value)) {
          // seat <image> elements are kept (their ids matter) but must not
          // load remote resources on the viewer's behalf
          el.removeAttribute(attr.name);
        }
      }
      if (
        attr.name === "style" &&
        (REMOTE_URL_RE.test(attr.value) || /expression\s*\(/i.test(attr.value))
      ) {
        // fill:url(#grad) is fine; url(https://...) is not
        el.setAttribute(attr.name, attr.value.replace(REMOTE_URL_RE, "none"));
      }
    }
  }

  const seatIds = new Set<string>();
  for (const img of svgDoc.querySelectorAll("image[id]")) {
    seatIds.add(normalizeSeatId(img.getAttribute("id")!));
  }

  const seatMap = new Map<string, SeatPos>();
  for (const el of svgDoc.querySelectorAll("[id]")) {
    const id = el.getAttribute("id")!;
    if (!seatIds.has(normalizeSeatId(id)) && !SEAT_ID_PATTERN.test(id)) {
      continue;
    }
    const key = normalizeSeatId(id);
    if (seatMap.has(key)) continue;
    seatMap.set(key, {
      x: parseFloat(el.getAttribute("x") || "0"),
      y: parseFloat(el.getAttribute("y") || "0"),
      w: parseFloat(el.getAttribute("width") || "30"),
      h: parseFloat(el.getAttribute("height") || "30"),
    });
  }
  return seatMap;
}

export function applyMarkers(container: HTMLElement, visible: boolean) {
  const byNormalizedId = new Map<string, Element>();
  for (const el of container.querySelectorAll("[id]")) {
    const key = normalizeSeatId(el.getAttribute("id")!);
    if (!byNormalizedId.has(key)) byNormalizedId.set(key, el);
  }

  for (const [id, dir] of Object.entries(SCREENS)) {
    const el = byNormalizedId.get(normalizeSeatId(id));
    if (!el?.parentNode) continue;
    if (el.parentNode.querySelector(`.custom-screen[data-for="${id}"]`))
      continue;

    const x = Number(el.getAttribute("x"));
    const y = Number(el.getAttribute("y"));
    const w = Number(el.getAttribute("width")) || 30;
    const h = Number(el.getAttribute("height")) || 30;
    const dirStr = String(dir).toUpperCase();
    if (Number.isNaN(x) || Number.isNaN(y) || dirStr === "NONE") continue;

    const chair = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    chair.setAttribute("class", "custom-screen");
    chair.dataset.for = id;

    const cw = 22,
      ch = 4;
    let cx: number, cy: number, fw: number, fh: number;
    if (dirStr === "UP" || dirStr === "DOWN") {
      fw = cw;
      fh = ch;
      cx = x + w / 2 - cw / 2;
      cy = dirStr === "DOWN" ? y - ch : y + h;
    } else {
      fw = ch;
      fh = cw;
      cx = dirStr === "RIGHT" ? x - ch : x + w;
      cy = y + h / 2 - cw / 2;
    }
    chair.setAttribute("width", String(fw));
    chair.setAttribute("height", String(fh));
    chair.setAttribute("x", String(cx));
    chair.setAttribute("y", String(cy));
    chair.setAttribute("rx", "1");
    Object.assign(chair.style, {
      fill: "var(--color-accent)",
      opacity: "0.9",
      pointerEvents: "none",
      display: visible ? "" : "none",
    });
    const t = el.getAttribute("transform");
    if (t) chair.setAttribute("transform", t);
    el.parentNode.appendChild(chair);
  }
}

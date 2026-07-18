export interface SeatPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cropSvgViewBox(
  container: HTMLElement,
  seats?: Map<string, SeatPos>,
): { w: number; h: number } | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const vbOld = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  if (vbOld.length < 4) return null;
  const vbW = vbOld[2];
  const vbH = vbOld[3];

  let hasRotatedContent = false;
  for (const el of svg.querySelectorAll("[transform]")) {
    if (el.tagName.toLowerCase() === "text") continue;
    if (/\brotate\b/.test(el.getAttribute("transform") || "")) {
      hasRotatedContent = true;
      break;
    }
  }

  if (!seats || seats.size === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [, pos] of seats) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pos.w);
    maxY = Math.max(maxY, pos.y + pos.h);
  }

  if (!isFinite(minY)) return null;
  const pad = 60;

  if (hasRotatedContent) {
    minX = 0;
    maxX = vbW;
  } else {
    minX = Math.max(0, minX - pad);
    maxX = Math.min(vbW, maxX + pad);
  }

  minY = Math.max(0, minY - pad);
  maxY = Math.min(vbH, maxY + pad);

  const newW = maxX - minX;
  const newH = maxY - minY;
  if (newW <= 0 || newH <= 0) return null;
  svg.setAttribute("viewBox", `${minX} ${minY} ${newW} ${newH}`);
  return { w: newW, h: newH };
}

import { escapeHtml } from "../../../utils/tooltip.ts";
import { SEAT_COMPONENT_MAP, type SeatComponentKey } from "./components";

export interface SeatComponentIcons {
  /** Normal icon: the component is working. */
  on: string;
  /** Crossed/off icon: the component is reported broken. */
  off: string;
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const SLASH = `<path d="m2 2 20 20"/>`;
const slashed = (body: string) => svg(`${body}${SLASH}`);

export const SEAT_COMPONENT_ICONS: Record<
  SeatComponentKey,
  SeatComponentIcons
> = {
  boot: {
    on: svg(`<path d="M12 2v10"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>`),
    off: slashed(
      `<path d="M12 2v10"/><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>`,
    ),
  },
  network: {
    on: svg(
      `<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>`,
    ),
    off: svg(
      `<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>`,
    ),
  },
  keyboard: {
    on: svg(
      `<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>`,
    ),
    off: svg(
      `<path d="M20 4A2 2 0 0 1 22 6"/><path d="M22 6v10.41"/><path d="M7 16h9"/><path d="M9.69 4H20"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="m2 2 20 20"/><path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/><path d="M6 8h.01"/><path d="M8 12h.01"/>`,
    ),
  },
  mouse_scroll: {
    on: svg(
      `<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/><path d="m9 9 3-3 3 3"/>`,
    ),
    off: slashed(
      `<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/><path d="m9 9 3-3 3 3"/>`,
    ),
  },
  computer: {
    on: svg(
      `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
    ),
    off: slashed(
      `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
    ),
  },
  usbc: {
    on: svg(
      `<rect x="2" y="7" width="20" height="10" rx="5"/><rect x="6" y="11" width="12" height="2" rx="1" fill="currentColor" stroke="none"/>`,
    ),
    off: slashed(
      `<rect x="2" y="7" width="20" height="10" rx="5"/><rect x="6" y="11" width="12" height="2" rx="1" fill="currentColor" stroke="none"/>`,
    ),
  },
};

/**
 * Rich tooltip for the non-blocking issue triangle: one row per broken part,
 * with the same crossed icon the report sheet uses.
 */
export function seatIssueTooltipHtml(
  components: SeatComponentKey[],
): string {
  if (components.length === 0) return "";
  const rows = components.map((key) => {
    const label = SEAT_COMPONENT_MAP.get(key)?.label ?? key;
    const icon = SEAT_COMPONENT_ICONS[key]?.off ?? "";
    const sized = icon.replace("<svg", '<svg width="14" height="14"');
    return (
      `<span style="display:flex;align-items:center;gap:6px;white-space:nowrap">` +
      `<span style="display:flex;width:14px;height:14px;flex:0 0 auto;color:#f59e0b">${sized}</span>` +
      `<span>${escapeHtml(label)}</span></span>`
    );
  });
  return (
    `<span style="display:flex;flex-direction:column;gap:4px">` +
    `<span style="font-weight:700;text-align:center">Broken</span>` +
    rows.join("") +
    `</span>`
  );
}

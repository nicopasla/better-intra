import type { SeatComponentKey } from "./components";

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
  audio: {
    on: svg(
      `<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>`,
    ),
    off: svg(
      `<path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11"/><path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686"/>`,
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

import { gmGetValue } from "../../lib/gm.ts";
import {
  DEFAULT_LOGTIME_CONFIG,
  LOGTIME_CONFIG_KEYS,
  type LogtimeConfig,
  type ShowDaysMode,
  HUB_SETTING_DEFS,
} from "../hub/hubSettings.data.ts";
import LOGTIME_CSS from "./logtime.css?inline";

const DEBUG = false;
const MAX_INTENSITY_SECS = 3600 * 12;
const CELL_RADIUS = "6px";
const PAST_MONTHS_OPACITY = 0.8;
const AVG_ONLY_ACTIVE_DAYS = true;
const COLORS = {
  BORDER: "#e2e8f0",
  TEXT_DARK: "#1e293b",
  TEXT_LIGHT: "#94a3b8",
  CELL_EMPTY: "#f8fafc",
};
const INTRA_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const CONFIG: LogtimeConfig = { ...DEFAULT_LOGTIME_CONFIG };
const rgbaCache = new Map<string, string>();

const dbg = (...args: unknown[]) => {
  if (DEBUG) console.debug("[logtime]", ...args);
};

const fmtHours = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
};

function hexToRgba(hex: string, opacity: number): string {
  const key = `${hex}|${opacity}`;
  if (rgbaCache.has(key)) return rgbaCache.get(key)!;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const val = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  rgbaCache.set(key, val);
  return val;
}

async function ensureWA() {
  if (!document.getElementById("wa-styles-bundle")) {
    const link = document.createElement("link");
    link.id = "wa-styles-bundle";
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@latest/dist/styles/themes/default.css";
    document.head.appendChild(link);
  }
  await import("@awesome.me/webawesome/dist/components/badge/badge.js");
}

async function loadConfig(): Promise<void> {
  for (const key of LOGTIME_CONFIG_KEYS) {
    const def = HUB_SETTING_DEFS.logtime.find((s) => s.key === key);
    if (!def) continue;
    const stored = await gmGetValue(key, DEFAULT_LOGTIME_CONFIG[key]);
    const configTarget = CONFIG as any;

    if (def.kind === "number") {
      const n = Number(stored);
      if (!isNaN(n)) configTarget[key] = n;
    } else if (def.kind === "toggle") {
      configTarget[key] = stored === true || String(stored) === "true";
    } else {
      configTarget[key] = stored;
    }
  }
}

function getFetchUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    if (typeof Request !== "undefined" && input instanceof Request)
      return input.url;
    return String(input ?? "");
  }
  
 function isStringMap(v: unknown): v is Record<string, string> {
    if (!v || typeof v !== "object") return false;
    return Object.values(v as Record<string, unknown>).every(
      (x) => typeof x === "string",
    );
  }

function extractStats(payload: unknown): Record<string, string> | null {
    dbg("extractStats:start", {
      type: typeof payload,
      isObject: !!payload && typeof payload === "object",
    });

    if (!payload || typeof payload !== "object") return null;

    const p = payload as {
      locations_stats?: unknown;
      data?: { locations_stats?: unknown };
    };

    if (isStringMap(p.locations_stats)) {
      dbg("extractStats:from", "locations_stats");
      return p.locations_stats;
    }
    if (isStringMap(p.data?.locations_stats)) {
      dbg("extractStats:from", "data.locations_stats");
      return p.data.locations_stats;
    }
    if (isStringMap(payload)) {
      dbg("extractStats:from", "direct");
      return payload;
    }

    dbg("extractStats:none");
    return null;
  }

const getLastSeenFormatted = (
  stats: Record<string, string>,
  mode: ShowDaysMode = "date",
): string => {
  const activeDays = Object.entries(stats)
    .filter(([, time]) => time !== "00:00:00")
    .map(([date]) => date)
    .sort();

  if (activeDays.length === 0) return "N/A";
  const lastDateStr = activeDays[activeDays.length - 1];
  const [y, m, d] = lastDateStr.split("-");
  const dateStr = `${d}/${m}`;
  if (mode === "date") return dateStr;

  const lastDate = new Date(lastDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (today.getTime() - lastDate.getTime()) / 86400000,
  );

  const relative =
    diffDays === 0
      ? "today"
      : diffDays === 1
        ? "yesterday"
        : `${diffDays} days ago`;
  return mode === "days" ? relative : `${dateStr} (${relative})`;
};

function setupStyles() {
  if (!document.head || document.getElementById("logtime-custom-styles")) return;

  const styleEl = document.createElement("style");
  styleEl.id = "logtime-custom-styles";

  styleEl.textContent = `
    :root {
      --intra-font: ${INTRA_FONT};
      --border-color: ${CONFIG?.LOGTIME_LABELS_COLOR};
      --calendar-color: ${CONFIG?.LOGTIME_CALENDAR_COLOR};
    }
    ${LOGTIME_CSS}
  `;

  document.head.appendChild(styleEl);
}

function createCalendarGrid(
  year: number,
  mon: number,
  data: Record<string, number>,
  lastDayDate: number,
): HTMLDivElement {
  const grid = document.createElement("div");
  grid.style.cssText = `display:grid; grid-template-columns:repeat(7, 1fr) 58px; gap:8px 5px;`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  ["M", "T", "W", "T", "F", "S", "S", "Total"].forEach((d, idx) => {
    const el = document.createElement("div");
    el.textContent = d;
    el.style.cssText = `font-size:11px; font-weight:800; text-align:center; color:${COLORS.TEXT_LIGHT}; ${idx === 7 ? "border-left:1px solid #f1f5f9; color:" + CONFIG.LOGTIME_LABELS_COLOR : ""}`;
    grid.appendChild(el);
  });

  const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
  for (let i = 0; i < offset; i++)
    grid.appendChild(document.createElement("div"));

  let weekSecs = 0;
  for (let day = 1; day <= lastDayDate; day++) {
    const dKey = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const s = data[dKey] ?? 0;
    weekSecs += s;

    const cellDate = new Date(year, mon - 1, day);
    cellDate.setHours(0, 0, 0, 0);

    const cell = document.createElement("div");
    cell.className = `day-cell ${dKey === todayStr ? "today-highlight" : ""}`;
    cell.textContent =
      data.hasOwnProperty(dKey) || cellDate >= today ? String(day) : "";
    const alpha = Math.min(s / MAX_INTENSITY_SECS, 1);
    cell.style.cssText = `aspect-ratio: 1/1; border-radius: ${CELL_RADIUS}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: ${s > 0 ? hexToRgba(CONFIG.LOGTIME_CALENDAR_COLOR, alpha) : COLORS.CELL_EMPTY};color: ${s > MAX_INTENSITY_SECS / 2 ? "#fff" : COLORS.TEXT_DARK};`;

    const tt = document.createElement("div");
    tt.className = "day-tooltip";
    tt.textContent = s > 0 ? fmtHours(s) : "0h";
    cell.appendChild(tt);
    grid.appendChild(cell);

    if ((offset + day) % 7 === 0 || day === lastDayDate) {
      if (day === lastDayDate && (offset + day) % 7 !== 0) {
        for (let j = 0; j < 7 - ((offset + day) % 7); j++)
          grid.appendChild(document.createElement("div"));
      }
      const w = document.createElement("div");
      w.textContent = weekSecs > 0 ? fmtHours(weekSecs) : "";
      w.style.cssText = `font-size:14px; font-weight:700; text-align:right; color:${CONFIG.LOGTIME_LABELS_COLOR}; padding-right:4px; display:flex; align-items:center; justify-content:flex-end;`;
      grid.appendChild(w);
      weekSecs = 0;
    }
  }
  return grid;
}

function createMonthCard(
  ym: string,
  data: Record<string, number>,
  isCurrent: boolean,
): HTMLDivElement {
  const [year, mon] = ym.split("-").map(Number);
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const lastDayDate = new Date(year, mon, 0).getDate();
  const divisor = AVG_ONLY_ACTIVE_DAYS
    ? Object.values(data).filter((s) => s > 0).length || 1
    : isCurrent
      ? new Date().getDate()
      : lastDayDate;
  const avg = total / divisor;

  const card = document.createElement("div");
  card.className = `month-card ${isCurrent ? "current-month" : ""}`;
  if (!isCurrent) card.style.opacity = String(PAST_MONTHS_OPACITY);

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(year, mon - 1),
  );
  const goalSecs = CONFIG.LOGTIME_GOAL_HOURS * 3600;
  const goalPercent = Math.round((total / goalSecs) * 100);
  const isGoalMet = goalPercent >= 100;
  const badgeClass = isGoalMet ? "badge-rainbow" : "";
  const fillClass = isGoalMet ? "liquid-fill-full" : "liquid-fill";
  const softGreenBg = `rgba(39, 174, 96, 0.1)`;

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 22px; font-weight: 700; color: ${COLORS.TEXT_DARK};">${monthName}</span>
      <wa-badge
        class="${badgeClass}"
        appearance="neutral" 
        pill
        style="
        font-size: 14px; 
        font-weight: 800; 
        background: ${isGoalMet ? "" : softGreenBg}; 
        color: ${isGoalMet ? "white" : CONFIG.LOGTIME_LABELS_COLOR};
        border: 1px solid ${isGoalMet ? "transparent" : "rgba(39, 174, 96, 0.2)"};
        padding: 8px 8px;
      "
      >
        ${fmtHours(total)}${CONFIG.LOGTIME_SHOW_GOAL ? ` / ${CONFIG.LOGTIME_GOAL_HOURS}h` : ""}
      </wa-badge>
      </span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: ${CONFIG.LOGTIME_LABELS_COLOR}; margin-bottom: 10px;">
      <div class="day-cell" style="background:transparent; width:auto; height:auto; padding:0; cursor:help;">
        ${CONFIG.LOGTIME_SHOW_GOAL ? `<b>${goalPercent}% </b>` : ""}
        ${CONFIG.LOGTIME_SHOW_TACOS ? ` ${Math.round(((total / 3600) * 2) / 8)} 🌮` : ""}
        ${CONFIG.LOGTIME_SHOW_GOAL ? `<div class="day-tooltip">Remaining: ${fmtHours(Math.max(0, goalSecs - total))}</div>` : ""}
      </div>
      ${CONFIG.LOGTIME_SHOW_AVERAGE ? `<span>Avg: <b>${fmtHours(avg)}</b></span>` : "<span></span>"}
    </div>
      ${
        CONFIG.LOGTIME_SHOW_GOAL
          ? `
  <div class="liquid-container">
    <div class="${fillClass}" style="width: ${Math.min(goalPercent, 100)}%;"></div>
  </div>`
          : ""
      }
  `;
  card.appendChild(createCalendarGrid(year, mon, data, lastDayDate));
  return card;
}

function findLogtimeMount(): HTMLElement | null {
  const legacy = Array.from(
    document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96"),
  ).find((c) => (c.textContent || "").toUpperCase().includes("LOGTIME"));
  if (legacy?.parentElement) return legacy.parentElement;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("main div[class*='grid']"),
  );
  return (
    candidates.find(
      (el) => el.children.length > 2 && el.offsetParent !== null,
    ) || null
  );
}

function hideOldLogtime(): void {
  document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96").forEach((c) => {
    if ((c.textContent || "").toUpperCase().includes("LOGTIME"))
      c.style.display = "none";
  });
}

function render(stats: Record<string, string>): void {
  if (!stats) return;

  const byMonth: Record<string, Record<string, number>> = {};
  Object.keys(stats)
    .sort()
    .forEach((d) => {
      const ym = d.slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = {};
      const [h = 0, m = 0, s = 0] = (stats[d] || "00:00:00")
        .split(":")
        .map(Number);
      byMonth[ym][d] = h * 3600 + m * 60 + s;
    });

  const containerBox = document.createElement("div");
  containerBox.className =
    "bg-white dark:bg-zinc-900 overflow-hidden md:drop-shadow-md md:rounded-lg p-0 mb-4 transition-all lt-box-container";

  const totalYearSecs = Object.values(stats).reduce((acc, time) => {
    const [h, m, s] = time.split(":").map(Number);
    return acc + (h * 3600 + m * 60 + s);
  }, 0);

  const header = document.createElement("div");
  header.className = "flex items-center justify-between p-4";
  const label = document.createElement("div");
  label.className =
    "font-bold text-black dark:text-white uppercase text-sm tracking-tight";
  label.style.cssText =
    "display: inline-flex; align-items: center; width: 100%;";
  label.innerHTML = `<div class="w-1.5 h-4 bg-legacy-main rounded-full"></div>Logtime`;

  if (CONFIG.LOGTIME_SHOW_TACOS) {
    const totalTacos = Math.floor(((totalYearSecs / 3600) * 2) / 8);
    const tacoBank = document.createElement("div");
    tacoBank.className = "taco-bank";
    tacoBank.innerHTML = `
    
      <span class="taco-icon">${totalTacos} 🌮</span>
    `;
    label.appendChild(tacoBank);
  }

  const lastSeenValue = getLastSeenFormatted(
    stats,
    CONFIG.LOGTIME_SHOW_DAYS_MODE,
  );

  if (lastSeenValue !== "N/A") {
    const badge = document.createElement("wa-badge");
    badge.setAttribute("variant", "success");
    badge.setAttribute("pill", "");

    badge.style.cssText = `
      margin-left: auto; 
      font-size: var(--wa-font-size-s);
      font-weight: 700;
      text-transform: none;
    `;

    badge.textContent = `Active ${lastSeenValue}`;
    label.appendChild(badge);
  }

  header.appendChild(label);
  containerBox.appendChild(header);

  const scrollWrapper = document.createElement("div");
  scrollWrapper.className = "log-slider-fixed";
  const gridContainer = document.createElement("div");
  gridContainer.className = "grid-centering-container";

  const monthKeys = Object.keys(byMonth).sort();
  monthKeys.forEach((ym, index) => {
    gridContainer.appendChild(
      createMonthCard(ym, byMonth[ym], index === monthKeys.length - 1),
    );
  });

  scrollWrapper.appendChild(gridContainer);
  containerBox.appendChild(scrollWrapper);

  let isDown = false,
    startX = 0,
    scrollLeft = 0;
  scrollWrapper.addEventListener("mousedown", (e) => {
    isDown = true;
    scrollWrapper.style.cursor = "grabbing";
    startX = e.pageX - scrollWrapper.offsetLeft;
    scrollLeft = scrollWrapper.scrollLeft;
  });
  scrollWrapper.addEventListener("mouseleave", () => {
    isDown = false;
    scrollWrapper.style.cursor = "grab";
  });
  scrollWrapper.addEventListener("mouseup", () => {
    isDown = false;
    scrollWrapper.style.cursor = "grab";
  });
  scrollWrapper.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scrollWrapper.offsetLeft;
    scrollWrapper.scrollLeft = scrollLeft - (x - startX) * 2;
  });
  scrollWrapper.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      scrollWrapper.scrollLeft += e.deltaY;
    }
  });

  const tryMount = (): boolean => {
    const mount = findLogtimeMount();
    if (!mount || document.querySelector(".lt-box-container"))
      return !!document.querySelector(".lt-box-container");
    hideOldLogtime();
    mount.prepend(containerBox);
    setTimeout(
      () =>
        scrollWrapper.scrollTo({
          left: scrollWrapper.scrollWidth,
          behavior: "smooth",
        }),
      300,
    );
    return true;
  };

  if (!tryMount()) {
    const observer = new MutationObserver((_, o) => {
      if (tryMount()) o.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function isProfileV3TargetPage() {
  return (
    location.hostname === "profile-v3.intra.42.fr" &&
    (location.pathname === "/" || /^\/users\/[^/]+\/?$/.test(location.pathname))
  );
}

let cachedStats = null;

function installFetchHook() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = getFetchUrl(args[0]);
    const response = await originalFetch(...args);

    if (url.includes("/locations_stats")) {
      const clone = response.clone();
      try {
        const json = await clone.json();
        const stats = extractStats(json);
        if (stats) {
          cachedStats = stats;
          render(stats);
        }
      } catch (e) { dbg(e); }
    }
    return response;
  };
}

export async function initLogtime() {
  dbg("init:start");
  await ensureWA();
  await loadConfig();
  setupStyles();
  installFetchHook();

  if (isProfileV3TargetPage()) {
    setTimeout(async () => {
      const urls = performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .filter((name) => name.includes("/locations_stats"));

      for (const url of urls) {
        try {
          const res = await fetch(url, { credentials: "include" });
          if (res.ok) {
            const stats = extractStats(await res.json());
            if (stats) {
              render(stats);
              break;
            }
          }
        } catch (e) {
          dbg(e);
        }
      }
    }, 1000);
  }
  console.log("Logtime loaded!");
}

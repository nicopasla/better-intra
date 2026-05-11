import { gmGetValue } from "../../lib/gm.ts";
import LOGTIME_CSS from "./logtime.css?inline";

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

const getSettings = async () => ({
  goal_hours: await gmGetValue<number>("LOGTIME_GOAL_HOURS", 140),
  show_average: await gmGetValue<boolean>("LOGTIME_SHOW_AVERAGE", true),
  show_goal: await gmGetValue<boolean>("LOGTIME_SHOW_GOAL", true),
  show_tacos: await gmGetValue<boolean>("LOGTIME_SHOW_TACOS", false),
  show_days_mode: await gmGetValue<"date" | "both" | "days">(
    "LOGTIME_SHOW_DAYS_MODE",
    "date",
  ),
  calendar_color: await gmGetValue<string>("LOGTIME_CALENDAR_COLOR", "#00BCBA"),
  labels_color: await gmGetValue<string>("LOGTIME_LABELS_COLOR", "#26a641"),
  disable_animations: await gmGetValue<boolean>("DISABLE_ANIMATIONS", false),
});
let isLoaded = false;
let CONFIG: Awaited<ReturnType<typeof getSettings>>;

const rgbaCache = new Map<string, string>();

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
  if (!payload || typeof payload !== "object") return null;

  const p = payload as {
    locations_stats?: unknown;
    data?: { locations_stats?: unknown };
  };

  if (isStringMap(p.locations_stats)) {
    return p.locations_stats;
  }
  if (isStringMap(p.data?.locations_stats)) {
    return p.data.locations_stats;
  }
  if (isStringMap(payload)) {
    return payload;
  }

  return null;
}

const getLastSeenFormatted = (
  stats: Record<string, string>,
  mode: "date" | "both" | "days" = "date",
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
  if (!document.head || document.getElementById("logtime-custom-styles"))
    return;

  const styleEl = document.createElement("style");
  styleEl.id = "logtime-custom-styles";

  const disableAnimCss = CONFIG.disable_animations
    ? `.lt-box-container *, .lt-box-container *::before, .lt-box-container *::after { 
        animation: none !important; 
        transition: none !important; 
      }
      .liquid-fill::after {
        display: none !important;
      }
      .liquid-fill {
        border-radius: 0 4px 4px 0; 
      }`
    : "";

  styleEl.textContent = `
    :root {
      --intra-font: ${INTRA_FONT};
      --border-color: ${CONFIG?.labels_color};
      --calendar-color: ${CONFIG?.calendar_color};
    }
    ${LOGTIME_CSS}
    ${disableAnimCss}
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
    el.style.cssText = `font-size:11px; font-weight:800; text-align:center; color:${COLORS.TEXT_LIGHT}; ${idx === 7 ? "border-left:1px solid #f1f5f9; color:" + CONFIG.labels_color : ""}`;
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
    cell.style.cssText = `aspect-ratio: 1/1; border-radius: ${CELL_RADIUS}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: ${s > 0 ? hexToRgba(CONFIG.calendar_color, alpha) : COLORS.CELL_EMPTY};color: ${s > MAX_INTENSITY_SECS / 2 ? "#fff" : COLORS.TEXT_DARK};`;

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
      w.style.cssText = `font-size:14px; font-weight:700; text-align:right; color:${CONFIG.labels_color}; padding-right:4px; display:flex; align-items:center; justify-content:flex-end;`;
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
  const goalSecs = CONFIG.goal_hours * 3600;
  const goalPercent = Math.round((total / goalSecs) * 100);
  const isGoalMet = goalPercent >= 100;
  const badgeClass = isGoalMet ? "badge-rainbow" : "";
  const isPast = !isCurrent;
  const animationClass = isPast ? "is-past" : "";
  const fillClass = isGoalMet ? "liquid-fill-full" : "liquid-fill";

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 22px; font-weight: 700; color: ${COLORS.TEXT_DARK};">${monthName}</span>
      <span class="inline-flex items-center justify-center rounded-full transition-all ${badgeClass}" 
            style="
              height: 30px; 
              padding: 0 10px; 
              font-size: 16px; 
              font-weight: 800; 
              white-space: nowrap;
              /* Only apply these if it's NOT a rainbow badge */
              ${
                !badgeClass.includes("badge-rainbow")
                  ? `
                background: ${isGoalMet ? "#27ae60" : "rgba(39, 174, 96, 0.1)"}; 
                color: ${isGoalMet ? "white" : "#27ae60"};
                border: 1px solid ${isGoalMet ? "transparent" : "rgba(39, 174, 96, 0.2)"};
              `
                  : ""
              }
            ">
  ${fmtHours(total)}${CONFIG.show_goal ? ` / ${CONFIG.goal_hours}h` : ""}
</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: ${CONFIG.labels_color}; margin-bottom: 10px;">
      <div class="day-cell" style="background:transparent; width:auto; height:auto; padding:0; cursor:help;">
        ${CONFIG.show_goal ? `<b>${goalPercent}% </b>` : ""}
        ${CONFIG.show_tacos ? ` ${Math.round(((total / 3600) * 2) / 8)} 🌮` : ""}
        ${CONFIG.show_goal ? `<div class="day-tooltip">Remaining: ${fmtHours(Math.max(0, goalSecs - total))}</div>` : ""}
      </div>
      ${CONFIG.show_average ? `<span>Avg: <b>${fmtHours(avg)}</b></span>` : "<span></span>"}
    </div>
    ${
      CONFIG.show_goal
        ? `
      <div class="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
        <div class="h-full transition-all duration-500 ${fillClass} ${animationClass}" 
             style="width: ${Math.min(goalPercent, 100)}%;">
        </div>
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

  const totalYearSecs = Object.values(stats).reduce((acc, time) => {
    const [h, m, s] = time.split(":").map(Number);
    return acc + (h * 3600 + m * 60 + s);
  }, 0);

  const containerBox = document.createElement("div");
  containerBox.className =
    "bg-white dark:bg-zinc-900 overflow-hidden md:drop-shadow-md md:rounded-lg p-0 mb-4 transition-all lt-box-container";

  const lastSeenValue = getLastSeenFormatted(stats, CONFIG.show_days_mode);
  const totalTacos = Math.floor(((totalYearSecs / 3600) * 2) / 8);

  containerBox.innerHTML = `
    <div class="flex items-center justify-between p-4" style=" padding-bottom:20px">
      <div class="font-bold text-black dark:text-white uppercase text-sm tracking-tight flex items-center w-full" style="display: inline-flex;">
        <div class="w-1.5 h-4 bg-legacy-main rounded-full mr-2"></div>
        Logtime
        ${CONFIG.show_tacos ? `<div class="taco-bank ml-2"><span class="taco-icon">${totalTacos} 🌮</span></div>` : ""}
        ${
          lastSeenValue !== "N/A"
            ? `
          <span class="ml-auto bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case border border-green-500/30">
            Active ${lastSeenValue}
          </span>`
            : ""
        }
      </div>
    </div>
    <div class="log-slider-fixed">
      <div class="grid-centering-container"></div>
    </div>
  `;

  const gridContainer = containerBox.querySelector(
    ".grid-centering-container",
  )!;
  const scrollWrapper = containerBox.querySelector(
    ".log-slider-fixed",
  ) as HTMLElement;

  const monthKeys = Object.keys(byMonth).sort();
  monthKeys.forEach((ym, index) => {
    gridContainer.appendChild(
      createMonthCard(ym, byMonth[ym], index === monthKeys.length - 1),
    );
  });

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
  const targetWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const originalFetch = targetWindow.fetch.bind(targetWindow);
  targetWindow.fetch = async (...args) => {
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
      } catch (e) {}
    }
    return response;
  };
}

export async function initLogtime() {
  if (isLoaded) return;
  installFetchHook();

  CONFIG = await getSettings();
  setupStyles();

  if (isProfileV3TargetPage()) {
    const existingResource = performance
      .getEntriesByType("resource")
      .find((r) => r.name.includes("/locations_stats"));

    if (existingResource) {
      try {
        const res = await fetch(existingResource.name, {
          credentials: "include",
        });
        const stats = extractStats(await res.json());
        if (stats) {
          isLoaded = true;
          render(stats);
          return;
        }
      } catch (e) {
      }
    }

    console.log("Logtime loaded!");
  }
}

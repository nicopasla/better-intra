import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
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

const getConfigs = async () => ({
  goal_hours: await getConfig("LOGTIME_GOAL_HOURS"),
  show_average: await getConfig("LOGTIME_SHOW_AVERAGE"),
  show_goal: await getConfig("LOGTIME_SHOW_GOAL"),
  show_tacos: await getConfig("LOGTIME_SHOW_TACOS"),
  emoji: limit(await getConfig("LOGTIME_EMOJI")),
  divisor: await getConfig("LOGTIME_EMOJI_DIVISOR"),
  rate: await getConfig("LOGTIME_EMOJI_RATE"),
  show_days_mode: await getConfig("LOGTIME_SHOW_DAYS_MODE"),
  calendar_color: await getConfig("LOGTIME_CALENDAR_COLOR"),
  labels_color: await getConfig("LOGTIME_LABELS_COLOR"),
  disable_animations: await getConfig("DISABLE_ANIMATIONS"),
});

let isLoaded = false;
let CONFIG: Awaited<ReturnType<typeof getConfigs>>;

const rgbaCache = new Map<string, string>();

function limit(s: unknown) {
  return Array.from(typeof s === "string" ? s : "🌮")
    .slice(0, 3)
    .join("");
}

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
  if (mode === "date") {
    const [y, m, d] = lastDateStr.split("-");
    return `${d}/${m}`;
  }

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
  if (mode === "days") return relative;

  const [y, m, d] = lastDateStr.split("-");
  return `${d}/${m} (${relative})`;
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
      .liquid-fill::after { display: none !important; }
      .liquid-fill { border-radius: 0 4px 4px 0; }`
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

function renderDayCell(
  day: number,
  dKey: string,
  secs: number,
  todayStr: string,
) {
  const alpha = Math.min(secs / MAX_INTENSITY_SECS, 1);
  const bgColor =
    secs > 0 ? hexToRgba(CONFIG.calendar_color, alpha) : COLORS.CELL_EMPTY;
  const textColor = secs > MAX_INTENSITY_SECS / 2 ? "#fff" : COLORS.TEXT_DARK;

  return html`<div
    class="day-cell ${dKey === todayStr ? "today-highlight" : ""}"
    style="
      aspect-ratio: 1/1;
      border-radius: ${CELL_RADIUS};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: ${bgColor};
      color: ${textColor};
    "
  >
    ${String(day)}
    <div class="day-tooltip">${secs > 0 ? fmtHours(secs) : "0h"}</div>
  </div>`;
}

function renderCalendarGrid(
  year: number,
  mon: number,
  data: Record<string, number>,
  lastDayDate: number,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const headerRow = ["M", "T", "W", "T", "F", "S", "S", "Total"].map(
    (day, idx) =>
      html`<div
        style="font-size: 11px; font-weight: 800; text-align: center; color: ${COLORS.TEXT_LIGHT}; ${idx ===
        7
          ? `border-left: 1px solid #f1f5f9; color: ${CONFIG.labels_color};`
          : ""}"
      >
        ${day}
      </div>`,
  );

  const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
  const emptyCells = Array.from({ length: offset }, () => html`<div></div>`);
  const dayRows: ReturnType<typeof html>[] = [];
  let weekSecs = 0;
  let cellCount = offset;

  for (let day = 1; day <= lastDayDate; day++) {
    const dKey = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const secs = data[dKey] ?? 0;
    weekSecs += secs;

    dayRows.push(renderDayCell(day, dKey, secs, todayStr));
    cellCount++;

    if ((cellCount % 7 === 0 && cellCount > 0) || day === lastDayDate) {
      if (day === lastDayDate && cellCount % 7 !== 0) {
        const fillCount = 7 - (cellCount % 7);
        for (let j = 0; j < fillCount; j++) dayRows.push(html`<div></div>`);
      }

      dayRows.push(
        html`<div
          style="font-size: 14px; font-weight: 700; text-align: right; color: ${CONFIG.labels_color}; padding-right: 4px; display: flex; align-items: center; justify-content: flex-end;"
        >
          ${weekSecs > 0 ? fmtHours(weekSecs) : ""}
        </div>`,
      );
      weekSecs = 0;
    }
  }

  return html`<div
    style="display: grid; grid-template-columns: repeat(7, 1fr) 58px; gap: 8px 5px;"
  >
    ${headerRow} ${emptyCells} ${dayRows}
  </div>`;
}

function renderMonthCard(
  ym: string,
  data: Record<string, number>,
  isCurrent: boolean,
) {
  const [year, mon] = ym.split("-").map(Number);
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const lastDayDate = new Date(year, mon, 0).getDate();
  const divisor = AVG_ONLY_ACTIVE_DAYS
    ? Object.values(data).filter((s) => s > 0).length || 1
    : isCurrent
      ? new Date().getDate()
      : lastDayDate;
  const avg = total / divisor;

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(year, mon - 1),
  );
  const goalSecs = CONFIG.goal_hours * 3600;
  const goalPercent = Math.round((total / goalSecs) * 100);
  const isGoalMet = goalPercent >= 100;
  const isPast = !isCurrent;
  const fillClass = isGoalMet ? "liquid-fill-full" : "liquid-fill";
  const badgeClass = isGoalMet ? "badge-rainbow" : "";

  const badgeStyles = !badgeClass.includes("badge-rainbow")
    ? `background: ${isGoalMet ? "#27ae60" : "rgba(39, 174, 96, 0.1)"}; color: ${isGoalMet ? "white" : "#27ae60"}; border: 1px solid ${isGoalMet ? "transparent" : "rgba(39, 174, 96, 0.2)"};`
    : "";

  return html`<div
    class="month-card ${isCurrent ? "current-month" : ""}"
    style="${!isCurrent ? `opacity: ${PAST_MONTHS_OPACITY};` : ""}"
  >
    <div
      style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;"
    >
      <span
        style="font-size: 22px; font-weight: 700; color: ${COLORS.TEXT_DARK};"
        >${monthName}</span
      >
      <span
        class="inline-flex items-center justify-center rounded-full transition-all ${badgeClass}"
        style="height: 30px; padding: 0 10px; font-size: 16px; font-weight: 800; white-space: nowrap; ${badgeStyles}"
      >
        ${fmtHours(total)}${CONFIG.show_goal ? ` / ${CONFIG.goal_hours}h` : ""}
      </span>
    </div>

    <div
      style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: ${CONFIG.labels_color}; margin-bottom: 10px;"
    >
      <div
        class="day-cell"
        style="background: transparent; width: auto; height: auto; padding: 0; cursor: help;"
      >
        ${CONFIG.show_goal ? html`<b>${goalPercent}% </b>` : ""}
        ${CONFIG.show_tacos
          ? html` ${Math.round(((total / 3600) * CONFIG.rate) / CONFIG.divisor)}
            ${CONFIG.emoji}`
          : ""}
        ${CONFIG.show_goal
          ? html`<div class="day-tooltip">
              Remaining: ${fmtHours(Math.max(0, goalSecs - total))}
            </div>`
          : ""}
      </div>
      ${CONFIG.show_average
        ? html`<span>Avg: <b>${fmtHours(avg)}</b></span>`
        : ""}
    </div>

    ${CONFIG.show_goal
      ? html`<div
          class="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden"
        >
          <div
            class="h-full transition-all duration-500 ${fillClass} ${isPast
              ? "is-past"
              : ""}"
            style="width: ${Math.min(goalPercent, 100)}%;"
          ></div>
        </div>`
      : ""}
    ${renderCalendarGrid(year, mon, data, lastDayDate)}
  </div>`;
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

function renderHeaderContent(
  stats: Record<string, string>,
  totalYearSecs: number,
) {
  const lastSeenValue = getLastSeenFormatted(stats, CONFIG.show_days_mode);
  const totalTacos = Math.floor(
    ((totalYearSecs / 3600) * CONFIG.rate) / CONFIG.divisor,
  );

  return html`<div
    class="flex items-center justify-between p-4"
    style="padding-bottom: 20px;"
  >
    <div
      class="font-bold text-black dark:text-white uppercase text-sm tracking-tight flex items-center w-full"
      style="display: inline-flex;"
    >
      <div class="w-1.5 h-4 bg-legacy-main rounded-full mr-2"></div>
      Logtime
      ${CONFIG.show_tacos
        ? html`<div class="taco-bank ml-2">
            <span class="taco-icon">${totalTacos} ${CONFIG.emoji}</span>
          </div>`
        : ""}
      ${lastSeenValue !== "N/A"
        ? html`<span
            class="ml-auto bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case border border-green-500/30"
            >Active ${lastSeenValue}</span
          >`
        : ""}
    </div>
  </div>`;
}

function renderContainer(
  stats: Record<string, string>,
  monthCards: ReturnType<typeof html>[],
) {
  const totalYearSecs = Object.values(stats).reduce((acc, time) => {
    const [h, m, s] = time.split(":").map(Number);
    return acc + (h * 3600 + m * 60 + s);
  }, 0);

  return html`<div
    class="bg-white dark:bg-zinc-900 overflow-hidden md:drop-shadow-md md:rounded-lg p-0 mb-4 transition-all lt-box-container"
  >
    ${renderHeaderContent(stats, totalYearSecs)}
    <div class="log-slider-fixed">
      <div class="grid-centering-container">${monthCards}</div>
    </div>
  </div>`;
}

function setupScrollHandlers(scrollWrapper: HTMLElement): void {
  let isDown = false,
    startX = 0,
    scrollLeft = 0;

  scrollWrapper.addEventListener("mousedown", (e) => {
    isDown = true;
    scrollWrapper.style.cursor = "grabbing";
    startX = e.pageX - scrollWrapper.offsetLeft;
    scrollLeft = scrollWrapper.scrollLeft;
  });

  const stopDragging = () => {
    isDown = false;
    scrollWrapper.style.cursor = "grab";
  };
  scrollWrapper.addEventListener("mouseleave", stopDragging);
  scrollWrapper.addEventListener("mouseup", stopDragging);

  scrollWrapper.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scrollWrapper.offsetLeft;
    scrollWrapper.scrollLeft = scrollLeft - (x - startX) * 2;
  });

  scrollWrapper.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollWrapper.scrollLeft += e.deltaY;
      }
    },
    { passive: false },
  );
}

function renderLogtime(stats: Record<string, string>): void {
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

  const monthKeys = Object.keys(byMonth).sort();
  const monthCards = monthKeys.map((ym, index) =>
    renderMonthCard(ym, byMonth[ym], index === monthKeys.length - 1),
  );

  const container = document.createElement("div");
  render(renderContainer(stats, monthCards), container);

  const tryMount = (): boolean => {
    const mount = findLogtimeMount();
    if (!mount || document.querySelector(".lt-box-container"))
      return !!document.querySelector(".lt-box-container");

    hideOldLogtime();
    const containerBox = container.firstElementChild as HTMLElement;
    mount.prepend(containerBox);

    const scrollWrapper = containerBox.querySelector(
      ".log-slider-fixed",
    ) as HTMLElement;
    if (scrollWrapper) {
      setupScrollHandlers(scrollWrapper);
      setTimeout(
        () =>
          scrollWrapper.scrollTo({
            left: scrollWrapper.scrollWidth,
            behavior: "smooth",
          }),
        300,
      );
    }
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

function installFetchHook() {
  window.addEventListener("42_LOGTIME_DATA", (event: any) => {
    if (event.detail) renderLogtime(event.detail);
  });

  const script = document.createElement("script");
  script.textContent = `
    (() => {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        if (url.includes("/locations_stats")) {
          const clone = response.clone();
          try {
            const json = await clone.json();
            const stats = json?.locations_stats || json?.data?.locations_stats || json;
            if (stats && typeof stats === 'object') {
              window.dispatchEvent(new CustomEvent("42_LOGTIME_DATA", { detail: stats }));
            }
          } catch (e) {}
        }
        return response;
      };
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

export async function initLogtime() {
  if (isLoaded) return;
  installFetchHook();

  CONFIG = await getConfigs();
  setupStyles();

  if (isProfileV3TargetPage()) {
    isLoaded = true;
    console.log("Logtime loaded!");
  }
}

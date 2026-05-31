import { render } from "lit-html";
import { getConfig } from "../../config.ts";
import {
  findLogtimeMount,
  hideOldLogtime,
  setupScrollHandlers,
  setupStyles,
} from "./dom.js";
import {
  renderContainer,
  renderHeaderContent,
  renderMonthCard,
} from "./render.js";
import { getLastSeenFormatted, limit } from "./utils.js";

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
  max_earnings: await getConfig("LOGTIME_MAX_EARNINGS"),
});

export type LogtimeConfig = Awaited<ReturnType<typeof getConfigs>>;

let isLoaded = false;
let CONFIG: LogtimeConfig;
let lastStats: Record<string, string> | null = null;

function renderLogtime(stats: Record<string, string>): void {
  if (!stats) return;
  lastStats = stats;

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
    renderMonthCard(ym, byMonth[ym], index === monthKeys.length - 1, CONFIG),
  );
  const lastSeenValue = getLastSeenFormatted(stats, CONFIG.show_days_mode);
  const header = renderHeaderContent(lastSeenValue, byMonth, CONFIG);

  const container = document.createElement("div");
  render(renderContainer(header, monthCards), container);

  const tryMount = (): boolean => {
    const mount = findLogtimeMount();
    const existing = document.querySelector(".lt-box-container");
    if (!mount) return false;
    if (existing) existing.remove();
    hideOldLogtime();
    const containerBox = container.firstElementChild as HTMLElement;
    mount.prepend(containerBox);
    const scrollWrapper = containerBox.querySelector(
      ".log-slider-fixed",
    ) as HTMLElement;
    if (scrollWrapper) {
      setupScrollHandlers(scrollWrapper);
      const scrollToLatest = () => {
        scrollWrapper.scrollLeft =
          scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToLatest);
      });
      window.addEventListener("load", scrollToLatest);
      setTimeout(scrollToLatest, 100);
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
  document.addEventListener("42_LOGTIME_DATA", (event: any) => {
    if (event.detail) renderLogtime(event.detail);
  });

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("hook.js");
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

export function applyPublicLogtimeSettings(logtime: {
  calendarColor?: string;
  labelsColor?: string;
  emoji?: string;
  emojiDivisor?: string | number;
  emojiRate?: string | number;
}) {
  if (!isLoaded || !logtime) return;

  CONFIG.calendar_color = logtime.calendarColor ?? CONFIG.calendar_color;
  CONFIG.labels_color = logtime.labelsColor ?? CONFIG.labels_color;
  CONFIG.emoji = logtime.emoji ? limit(logtime.emoji) : CONFIG.emoji;
  CONFIG.divisor =
    logtime.emojiDivisor !== undefined
      ? Number(logtime.emojiDivisor)
      : CONFIG.divisor;
  CONFIG.rate =
    logtime.emojiRate !== undefined ? Number(logtime.emojiRate) : CONFIG.rate;

  setupStyles(CONFIG);

  if (lastStats) {
    renderLogtime(lastStats);
  } else {
  }
}

export async function initLogtime() {
  if (isLoaded) return;
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  installFetchHook();

  CONFIG = await getConfigs();
  setupStyles(CONFIG);

  if (isProfileV3TargetPage()) {
    isLoaded = true;
    console.log("Logtime loaded!");
  }
}

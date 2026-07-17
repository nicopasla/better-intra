import { render } from "lit-html";
import { getConfig } from "../../config.ts";
import { hashLogin } from "../../utils/crypto.ts";
import {
  findLogtimeMount,
  hideOldLogtime,
  setupScrollHandlers,
} from "./dom.ts";
import {
  renderContainer,
  renderHeaderContent,
  renderMonthCard,
  renderLoadMoreCard,
  renderYearLabel,
} from "./render.ts";
import { getLastSeenFormatted, limit } from "./utils.ts";
import { getEffectiveTheme } from "../profile/theme/theme-manager.ts";
import { syncCalendarIcs } from "../calendar/calendar-sync.ts";

export interface CalendarEvent {
  id: number;
  name: string;
  kind: string;
  begin_at: string;
  end_at: string;
  location: string;
  is_subscribed: boolean;
}

export type EventsByDate = Record<string, CalendarEvent[]>;

const INTRAPY_BASE = "https://intrapy.intra.42.fr";
const WORKER_URL = "https://api.betterintra.com";

const historyCache = new Map<string, Record<string, number>>();
const fetchPromiseMap = new Map<string, Promise<void>>();

let loadMoreLogin: string | null = null;
let loadMoreBefore: string | undefined;
let loadMoreLoading = false;
let restoreScrollLeft = -1;
let skipScroll = false;

function extractLoginFromPath(): string | null {
  const m = location.pathname.match(/^\/users\/([^/]+)/);
  return m ? m[1] : null;
}

async function fetchHistoricalLogtime(
  login: string,
  before?: string,
): Promise<void> {
  if (historyCache.has(login)) return;
  if (fetchPromiseMap.has(login)) {
    await fetchPromiseMap.get(login);
    return;
  }

  const promise = (async () => {
    try {
      const cloudLogin = await getConfig("CLOUD_LOGIN");
      const sessionToken = await getConfig("CLOUD_TOKEN");
      if (!cloudLogin || !sessionToken) {
        historyCache.set(login, {});
        return;
      }

      const hashed = await hashLogin(cloudLogin);
      let url = `${WORKER_URL}/api/v1/private/logtime/history?login=${encodeURIComponent(hashed)}&user=${encodeURIComponent(login)}`;
      if (before) url += `&before=${encodeURIComponent(before)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.days) {
          historyCache.set(login, data.days as Record<string, number>);
          return;
        }
      }
    } catch {}

    historyCache.set(login, {});
  })();

  fetchPromiseMap.set(login, promise);
  await promise;
  fetchPromiseMap.delete(login);
}

function mergeHistoryWithHook(
  hookData: Record<string, string>,
  login: string,
): Record<string, string> {
  const merged: Record<string, string> = {};
  const history = historyCache.get(login);

  if (history) {
    for (const [date, secs] of Object.entries(history)) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      merged[date] =
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
  }

  for (const [date, time] of Object.entries(hookData)) {
    merged[date] = time;
  }

  return merged;
}

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
export let lastStats: Record<string, string> | null = null;
let currentTheme = "light";

function isOwnProfile(): boolean {
  return (
    location.hostname === "profile-v3.intra.42.fr" && location.pathname === "/"
  );
}

function groupEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const iso = ev.begin_at.endsWith("Z") ? ev.begin_at : ev.begin_at + "Z";
    const d = new Date(iso);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(ev);
  }
  return byDate;
}

async function fetchEvents(): Promise<Record<string, CalendarEvent[]>> {
  try {
    const token = sessionStorage.getItem("ft_intrapy_token");
    if (!token) return {};
    const res = await fetch(`${INTRAPY_BASE}/api/v1/users/me/events`, {
      headers: { Authorization: token },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, CalendarEvent>;
    return groupEventsByDate(Object.values(data));
  } catch {
    return {};
  }
}

function renderLogtime(
  stats: Record<string, string>,
  eventsByDate?: Record<string, CalendarEvent[]>,
): void {
  if (!stats || !CONFIG) return;
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
  const monthCards: ReturnType<
    typeof renderMonthCard | typeof renderYearLabel
  >[] = [];
  let prevYear = "";
  for (const ym of monthKeys) {
    const year = ym.slice(0, 4);
    if (year !== prevYear && prevYear !== "") {
      monthCards.push(renderYearLabel(year));
    }
    prevYear = year;
    monthCards.push(
      renderMonthCard(
        ym,
        byMonth[ym],
        ym === monthKeys[monthKeys.length - 1],
        CONFIG,
        eventsByDate,
      ),
    );
  }

  if (loadMoreLogin && monthCards.length > 0) {
    const login = loadMoreLogin;
    const before = loadMoreBefore;
    monthCards.unshift(
      renderLoadMoreCard(async () => {
        loadMoreLoading = true;
        const host = document.getElementById("logtime-shadow-wrapper");
        const root = host?.shadowRoot;
        const sw = root?.querySelector(
          ".log-slider-fixed",
        ) as HTMLElement | null;
        const hookMonth = before?.slice(0, 7);
        const anchor = hookMonth
          ? (root?.querySelector(
              `[data-month="${hookMonth}"]`,
            ) as HTMLElement | null)
          : null;
        const anchorOffset = anchor ? anchor.offsetLeft : 0;
        const savedScroll = sw ? sw.scrollLeft : 0;

        restoreScrollLeft = savedScroll;
        renderLogtime(stats, eventsByDate);

        await fetchHistoricalLogtime(login, before);
        loadMoreLogin = null;
        loadMoreBefore = undefined;
        loadMoreLoading = false;

        const merged = mergeHistoryWithHook(stats, login);
        skipScroll = true;
        renderLogtime(merged, eventsByDate);

        const newAnchor = root?.querySelector(
          `[data-month="${hookMonth}"]`,
        ) as HTMLElement | null;
        const shift = (newAnchor?.offsetLeft ?? anchorOffset) - anchorOffset;
        const newSw = root?.querySelector(
          ".log-slider-fixed",
        ) as HTMLElement | null;
        if (newSw) {
          requestAnimationFrame(() => {
            newSw.scrollLeft = Math.max(0, savedScroll + shift);
          });
        }
      }, loadMoreLoading),
    );
  }

  const lastSeenValue = getLastSeenFormatted(stats, CONFIG.show_days_mode);
  const header = renderHeaderContent(lastSeenValue, byMonth, CONFIG);

  let shadowHost = document.getElementById("logtime-shadow-wrapper");
  if (!shadowHost) {
    shadowHost = document.createElement("div");
    shadowHost.id = "logtime-shadow-wrapper";
    const mount = findLogtimeMount();
    if (mount) mount.prepend(shadowHost);
    shadowHost.attachShadow({ mode: "open" });
  }
  hideOldLogtime();

  render(
    renderContainer(header, monthCards, currentTheme, CONFIG),
    shadowHost.shadowRoot!,
  );

  const scrollWrapper = shadowHost.shadowRoot!.querySelector(
    ".log-slider-fixed",
  ) as HTMLElement;
  if (scrollWrapper) {
    setupScrollHandlers(scrollWrapper);
    if (skipScroll) {
      skipScroll = false;
    } else if (restoreScrollLeft >= 0) {
      const target = restoreScrollLeft;
      restoreScrollLeft = -1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollWrapper.scrollLeft = target;
        });
      });
    } else {
      const scrollToLatest = () => {
        scrollWrapper.scrollLeft =
          scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToLatest);
      });
      window.addEventListener("load", scrollToLatest, { once: true });
      setTimeout(scrollToLatest, 100);
    }
  }
}

function isProfileV3TargetPage() {
  return (
    location.hostname === "profile-v3.intra.42.fr" &&
    (location.pathname === "/" || /^\/users\/[^/]+\/?$/.test(location.pathname))
  );
}

function installFetchHook() {
  document.addEventListener("42_LOGTIME_DATA", async (event: Event) => {
    const detail = (event as CustomEvent<Record<string, string>>).detail;
    if (!detail) return;

    const hookDates = Object.keys(detail).sort();
    const before = hookDates.length > 0 ? hookDates[0] : undefined;

    if (isOwnProfile()) {
      const cloudLogin = await getConfig("CLOUD_LOGIN");
      if (cloudLogin) {
        const hasHistory = historyCache.has(cloudLogin);
        if (!hasHistory) {
          loadMoreLogin = cloudLogin;
          loadMoreBefore = before;
        }
        const stats = hasHistory
          ? mergeHistoryWithHook(detail, cloudLogin)
          : detail;
        renderLogtime(stats);

        fetchEvents().then((events) => {
          renderLogtime(lastStats || detail, events);

          const flatEvents = Object.values(events).flat();
          const subscribed = flatEvents.filter((e) => e.is_subscribed);
          if (subscribed.length > 0) {
            syncCalendarIcs(subscribed);
          }
        });
        return;
      }
    }

    const targetLogin = extractLoginFromPath();
    if (targetLogin) {
      const hasHistory = historyCache.has(targetLogin);
      if (!hasHistory) {
        loadMoreLogin = targetLogin;
        loadMoreBefore = before;
      }
      const stats = hasHistory
        ? mergeHistoryWithHook(detail, targetLogin)
        : detail;
      renderLogtime(stats);
      return;
    }

    renderLogtime(detail);
  });
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

  if (lastStats) {
    renderLogtime(lastStats);
  }
}

export async function initLogtime() {
  if (isLoaded) return;
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  CONFIG = await getConfigs();
  currentTheme = await getEffectiveTheme();
  installFetchHook();

  if (isProfileV3TargetPage()) {
    isLoaded = true;
  }
}

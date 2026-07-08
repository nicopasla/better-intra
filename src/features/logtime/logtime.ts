import { render } from "lit-html";
import { getConfig } from "../../config.ts";
import {
  findLogtimeMount,
  hideOldLogtime,
  setupScrollHandlers,
} from "./dom.ts";
import {
  renderContainer,
  renderHeaderContent,
  renderMonthCard,
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
    const dateKey = ev.begin_at.slice(0, 10);
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
  const monthCards = monthKeys.map((ym, index) =>
    renderMonthCard(
      ym,
      byMonth[ym],
      index === monthKeys.length - 1,
      CONFIG,
      eventsByDate,
    ),
  );
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

    if (isOwnProfile()) {
      renderLogtime(detail);

      fetchEvents().then((events) => {
        renderLogtime(detail, events);

        const flatEvents = Object.values(events).flat();
        const subscribed = flatEvents.filter((e) => e.is_subscribed);
        if (subscribed.length > 0) {
          syncCalendarIcs(subscribed);
        }
      });
    } else {
      renderLogtime(detail);
    }
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

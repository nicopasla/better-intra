import { getConfig } from "../../config.ts";
import { getCloudLogin } from "../account/account.ts";
import { hashLogin } from "../../utils/crypto.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

const CARD_ID = "ft-roulette-card";

let rouletteInitialized = false;
let roulettePolling = false;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let cachedEntries: RouletteEntry[] = [];
let cachedShowHistory = true;

interface RouletteEntry {
  historic_id: number;
  sum: number;
  total: number;
  created_at: string;
}

function formatRouletteDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nextRouletteTimestamp(from: number): number {
  const d = new Date(from);
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6, 0, 0),
  );
  while (next.getUTCDay() !== 5 || next.getTime() <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime();
}

function getNextRoulette(): {
  days: number;
  hours: number;
  minutes: number;
  dateLabel: string;
} {
  const now = Date.now();
  const nextMs = nextRouletteTimestamp(now);
  const diff = nextMs - now;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  const d = new Date(nextMs);
  const dateLabel = `${d.toLocaleDateString("en-US", { weekday: "long" })} ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "long" })}, 8:00`;

  return { days, hours, minutes, dateLabel };
}

function getTargetLogin(): string | null {
  if (location.pathname.startsWith("/users/")) {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[1] || null;
  }
  return null;
}

async function fetchRoulette(targetLogin: string): Promise<RouletteEntry[]> {
  const cacheKey = `ROULETTE_CACHE_${targetLogin}`;
  const raw = (await chrome.storage.local.get(cacheKey))[cacheKey];
  if (raw && typeof raw === "string") {
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
      return parsed.entries;
    }
  }

  const cloudLogin = await getCloudLogin();
  const sessionToken = await getConfig("CLOUD_TOKEN");
  if (!cloudLogin || !sessionToken) return [];

  const hashedLogin = await hashLogin(cloudLogin);

  try {
    const params = new URLSearchParams({
      login: hashedLogin,
      target: targetLogin,
    });
    const res = await fetch(`${WORKER_URL}/api/v1/private/roulette?${params}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { entries: RouletteEntry[] };
    const entries = data.entries || [];

    await chrome.storage.local.set({
      [cacheKey]: JSON.stringify({
        entries,
        fetchedAt: Date.now(),
        expiresAt: nextRouletteTimestamp(Date.now()),
      }),
    });

    return entries.length > 0 ? entries : [];
  } catch {
    return [];
  }
}

function formatCountdownText(): string {
  const { days, hours, minutes } = getNextRoulette();
  const now = Date.now();
  const nextMs = nextRouletteTimestamp(now);
  const diff = nextMs - now;
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildCountdown(dateLabel: string): {
  wrap: HTMLElement;
  text: HTMLElement;
} {
  const wrap = document.createElement("span");
  wrap.className = "ft-roulette-wrap";
  wrap.style.cssText = "position: relative; cursor: default;";

  const text = document.createElement("span");
  text.id = "ft-roulette-countdown";
  text.className = "text-2xl font-bold text-amber-600";
  text.style.cssText =
    "font-variant-numeric: tabular-nums; font-feature-settings: 'tnum';";
  text.textContent = formatCountdownText();
  wrap.appendChild(text);

  const tooltip = document.createElement("div");
  tooltip.className = "ft-roulette-tooltip";
  tooltip.textContent = dateLabel;
  wrap.appendChild(tooltip);

  return { wrap, text };
}

function buildCounters(
  wins: number,
  points: number,
  dateLabel: string,
): HTMLElement {
  const counters = document.createElement("div");
  counters.className = "flex flex-row justify-around items-stretch my-2 gap-3";

  const winCol = document.createElement("div");
  winCol.className = "flex flex-row items-center gap-1.5";
  winCol.style.cssText =
    "background: rgba(59,130,246,0.08); border-radius: 10px; padding: 10px 14px;";
  const winNum = document.createElement("span");
  winNum.className = "text-2xl font-bold text-blue-600";
  winNum.textContent = String(wins);
  const winLabel = document.createElement("span");
  winLabel.className = "text-xs opacity-70 uppercase tracking-wide";
  winLabel.textContent = "Wins";
  winCol.appendChild(winNum);
  winCol.appendChild(winLabel);
  counters.appendChild(winCol);

  const ptsCol = document.createElement("div");
  ptsCol.className = "flex flex-row items-center gap-1.5";
  ptsCol.style.cssText =
    "background: rgba(34,197,94,0.08); border-radius: 10px; padding: 10px 14px;";
  const ptsNum = document.createElement("span");
  ptsNum.className = "text-2xl font-bold text-green-600";
  ptsNum.textContent = String(points);
  const ptsLabel = document.createElement("span");
  ptsLabel.className = "text-xs opacity-70 uppercase tracking-wide";
  ptsLabel.textContent = "Points";
  ptsCol.appendChild(ptsNum);
  ptsCol.appendChild(ptsLabel);
  counters.appendChild(ptsCol);

  const nextCol = document.createElement("div");
  nextCol.className = "flex flex-col items-center justify-center";
  const nextRow = document.createElement("div");
  nextRow.className = "flex flex-row items-center gap-1.5";
  nextRow.style.cssText =
    "background: rgba(245,158,11,0.08); border-radius: 10px; padding: 10px 14px;";
  const { wrap: countdownWrap } = buildCountdown(dateLabel);
  const nextLabel = document.createElement("span");
  nextLabel.className = "text-xs opacity-70 uppercase tracking-wide";
  nextLabel.textContent = "Next draw";
  nextRow.appendChild(countdownWrap);
  nextRow.appendChild(nextLabel);
  nextCol.appendChild(nextRow);
  counters.appendChild(nextCol);

  return counters;
}

function buildHistoryList(entries: RouletteEntry[]): HTMLElement {
  const scrollWrap = document.createElement("div");
  scrollWrap.style.cssText = "flex: 1; min-height: 0; overflow-y: auto;";

  const list = document.createElement("div");
  list.className = "flex flex-col gap-0.5";

  const grouped = new Map<string, number>();
  for (const entry of entries) {
    const dateStr = formatRouletteDate(entry.created_at);
    grouped.set(dateStr, (grouped.get(dateStr) || 0) + entry.sum);
  }
  for (const [dateStr, totalSum] of grouped) {
    const row = document.createElement("div");
    row.className =
      "flex flex-row justify-between hover:bg-gray-100 py-0.5 px-2 text-xs";
    const date = document.createElement("span");
    date.className = "opacity-50";
    date.textContent = dateStr;
    row.appendChild(date);
    const sum = document.createElement("span");
    sum.className = "text-sm font-bold text-green-500";
    sum.textContent = `+${totalSum}`;
    row.appendChild(sum);
    list.appendChild(row);
  }

  scrollWrap.appendChild(list);
  return scrollWrap;
}

function buildCard(
  entries: RouletteEntry[],
  showHistory: boolean,
  isOwnProfile: boolean,
) {
  const existing = document.getElementById(CARD_ID);
  if (existing) existing.remove();

  let tooltipStyle = document.getElementById(
    "ft-roulette-tooltip-style",
  ) as HTMLStyleElement | null;
  if (!tooltipStyle) {
    tooltipStyle = document.createElement("style");
    tooltipStyle.id = "ft-roulette-tooltip-style";
    document.head.appendChild(tooltipStyle);
  }
  tooltipStyle.textContent = `
      .ft-roulette-tooltip { display: none; position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%); background: hsl(var(--card)); color: hsl(var(--foreground)); font-size: 14px; padding: 6px 12px; border-radius: 4px; z-index: 100; white-space: nowrap; pointer-events: none; }
      .ft-roulette-wrap:hover .ft-roulette-tooltip { display: block; }
    `;

  cachedEntries = entries;
  cachedShowHistory = showHistory;

  const wins = new Set(entries.map((e) => formatRouletteDate(e.created_at)))
    .size;
  const points = entries.reduce((acc, e) => acc + e.sum, 0);
  const { dateLabel } = getNextRoulette();

  if (isOwnProfile) {
    const card = document.createElement("div");
    card.id = CARD_ID;
    card.className = "bg-white rounded-lg shadow-sm";
    if (showHistory) {
      card.classList.add("md:h-96");
      card.style.cssText = "overflow: hidden;";
    } else {
      card.style.cssText = "overflow: hidden; max-height: 192px;";
    }

    const inner = document.createElement("div");
    inner.className = "flex flex-col w-full h-full";
    inner.style.padding = "16px";

    const title = document.createElement("div");
    title.className = "font-bold text-black uppercase text-sm mb-2";
    title.textContent = "Thursday Roulette";
    inner.appendChild(title);

    const counters = buildCounters(wins, points, dateLabel);
    if (showHistory) {
      inner.appendChild(counters);
    } else {
      const centerWrap = document.createElement("div");
      centerWrap.className = "flex-1 flex items-center justify-center";
      centerWrap.appendChild(counters);
      inner.appendChild(centerWrap);
    }

    if (showHistory) {
      const divider = document.createElement("div");
      divider.style.cssText =
        "border-top: 1px solid hsl(var(--border)); margin: 8px 0;";
      inner.appendChild(divider);
      inner.appendChild(buildHistoryList(entries));
    }

    card.appendChild(inner);

    const grid =
      document.querySelector(".dash-main") ||
      document.querySelector(".bg-white.md\\:h-96")?.parentElement;
    if (grid) grid.appendChild(card);
  } else {
    const existingInside = document.getElementById("ft-roulette-inside");
    if (existingInside) existingInside.remove();

    const projectsCard = [
      ...document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96"),
    ].find((c) => (c.textContent || "").toUpperCase().includes("PROJECTS"));
    if (!projectsCard) return;

    projectsCard.classList.remove("md:h-96");
    projectsCard.style.display = "flex";
    projectsCard.style.flexDirection = "column";
    projectsCard.style.height = "384px";
    projectsCard.style.overflow = "hidden";

    const contentWrap = document.createElement("div");
    contentWrap.style.cssText = "flex: 1; overflow: auto; min-height: 0;";
    while (projectsCard.firstChild) {
      contentWrap.appendChild(projectsCard.firstChild);
    }
    projectsCard.appendChild(contentWrap);

    const divider = document.createElement("div");
    divider.style.cssText =
      "border-top: 1px solid hsl(var(--border)); flex-shrink: 0; margin: 8px 0;";
    projectsCard.appendChild(divider);

    const section = document.createElement("div");
    section.id = "ft-roulette-inside";
    section.style.cssText = showHistory
      ? "flex: 1; overflow: auto; min-height: 0; padding: 10px 0;"
      : "padding: 10px 0;";

    const title = document.createElement("div");
    title.className = "font-bold text-black uppercase text-sm mb-2";
    title.textContent = "Thursday Roulette";
    section.appendChild(title);

    section.appendChild(buildCounters(wins, points, dateLabel));

    if (showHistory) {
      const hDivider = document.createElement("div");
      hDivider.style.cssText =
        "border-top: 1px solid hsl(var(--border)); margin: 8px 0;";
      section.appendChild(hDivider);
      section.appendChild(buildHistoryList(entries));
    }

    projectsCard.appendChild(section);
  }

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const el = document.getElementById("ft-roulette-countdown");
    if (!el) {
      if (countdownInterval) clearInterval(countdownInterval);
      return;
    }
    el.textContent = formatCountdownText();
  }, 1000);
}

export async function initRoulette() {
  if (rouletteInitialized || roulettePolling) return;

  const showRoulette = await getConfig("PROFILE_SHOW_ROULETTE");
  if (!showRoulette) return;

  if (
    location.hostname !== "profile-v3.intra.42.fr" ||
    !(location.pathname === "/" || location.pathname.startsWith("/users"))
  )
    return;

  roulettePolling = true;

  const showHistory = await getConfig("PROFILE_SHOW_ROULETTE_HISTORY");
  const cloudLogin = await getCloudLogin();
  const targetLogin = getTargetLogin() || cloudLogin;
  if (!targetLogin) return;

  let attempts = 0;
  let polling = true;
  const poll = () => {
    if (!polling) return;
    if (++attempts > 30) {
      polling = false;
      roulettePolling = false;
      return;
    }

    const grid =
      document.querySelector(".dash-main") ||
      document.querySelector(".bg-white.md\\:h-96")?.parentElement;

    if (!grid) {
      requestAnimationFrame(poll);
      return;
    }

    polling = false;
    roulettePolling = false;
    rouletteInitialized = true;

    const isOwnProfile = location.pathname === "/";
    fetchRoulette(targetLogin).then((entries) => {
      if (entries.length > 0) buildCard(entries, showHistory, isOwnProfile);
    });
  };
  requestAnimationFrame(poll);
}

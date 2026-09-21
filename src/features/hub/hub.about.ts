import { html } from "lit-html";
import { until } from "lit-html/directives/until.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { directive, Directive } from "lit-html/directive.js";
import type { PartInfo } from "lit-html/directive.js";
import { HUB_INFO } from "../hub/hubSettings.data.ts";

import GITHUB_SVG from "../../assets/svg/github.svg?raw";
import ICON_SVG from "../../assets/svg/icon.svg?raw";
import ISSUES_SVG from "../../assets/svg/issues.svg?raw";
import PERSON_FOLLOW_SVG from "../../assets/svg/person-follow.svg?raw";
import PR_SVG from "../../assets/svg/pr.svg?raw";
import STAR_SVG from "../../assets/svg/star.svg?raw";

const QUICK_LINKS = [
  {
    href: HUB_INFO.github,
    svg: GITHUB_SVG,
    label: "GitHub",
    color: "bg-primary text-primary-content",
  },
  {
    href: HUB_INFO.issues,
    svg: ISSUES_SVG,
    label: "Issues",
    color: "bg-secondary text-secondary-content",
  },
  {
    href: `${HUB_INFO.github}/pulls`,
    svg: PR_SVG,
    label: "PRs",
    color: "bg-accent text-accent-content",
  },
];

let starCountPromise: Promise<number | null> | null = null;

function getStarCount(): Promise<number | null> {
  return (starCountPromise ??= fetch(
    "https://api.github.com/repos/nicopasla/better-intra",
  )
    .then((r) => r.json())
    .then((d) => d.stargazers_count as number)
    .catch(() => null));
}

let followerCountPromise: Promise<number | null> | null = null;

function getFollowerCount(): Promise<number | null> {
  return (followerCountPromise ??= fetch(
    "https://api.github.com/users/nicopasla",
  )
    .then((r) => r.json())
    .then((d) => d.followers as number)
    .catch(() => null));
}

type HistoryPoint = { date: string; total: number };

type Stats = {
  total: number;
  newToday: number;
  newLast30Days: number;
  newLast14Days: number;
  newLast7Days: number;
  history?: HistoryPoint[];
  countries: {
    country: string;
    count: number;
    campuses: { name: string; count: number }[];
  }[];
};

let communityStatsPromise: Promise<Stats | null> | null = null;

function getCommunityStats(): Promise<Stats | null> {
  return (communityStatsPromise ??= fetch(
    "https://api.betterintra.com/api/v1/public/stats",
  )
    .then((r) => r.json())
    .then((d) => d as Stats)
    .catch(() => null));
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...[...upper].map((c) => 127397 + c.charCodeAt(0)),
  );
}

let countryNames: Intl.DisplayNames | null = null;
try {
  countryNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  countryNames = null;
}

function countryName(code: string): string {
  if (!code || code.length !== 2) return "Unknown";
  if (!countryNames) return code;
  try {
    return countryNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

const MAX_CAMPUSES_IN_TOOLTIP = 5;

function countryTooltip(c: {
  country: string;
  count: number;
  campuses: { name: string; count: number }[];
}): string {
  const name = countryName(c.country);
  if (!c.campuses || c.campuses.length === 0) return name;
  const shown = c.campuses.slice(0, MAX_CAMPUSES_IN_TOOLTIP);
  const parts = shown.map((cp) => `${cp.name} (${cp.count})`);
  if (c.campuses.length > MAX_CAMPUSES_IN_TOOLTIP) parts.push("…");
  return `${name} · ${parts.join(", ")}`;
}

const MAX_GROWTH_POINTS = 120;

function downsample(history: HistoryPoint[]): HistoryPoint[] {
  if (history.length <= MAX_GROWTH_POINTS) return history;
  const step = history.length / MAX_GROWTH_POINTS;
  const out: HistoryPoint[] = [];
  for (let i = 0; i < MAX_GROWTH_POINTS; i++) {
    out.push(history[Math.floor(i * step)]);
  }
  out[out.length - 1] = history[history.length - 1];
  return out.filter((p, i, a) => i === 0 || p.date !== a[i - 1].date);
}

const GROWTH_MONTHS = 3;

function lastMonths(history: HistoryPoint[]): HistoryPoint[] {
  if (history.length === 0) return history;
  const latest = new Date(`${history[history.length - 1].date}T00:00:00Z`);
  if (Number.isNaN(latest.getTime())) return history;

  const cutoff = new Date(latest);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - GROWTH_MONTHS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const recent = history.filter((p) => p.date >= cutoffKey);
  if (recent.length >= 2) return recent;

  const tail = history.slice(-GROWTH_MONTHS * 31);
  return tail.length >= 2 ? tail : history;
}

function formatGrowthDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const W = 200;
const H = 40;
const PAD_TOP = 4;
const PAD_BOTTOM = 4;

type ChartPoint = { x: number; y: number; date: string; total: number };

type GrowthLayout = {
  points: ChartPoint[];
  polyline: string;
  area: string;
  plotW: number;
  baseY: number;
};

const growthLayouts = new WeakMap<SVGSVGElement, GrowthLayout>();

function buildGrowthLayout(history: HistoryPoint[]): GrowthLayout {
  const n = history.length;
  const plotW = W;
  const baseY = H - PAD_BOTTOM;
  const topY = PAD_TOP;
  const scaleMax = Math.max(...history.map((p) => p.total), 1);

  const xAt = (i: number) => (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (total: number) =>
    baseY - (Math.max(total, 0) / scaleMax) * (baseY - topY);

  const points: ChartPoint[] = history.map((p, i) => ({
    x: xAt(i),
    y: yAt(p.total),
    date: p.date,
    total: p.total,
  }));

  const polyline = points
    .map((p) => `${round2(p.x)} ${round2(p.y)}`)
    .join(" L ");
  const area = `M${round2(points[0].x)} ${baseY} L ${polyline} L ${round2(
    points[n - 1].x,
  )} ${baseY} Z`;

  return { points, polyline, area, plotW, baseY };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function growthAnchor(layout: GrowthLayout, clientX: number): ChartPoint {
  const { points, plotW } = layout;
  let nearest = points[0];
  let best = Infinity;
  for (const p of points) {
    const d = Math.abs(p.x - clientX * plotW);
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  return nearest;
}

function hideGrowthHint(el: Element): void {
  const svg = el.closest("svg");
  if (!svg) return;
  svg.querySelector(".bi-growth-cursor")?.setAttribute("opacity", "0");
  svg.querySelector(".bi-growth-spot")?.setAttribute("opacity", "0");
  const hint = el.parentElement?.querySelector<HTMLElement>(".bi-growth-hint");
  hint?.classList.add("hidden");
}

function showGrowthHint(el: Element, e: PointerEvent): void {
  const svg = el.closest<SVGSVGElement>("svg");
  if (!svg) return;
  const layout = growthLayouts.get(svg);
  if (!layout) return;

  const rect = svg.getBoundingClientRect();
  if (rect.width === 0) return;
  const fraction = (e.clientX - rect.left) / rect.width;
  const anchor = growthAnchor(layout, Math.min(Math.max(fraction, 0), 1));

  svg.querySelector(".bi-growth-cursor")?.setAttribute("opacity", "1");
  const cursor = svg.querySelector<SVGLineElement>(".bi-growth-cursor");
  cursor?.setAttribute("x1", `${anchor.x}`);
  cursor?.setAttribute("x2", `${anchor.x}`);

  const spot = svg.querySelector<SVGCircleElement>(".bi-growth-spot");
  spot?.setAttribute("cx", `${anchor.x}`);
  spot?.setAttribute("cy", `${anchor.y}`);
  spot?.setAttribute("opacity", "1");

  const hint = el.parentElement?.querySelector<HTMLElement>(".bi-growth-hint");
  if (!hint) return;
  hint.textContent = `${formatGrowthDate(anchor.date)} · ${anchor.total}`;
  hint.classList.remove("hidden");

  const leftPct = (anchor.x / W) * 100;
  hint.style.left = `${leftPct}%`;
}

function registerGrowthLayout(el: Element, layout: GrowthLayout): void {
  growthLayouts.set(el as SVGSVGElement, layout);
}

class RegisterGrowthChart extends Directive {
  constructor(part: PartInfo) {
    super(part);
  }
  render(layout: GrowthLayout): unknown {
    void layout;
    return undefined;
  }
  update(part: unknown, [layout]: [GrowthLayout]): unknown {
    const el = (part as { element?: Element }).element;
    if (el) registerGrowthLayout(el, layout);
    return undefined;
  }
}

const registerGrowthChartDirective = directive(RegisterGrowthChart);

function renderGrowthChart(
  rawHistory: HistoryPoint[],
): ReturnType<typeof html> {
  const history = downsample(lastMonths(rawHistory));
  const layout = buildGrowthLayout(history);
  const { area, polyline } = layout;

  return html`
    <div
      class="relative flex items-center justify-center rounded-xl bg-base-100 px-4 min-w-32"
      style="border: 2px solid #8956ff"
    >
      <svg
        viewBox="0 0 ${W} ${H}"
        class="w-full h-full text-[#8956ff]"
        preserveAspectRatio="none"
        ${registerGrowthChartDirective(layout)}
        @pointermove=${(e: PointerEvent) =>
          showGrowthHint(e.currentTarget as Element, e)}
        @pointerleave=${(e: PointerEvent) =>
          hideGrowthHint(e.currentTarget as Element)}
      >
        <path
          d="${area}"
          fill="currentColor"
          fill-opacity="0.2"
          stroke="none"
        />
        <path
          d="M ${polyline}"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <line
          class="bi-growth-cursor"
          x1="0"
          x2="0"
          y1="0"
          y2="${H}"
          stroke="currentColor"
          stroke-width="1"
          opacity="0"
          pointer-events="none"
        />
        <circle
          class="bi-growth-spot"
          cx="0"
          cy="0"
          r="2"
          fill="currentColor"
          opacity="0"
          pointer-events="none"
        />
      </svg>
      <span
        class="bi-growth-hint hidden absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-base-300 px-1.5 py-0.5 text-[11px] font-mono whitespace-nowrap pointer-events-none"
      ></span>
    </div>
  `;
}

export function renderAboutPanel(): ReturnType<typeof html> {
  return html`
    <div
      class="card bg-base-100 border border-base-300 shadow-sm w-full h-full overflow-hidden select-none"
    >
      <div
        class="card-body p-4 flex flex-col gap-4 text-base-content overflow-y-auto"
      >
        <!-- Hero -->
        <div class="flex flex-col gap-3 shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="size-12 flex items-center justify-center"
                style="color: #00babc;"
              >
                ${unsafeHTML(ICON_SVG)}
              </div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight">
                  ${HUB_INFO.name}
                </h1>
                <a
                  href="${HUB_INFO.github}/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm font-bold transition-all hover:scale-105 active:scale-95"
                >
                  <span>v${HUB_INFO.version}</span>
                </a>
                <a
                  href="https://github.com/nicopasla/better-intra"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm gap-1"
                >
                  <span
                    class="size-4 flex items-center justify-center fill-current"
                  >
                    ${unsafeHTML(STAR_SVG)}
                  </span>
                  <span>Star</span>
                  ${until(
                    getStarCount().then((c) =>
                      c != null
                        ? html`<span class="badge badge-sm font-mono"
                            >${c}</span
                          >`
                        : "",
                    ),
                    html`<span
                      class="loading loading-spinner loading-xs"
                    ></span>`,
                  )}
                </a>
              </div>
            </div>
          </div>
          <p class="text-sm opacity-60 max-w-full">
            UI and UX improvements for 42 Intra v3: logtime calendar, cluster
            map tools, custom profiles, shortcuts, friends widget, and more.
          </p>
        </div>

        <!-- Community -->
        <div class="flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold uppercase tracking-widest">
              Community
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          ${until(
            getCommunityStats().then((s) =>
              s && s.total > 0
                ? html`
                    <div
                      class="flex flex-col gap-3 p-4 bg-base-200 rounded-xl border border-base-300"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div
                          class="flex flex-col items-center rounded-xl bg-base-100 px-6 py-3"
                          style="border: 2px solid #00babc"
                        >
                          <span
                            class="text-3xl font-bold font-mono leading-none"
                            >${s.total}</span
                          >
                          <span class="text-sm opacity-60 font-semibold"
                            >users</span
                          >
                        </div>
                        ${s.history && s.history.length > 1
                          ? html`<div
                              class="self-stretch shrink-0 flex min-w-40"
                            >
                              ${renderGrowthChart(s.history)}
                            </div>`
                          : ""}
                        <div class="flex items-start justify-end gap-6">
                          ${[
                            {
                              label: "today",
                              value: s.newToday ?? 0,
                              color: "#a78bfa",
                            },
                            {
                              label: "in 7 days",
                              value: s.newLast7Days,
                              color: "#fb923c",
                            },
                            {
                              label: "in 14 days",
                              value: s.newLast14Days,
                              color: "#4ade80",
                            },
                            {
                              label: "in 30 days",
                              value: s.newLast30Days,
                              color: "#38bdf8",
                            },
                          ].map(
                            (w) => html`
                              <div
                                class="flex flex-col items-center rounded-xl bg-base-100 px-6 py-3"
                                style="border: 2px solid ${w.color}"
                              >
                                <span
                                  class="text-3xl font-bold font-mono leading-none"
                                  >+${w.value}</span
                                >
                                <span
                                  class="text-sm text-center opacity-60 font-semibold"
                                  >${w.label}</span
                                >
                              </div>
                            `,
                          )}
                        </div>
                      </div>
                      ${s.countries.length > 0
                        ? html`
                            <div class="flex flex-wrap gap-1 justify-center">
                              ${s.countries.map(
                                (c) => html`
                                  <span
                                    class="badge badge-lg font-mono gap-2 px-4 py-4 bg-base-100"
                                    style="border: 2px solid var(--color-info)"
                                    data-tip="${countryTooltip(c)}"
                                  >
                                    <span class="text-2xl"
                                      >${countryFlag(c.country)}</span
                                    >
                                    <span class="text-xl font-bold"
                                      >${c.count}</span
                                    >
                                  </span>
                                `,
                              )}
                            </div>
                          `
                        : ""}
                    </div>
                  `
                : "",
            ),
            html`<div class="loading loading-spinner loading-sm"></div>`,
          )}
        </div>

        <!-- Quick Links -->
        <div class="flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold uppercase tracking-widest">
              Quick Links
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          <div class="join w-full">
            ${QUICK_LINKS.map(
              (link) => html`
                <a
                  href="${link.href}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="join-item btn btn-md flex-1 gap-2 border-none ${link.color} transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span
                    class="size-5 flex items-center justify-center fill-current"
                  >
                    ${unsafeHTML(link.svg)}
                  </span>
                  <span class="text-sm font-semibold">${link.label}</span>
                </a>
              `,
            )}
          </div>
        </div>

        <!-- Divider -->
        <div class="divider my-0 opacity-20 shrink-0"></div>

        <!-- Footer -->
        <div class="text-center mt-auto shrink-0">
          <p class="text-sm opacity-50 font-medium">
            Made for 42 Belgium · ${HUB_INFO.license} License
          </p>
          <div class="flex justify-center gap-3 mt-2">
            <a
              href="https://github.com/nicopasla"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm gap-1"
            >
              <span
                class="size-4 flex items-center justify-center fill-current"
              >
                ${unsafeHTML(PERSON_FOLLOW_SVG)}
              </span>
              <span>Follow</span>
              ${until(
                getFollowerCount().then((c) =>
                  c != null
                    ? html`<span class="badge badge-sm font-mono">${c}</span>`
                    : "",
                ),
                html`<span class="loading loading-spinner loading-xs"></span>`,
              )}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getConfig } from "../../config.ts";
import { waitFor } from "../../utils/wait-for.ts";
import { getCloudLogin } from "../account/account.ts";
import { getLoginFromPage } from "../../utils/profile-login.ts";
import { formatAbsoluteDate, parseIntraDate } from "../../utils/dates.ts";
import {
  INTRAPY_BASE,
  intrapyFetch,
  waitForIntrapyToken,
} from "../../utils/intrapy.ts";
import { INTRA_FONT } from "../logtime/constants.ts";
import CHECK_CIRCLE_SVG from "../../assets/svg/check-circle.svg?raw";

interface Achievement {
  name: string;
  achieved_at: string;
  description: string;
  svg: string;
}

/** An achievement icon is either inline SVG markup (fetched inlined) or a URL
 *  the browser can load itself. */
export type AchievementIcon =
  | { kind: "inline"; markup: string }
  | { kind: "url"; url: string };

const INJECTED_ID = "ft-achievements-injected";
let achievementsInitialized = false;
let lastInjectedLogin: string | null = null;

/** The intrapy API returns `svg` either as markup or as a URL, sometimes
 *  relative to the intrapy host. Resolve it to a source we can render. */
export function resolveAchievementIconSource(
  value: string | null | undefined,
): AchievementIcon | null {
  const source = (value ?? "").trim();
  if (!source) return null;
  if (source.startsWith("<")) return { kind: "inline", markup: source };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(source);
  const url = hasScheme
    ? source
    : source.startsWith("//")
      ? `https:${source}`
      : `${INTRAPY_BASE}${source.startsWith("/") ? "" : "/"}${source}`;
  return { kind: "url", url };
}

/** Sizes an SVG for the 45×45 icon box without touching its children: the old
 *  blanket `width|height` attribute strip also hit `<rect>`/`<image>`/`<mask>`
 *  nodes and left shape-based icons blank. */
export function normalizeAchievementSvg(markup: string): string {
  const source = markup.trim();
  if (!source.startsWith("<")) return markup;
  try {
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return markup;

    const dimension = (name: string): number => {
      const raw = (root.getAttribute(name) ?? "").trim();
      const match = /^(\d+(?:\.\d+)?)(?:px)?$/i.exec(raw);
      return match ? Number.parseFloat(match[1]) : 0;
    };
    const width = dimension("width");
    const height = dimension("height");
    if (!root.getAttribute("viewBox") && width > 0 && height > 0) {
      root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return markup;
  }
}

/** Bearer-protected intrapy assets are fetched and inlined; anything else is
 *  left to the browser as an `<img>`, which bypasses CORS and carries the intra
 *  session cookie (a bare cross-origin `fetch` carries neither). */
async function loadIcon(
  value: string,
  token: string,
): Promise<AchievementIcon | null> {
  const resolved = resolveAchievementIconSource(value);
  if (!resolved) return null;
  if (resolved.kind === "inline") {
    return { kind: "inline", markup: normalizeAchievementSvg(resolved.markup) };
  }
  if (!resolved.url.startsWith(INTRAPY_BASE)) return resolved;

  try {
    const res = await fetch(resolved.url, {
      headers: { Authorization: token },
      credentials: "include",
    });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith("<")) {
        return { kind: "inline", markup: normalizeAchievementSvg(text) };
      }
    }
    console.warn("[achievements] icon fetch failed", resolved.url, res.status);
  } catch (e) {
    console.warn("[achievements] icon fetch error", resolved.url, e);
  }
  return resolved;
}

async function fetchAchievements(
  login: string,
  token: string,
): Promise<Achievement[]> {
  const data = await intrapyFetch<Achievement[]>(
    `/api/v1/users/${login}/achievements`,
    token,
  );
  return Array.isArray(data) ? data : [];
}

function formatDate(dateStr: string): string {
  return formatAbsoluteDate(dateStr, "short");
}

function findCard(): HTMLElement | null {
  for (const card of document.querySelectorAll<HTMLElement>(
    ".bg-white.md\\:h-96",
  )) {
    if (
      card
        .querySelector("[class*='uppercase']")
        ?.textContent?.trim()
        .toUpperCase() === "LAST ACHIEVEMENTS"
    )
      return card;
  }
  return null;
}

function renderIcon(icon: AchievementIcon | undefined) {
  if (!icon) {
    return html`<div
      class="w-8 h-8 bg-zinc-200 rounded-sm animate-pulse"
    ></div>`;
  }
  if (icon.kind === "inline") {
    return html`<div style="width:45px;height:45px">
      ${unsafeHTML(icon.markup)}
    </div>`;
  }
  return html`<img
    src="${icon.url}"
    alt=""
    width="45"
    height="45"
    style="width:45px;height:45px;object-fit:contain"
  />`;
}

function renderList(
  achievements: Achievement[],
  icons: Map<string, AchievementIcon>,
) {
  return html`<div
    class="grid gap-4 mt-4"
    style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))"
  >
    ${achievements.map(
      (a) =>
        html` <div
          class="w-full border-2 border-neutral-200 flex flex-row justify-between rounded-sm h-24"
        >
          <div class="p-3 flex flex-row justify-between w-full items-center">
            <div class="flex flex-col min-w-0 flex-1">
              <h1 class="text-base font-medium leading-none">${a.name}</h1>
              <p
                class="text-xs max-h-10 overflow-y-auto text-neutral-400 pt-2"
                style="scrollbar-width:none"
              >
                ${a.description}
              </p>
            </div>
            <div class="pt-1 flex flex-row gap-1 shrink-0 ml-3">
              <div>
                <span
                  class="size-6 flex items-center justify-center"
                  style="color: hsl(var(--legacy-main))"
                  >${unsafeHTML(CHECK_CIRCLE_SVG)}</span
                >
              </div>
              <div>
                <p class="font-bold text-legacy-main">Achieved</p>
                <p>${formatDate(a.achieved_at)}</p>
              </div>
            </div>
          </div>
          <div class="bg-zinc-100 w-20 grid place-items-center shrink-0">
            ${renderIcon(icons.get(a.svg))}
          </div>
        </div>`,
    )}
  </div>`;
}

function inject(achievements: Achievement[], token: string) {
  const existing = document.getElementById(INJECTED_ID);
  const card = findCard();
  if (!card) {
    if (existing) existing.remove();
    return;
  }

  const grid = card.querySelector<HTMLElement>(
    ":scope .h-full .grid, :scope .grid",
  );
  const area = grid?.parentElement;
  if (!area) return;

  if (existing) {
    if (grid) grid.style.display = "";
    existing.remove();
  }
  if (grid) grid.style.display = "none";

  const container = document.createElement("div");
  container.id = INJECTED_ID;
  container.style.cssText = `font-family: ${INTRA_FONT};`;

  const icons = new Map<string, AchievementIcon>();
  const load = (a: Achievement) => {
    const curried = () => render(renderList(achievements, icons), container);
    if (icons.has(a.svg)) {
      curried();
      return;
    }
    loadIcon(a.svg, token)
      .then((icon) => {
        if (icon) icons.set(a.svg, icon);
        curried();
      })
      .catch(() => curried());
  };
  for (const a of achievements) load(a);
  render(renderList(achievements, icons), container);
  area.appendChild(container);
}

async function tryInject(achievements: Achievement[], token: string) {
  const sorted = [...achievements].sort(
    (a, b) =>
      parseIntraDate(b.achieved_at).getTime() -
      parseIntraDate(a.achieved_at).getTime(),
  );
  await waitFor(() => findCard() !== null, 1000).then((ok) => {
    if (ok) inject(sorted, token);
  });
}

export async function initAchievements() {
  if (!(await getConfig("PROFILE_SHOW_ACHIEVEMENTS"))) return;
  if (
    location.hostname !== "profile-v3.intra.42.fr" ||
    location.pathname !== "/"
  )
    return;

  const pageLogin = getLoginFromPage();
  const login = (await getCloudLogin()) || pageLogin;
  if (!login) return;
  if (achievementsInitialized && login === lastInjectedLogin) return;

  const token = await waitForIntrapyToken(30000);
  if (!token) return;
  achievementsInitialized = true;
  lastInjectedLogin = login;

  const achievements = await fetchAchievements(login, token);
  if (achievements.length === 0) return;

  await tryInject(achievements, token);
}

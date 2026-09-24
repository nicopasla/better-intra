import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import { INTRA_FONT } from "../logtime/constants.ts";

let initialized = false;
let observer: MutationObserver | null = null;
let showCountdown = true;

const WRAPPER_ID = "ft-blackhole-v2";
const STYLE_ID = "ft-blackhole-v2-style";

const STYLES = `
#${WRAPPER_ID} {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  text-align: center;
}
#${WRAPPER_ID} .title {
  font-family: ${INTRA_FONT};
  font-size: 1.05rem;
  font-weight: 600;
}
#${WRAPPER_ID} .coalition-span,
#${WRAPPER_ID} .milestone .end-goal {
  color: inherit;
}
#${WRAPPER_ID} .milestone .end-goal {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  font-family: var(--font-sans);
}
#${WRAPPER_ID}.ultimate .coalition-span,
#${WRAPPER_ID}.ultimate .milestone .end-goal {
  color: rgb(234, 52, 35);
}
#${WRAPPER_ID} .eta .end-goal {
  color: inherit;
  font-size: 1.25rem;
  font-weight: 500;
  opacity: 0.7;
  font-family: var(--font-sans);
}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function findWidget() {
  if (!document.body) return null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = node.textContent || "";
        const parent = node.parentElement;
        if (parent?.closest(`#${WRAPPER_ID}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        return /blackholed at|milestone deadline/i.test(text) &&
          text.trim().length < 40
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  const label = walker.nextNode()?.parentElement as HTMLElement | null;
  const dateBlock = label?.parentElement as HTMLElement | null;
  const topRow = dateBlock?.parentElement as HTMLElement | null;
  const widgetRoot = topRow?.parentElement?.parentElement
    ?.parentElement as HTMLElement | null;
  if (!dateBlock || !widgetRoot) return null;

  return { dateBlock, widgetRoot };
}

function isRed(el: Element | null): boolean {
  if (!el) return false;
  const match = getComputedStyle(el).color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)/,
  );
  if (!match) return false;
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return r > 120 && r > g * 1.5 && r > b * 1.5;
}

function extractDeadline(dateBlock: HTMLElement): {
  label: string;
  daysLeft: number;
  isUltimate: boolean;
} | null {
  const dateEl = dateBlock.lastElementChild;
  const text = (dateEl?.textContent || "").trim();
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const deadline = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - Date.now()) / 86400000),
  );
  return { label: match[0], daysLeft, isUltimate: isRed(dateEl) };
}

function template(label: string, daysLeft: number, isUltimate: boolean) {
  const eta = `${daysLeft} days left`;
  const title = isUltimate
    ? "Milestone Ultimate Deadline"
    : "Milestone Deadline";
  return html`
    <div id="${WRAPPER_ID}" class="${isUltimate ? "ultimate" : ""}">
      <div class="milestone">
        <div class="title mb-1">
          <span class="coalition-span">${title}</span>
        </div>
        <div class="container-end-goal">
          <div class="end-goal" title="${eta}">${label}</div>
        </div>
      </div>
      <div class="eta">
        <div class="container-end-goal">
          ${showCountdown ? html`<div class="end-goal">${eta}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

function applyV2Mode(): boolean {
  const widget = findWidget();
  if (!widget) return false;

  if (widget.widgetRoot.querySelector(`#${WRAPPER_ID}`)) return true;

  const deadline = extractDeadline(widget.dateBlock);
  if (!deadline) return false;

  injectStyles();
  widget.widgetRoot.style.visibility = "hidden";
  const host = document.createElement("div");
  host.style.cssText =
    "flex: 1 1 0%; width: 100%; display: flex; align-items: center; justify-content: center;";
  widget.widgetRoot.style.paddingBottom = "0px";
  widget.widgetRoot.replaceChildren(host);
  render(
    template(deadline.label, deadline.daysLeft, deadline.isUltimate),
    host,
  );
  widget.widgetRoot.style.visibility = "visible";
  return true;
}

function poll(attempts = 0) {
  if (applyV2Mode()) return;
  if (attempts > 300) return;
  requestAnimationFrame(() => poll(attempts + 1));
}

export async function initBlackholeMode() {
  if (initialized) return;
  if (location.hostname !== "profile-v3.intra.42.fr") return;
  if (location.pathname !== "/" && !location.pathname.startsWith("/users/"))
    return;

  const [enabled, countdown] = await Promise.all([
    getConfig("PROFILE_V2_BLACKHOLE"),
    getConfig("PROFILE_BLACKHOLE_SHOW_COUNTDOWN"),
  ]);
  showCountdown = countdown;
  if (!enabled) return;
  initialized = true;

  poll();

  let pending = false;
  let lastMiss = 0;
  observer = new MutationObserver(() => {
    if (pending) return;
    if (document.getElementById(WRAPPER_ID)) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (document.getElementById(WRAPPER_ID)) return;
      if (Date.now() - lastMiss < 1000) return;
      if (!applyV2Mode()) lastMiss = Date.now();
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener(
    "pagehide",
    () => {
      observer?.disconnect();
      observer = null;
    },
    { once: true },
  );
}

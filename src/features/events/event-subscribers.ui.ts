import { html, render, type TemplateResult } from "lit-html";
import { formatAbsoluteDateTime, formatTimeAgo } from "../../utils/dates.ts";
import {
  findEventIdByName,
  initEventIndex,
  isExamEventName,
} from "./event-index.ts";
import {
  SUBSCRIBERS_LIVE_MS,
  SUBSCRIBERS_STALE_MS,
  clearCachedSubscribers,
  fetchEventSubscribers,
  lookupEventId,
  readCachedSubscribers,
  type EventSubscriber,
  type EventSubscribersPage,
} from "./event-subscribers.ts";

const MARKER = "data-ft-event-subscribers";
const PANEL_ID = "ft-event-subscribers-panel";
const ACTIONS_SELECTOR = '[role="dialog"], dialog, .modal';

/** Neutral action styling, copied from Intra's own "Close" button. */
const FALLBACK_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4";

/**
 * The panel lives in the page's light DOM (inside Intra's own dialog) and only
 * inherits `color`/font, so it matches the event dialog and scrolls normally.
 * A shadow root + daisyUI card looked foreign and could be clipped.
 */
const STYLE = {
  panel:
    "border-top:1px solid color-mix(in srgb, currentColor 18%, transparent);",
  header:
    "display:flex;align-items:center;gap:8px;padding:12px 16px 6px;margin:0;flex:none;",
  title: "font-size:13px;font-weight:700;flex:none;",
  hide: "flex:none;border:none;background:transparent;color:inherit;opacity:.55;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;",
  list: "max-height:min(16rem,40vh);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable;padding:0 16px 10px;",
  row: "display:flex;align-items:center;gap:10px;padding:4px 0;",
  avatar:
    "width:28px;height:28px;border-radius:9999px;object-fit:cover;flex:none;background:color-mix(in srgb, currentColor 15%, transparent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;overflow:hidden;",
  login:
    "flex:1;min-width:0;font-size:13px;font-weight:600;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
  name: "font-size:11px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
  note: "padding:10px 0 4px;font-size:12px;opacity:.7;text-align:center;",
};

/** daisyUI-style pill: rounded badge radius, tinted fill + border. */
const badgeStyle = (color: string): string =>
  `flex:none;font-size:11px;line-height:1.6;font-weight:600;padding:0 8px;border-radius:9999px;` +
  `color:${color};border:1px solid color-mix(in srgb, ${color} 55%, transparent);` +
  `background:color-mix(in srgb, ${color} 15%, transparent);`;

const SEAT_STYLE = badgeStyle("#10b981");

/** daisyUI-style freshness chip, clickable to refresh. */
const chipStyle = (color?: string): string =>
  `margin-left:auto;flex:none;font-size:11px;line-height:1.6;font-weight:600;` +
  `padding:0 8px;border-radius:9999px;cursor:pointer;` +
  (color
    ? `color:${color};border:1px solid color-mix(in srgb, ${color} 55%, transparent);` +
      `background:color-mix(in srgb, ${color} 15%, transparent);`
    : `color:inherit;border:1px solid color-mix(in srgb, currentColor 35%, transparent);` +
      `background:transparent;`);

const SCROLL_STYLE_ID = "ft-event-subscribers-style";

/**
 * Makes the list obviously scrollable: a reserved, always-visible thin
 * scrollbar (overlay scrollbars hide until the user scrolls).
 */
function ensureScrollbarStyle(): void {
  if (document.getElementById(SCROLL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SCROLL_STYLE_ID;
  style.textContent = `
#${PANEL_ID} .ft-subs-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.55) transparent;
}
#${PANEL_ID} .ft-subs-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
#${PANEL_ID} .ft-subs-scroll::-webkit-scrollbar-track { background: transparent; }
#${PANEL_ID} .ft-subs-scroll::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.55);
  border-radius: 9999px;
}
#${PANEL_ID} .ft-subs-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.8);
}`;
  (document.head || document.documentElement).appendChild(style);
}

let started = false;
let scanScheduled = false;

/** Event ids resolved by name, so later scans/clicks skip the lookup. */
const idByName = new Map<string, number>();

/** Layout undo callbacks for panels that reshaped the dialog (side-by-side). */
const restorers = new WeakMap<HTMLElement, () => void>();

function label(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findCloseButton(row: HTMLElement): HTMLElement | null {
  for (const el of row.querySelectorAll<HTMLElement>("button, a")) {
    if (label(el) === "close") return el;
  }
  return null;
}

/** Close on the far left of the action row. */
function pinCloseLeft(row: HTMLElement): HTMLElement | null {
  const closeBtn = findCloseButton(row);
  if (!closeBtn) return null;
  if (row.firstElementChild !== closeBtn) {
    row.insertBefore(closeBtn, row.firstElementChild);
  }
  return closeBtn;
}

/** Fallback for dialogs without a Subscribe button (e.g. exams). */
function findCloseRow(): { row: HTMLElement } | null {
  for (const btn of document.querySelectorAll<HTMLElement>("button, a")) {
    if (label(btn) !== "close") continue;
    const row = btn.parentElement;
    if (!row) continue;
    if (!btn.closest(ACTIONS_SELECTOR) && !/\/events/.test(location.pathname)) {
      continue;
    }
    return { row };
  }
  return null;
}

/**
 * Finds Intra's event action row: the Subscribe/Unsubscribe button, next to a
 * Close button or inside the event dialog.
 */
function findActions(): {
  row: HTMLElement;
  anchor: HTMLButtonElement;
  container: HTMLElement | null;
} | null {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("button")) {
    const text = label(btn);
    if (text !== "subscribe" && text !== "unsubscribe") continue;
    const row = btn.parentElement;
    if (!row) continue;
    const container = btn.closest<HTMLElement>(ACTIONS_SELECTOR);
    if (
      !findCloseButton(row) &&
      !container &&
      !/\/events\/\d+/.test(location.pathname)
    ) {
      continue;
    }
    return { row, anchor: btn, container };
  }
  return null;
}

/** The event id, from the route, the query, or a link in the dialog. */
export function resolveEventId(container: HTMLElement | null): number | null {
  const fromPath = location.pathname.match(/\/events\/(\d+)/);
  if (fromPath) return Number(fromPath[1]);

  for (const params of [
    new URLSearchParams(location.search),
    new URLSearchParams(location.hash.replace(/^#/, "")),
  ]) {
    const value = params.get("event") ?? params.get("event_id");
    if (value && /^\d+$/.test(value)) return Number(value);
  }

  const root: ParentNode = container ?? document;
  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/events/"]',
  )) {
    const match = link.getAttribute("href")?.match(/\/events\/(\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
}

function eventTitle(container: HTMLElement | null): string {
  const heading = container?.querySelector("h4, h3, h2, h1");
  return heading?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Exams have no subscribers endpoint, so the button is hidden for them. */
function isExam(container: HTMLElement | null): boolean {
  if (/\/exams?\//.test(location.pathname)) return true;
  const title = eventTitle(container);
  if (/^exam\b/i.test(title)) return true;
  if (isExamEventName(title)) return true;
  return !!container?.querySelector('a[href*="/exams/"]');
}

/** Resolves with null instead of waiting forever on a stalled lookup. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** Id from captured Intra payloads, the page, or the user's event list. */
async function resolveId(
  container: HTMLElement | null,
  title: string,
): Promise<number | null> {
  const key = title.toLowerCase();
  const known = key ? idByName.get(key) : undefined;
  if (known) return known;

  const indexed = findEventIdByName(title);
  if (indexed) {
    if (key) idByName.set(key, indexed);
    return indexed;
  }

  const direct = resolveEventId(container);
  if (direct) {
    if (key) idByName.set(key, direct);
    return direct;
  }

  const looked = await lookupEventId(title);
  if (looked && key) idByName.set(key, looked);
  return looked;
}

function initials(login: string): string {
  return login.slice(0, 2).toUpperCase();
}

/**
 * Opens (or collapses) the subscribers panel inside Intra's event dialog. It is
 * a sibling of the body/actions, so Intra never sees an outside click and its
 * own dialog simply grows.
 */
function toggleSubscribersPanel(
  row: HTMLElement,
  container: HTMLElement | null,
): void {
  const parent = row.parentElement;
  if (!parent) return;

  const existing = parent.querySelector<HTMLElement>(`#${PANEL_ID}`);
  if (existing) {
    restorers.get(existing)?.();
    restorers.delete(existing);
    existing.remove();
    return;
  }

  const eventName = eventTitle(container);
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = STYLE.panel;
  ensureScrollbarStyle();

  let listStyle = STYLE.list;
  {
    const dialogEl = parent.closest<HTMLElement>('[role="dialog"], dialog');
    const changes: {
      el: HTMLElement;
      prop: string;
      value: string;
      priority: string;
    }[] = [];
    // Records only the properties we touch, so toggling cannot wipe the styles
    // Intra (or React) put on those elements.
    const setProp = (el: HTMLElement, prop: string, value: string) => {
      changes.push({
        el,
        prop,
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
      });
      el.style.setProperty(prop, value);
    };

    // Anchor the panel to the dialog's left edge but keep it out of the layout
    // (absolute), so the event keeps its exact size — the panel is simply as
    // tall as the dialog because top/bottom are pinned to it.
    const PANEL_WIDTH = 288;
    const dialogRect = dialogEl?.getBoundingClientRect();
    const onRight = !!dialogRect && dialogRect.left < PANEL_WIDTH + 24;

    if (getComputedStyle(parent).position === "static") {
      setProp(parent, "position", "relative");
    }
    setProp(parent, "overflow", "visible");
    if (dialogEl) setProp(dialogEl, "overflow", "visible");

    panel.style.position = "absolute";
    panel.style.top = "0";
    panel.style.width = `${PANEL_WIDTH}px`;
    panel.style.boxSizing = "border-box";
    panel.style.zIndex = "1";
    // Give the panel a concrete height (the dialog's), so the flex list inside
    // has a definite box to scroll in — `top/bottom` alone can collapse when the
    // containing block has no height.
    const measured = Math.round(
      (dialogRect ?? parent.getBoundingClientRect()).height,
    );
    panel.style.height = measured > 0 ? `${measured}px` : "auto";
    panel.style.maxHeight = "90vh";
    if (onRight) {
      panel.style.left = "100%";
      panel.style.marginLeft = "12px";
      panel.style.borderLeft =
        "1px solid color-mix(in srgb, currentColor 18%, transparent)";
    } else {
      panel.style.right = "100%";
      panel.style.marginRight = "12px";
      panel.style.borderRight =
        "1px solid color-mix(in srgb, currentColor 18%, transparent)";
    }
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.minHeight = "0";
    panel.style.overflow = "hidden";
    // Opaque surface: the panel sits outside the dialog box, so it needs its own
    // background instead of showing the page through it.
    const isOpaque = (color: string) =>
      !!color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)";
    const contentBg = getComputedStyle(parent).backgroundColor;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const dark = document.documentElement.classList.contains("dark");
    panel.style.background = isOpaque(contentBg)
      ? contentBg
      : isOpaque(bodyBg)
        ? bodyBg
        : dark
          ? "#1b1b1f"
          : "#ffffff";
    panel.style.borderRadius = "12px";
    panel.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";
    // flex-basis 0 + min-height 0 keeps the list from inflating the panel; it
    // fills the dialog height and scrolls once it overflows.
    listStyle =
      "flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable;padding:0 16px 10px;";
    parent.appendChild(panel);

    restorers.set(panel, () => {
      for (const { el, prop, value, priority } of changes) {
        if (value) el.style.setProperty(prop, value, priority);
        else el.style.removeProperty(prop);
      }
    });
  }

  let eventId: number | null = null;
  let page: EventSubscribersPage | null = null;
  let loading = true;
  let refreshing = false;
  let error: string | null = null;

  const close = () => {
    restorers.get(panel)?.();
    restorers.delete(panel);
    panel.remove();
  };

  const refresh = async () => {
    if (!eventId || refreshing) return;
    refreshing = true;
    draw();
    try {
      page = await fetchEventSubscribers(eventId);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "error";
    } finally {
      loading = false;
      refreshing = false;
      draw();
    }
  };

  const chip = (): TemplateResult => {
    if (refreshing) {
      return html`<button
        type="button"
        style="${chipStyle()}"
        aria-label="Refreshing subscribers"
        disabled
      >
        Refreshing…
      </button>`;
    }
    if (!page) return html``;

    const age = Date.now() - page.fetchedAt;
    const stale = age >= SUBSCRIBERS_STALE_MS;
    const live = age < SUBSCRIBERS_LIVE_MS;
    const ago = formatTimeAgo(page.fetchedAt);
    const absolute = formatAbsoluteDateTime(page.fetchedAt);
    return html`<button
      type="button"
      style="${chipStyle(live ? "#22c55e" : stale ? "#f59e0b" : undefined)}"
      title="${stale
        ? `Showing cached subscribers (${absolute}) — click for live status`
        : `${absolute} — click to refresh`}"
      aria-label="Refresh subscribers"
      @click=${() => void refresh()}
    >
      ${live ? "Live" : stale ? "Cached" : `Updated ${ago}`}
    </button>`;
  };

  const rowFor = (u: EventSubscriber) => {
    const src = u.avatarUrl ?? u.avatar;
    return html`<div style="${STYLE.row}">
      <span style="${STYLE.avatar}">
        ${src
          ? html`<img
              src=${src}
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              style="width:100%;height:100%;object-fit:cover;"
            />`
          : initials(u.login)}
      </span>
      <a
        style="${STYLE.login}"
        href="https://profile.intra.42.fr/users/${encodeURIComponent(u.login)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${u.login}
        ${u.displayName && u.displayName !== u.login
          ? html`<span style="display:block;${STYLE.name}"
              >${u.displayName}</span
            >`
          : ""}
      </a>
      ${u.location
        ? html`<span style="${SEAT_STYLE}">${u.location}</span>`
        : ""}
    </div>`;
  };

  const body = (): TemplateResult => {
    if (!page && loading) {
      return html`<p style="${STYLE.note}">Loading…</p>`;
    }
    if (!page) {
      return html`<p style="${STYLE.note}">
        ${!eventId
          ? "Couldn't identify this event, so its subscriber list can't be loaded."
          : error === "not-connected"
            ? "Connect your 42 account from the Better Intra settings to see who subscribed."
            : error === "http-404"
              ? "This event could not be found on the 42 API."
              : "Couldn't load the subscribers."}
      </p>`;
    }
    if (page.users.length === 0) {
      return html`<p style="${STYLE.note}">No one has subscribed yet.</p>`;
    }
    return html`<div>
      ${page.users.map(rowFor)}
      ${page.truncated
        ? html`<p style="${STYLE.note}">
            Showing the first ${page.users.length} subscribers.
          </p>`
        : ""}
    </div>`;
  };

  const draw = () => {
    render(
      html`<div
        style="display:flex;flex-direction:column;height:100%;min-height:0;"
      >
        <div style="${STYLE.header}">
          <span style="${STYLE.title}">Subscribers</span>
          ${chip()}
          <button
            type="button"
            style="${STYLE.hide}"
            aria-label="Hide subscribers"
            @click=${close}
          >
            ✕
          </button>
        </div>
        <div class="ft-subs-scroll" style="${listStyle}">${body()}</div>
      </div>`,
      panel,
    );
  };

  draw();

  void (async () => {
    const id = await withTimeout(resolveId(container, eventName), 4000);
    eventId = id;
    if (!id) {
      loading = false;
      draw();
      return;
    }
    const cached = await readCachedSubscribers(id);
    if (cached) {
      page = cached.page;
      loading = false;
      draw();
      if (!cached.fresh) void refresh();
      return;
    }
    draw();
    void refresh();
  })();
}

/** Adds the Subscribers button to the 42 event dialog. */
export function scanEventDialog(): void {
  const actions = findActions();
  if (!actions) {
    // Dialogs with no Subscribe button (exams) still get Close on the left.
    const closeRow = findCloseRow();
    const closeBtn = closeRow ? pinCloseLeft(closeRow.row) : null;
    if (closeRow && closeBtn) {
      const firstOther = Array.from(
        closeRow.row.querySelectorAll<HTMLElement>("button, a"),
      ).find((el) => el !== closeBtn);
      firstOther?.style.setProperty("margin-left", "auto", "important");
    }
    return;
  }

  // Intra right-aligns the actions; Close must sit on the far left. Moving it
  // first plus an auto margin on our button pins it there while keeping
  // Subscribers next to Subscribe/Unsubscribe on the right.
  pinCloseLeft(actions.row);
  const closeBtn = findCloseButton(actions.row);

  // Exams have no subscriber list on the 42 API.
  const exam = isExam(actions.container);
  let button = actions.row.querySelector<HTMLButtonElement>(`[${MARKER}]`);
  if (exam) {
    button?.remove();
    actions.row.parentElement
      ?.querySelector<HTMLElement>(`#${PANEL_ID}`)
      ?.remove();
  } else {
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.setAttribute(MARKER, "");
      button.className = closeBtn?.className || FALLBACK_BUTTON_CLASS;
      button.textContent = "Subscribers";
      button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleSubscribersPanel(actions.row, actions.container);
      });
    }
    button.style.setProperty("margin-left", "auto", "important");
    if (button.nextElementSibling !== actions.anchor) {
      actions.row.insertBefore(button, actions.anchor);
    }
  }

  // Subscribing or unsubscribing changes the list: drop the cached copy so the
  // next open is fresh even though the cache otherwise lives for a day.
  if (!actions.anchor.dataset.ftSubInvalidate) {
    actions.anchor.dataset.ftSubInvalidate = "1";
    actions.anchor.addEventListener("click", () => {
      const title = eventTitle(actions.container);
      void resolveId(actions.container, title).then((id) => {
        if (id) void clearCachedSubscribers(id);
      });
    });
  }
}

function schedule(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scanEventDialog();
  });
}

/** Starts watching for the 42 event dialog. Safe to call more than once. */
export function initEventSubscribers(): void {
  if (started || !document.documentElement) return;
  started = true;
  initEventIndex();
  scanEventDialog();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

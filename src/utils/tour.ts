import { html, render } from "lit-html";

export type Placement = "right" | "left" | "top" | "bottom";

export type TargetResolver = () => HTMLElement | null;

export interface TourStep {
  target: string | TargetResolver;
  title: string;
  body: string;
  placement: Placement;
  onEnter?: () => void;
  onLeave?: () => void;
}

export interface TourOptions {
  steps: TourStep[];
  container?: HTMLElement;
  root?: ParentNode;
  hostId?: string;
  signal?: AbortSignal;
  scrimOpacity?: number;
  onEnd?: () => void;
}

const TOUR_CSS = `
  .bi-tour-root {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    pointer-events: none;
    --bi-tour-scrim: rgba(6, 10, 16, 0.64);
  }
  .bi-tour-scrim {
    position: fixed;
    background: var(--bi-tour-scrim);
    pointer-events: auto;
  }
  .bi-tour-ring {
    position: fixed;
    border: 2px solid #00babc;
    border-radius: 10px;
    box-shadow: 0 0 0 4px rgba(0, 186, 188, 0.22), 0 0 26px rgba(0, 186, 188, 0.55);
    pointer-events: none;
    transition: left 140ms ease, top 140ms ease, width 140ms ease, height 140ms ease;
  }
  .bi-tour-tip {
    position: fixed;
    width: 300px;
    max-width: calc(100vw - 24px);
    box-sizing: border-box;
    background: #14181f;
    color: #f5f7fa;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    padding: 16px 16px 12px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
    pointer-events: auto;
  }
  .bi-tour-tip h3 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
  }
  .bi-tour-tip p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(245, 247, 250, 0.78);
  }
  .bi-tour-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 14px;
  }
  .bi-tour-count {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }
  .bi-tour-actions { display: flex; gap: 6px; }
  .bi-tour-btn {
    appearance: none;
    border: none;
    border-radius: 8px;
    padding: 7px 13px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
    transition: background-color 120ms ease, opacity 120ms ease;
  }
  .bi-tour-btn.ghost {
    background: transparent;
    color: rgba(245, 247, 250, 0.7);
  }
  .bi-tour-btn.ghost:hover { background: rgba(255, 255, 255, 0.08); }
  .bi-tour-btn.primary {
    background: #00babc;
    color: #06282a;
  }
  .bi-tour-btn.primary:hover { background: #1fd2d4; }
`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isVisible(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.isConnected && el.getClientRects().length > 0;
}

function resolvePresent(root: ParentNode, step: TourStep): HTMLElement | null {
  if (typeof step.target === "function") return step.target();
  return root.querySelector<HTMLElement>(step.target);
}

async function collectSteps(
  steps: TourStep[],
  root: ParentNode,
): Promise<TourStep[]> {
  const present = () => steps.filter((s) => resolvePresent(root, s));

  const found = present();
  if (found.length > 0) return found;

  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    await delay(100);
    const retry = present();
    if (retry.length > 0) return retry;
  }
  return present();
}

export async function runTour(options: TourOptions): Promise<void> {
  const container = options.container ?? document.body;
  const root = options.root ?? document;
  const hostId = options.hostId ?? "welcome-tour-host";

  document.getElementById(hostId)?.remove();

  const steps = await collectSteps(options.steps, root);
  if (steps.length === 0) return;

  const host = document.createElement("div");
  host.id = hostId;
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = TOUR_CSS;
  shadow.appendChild(style);

  const rootEl = document.createElement("div");
  rootEl.className = "bi-tour-root";
  if (options.scrimOpacity != null) {
    rootEl.style.setProperty(
      "--bi-tour-scrim",
      `rgba(6, 10, 16, ${options.scrimOpacity})`,
    );
  }
  render(
    html`
      <div class="bi-tour-scrim" data-p="top"></div>
      <div class="bi-tour-scrim" data-p="bottom"></div>
      <div class="bi-tour-scrim" data-p="left"></div>
      <div class="bi-tour-scrim" data-p="right"></div>
      <div class="bi-tour-ring"></div>
      <div class="bi-tour-tip"></div>
    `,
    rootEl,
  );
  shadow.appendChild(rootEl);
  container.appendChild(host);

  const scrim = (p: string) =>
    rootEl.querySelector<HTMLElement>(`.bi-tour-scrim[data-p="${p}"]`)!;
  const scrims = {
    top: scrim("top"),
    bottom: scrim("bottom"),
    left: scrim("left"),
    right: scrim("right"),
  };
  const ring = rootEl.querySelector<HTMLElement>(".bi-tour-ring")!;
  const tip = rootEl.querySelector<HTMLElement>(".bi-tour-tip")!;

  let index = -1;
  let target: HTMLElement | null = null;
  let follow = 0;
  let poll = 0;
  let done = false;

  const PAD = 6;
  const TIP_MARGIN = 14;

  let resolveEnd!: () => void;
  const ended = new Promise<void>((r) => (resolveEnd = r));

  function refreshTarget(): boolean {
    target = resolvePresent(root, steps[index]);
    return isVisible(target);
  }

  function placeBox(
    el: HTMLElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${Math.max(0, w)}px`;
    el.style.height = `${Math.max(0, h)}px`;
  }

  function position() {
    if (done || !target || !target.isConnected) return;

    const r = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = r.left - PAD;
    const y = r.top - PAD;
    const w = r.width + PAD * 2;
    const h = r.height + PAD * 2;

    placeBox(scrims.top, 0, 0, vw, y);
    placeBox(scrims.bottom, 0, y + h, vw, vh - (y + h));
    placeBox(scrims.left, 0, y, x, h);
    placeBox(scrims.right, x + w, y, vw - (x + w), h);
    placeBox(ring, x, y, w, h);

    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const prefer = steps[index].placement;

    let tx: number;
    let ty: number;
    if (prefer === "right" || prefer === "left") {
      tx = prefer === "right" ? x + w + TIP_MARGIN : x - tipW - TIP_MARGIN;
      ty = r.top + r.height / 2 - tipH / 2;
      if (tx < 12 || tx + tipW > vw - 12) {
        tx = Math.min(Math.max(12, x), vw - tipW - 12);
        ty = y + h + TIP_MARGIN;
      }
    } else {
      ty =
        r.bottom + TIP_MARGIN + tipH < vh
          ? y + h + TIP_MARGIN
          : y - tipH - TIP_MARGIN;
      tx = r.left + r.width / 2 - tipW / 2;
    }

    tx = Math.min(Math.max(12, tx), vw - tipW - 12);
    ty = Math.min(Math.max(12, ty), vh - tipH - 12);
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
  }

  function renderTip() {
    const step = steps[index];
    const isLast = index === steps.length - 1;
    render(
      html`
        <h3>${step.title}</h3>
        <p>${step.body}</p>
        <div class="bi-tour-foot">
          <span class="bi-tour-count">${index + 1} / ${steps.length}</span>
          <div class="bi-tour-actions">
            <button class="bi-tour-btn ghost" @click=${() => end()}>
              Skip
            </button>
            ${index > 0
              ? html`<button
                  class="bi-tour-btn ghost"
                  @click=${() => goTo(index - 1)}
                >
                  Back
                </button>`
              : ""}
            <button class="bi-tour-btn primary" @click=${() => goTo(index + 1)}>
              ${isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      `,
      tip,
    );
    tip.querySelector<HTMLButtonElement>(".bi-tour-btn.primary")?.focus();
  }

  function goTo(i: number) {
    if (done) return;
    if (i < 0) i = 0;
    if (i >= steps.length) return end();

    if (index >= 0 && index !== i) steps[index].onLeave?.();
    index = i;
    steps[index].onEnter?.();

    if (!refreshTarget()) return goTo(i + 1);
    target!.scrollIntoView({ block: "center", inline: "nearest" });
    renderTip();
    position();
  }

  function onFollow() {
    if (!refreshTarget()) return goTo(index + 1);
    position();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      end();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
      return;
    }
    const origin = e.composedPath()[0] as HTMLElement | undefined;
    const fromButton = origin?.tagName === "BUTTON";
    if ((e.key === "Enter" || e.key === " ") && !fromButton) {
      e.preventDefault();
      goTo(index + 1);
    }
  }

  function end() {
    if (done) return;
    done = true;
    if (index >= 0) steps[index]?.onLeave?.();
    cancelAnimationFrame(follow);
    clearInterval(poll);
    window.removeEventListener("scroll", onFollow, true);
    window.removeEventListener("resize", onFollow);
    document.removeEventListener("keydown", onKey, true);
    host.remove();
    options.onEnd?.();
    resolveEnd();
  }

  window.addEventListener("scroll", onFollow, true);
  window.addEventListener("resize", onFollow);
  document.addEventListener("keydown", onKey, true);
  options.signal?.addEventListener("abort", end, { once: true });

  poll = window.setInterval(() => {
    if (!target || !target.isConnected) onFollow();
    else position();
  }, 350);

  follow = requestAnimationFrame(function tick() {
    position();
    follow = requestAnimationFrame(tick);
  });

  goTo(0);
  return ended;
}

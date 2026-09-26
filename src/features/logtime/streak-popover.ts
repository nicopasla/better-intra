import { html, render, TemplateResult } from "lit-html";
import { adoptShadowCss } from "../../utils/shadow-styles.ts";
import { getEffectiveTheme } from "../profile/theme/theme-manager.ts";
import { fmtHours } from "./utils.ts";
import { formatRange, type LogtimeStreak } from "./streak.ts";

const POPOVER_ID = "ft-streak-popover";
const HIDE_DELAY_MS = 120;

let _host: HTMLElement | null = null;
let _hideTimer: ReturnType<typeof setTimeout> | null = null;

const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
});

const dayLabel = (key: string) => DAY_FMT.format(new Date(`${key}T00:00:00`));
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function tile(
  label: string,
  value: string,
  sub?: string,
  tone = "bg-base-200/60",
): TemplateResult {
  return html`<div class="card card-compact ${tone}">
    <div class="card-body p-2 items-center text-center gap-0.5">
      <span
        class="text-[0.65rem] uppercase tracking-wide opacity-60 leading-none"
        >${label}</span
      >
      <span class="font-bold tabular-nums font-mono text-sm">${value}</span>
      ${sub
        ? html`<span class="text-[0.65rem] opacity-50 leading-none"
            >${sub}</span
          >`
        : ""}
    </div>
  </div>`;
}

export function closeStreakPopover(): void {
  if (_hideTimer) {
    clearTimeout(_hideTimer);
    _hideTimer = null;
  }
  if (!_host) return;
  _host.remove();
  _host = null;
}

export function scheduleHideStreakPopover(): void {
  if (_hideTimer) clearTimeout(_hideTimer);
  _hideTimer = setTimeout(closeStreakPopover, HIDE_DELAY_MS);
}

export async function showStreakPopover(
  anchor: HTMLElement,
  streak: LogtimeStreak,
): Promise<void> {
  closeStreakPopover();

  const host = document.createElement("div");
  host.id = POPOVER_ID;
  host.style.cssText = "position:absolute;z-index:99999;width:238px;";
  _host = host;

  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowCss(
    shadow,
    `.ft-streak-popover { box-shadow: 0 4px 24px rgba(0,0,0,0.3); }`,
  );

  const theme = await getEffectiveTheme();
  const daisyTheme = theme === "light" ? "light" : "dark";

  if (_host !== host) return;

  render(
    html`
      <div data-theme="${daisyTheme}">
        <div class="card card-compact ft-streak-popover bg-base-100">
          <div class="card-body p-3 gap-2">
            <div class="flex items-center gap-1.5 font-bold text-sm">
              <span class="text-base leading-none">🔥</span>
              Streak
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${tile(
                "Current",
                days(streak.currentStreak),
                undefined,
                streak.currentStreak > 0 ? "bg-warning/20" : "bg-base-200/60",
              )}
              ${tile("Longest", days(streak.longestStreak))}
              ${tile(
                "Best day",
                fmtHours(streak.bestDay.secs),
                dayLabel(streak.bestDay.date),
              )}
              ${tile(
                "Best week",
                fmtHours(streak.bestWeek.secs),
                `week of ${dayLabel(streak.bestWeek.monday)}`,
              )}
            </div>
            <span class="text-[0.65rem] opacity-40 text-center"
              >${formatRange(streak.range)}</span
            >
          </div>
        </div>
      </div>
    `,
    shadow,
  );

  document.body.appendChild(host);

  const rect = anchor.getBoundingClientRect();
  const height = host.getBoundingClientRect().height;
  const above = rect.top - height - 6;
  const top = above >= 4 ? above : rect.bottom + 6;
  host.style.top = `${top + window.scrollY}px`;
  host.style.left = `${Math.min(rect.left + window.scrollX, document.documentElement.scrollWidth - 254)}px`;

  host.addEventListener("mouseenter", () => {
    if (_hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = null;
    }
  });
  host.addEventListener("mouseleave", scheduleHideStreakPopover);
}

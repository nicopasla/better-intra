import { html } from "lit-html";
import {
  AVG_ONLY_ACTIVE_DAYS,
  CELL_RADIUS,
  COLORS,
  MAX_INTENSITY_SECS,
  PAST_MONTHS_OPACITY,
} from "./constants";
import { fmtHours, hexToRgba } from "./utils";
import { LogtimeConfig } from "./logtime";

function renderDayCell(
  day: number,
  dKey: string,
  secs: number,
  todayStr: string,
  config: LogtimeConfig,
) {
  const alpha = Math.min(secs / MAX_INTENSITY_SECS, 1);
  const bgColor =
    secs > 0 ? hexToRgba(config.calendar_color, alpha) : COLORS.CELL_EMPTY;
  const textColor = secs > MAX_INTENSITY_SECS / 2 ? "#fff" : COLORS.TEXT_DARK;

  return html`<div
    class="day-cell ${dKey === todayStr ? "today-highlight" : ""}"
    style="
      aspect-ratio: 1/1;
      border-radius: ${CELL_RADIUS};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: ${bgColor};
      color: ${textColor};
    "
  >
    ${String(day)}
    <div class="day-tooltip">${secs > 0 ? fmtHours(secs) : "0h"}</div>
  </div>`;
}

function renderCalendarGrid(
  year: number,
  mon: number,
  data: Record<string, number>,
  lastDayDate: number,
  config: LogtimeConfig,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const headerRow = ["M", "T", "W", "T", "F", "S", "S", "Total"].map(
    (day, idx) =>
      html`<div
        style="font-size: 11px; font-weight: 800; text-align: center; color: ${COLORS.TEXT_LIGHT}; ${idx ===
        7
          ? `border-left: 1px solid #f1f5f9; color: ${config.labels_color};`
          : ""}"
      >
        ${day}
      </div>`,
  );

  const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
  const emptyCells = Array.from({ length: offset }, () => html`<div></div>`);
  const dayRows: ReturnType<typeof html>[] = [];
  let weekSecs = 0;
  let cellCount = offset;

  for (let day = 1; day <= lastDayDate; day++) {
    const dKey = `${year}-${String(mon).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
    const secs = data[dKey] ?? 0;
    weekSecs += secs;

    dayRows.push(renderDayCell(day, dKey, secs, todayStr, config));
    cellCount++;

    if ((cellCount % 7 === 0 && cellCount > 0) || day === lastDayDate) {
      if (day === lastDayDate && cellCount % 7 !== 0) {
        const fillCount = 7 - (cellCount % 7);
        for (let j = 0; j < fillCount; j++) dayRows.push(html`<div></div>`);
      }

      dayRows.push(
        html`<div
          style="font-size: 14px; font-weight: 700; text-align: right; color: ${config.labels_color}; padding-right: 4px; display: flex; align-items: center; justify-content: flex-end;"
        >
          ${weekSecs > 0 ? fmtHours(weekSecs) : ""}
        </div>`,
      );
      weekSecs = 0;
    }
  }

  return html`<div
    style="display: grid; grid-template-columns: repeat(7, 1fr) 58px; gap: 8px 5px;"
  >
    ${headerRow} ${emptyCells} ${dayRows}
  </div>`;
}

export function renderMonthCard(
  ym: string,
  data: Record<string, number>,
  isCurrent: boolean,
  config: LogtimeConfig,
) {
  const [year, mon] = ym.split("-").map(Number);
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const lastDayDate = new Date(year, mon, 0).getDate();
  const divisor = AVG_ONLY_ACTIVE_DAYS
    ? Object.values(data).filter((s) => s > 0).length || 1
    : isCurrent
      ? new Date().getDate()
      : lastDayDate;
  const avg = total / divisor;

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(year, mon - 1),
  );
  const goalSecs = config.goal_hours * 3600;
  const goalPercent = Math.round((total / goalSecs) * 100);
  const isGoalMet = goalPercent >= 100;
  const isPast = !isCurrent;
  const fillClass = isGoalMet ? "liquid-fill-full" : "liquid-fill";
  const badgeClass = isGoalMet ? "badge-rainbow" : "";

  const badgeStyles = !badgeClass.includes("badge-rainbow")
    ? `background: ${
        isGoalMet ? "#27ae60" : "rgba(39, 174, 96, 0.1)"
      }; color: ${isGoalMet ? "white" : "#27ae60"}; border: 1px solid ${
        isGoalMet ? "transparent" : "rgba(39, 174, 96, 0.2)"
      };`
    : "";

  const monthEarnings = (total / 3600) * config.rate;
  const isMonthCapped = config.max_earnings > 0 && monthEarnings >= config.max_earnings;
  const cappedMonthEarnings = config.max_earnings > 0 && monthEarnings > config.max_earnings
    ? config.max_earnings
    : monthEarnings;
  const monthTacos = Math.round(cappedMonthEarnings / config.divisor);

  return html`<div
    class="month-card ${isCurrent ? "current-month" : ""}"
    style="${!isCurrent ? `opacity: ${PAST_MONTHS_OPACITY};` : ""}"
  >
    <div
      style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;"
    >
      <span
        style="font-size: 22px; font-weight: 700; color: ${COLORS.TEXT_DARK};"
        >${monthName}</span
      >
      <span
        class="inline-flex items-center justify-center rounded-full transition-all ${badgeClass}"
        style="height: 30px; padding: 0 10px; font-size: 16px; font-weight: 800; white-space: nowrap; ${badgeStyles}"
      >
        ${fmtHours(total)}${config.show_goal ? ` / ${config.goal_hours}h` : ""}
      </span>
    </div>

    <div
      style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: ${config.labels_color}; margin-bottom: 10px;"
    >
      <div
        class="day-cell"
        style="background: transparent; width: auto; height: auto; padding: 0; cursor: help;"
      >
        ${config.show_goal ? html`<b>${goalPercent}% </b>` : ""}
        ${config.show_tacos
          ? html` ${monthTacos}${isMonthCapped ? "+" : ""} ${config.emoji}`
          : ""}
        ${config.show_goal
          ? html`<div class="day-tooltip">
              Remaining: ${fmtHours(Math.max(0, goalSecs - total))}
            </div>`
          : ""}
      </div>
      ${config.show_average
        ? html`<span>Avg: <b>${fmtHours(avg)}</b></span>`
        : ""}
    </div>

    ${config.show_goal
      ? html`<div
          class="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden"
        >
          <div
            class="h-full transition-all duration-500 ${fillClass} ${isPast
              ? "is-past"
              : ""}"
            style="width: ${Math.min(goalPercent, 100)}%;"
          ></div>
        </div>`
      : ""}
    ${renderCalendarGrid(year, mon, data, lastDayDate, config)}
  </div>`;
}

export function renderHeaderContent(
  lastSeenValue: string,
  monthsData: Record<string, Record<string, number>>,
  config: LogtimeConfig,
) {
  // Sum all monthly earnings (capped if enabled)
  let totalCappedEarnings = 0;

  for (const data of Object.values(monthsData)) {
    const monthSecs = Object.values(data).reduce((a, b) => a + b, 0);
    const monthEarnings = (monthSecs / 3600) * config.rate;
    const cappedMonthEarnings = config.max_earnings
      ? Math.min(monthEarnings, config.max_earnings)
      : monthEarnings;
    totalCappedEarnings += cappedMonthEarnings;
  }

  const totalTacos = Math.floor(totalCappedEarnings / config.divisor);

  return html`<div
    class="flex items-center justify-between p-4"
    style="padding-bottom: 20px;"
  >
    <div
      class="font-bold text-black dark:text-white uppercase text-sm tracking-tight flex items-center w-full"
      style="display: inline-flex;"
    >
      <div class="w-1.5 h-4 bg-legacy-main rounded-full mr-2"></div>
      Logtime
      ${config.show_tacos
        ? html`<div class="taco-bank ml-2">
            <span class="taco-icon">${totalTacos} ${config.emoji}</span>
          </div>`
        : ""}
      ${lastSeenValue !== "N/A"
        ? html`<span
            class="ml-auto bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case border border-green-500/30"
            >Active ${lastSeenValue}</span
          >`
        : ""}
    </div>
  </div>`;
}

export function renderContainer(
  header: ReturnType<typeof html>,
  monthCards: ReturnType<typeof html>[],
) {
  return html`<div
    class="bg-white dark:bg-zinc-900 overflow-hidden md:drop-shadow-md md:rounded-lg p-0 mb-4 transition-all lt-box-container"
  >
    ${header}
    <div class="log-slider-fixed">
      <div class="grid-centering-container">${monthCards}</div>
    </div>
  </div>`;
}

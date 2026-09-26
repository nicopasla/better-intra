import { getMondayWeekStart } from "./heatmap.ts";
import { fmtHours } from "./utils.ts";

export interface LogtimeStreak {
  currentStreak: number;
  longestStreak: number;
  bestDay: { date: string; secs: number };
  bestWeek: { monday: string; secs: number };
  range: { from: string; to: string };
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const localDay = (key: string): Date => new Date(`${key}T00:00:00`);

function shiftDay(key: string, offset: number): string {
  const d = localDay(key);
  d.setDate(d.getDate() + offset);
  return ymd(d);
}

function toSecs(value: string): number {
  const [h = 0, m = 0, s = 0] = value.split(":").map(Number);
  const secs = h * 3600 + m * 60 + s;
  return Number.isFinite(secs) ? secs : 0;
}

function isWeekend(key: string): boolean {
  const day = localDay(key).getDay();
  return day === 0 || day === 6;
}

export function computeStreak(
  stats: Record<string, string>,
  now: Date = new Date(),
): LogtimeStreak | null {
  const secsByDay = new Map<string, number>();
  for (const [date, value] of Object.entries(stats)) {
    const secs = toSecs(value);
    if (secs > 0) secsByDay.set(date, secs);
  }
  if (secsByDay.size === 0) return null;

  const active = [...secsByDay.keys()].sort();

  let bestDay = { date: active[0], secs: secsByDay.get(active[0])! };
  for (const date of active) {
    const secs = secsByDay.get(date)!;
    if (secs > bestDay.secs) bestDay = { date, secs };
  }

  const weeks = new Map<string, number>();
  for (const date of active) {
    const monday = ymd(getMondayWeekStart(localDay(date)));
    weeks.set(monday, (weeks.get(monday) ?? 0) + secsByDay.get(date)!);
  }
  let bestWeek = { monday: active[0], secs: 0 };
  for (const monday of [...weeks.keys()].sort()) {
    const secs = weeks.get(monday)!;
    if (secs > bestWeek.secs) bestWeek = { monday, secs };
  }

  const first = active[0];
  const last = active[active.length - 1];
  let longestStreak = 0;
  let run = 0;
  for (let day = first; day <= last; day = shiftDay(day, 1)) {
    if (secsByDay.has(day)) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else if (!isWeekend(day)) {
      run = 0;
    }
  }

  const today = ymd(now);
  let day = secsByDay.has(today) ? today : shiftDay(today, -1);
  let currentStreak = 0;
  while (day >= first) {
    if (secsByDay.has(day)) {
      currentStreak++;
      day = shiftDay(day, -1);
    } else if (isWeekend(day)) {
      day = shiftDay(day, -1);
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    bestDay,
    bestWeek,
    range: { from: first, to: last },
  };
}

const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
});

export const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatRange(range: { from: string; to: string }): string {
  return `${RANGE_FMT.format(localDay(range.from))} – ${RANGE_FMT.format(localDay(range.to))}`;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function streakLines(records: LogtimeStreak): string[] {
  const day = (key: string) => DAY_FMT.format(localDay(key));
  return [
    `Current streak: ${days(records.currentStreak)}`,
    `Longest streak: ${days(records.longestStreak)}`,
    `Best day: ${fmtHours(records.bestDay.secs)} (${day(records.bestDay.date)})`,
    `Best week: ${fmtHours(records.bestWeek.secs)} (week of ${day(records.bestWeek.monday)})`,
    formatRange(records.range),
  ];
}

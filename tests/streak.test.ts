import { describe, it, expect } from "vitest";
import { computeStreak, streakLines } from "../src/features/logtime/streak";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("computeStreak", () => {
  it("returns null when there is no active day", () => {
    expect(computeStreak({}, at(2026, 4, 20))).toBeNull();
    expect(
      computeStreak({ "2026-04-19": "00:00:00.000000" }, at(2026, 4, 20)),
    ).toBeNull();
  });

  it("ignores a fractional zero total", () => {
    const r = computeStreak(
      { "2026-04-13": "00:00:00.000000", "2026-04-14": "03:00:00" },
      at(2026, 4, 14),
    )!;
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.bestDay).toEqual({ date: "2026-04-14", secs: 3 * 3600 });
  });

  it("forgives a silent weekend and keeps the streak", () => {
    const r = computeStreak(
      { "2026-04-17": "02:00:00", "2026-04-20": "02:00:00" },
      at(2026, 4, 20),
    )!;
    expect(r.currentStreak).toBe(2);
    expect(r.longestStreak).toBe(2);
  });

  it("counts logtime on a weekend day", () => {
    const r = computeStreak(
      {
        "2026-04-17": "02:00:00",
        "2026-04-18": "02:00:00",
        "2026-04-20": "02:00:00",
      },
      at(2026, 4, 20),
    )!;
    expect(r.currentStreak).toBe(3);
    expect(r.longestStreak).toBe(3);
  });

  it("breaks on a missed weekday", () => {
    const r = computeStreak(
      { "2026-04-13": "02:00:00", "2026-04-15": "02:00:00" },
      at(2026, 4, 15),
    )!;
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
  });

  it("keeps the streak through yesterday while today is empty", () => {
    const r = computeStreak({ "2026-04-13": "02:00:00" }, at(2026, 4, 14))!;
    expect(r.currentStreak).toBe(1);
  });

  it("breaks once an empty weekday has passed", () => {
    const r = computeStreak({ "2026-04-13": "02:00:00" }, at(2026, 4, 15))!;
    expect(r.currentStreak).toBe(0);
  });

  it("picks the earliest day on a best-day tie", () => {
    const r = computeStreak(
      {
        "2026-04-13": "05:00:00",
        "2026-04-14": "05:00:00",
        "2026-04-15": "01:00:00",
      },
      at(2026, 4, 15),
    )!;
    expect(r.bestDay).toEqual({ date: "2026-04-13", secs: 5 * 3600 });
  });

  it("sums best week over Monday to Sunday", () => {
    const r = computeStreak(
      {
        "2026-04-13": "03:00:00",
        "2026-04-19": "03:00:00",
        "2026-04-20": "05:00:00",
      },
      at(2026, 4, 20),
    )!;
    expect(r.bestWeek).toEqual({ monday: "2026-04-13", secs: 6 * 3600 });
  });

  it("steps across a DST change without breaking the run", () => {
    const r = computeStreak(
      {
        "2026-03-28": "01:00:00",
        "2026-03-29": "01:00:00",
        "2026-03-30": "01:00:00",
      },
      at(2026, 3, 30),
    )!;
    expect(r.currentStreak).toBe(3);
    expect(r.longestStreak).toBe(3);
  });
});

describe("streakLines", () => {
  it("formats the figures for the tooltip", () => {
    const r = computeStreak({ "2026-04-13": "05:30:00" }, at(2026, 4, 13))!;
    expect(streakLines(r)).toEqual([
      "Current streak: 1 day",
      "Longest streak: 1 day",
      "Best day: 5h30 (13/04)",
      "Best week: 5h30 (week of 13/04)",
      "13/04/2026 – 13/04/2026",
    ]);
  });

  it("reports the date range covered by the data", () => {
    const r = computeStreak(
      { "2024-04-17": "02:00:00", "2026-09-26": "03:00:00" },
      at(2026, 9, 26),
    )!;
    expect(r.range).toEqual({ from: "2024-04-17", to: "2026-09-26" });
    expect(streakLines(r).at(-1)).toBe("17/04/2024 – 26/09/2026");
  });
});

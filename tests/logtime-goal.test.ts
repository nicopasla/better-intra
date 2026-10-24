import { describe, it, expect } from "vitest";
import { goalProgress } from "../src/features/logtime/goal";

const MIN = 60;

describe("goalProgress", () => {
  it("does not report 100% before the goal is reached", () => {
    // 139 h 30 min vs a 140 h goal: rounds to 100 but is not reached.
    const p = goalProgress(139 * 3600 + 30 * MIN, 140);
    expect(p.percent).toBe(99);
    expect(p.met).toBe(false);
  });

  it("reports 99% right up to the last minute", () => {
    const p = goalProgress(140 * 3600 - MIN, 140);
    expect(p.percent).toBe(99);
    expect(p.met).toBe(false);
  });

  it("is met exactly at the goal", () => {
    const p = goalProgress(140 * 3600, 140);
    expect(p.percent).toBe(100);
    expect(p.met).toBe(true);
  });

  it("keeps counting above the goal", () => {
    const p = goalProgress(147 * 3600, 140);
    expect(p.percent).toBe(105);
    expect(p.met).toBe(true);
  });

  it("treats a zero goal as already met", () => {
    expect(goalProgress(0, 0)).toEqual({ percent: 100, met: true });
  });
});

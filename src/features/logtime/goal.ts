/** Monthly goal progress, exact to the second. */

export interface GoalProgress {
  /** Rounded percentage; capped at 99 until the goal is actually reached. */
  percent: number;
  met: boolean;
}

/**
 * `Math.round` used to make 99.5 % read as 100 % (and light the rainbow) while
 * tens of minutes were still missing. Only a real `total >= goal` counts as
 * met; the displayed percentage is clamped to 99 below it.
 */
export function goalProgress(totalSecs: number, goalHours: number): GoalProgress {
  const goalSecs = goalHours * 3600;
  if (!Number.isFinite(goalSecs) || goalSecs <= 0) {
    return { percent: 100, met: true };
  }
  const met = totalSecs >= goalSecs;
  const percent = Math.round((totalSecs / goalSecs) * 100);
  return { percent: met ? percent : Math.min(percent, 99), met };
}

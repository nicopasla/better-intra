import { formatRelativeTime, formatShortDate } from "./fingerprint.ts";

export interface LocalSubjectState {
  lastUrl?: string;
  versionDate?: number;
  checkedAt?: number;
}

export type SubjectTone = "error" | "warning" | "ghost";

export interface SubjectBadgeInfo {
  when: string;
  tone: SubjectTone;
}

const DAY = 86_400_000;

/**
 * Derives the subject-update badge text/tone from a tracker state entry. The
 * date is the subject's real last-updated time, shared by the registry, so a
 * subject with no recorded update shows no badge.
 */
export function subjectBadgeInfo(
  local: LocalSubjectState | undefined,
): SubjectBadgeInfo | null {
  const date = local?.versionDate;
  if (!date) return null;
  const age = Date.now() - date;
  const recent = age <= 7 * DAY;
  const tone: SubjectTone =
    age <= 7 * DAY ? "error" : age <= 30 * DAY ? "warning" : "ghost";
  const when = recent ? formatRelativeTime(date) : formatShortDate(date);
  return { when, tone };
}

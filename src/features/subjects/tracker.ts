import { getConfig } from "../../config.ts";
import { renderSubjectBadge } from "./ui.ts";
import { subjectBadgeInfo, type LocalSubjectState } from "./badge.ts";

const CHECK_COOLDOWN_MS = 15 * 60 * 1000;
const STATE_VERSION = 3;

type SubjectTrackerState = Record<string, LocalSubjectState>;

interface SubjectMetaResponse {
  modifiedAt?: number | null;
}

export function matchProjectSlug(pathname: string): string | null {
  const m = pathname.match(/^\/(?:projects\/)?([^/]+)(?:\/.*)?$/);
  return m ? m[1] : null;
}

function isProjectPage(): string | null {
  if (window.location.hostname !== "projects.intra.42.fr") return null;
  return matchProjectSlug(window.location.pathname);
}

function findSubjectAnchor(): HTMLAnchorElement | null {
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    '.project-attachments-list a[href$=".pdf"]',
  );
  return anchors[0] ?? null;
}

async function readLocalState(): Promise<SubjectTrackerState> {
  const raw = await getConfig("SUBJECT_TRACKER_STATE");
  return (raw && typeof raw === "object" ? raw : {}) as SubjectTrackerState;
}

/**
 * Drops state written by older builds, which stored dates derived from a
 * different (unreliable) source. The badge now reflects the subject file's
 * real last-update date.
 */
async function migrateState(): Promise<void> {
  const version = await getConfig("SUBJECT_TRACKER_STATE_VERSION");
  if (version >= STATE_VERSION) return;
  await chrome.storage.local.set({
    SUBJECT_TRACKER_STATE: {},
    SUBJECT_TRACKER_STATE_VERSION: STATE_VERSION,
  });
}

/** Asks the background to scrape the subject file's last-update date. */
function requestSubjectMeta(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: "FT_SUBJECT_META", url },
        (res: SubjectMetaResponse | undefined) => {
          if (chrome.runtime.lastError) {
            resolve(undefined);
            return;
          }
          resolve(res?.modifiedAt ?? undefined);
        },
      );
    } catch {
      resolve(undefined);
    }
  });
}

async function waitForSubject(
  anchor: HTMLAnchorElement | null,
): Promise<HTMLAnchorElement | null> {
  const MAX_ATTEMPTS = 40;
  const DELAY_MS = 150;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (anchor) return anchor;
    await new Promise((r) => setTimeout(r, DELAY_MS));
    anchor = findSubjectAnchor();
  }
  return anchor;
}

export async function initSubjectTracker(): Promise<void> {
  const enabled = await getConfig("SUBJECT_TRACKER_ENABLED");
  if (!enabled) return;

  const slug = isProjectPage();
  if (!slug) return;

  const anchor = await waitForSubject(findSubjectAnchor());
  if (!anchor) return;

  await migrateState();

  const state = await readLocalState();
  const local = state[slug] ?? {};
  if (local.checkedAt && Date.now() - local.checkedAt < CHECK_COOLDOWN_MS) {
    maybeRenderBadge(local, anchor);
    return;
  }

  const modifiedAt = await requestSubjectMeta(anchor.href);
  const nextLocal: LocalSubjectState = {
    lastUrl: anchor.href,
    versionDate: modifiedAt ?? local.versionDate,
    checkedAt: Date.now(),
  };

  await chrome.storage.local.set({
    SUBJECT_TRACKER_STATE: { ...state, [slug]: nextLocal },
  });

  maybeRenderBadge(nextLocal, anchor);
}

export function maybeRenderBadge(
  local: LocalSubjectState,
  button: HTMLAnchorElement | null,
): void {
  if (!button) return;
  const info = subjectBadgeInfo(local);
  if (!info) return;
  renderSubjectBadge(button, "Subject updated", info.when, info.tone);
}

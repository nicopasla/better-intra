import { getConfig } from "../../config.ts";
import { workerFetch } from "../../utils/worker.ts";
import { hashLogin } from "../../utils/crypto.ts";
import { decide, normalizeUrl } from "./fingerprint.ts";
import { renderSubjectBadge } from "./ui.ts";
import { subjectBadgeInfo, type LocalSubjectState } from "./badge.ts";

const CHECK_COOLDOWN_MS = 15 * 60 * 1000;

type SubjectTrackerState = Record<string, LocalSubjectState>;

interface WorkerStateEntry {
  slug: string;
  tracked: boolean;
  name?: string;
  url?: string | null;
  lastChangedAt?: number | null;
}

interface WorkerReportEntry {
  slug: string;
  status: "first" | "known" | "changed" | "unknown";
  name?: string;
  lastChangedAt?: number | null;
}

interface CloudClient {
  token: string;
  hashedLogin: string;
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

async function cloudClient(): Promise<CloudClient | null> {
  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !login) return null;
  return { token, hashedLogin: await hashLogin(login) };
}

async function getWorkerState(
  slug: string,
  client: CloudClient,
): Promise<WorkerStateEntry | null> {
  const path = `/api/v1/private/subjects/state?login=${encodeURIComponent(client.hashedLogin)}&slugs=${encodeURIComponent(slug)}`;
  try {
    const res = await workerFetch(path, { token: client.token });
    if (!res.ok) return null;
    const data = (await res.json()) as { subjects?: WorkerStateEntry[] };
    return data.subjects?.find((s) => s.slug === slug) ?? null;
  } catch {
    return null;
  }
}

async function reportToWorker(
  slug: string,
  client: CloudClient,
  url: string,
): Promise<WorkerReportEntry | null> {
  const path = `/api/v1/private/subjects/report?login=${encodeURIComponent(client.hashedLogin)}`;
  try {
    const res = await workerFetch(path, {
      method: "POST",
      token: client.token,
      body: { items: [{ slug, url: normalizeUrl(url) }] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { subjects?: WorkerReportEntry[] };
    return data.subjects?.find((s) => s.slug === slug) ?? null;
  } catch {
    return null;
  }
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

  const url = anchor.href;
  const state = await readLocalState();
  const local = state[slug] ?? {};
  if (local.checkedAt && Date.now() - local.checkedAt < CHECK_COOLDOWN_MS) {
    maybeRenderBadge(slug, local, anchor);
    return;
  }

  const client = await cloudClient();
  const sendData = await getConfig("SUBJECT_TRACKER_SEND_DATA");
  let nextLocal: LocalSubjectState;

  if (client && sendData) {
    const entry = await getWorkerState(slug, client);
    if (entry === null) {
      // Worker unreachable → keep the latest local knowledge.
      nextLocal = {
        lastUrl: local.lastUrl ?? normalizeUrl(url),
        changedAt: local.changedAt,
        checkedAt: Date.now(),
      };
    } else if (!entry.tracked) {
      // Never-seen slug → register the link. No baseline date → no badge.
      const report = await reportToWorker(slug, client, url);
      nextLocal = {
        lastUrl: normalizeUrl(url),
        changedAt: report?.lastChangedAt ?? local.changedAt,
        checkedAt: Date.now(),
      };
    } else if (entry.url && normalizeUrl(entry.url) !== normalizeUrl(url)) {
      // The shared link differs from the one we see → record the change.
      const report = await reportToWorker(slug, client, url);
      nextLocal = {
        lastUrl: normalizeUrl(url),
        changedAt: report?.lastChangedAt ?? Date.now(),
        checkedAt: Date.now(),
      };
    } else {
      // Same link → surface the shared change date, if any.
      nextLocal = {
        lastUrl: normalizeUrl(url),
        changedAt: entry.lastChangedAt ?? local.changedAt,
        checkedAt: Date.now(),
      };
    }
  } else {
    // No cloud session → pure local comparison of the link.
    const prev = local.lastUrl ? { url: local.lastUrl } : null;
    if (decide(prev, { url }) === "changed") {
      nextLocal = {
        lastUrl: normalizeUrl(url),
        changedAt: Date.now(),
        checkedAt: Date.now(),
      };
    } else {
      // No prior record → keep no change date so no badge shows.
      nextLocal = {
        lastUrl: normalizeUrl(url),
        changedAt: local.changedAt,
        checkedAt: Date.now(),
      };
    }
  }

  await chrome.storage.local.set({
    SUBJECT_TRACKER_STATE: { ...state, [slug]: nextLocal },
  });

  maybeRenderBadge(slug, nextLocal, anchor);
}

export function maybeRenderBadge(
  _slug: string,
  local: LocalSubjectState,
  button: HTMLAnchorElement | null,
): void {
  if (!button) return;
  const info = subjectBadgeInfo(local);
  if (!info) return;
  renderSubjectBadge(button, "Subject updated", info.when, info.tone);
}

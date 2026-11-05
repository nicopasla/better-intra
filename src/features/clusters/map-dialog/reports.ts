import { getConfig } from "../../../config.ts";
import { hashLogin } from "../../../utils/crypto.ts";
import { workerFetch } from "../../../utils/worker.ts";
import { normalizeSeatId } from "./seats";
import type { SeatComponentKey, SeatSeverity } from "./components";
import { SEAT_COMPONENT_MAP } from "./components";

/**
 * Broken-computer reports for the cluster maps. The report is shared with the
 * PWA through the worker; the extension reads and writes it with the same cloud
 * session. No cloud login means no report layer at all.
 */

export type SeatComponentStatus = "broken" | "works";

export interface SeatComponentReport {
  component: SeatComponentKey;
  status: SeatComponentStatus;
  updatedAt: number;
  confirmations: number;
  /** 42 login of the last reporter (absent on pre-tracking reports). */
  reporter: string | null;
}

export interface SeatReport {
  host: string;
  cluster: string | null;
  components: SeatComponentReport[];
}

export interface SeatReportsResponse {
  seats: SeatReport[];
  updatedAt: number;
}

export interface SeatReportEvent {
  component: SeatComponentKey;
  status: SeatComponentStatus;
  createdAt: number;
  /** 42 login of the reporter (absent on pre-tracking events). */
  reporter: string | null;
}

export interface SeatHistoryResponse {
  events: SeatReportEvent[];
}

export interface SeatReportInput {
  component: SeatComponentKey;
  status: SeatComponentStatus;
}

/** Reports are scoped to the Belgium campus by the worker. */
export const SEAT_REPORT_CAMPUS = "12";

interface WorkerAuth {
  token: string;
  login: string;
}

const byHost = new Map<string, SeatReport>();
const byKey = new Map<string, SeatReport>();
let available = false;

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function replace(seats: SeatReport[]): void {
  byHost.clear();
  byKey.clear();
  for (const seat of seats) {
    if (!seat?.host) continue;
    const host = normalizeHost(seat.host);
    byHost.set(host, seat);
    byKey.set(normalizeSeatId(host), seat);
  }
}

function clearReports(): void {
  byHost.clear();
  byKey.clear();
}

async function workerAuth(): Promise<WorkerAuth | null> {
  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !login) return null;
  return { token, login: await hashLogin(login) };
}

/** True when the extension has a cloud session at all. */
export async function hasCloudSession(): Promise<boolean> {
  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  return Boolean(token && login);
}

/** Read attempts have failed for lack of a session: hide the whole layer. */
export function reportsAvailable(): boolean {
  return available;
}

/**
 * Loads the current reports. Returns false when there is no cloud session (or
 * the session was rejected), which hides reporting in the dialog.
 */
export async function loadSeatReports(): Promise<boolean> {
  const auth = await workerAuth();
  if (!auth) {
    available = false;
    clearReports();
    return false;
  }
  try {
    const res = await workerFetch(
      `/api/v1/private/cluster/reports?login=${encodeURIComponent(auth.login)}`,
      { token: auth.token, cache: "no-store" },
    );
    if (res.status === 401) {
      available = false;
      clearReports();
      return false;
    }
    if (!res.ok) return available;
    const data = (await res.json()) as SeatReportsResponse;
    replace(data.seats ?? []);
    available = true;
    return true;
  } catch {
    // Offline / aborted: keep the last known reports.
    return available;
  }
}

export function getSeatReport(host: string): SeatReport | undefined {
  return byHost.get(normalizeHost(host));
}

export function getSeatReportByKey(key: string): SeatReport | undefined {
  return byKey.get(key);
}

/** Status-change history for a seat, newest first. */
export async function loadSeatHistory(
  host: string,
): Promise<SeatReportEvent[]> {
  const auth = await workerAuth();
  if (!auth) return [];
  const res = await workerFetch(
    `/api/v1/private/cluster/reports/history?login=${encodeURIComponent(
      auth.login,
    )}&host=${encodeURIComponent(normalizeHost(host))}`,
    { token: auth.token, cache: "no-store" },
  );
  if (res.status === 401) {
    available = false;
    clearReports();
    throw new Error("not_connected");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as SeatHistoryResponse;
  return (data.events ?? []).sort((a, b) => b.createdAt - a.createdAt);
}

/** Worst active issue on a seat, or null when nothing is broken. */
export function getSeatSeverity(host: string): SeatSeverity | null {
  return severityOf(host, getSeatReport(host));
}

export function getSeatSeverityByKey(key: string): SeatSeverity | null {
  const report = getSeatReportByKey(key);
  return severityOf(report?.host ?? key, report);
}

function hasReporter(component: SeatComponentReport): boolean {
  return (
    typeof component.reporter === "string" && component.reporter.trim() !== ""
  );
}

/**
 * A legacy anonymous Power/Network row is ignored only on a seat where a
 * signed-in user has explicitly reported the USB-C port present. Those are the
 * stale testing rows; a real broken seat without that USB-C confirmation still
 * crosses.
 */
function hasAttributedUsbcWorks(host: string): boolean {
  const report = getSeatReport(host);
  return Boolean(
    report?.components.some(
      (component) =>
        component.component === "usbc" &&
        component.status === "works" &&
        hasReporter(component),
    ),
  );
}

function isCrossingBroken(
  host: string,
  component: SeatComponentReport,
): boolean {
  if (component.status !== "broken") return false;
  if (hasReporter(component)) return true;
  return !hasAttributedUsbcWorks(host);
}

function severityOf(
  host: string,
  report: SeatReport | undefined,
): SeatSeverity | null {
  if (!report) return null;
  let severity: SeatSeverity | null = null;
  for (const component of report.components) {
    if (!isCrossingBroken(host, component)) continue;
    const def = SEAT_COMPONENT_MAP.get(component.component);
    // A missing USB-C port is not a defect: presence answers never mark the
    // seat as broken.
    if (component.component === "usbc" || def?.kind === "presence") continue;
    if (def?.severity === "blocking") return "blocking";
    severity = "minor";
  }
  return severity;
}

/**
 * Broken components that do not cross the seat out: keyboard, mouse scroll and
 * audio. Used for the map's warning glyph, so a crossed seat keeps its cross
 * and only the non-blocking issues get the triangle.
 */
export function getMinorSeatIssues(host: string): SeatComponentKey[] {
  const report = getSeatReport(host);
  if (!report) return [];
  const issues: SeatComponentKey[] = [];
  for (const component of report.components) {
    if (!isCrossingBroken(report.host, component)) continue;
    const def = SEAT_COMPONENT_MAP.get(component.component);
    if (component.component === "usbc" || def?.kind === "presence") continue;
    if (def?.severity !== "minor") continue;
    issues.push(component.component);
  }
  return issues;
}

/** Current status for one component, or null when it was never reported. */
export function getComponentStatus(
  host: string,
  component: SeatComponentKey,
): SeatComponentReport | undefined {
  return getSeatReport(host)?.components.find(
    (entry) => entry.component === component,
  );
}

export function getComponentStatusByKey(
  key: string,
  component: SeatComponentKey,
): SeatComponentReport | undefined {
  return getSeatReportByKey(key)?.components.find(
    (entry) => entry.component === component,
  );
}

function applyLocally(
  host: string,
  cluster: string | null,
  entries: SeatReportInput[],
): SeatReport {
  const key = normalizeHost(host);
  const previous = byHost.get(key);
  const components = new Map<SeatComponentKey, SeatComponentReport>();
  for (const component of previous?.components ?? []) {
    components.set(component.component, { ...component });
  }
  const now = Date.now();
  for (const entry of entries) {
    const existing = components.get(entry.component);
    components.set(entry.component, {
      component: entry.component,
      status: entry.status,
      updatedAt: now,
      confirmations:
        existing?.status === entry.status
          ? (existing.confirmations ?? 1) + 1
          : 1,
      reporter: null,
    });
  }
  const seat: SeatReport = {
    host: key,
    cluster: cluster ?? previous?.cluster ?? null,
    components: [...components.values()],
  };
  byHost.set(key, seat);
  byKey.set(normalizeSeatId(key), seat);
  return seat;
}

/**
 * Sends a batch of component statuses. The UI is updated optimistically and
 * rolled back if the worker rejects the request.
 */
export async function submitSeatReports(
  host: string,
  cluster: string | null,
  entries: SeatReportInput[],
): Promise<void> {
  const auth = await workerAuth();
  if (!auth) throw new Error("not_connected");

  const key = normalizeHost(host);
  const previous = byHost.get(key);
  applyLocally(key, cluster, entries);

  try {
    const res = await workerFetch(
      `/api/v1/private/cluster/reports?login=${encodeURIComponent(auth.login)}`,
      {
        token: auth.token,
        method: "POST",
        body: {
          host: key,
          cluster: cluster ?? undefined,
          reports: entries,
        },
      },
    );
    if (res.status === 401) {
      available = false;
      clearReports();
      throw new Error("not_connected");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { seat: SeatReport | null };
    if (data.seat) {
      const seat = { ...data.seat, host: key };
      byHost.set(key, seat);
      byKey.set(normalizeSeatId(key), seat);
    }
  } catch (error) {
    if (previous) {
      byHost.set(key, previous);
      byKey.set(normalizeSeatId(key), previous);
    } else {
      byHost.delete(key);
      byKey.delete(normalizeSeatId(key));
    }
    throw error;
  }
}

/** Number of seats with a blocking issue and with only minor issues. */
export function reportedSeatCounts(seatKeys: Iterable<string>): {
  blocking: number;
  minor: number;
} {
  let blocking = 0;
  let minor = 0;
  for (const key of seatKeys) {
    const severity = getSeatSeverityByKey(key);
    if (severity === "blocking") blocking++;
    else if (severity === "minor") minor++;
  }
  return { blocking, minor };
}

/** Seats whose power/network is broken are not usable. */
export function blockingSeatCount(seatKeys: Iterable<string>): number {
  let blocking = 0;
  for (const key of seatKeys) {
    if (getSeatSeverityByKey(key) === "blocking") blocking++;
  }
  return blocking;
}

/** Why a seat is crossed, for the hover tooltip / debugging. */
export function blockingSeatReasons(host: string): string {
  const report = getSeatReport(host);
  if (!report) return "";
  return report.components
    .filter(
      (component) =>
        isCrossingBroken(host, component) &&
        (component.component === "boot" || component.component === "network"),
    )
    .map(
      (component) =>
        `${component.component === "boot" ? "Power" : "Network"}${
          component.reporter ? ` (${component.reporter})` : ""
        }`,
    )
    .join(", ");
}

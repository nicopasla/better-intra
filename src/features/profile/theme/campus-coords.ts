/** Campus location from the worker (42 API), cached in D1 server-side. */
import * as SunCalc from "suncalc";
import { WORKER_URL } from "../../../utils/worker.ts";
import { isDarkAt } from "./sun-times.ts";

export interface CampusLocation {
  lat: number;
  lon: number;
  timezone: string;
}

const memCache = new Map<string, { loc: CampusLocation | null; ts: number }>();
const inflight = new Map<string, Promise<CampusLocation | null>>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const STORE_KEY = (id: string) => `CAMPUS_LOCATION_CACHE_${id}`;

export async function getCampusLocation(
  campusId: string,
): Promise<CampusLocation | null> {
  if (!campusId) return null;

  const hit = memCache.get(campusId);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.loc;

  const pending = inflight.get(campusId);
  if (pending) return pending;

  const run = (async (): Promise<CampusLocation | null> => {
    try {
      const raw = await chrome.storage.local.get(STORE_KEY(campusId));
      const entry = raw[STORE_KEY(campusId)] as
        | { loc?: CampusLocation | null; ts?: number }
        | undefined;
      if (entry && typeof entry.ts === "number" && Date.now() - entry.ts < CACHE_TTL) {
        memCache.set(campusId, { loc: entry.loc ?? null, ts: entry.ts });
        return entry.loc ?? null;
      }
    } catch {
      // storage unavailable → fall through to fetch
    }

    let loc: CampusLocation | null = null;
    try {
      const res = await fetch(
        `${WORKER_URL}/api/v1/public/campus/${encodeURIComponent(campusId)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          latitude?: number;
          longitude?: number;
          timezone?: string;
        };
        if (
          typeof data.latitude === "number" &&
          typeof data.longitude === "number" &&
          data.timezone
        ) {
          loc = { lat: data.latitude, lon: data.longitude, timezone: data.timezone };
        }
      }
    } catch {
      // transient network error → don't persist, allow retry later
    }

    const ts = Date.now();
    memCache.set(campusId, { loc, ts });
    try {
      await chrome.storage.local.set({ [STORE_KEY(campusId)]: { loc, ts } });
    } catch {}
    return loc;
  })();

  inflight.set(campusId, run);
  try {
    return await run;
  } finally {
    inflight.delete(campusId);
  }
}

export interface CampusSunTimes {
  sunset: string;
  sunrise: string;
}

/** Sunset/sunrise clock times for the campus, or null when unavailable. */
export async function getCampusSunTimes(
  campusId: string,
): Promise<CampusSunTimes | null> {
  const loc = await getCampusLocation(campusId);
  if (!loc) return null;
  const times = SunCalc.getTimes(new Date(), loc.lat, loc.lon);
  if (!times.sunrise || !times.sunset) return null;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: loc.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  return { sunset: fmt(times.sunset), sunrise: fmt(times.sunrise) };
}

/** Fallback wall-clock window used when a campus has no known coordinates. */
export const FALLBACK_DARK_START = { h: 20, m: 0 };
export const FALLBACK_DARK_END = { h: 7, m: 0 };

/** True when it is currently night at the campus, using a fixed window as fallback. */
export function isDarkAtCampus(
  location: CampusLocation | null,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (location) {
    return isDarkAt(location.lat, location.lon, location.timezone || timeZone, now);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = get("hour");
  if (h === 24) h = 0;
  const cur = h * 60 + get("minute");
  const start = FALLBACK_DARK_START.h * 60 + FALLBACK_DARK_START.m;
  const end = FALLBACK_DARK_END.h * 60 + FALLBACK_DARK_END.m;
  return cur >= start || cur < end;
}
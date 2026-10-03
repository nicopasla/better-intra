import * as SunCalc from "suncalc";

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const times = SunCalc.getTimes(date, lat, lon);
  // Polar day/night: fall back to fixed times so the caller still works.
  return {
    sunrise: times.sunrise ?? new Date(date.setHours(7, 0, 0, 0)),
    sunset: times.sunset ?? new Date(date.setHours(20, 0, 0, 0)),
  };
}

/** Wall-clock hours/minutes of a UTC instant in a given IANA timezone. */
function timeParts(date: Date, timeZone: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = get("hour");
  if (h === 24) h = 0;
  return { h, m: get("minute") };
}

/** True when it is currently night (after sunset or before sunrise) at the location. */
export function isDarkAt(
  lat: number,
  lon: number,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  const today = timeParts(now, timeZone);
  const cur = today.h * 60 + today.m;

  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const { sunrise, sunset } = sunTimes(lat, lon, utcToday);
  const start = timeParts(sunrise, timeZone);
  const end = timeParts(sunset, timeZone);

  return cur >= end.h * 60 + end.m || cur < start.h * 60 + start.m;
}
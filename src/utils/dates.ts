/**
 * A Date for a timestamp from the Intra / intrapy APIs.
 *
 * Those APIs return "YYYY-MM-DDTHH:MM:SS" without a timezone, meaning UTC.
 * Append "Z" only when the string has a time part and no offset, so every
 * card agrees on the day: parsing it bare treats it as local time (off by one
 * day around midnight), while appending "Z" blindly breaks strings that
 * already carry an offset. Date-only strings are already UTC per the
 * ECMAScript date format, so they are left untouched.
 */
export function parseIntraDate(dateStr: string): Date {
  const bare =
    dateStr.includes("T") && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateStr);
  return new Date(bare ? dateStr + "Z" : dateStr);
}

export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "Never";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Compact age for live data ("42s ago", "3m ago", "2h 10m ago", "1d 4h ago"). */
export function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

export function formatAbsoluteDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Absolute en-US date for an Intra timestamp; `short` uses an abbreviated month. */
export function formatAbsoluteDate(
  iso: string,
  style: "long" | "short" = "long",
): string {
  return parseIntraDate(iso).toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

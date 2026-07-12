import { hashLogin } from "../../utils/crypto.ts";

const WORKER_URL = "https://api.betterintra.com";

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDate(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function computeHash(events: { id: number; begin_at: string }[]): string {
  let h = 0;
  for (const e of events) {
    h = ((h << 5) - h + e.id) | 0;
    for (let i = 0; i < e.begin_at.length; i++) {
      h = ((h << 5) - h + e.begin_at.charCodeAt(i)) | 0;
    }
  }
  return String(h);
}

export function generateIcs(
  events: {
    id: number;
    name: string;
    kind: string;
    begin_at: string;
    end_at: string;
    location?: string;
  }[],
): string {
  const lines: string[] = [];
  lines.push(
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BetterIntra//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:42 Events",
  );

  for (const ev of events) {
    const url =
      ev.kind === "exam"
        ? `https://profile.intra.42.fr/exams/${ev.id}`
        : `https://profile.intra.42.fr/events/${ev.id}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@better-intra`,
      `DTSTART:${formatIcsDate(ev.begin_at)}`,
      `DTEND:${formatIcsDate(ev.end_at)}`,
      `SUMMARY:${escapeIcs(ev.name)}`,
      ev.location ? `LOCATION:${escapeIcs(ev.location)}` : "",
      `URL:${url}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:15 min before",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export async function syncCalendarIcs(
  events: {
    id: number;
    name: string;
    kind: string;
    begin_at: string;
    end_at: string;
    location?: string;
  }[],
  force = false,
): Promise<void> {
  const store = await chrome.storage.local.get([
    "CLOUD_TOKEN",
    "CLOUD_LOGIN",
    "CALENDAR_SYNC_TOKEN",
    "CALENDAR_EVENTS_HASH",
  ]);
  const sessionToken = store["CLOUD_TOKEN"] as string;
  const cloudLogin = store["CLOUD_LOGIN"] as string;
  const calendarToken = store["CALENDAR_SYNC_TOKEN"] as string;

  if (!sessionToken || !cloudLogin || !calendarToken) return;

  const currentHash = computeHash(events);
  if (!force && store["CALENDAR_EVENTS_HASH"] === currentHash) return;

  const hashed = await hashLogin(cloudLogin);
  const ics = generateIcs(events);

  try {
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/calendar/update?login=${encodeURIComponent(hashed)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ ics }),
      },
    );
    if (res.ok) {
      await chrome.storage.local.set({ CALENDAR_EVENTS_HASH: currentHash });
    }
  } catch {
    // silent
  }
}

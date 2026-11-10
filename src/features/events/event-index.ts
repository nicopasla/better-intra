import { normalizeEventName } from "./event-subscribers.ts";

/**
 * Event ids captured from Intra's own API responses by `public/hook.js`
 * (`42_EVENTS_DATA`). The v3 calendar dialog's markup carries no event id, so
 * this map is how the Subscribers button finds it without another request.
 */
const byName = new Map<string, { id: number; exam: boolean }>();

let listening = false;

function merge(payload: unknown): void {
  if (!Array.isArray(payload)) return;
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const raw = item as { id?: unknown; name?: unknown; kind?: unknown };
    const id = Number(raw.id);
    const name = String(raw.name ?? "");
    if (!Number.isFinite(id) || !name) continue;
    const key = normalizeEventName(name);
    if (!key) continue;
    byName.set(key, {
      id,
      exam: String(raw.kind ?? "").toLowerCase() === "exam",
    });
  }
}

export function findEventIdByName(name: string): number | null {
  const key = normalizeEventName(name);
  if (!key) return null;
  return byName.get(key)?.id ?? null;
}

/** True when the captured payload marked this event as an exam. */
export function isExamEventName(name: string): boolean {
  const key = normalizeEventName(name);
  if (!key) return false;
  return byName.get(key)?.exam ?? false;
}

/** Starts collecting the hooked event payloads. Safe to call repeatedly. */
export function initEventIndex(): void {
  if (listening) return;
  listening = true;
  document.addEventListener("42_EVENTS_DATA", (event) => {
    merge((event as CustomEvent).detail);
  });
  // The page may have fetched the calendar before this listener existed.
  document.dispatchEvent(new CustomEvent("42_EVENTS_REQUEST"));
}

/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  SUBSCRIBERS_TTL,
  clearCachedSubscribers,
  normalizeEventName,
  readCachedSubscribers,
  sanitizeSubscribers,
} from "../src/features/events/event-subscribers.ts";
import {
  resolveEventId,
  scanEventDialog,
} from "../src/features/events/event-subscribers.ui.ts";
import {
  findEventIdByName,
  initEventIndex,
  isExamEventName,
} from "../src/features/events/event-index.ts";

const CACHE_KEY = "EVENT_SUBSCRIBERS_CACHE";

const subscriber = {
  login: "alice",
  displayName: "Alice Doe",
  avatar: "https://cdn.intra.42.fr/users/alice.jpg",
  location: "e1r1p1",
};

async function seedCache(cache: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

beforeEach(async () => {
  await chrome.storage.local.clear();
  history.replaceState({}, "", "/");
  document.body.innerHTML = "";
});

describe("readCachedSubscribers", () => {
  it("returns a fresh entry within the TTL", async () => {
    const at = Date.now() - 60_000;
    await seedCache({ "42": { at, users: [subscriber], truncated: false } });

    const hit = await readCachedSubscribers(42);

    expect(hit?.fresh).toBe(true);
    expect(hit?.page.users).toHaveLength(1);
    expect(hit?.page.fetchedAt).toBe(at);
  });

  it("returns a stale entry so the dialog can still paint", async () => {
    const at = Date.now() - SUBSCRIBERS_TTL - 1_000;
    await seedCache({ "42": { at, users: [subscriber], truncated: true } });

    const hit = await readCachedSubscribers(42);

    expect(hit?.fresh).toBe(false);
    expect(hit?.page.truncated).toBe(true);
  });

  it("returns null for unknown events", async () => {
    expect(await readCachedSubscribers(7)).toBeNull();
  });
});

describe("clearCachedSubscribers", () => {
  it("drops only the given event", async () => {
    const now = Date.now();
    await seedCache({
      "1": { at: now, users: [subscriber], truncated: false },
      "2": { at: now, users: [subscriber], truncated: false },
    });

    await clearCachedSubscribers(1);

    expect(await readCachedSubscribers(1)).toBeNull();
    expect(await readCachedSubscribers(2)).not.toBeNull();
  });
});

describe("sanitizeSubscribers", () => {
  it("keeps valid users and defaults the display name", () => {
    const out = sanitizeSubscribers([
      { login: " alice ", displayName: "Alice", location: "e1r1p1" },
      { login: "bob" },
      { login: "" },
      { displayName: "no login" },
      null,
      "nope",
    ]);

    expect(out.map((u) => u.login)).toEqual(["alice", "bob"]);
    expect(out[0]?.displayName).toBe("Alice");
    expect(out[0]?.location).toBe("e1r1p1");
    expect(out[1]?.displayName).toBe("bob");
    expect(out[1]?.location).toBeNull();
    expect(out[1]?.avatar).toBeNull();
  });

  it("ignores non-array payloads", () => {
    expect(sanitizeSubscribers(null)).toEqual([]);
    expect(sanitizeSubscribers({ users: [] })).toEqual([]);
  });
});

describe("resolveEventId", () => {
  it("reads the id from the events route", () => {
    history.replaceState({}, "", "/events/4321");
    expect(resolveEventId(null)).toBe(4321);
  });

  it("falls back to the query string and the hash", () => {
    history.replaceState({}, "", "/calendar?event=99");
    expect(resolveEventId(null)).toBe(99);

    history.replaceState({}, "", "/calendar#event=77");
    expect(resolveEventId(null)).toBe(77);
  });

  it("reads a link inside the dialog", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<a href="https://events.intra.42.fr/events/12">event</a>';
    expect(resolveEventId(container)).toBe(12);
  });

  it("returns null when nothing identifies the event", () => {
    expect(resolveEventId(null)).toBeNull();
  });
});

describe("normalizeEventName", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeEventName("[CLUB] Art&Craft - Monthly Workshop")).toBe(
      normalizeEventName("[club] art craft   monthly workshop"),
    );
    expect(normalizeEventName("Party!")).toBe("party");
  });
});

describe("event index", () => {
  it("asks the page hook for the last captured events", () => {
    let requested = false;
    const onRequest = () => {
      requested = true;
    };
    document.addEventListener("42_EVENTS_REQUEST", onRequest);

    initEventIndex();

    document.removeEventListener("42_EVENTS_REQUEST", onRequest);
    expect(requested).toBe(true);
  });

  it("maps a dialog title back to its event id", () => {
    initEventIndex();
    document.dispatchEvent(
      new CustomEvent("42_EVENTS_DATA", {
        detail: [
          { id: 12, name: "[CLUB] Art&Craft - Monthly Workshop" },
          { id: "nope", name: "Broken" },
          { id: 14 },
        ],
      }),
    );

    expect(findEventIdByName("[club] art&craft - monthly workshop")).toBe(12);
    expect(findEventIdByName("Unknown")).toBeNull();
  });

  it("flags exams from the captured kind", () => {
    initEventIndex();
    document.dispatchEvent(
      new CustomEvent("42_EVENTS_DATA", {
        detail: [{ id: 9, name: "Exam Rank 03", kind: "exam" }],
      }),
    );

    expect(isExamEventName("Exam Rank 03")).toBe(true);
    expect(isExamEventName("[CLUB] Art&Craft")).toBe(false);
  });
});

describe("scanEventDialog", () => {
  function mountActions(closeFirst = true): HTMLElement {
    document.body.innerHTML = `
      <div id="actions" class="flex justify-end space-x-2 p-2">
        ${closeFirst ? '<button type="button" class="close">Close</button>' : ""}
        <button type="button" class="unsub">Unsubscribe</button>
        ${closeFirst ? "" : '<button type="button" class="close">Close</button>'}
      </div>`;
    return document.getElementById("actions") as HTMLElement;
  }

  it("injects Subscribers next to the subscribe button", () => {
    history.replaceState({}, "", "/events/123");
    const row = mountActions();

    scanEventDialog();

    const injected = row.querySelector<HTMLElement>(
      "[data-ft-event-subscribers]",
    );
    expect(injected?.textContent).toBe("Subscribers");
    expect(injected?.nextElementSibling?.textContent).toBe("Unsubscribe");
    expect(injected?.style.getPropertyValue("margin-left")).toBe("auto");
    expect(injected?.style.getPropertyPriority("margin-left")).toBe(
      "important",
    );
  });

  it("moves Close to the far left of the row", () => {
    history.replaceState({}, "", "/events/123");
    const row = mountActions(false);

    scanEventDialog();

    expect(row.firstElementChild?.textContent).toBe("Close");
    expect(row.querySelector("[data-ft-event-subscribers]")).not.toBeNull();
  });

  it("injects even when the event id is not on the page", () => {
    history.replaceState({}, "", "/calendar");
    const row = mountActions();

    scanEventDialog();

    expect(row.querySelector("[data-ft-event-subscribers]")).not.toBeNull();
  });

  it("hides the button on exams", () => {
    history.replaceState({}, "", "/events/123");
    const row = mountActions();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.appendChild(row);
    dialog.insertAdjacentHTML("afterbegin", "<h4>Exam Rank 03</h4>");
    document.body.appendChild(dialog);

    scanEventDialog();

    expect(row.querySelector("[data-ft-event-subscribers]")).toBeNull();
  });

  it("still puts Close on the left when there is no Subscribe button", () => {
    history.replaceState({}, "", "/events/123");
    document.body.innerHTML = `
      <div role="dialog">
        <h4>Exam Rank 03</h4>
        <div id="exam-actions" class="flex justify-end">
          <button type="button">Open</button>
          <button type="button">Close</button>
        </div>
      </div>`;

    scanEventDialog();

    const row = document.getElementById("exam-actions") as HTMLElement;
    expect(row.firstElementChild?.textContent).toBe("Close");
    expect(row.querySelector("[data-ft-event-subscribers]")).toBeNull();
  });

  it("toggles the subscribers panel inside the dialog", async () => {
    history.replaceState({}, "", "/events/123");
    const row = mountActions();
    scanEventDialog();

    const button = row.querySelector<HTMLElement>(
      "[data-ft-event-subscribers]",
    );
    button?.click();
    await new Promise((r) => setTimeout(r, 0));

    const panel = document.getElementById("ft-event-subscribers-panel");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Subscribers");

    button?.click();
    expect(document.getElementById("ft-event-subscribers-panel")).toBeNull();
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  formatShortDate,
  formatRelativeTime,
} from "../src/features/subjects/fingerprint";
import { parsePdfDate, subjectMeta } from "../src/features/subjects/meta";
import { maybeRenderBadge } from "../src/features/subjects/tracker";

const URL_A = "https://cdn.example.com/pdf/pdf/900001/en.subject.example.pdf";
const SEED_DATE = Date.UTC(2026, 7, 11, 14, 19, 24);
const NEW_DATE = Date.UTC(2026, 8, 1, 8, 9, 0);

function pdfBytes(text: string): Uint8Array {
  return new Uint8Array([...text].map((c) => c.charCodeAt(0)));
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response,
): string[] {
  const calls: string[] = [];
  (globalThis as any).fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return handler(url, init);
  });
  return calls;
}

describe("parsePdfDate", () => {
  it("parses a full timestamp with a timezone offset", () => {
    expect(parsePdfDate("D:20260811161924+02'00'")).toBe(SEED_DATE);
  });

  it("parses a date without time", () => {
    expect(parsePdfDate("D:20260811")).toBe(Date.UTC(2026, 7, 11));
  });

  it("returns null for non-date input", () => {
    expect(parsePdfDate("nonsense")).toBeNull();
  });
});

describe("subjectMeta", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers the Last-Modified header", async () => {
    const calls = mockFetch((_url, init) => {
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "last-modified": new Date(NEW_DATE).toUTCString() },
        });
      }
      return new Response("unused", { status: 500 });
    });
    expect(await subjectMeta(URL_A)).toBe(NEW_DATE);
    expect(calls).toEqual([`HEAD ${URL_A}`]);
  });

  it("falls back to the pdf metadata when the header is missing", async () => {
    mockFetch((_url, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200 });
      return new Response(
        pdfBytes(
          "<< /CreationDate (D:20260811161924+02'00') /ModDate (D:20260901100900+02'00') >>",
        ),
        { status: 200 },
      );
    });
    expect(await subjectMeta(URL_A)).toBe(Date.UTC(2026, 8, 1, 8, 9, 0));
  });

  it("falls back to the pdf metadata when the HEAD is rejected", async () => {
    mockFetch((_url, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 403 });
      return new Response(
        pdfBytes("<< /ModDate (D:20260811161924+02'00') >>"),
        { status: 200 },
      );
    });
    expect(await subjectMeta(URL_A)).toBe(SEED_DATE);
  });

  it("returns null when nothing can be read", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    expect(await subjectMeta(URL_A)).toBeNull();
  });

  it("returns null for a non-http url", async () => {
    expect(await subjectMeta("javascript:alert(1)")).toBeNull();
  });
});

describe("formatShortDate", () => {
  it("formats as DD/MM/YY in UTC", () => {
    expect(formatShortDate(Date.UTC(2026, 7, 11, 16, 19, 24))).toBe("11/08/26");
  });
});

describe("formatRelativeTime", () => {
  const NOW = Date.UTC(2026, 7, 11, 16, 19, 24);

  it("returns 'just now' for fresh timestamps", () => {
    expect(formatRelativeTime(NOW - 5_000, NOW)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
  });

  it("falls back to an absolute date after a week", () => {
    expect(formatRelativeTime(NOW - 10 * 86_400_000, NOW)).toBe("01/08/26");
  });
});

describe("maybeRenderBadge", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mount() {
    const summary = document.createElement("div");
    summary.className = "project-summary";
    const anchor = document.createElement("a");
    summary.appendChild(anchor);
    document.body.appendChild(summary);
    return { summary, anchor };
  }

  it("renders nothing without a button or a version date", () => {
    maybeRenderBadge({}, null);
    expect(document.getElementById("ft-subject-update-host")).toBeNull();
  });

  it("renders nothing when there is no known update date", () => {
    const { anchor } = mount();
    maybeRenderBadge({}, anchor);
    expect(document.getElementById("ft-subject-update-host")).toBeNull();
  });

  it("appends the badge to the end of the project summary", () => {
    const { summary, anchor } = mount();
    maybeRenderBadge({ versionDate: Date.now() }, anchor);
    const badge = document.getElementById("ft-subject-update-host");
    expect(badge).toBeTruthy();
    expect(summary.lastElementChild).toBe(badge);
  });

  it("writes 'Subject updated' with relative time for a recent update", () => {
    const { anchor } = mount();
    maybeRenderBadge({ versionDate: Date.now() - 3 * 3_600_000 }, anchor);
    const badge = document.getElementById("ft-subject-update-host");
    const shadowText = badge?.shadowRoot?.textContent ?? "";
    expect(shadowText).toContain("Subject updated");
    expect(shadowText).toContain("3h ago");
  });

  it("falls back to an absolute date after a week", () => {
    const { anchor } = mount();
    maybeRenderBadge({ versionDate: Date.UTC(2026, 7, 11, 16, 19, 24) }, anchor);
    const badge = document.getElementById("ft-subject-update-host");
    const shadowText = badge?.shadowRoot?.textContent ?? "";
    expect(shadowText).toContain("Subject updated");
    expect(shadowText).toContain("11/08/26");
    expect(shadowText).not.toContain("ago");
  });

  it("colors the badge red within 7 days", () => {
    const { anchor } = mount();
    maybeRenderBadge({ versionDate: Date.now() }, anchor);
    const badge = document.getElementById("ft-subject-update-host");
    const pill = badge?.shadowRoot?.querySelector<HTMLElement>(
      'span[style*="background"]',
    );
    expect(pill?.style.background).toContain("var(--color-error");
  });

  it("colors the badge neutral after 30 days", () => {
    const { anchor } = mount();
    maybeRenderBadge({ versionDate: Date.now() - 45 * 86_400_000 }, anchor);
    const badge = document.getElementById("ft-subject-update-host");
    const pill = badge?.shadowRoot?.querySelector<HTMLElement>(
      'span[style*="background"]',
    );
    expect(pill?.style.background).not.toContain("var(--color-error");
    expect(pill?.style.background).not.toContain("var(--color-warning");
  });
});

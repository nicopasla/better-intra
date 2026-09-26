import { describe, it, expect } from "vitest";
import { formatRelative, parseIntraDate } from "../src/utils/dates.ts";

describe("parseIntraDate", () => {
  it("reads a timezone-less timestamp as UTC", () => {
    expect(parseIntraDate("2024-03-05T23:30:00").getTime()).toBe(
      Date.UTC(2024, 2, 5, 23, 30, 0),
    );
  });

  it("keeps an explicit UTC offset", () => {
    expect(parseIntraDate("2024-03-05T23:30:00Z").getTime()).toBe(
      Date.UTC(2024, 2, 5, 23, 30, 0),
    );
    expect(parseIntraDate("2024-03-06T01:30:00+02:00").getTime()).toBe(
      Date.UTC(2024, 2, 5, 23, 30, 0),
    );
  });

  it("leaves a date-only string alone instead of producing NaN", () => {
    const d = parseIntraDate("2024-03-05");
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.toISOString()).toBe("2024-03-05T00:00:00.000Z");
  });
});

describe("formatRelative", () => {
  const now = Date.now();
  it("formats recent timestamps", () => {
    expect(formatRelative(null)).toBe("Never");
    expect(formatRelative(now)).toBe("just now");
    expect(formatRelative(now - 5 * 60_000)).toBe("5m ago");
    expect(formatRelative(now - 3 * 3_600_000)).toBe("3h ago");
    expect(formatRelative(now - 2 * 86_400_000)).toBe("2d ago");
  });
});

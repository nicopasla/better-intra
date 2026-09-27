import { describe, it, expect } from "vitest";
import {
  formatAbsoluteDate,
  formatAbsoluteDateTime,
  formatRelative,
  parseIntraDate,
} from "../src/utils/dates.ts";

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

describe("formatAbsoluteDate", () => {
  it("formats a long month", () => {
    expect(formatAbsoluteDate("2024-03-05T12:00:00")).toBe("March 5, 2024");
  });

  it("formats a short month", () => {
    expect(formatAbsoluteDate("2024-03-05T12:00:00", "short")).toBe(
      "Mar 5, 2024",
    );
  });
});

describe("formatAbsoluteDateTime", () => {
  it("includes the date and 24h time", () => {
    const ts = new Date(2024, 2, 5, 18, 14).getTime();
    const out = formatAbsoluteDateTime(ts);
    expect(out).toContain("Mar 5, 2024");
    expect(out).toContain("18:14");
  });
});

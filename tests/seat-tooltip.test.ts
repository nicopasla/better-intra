import { describe, it, expect } from "vitest";
import { seatIssueTooltipHtml } from "../src/features/clusters/map-dialog/seat-icons";

describe("seatIssueTooltipHtml", () => {
  it("renders nothing when there are no issues", () => {
    expect(seatIssueTooltipHtml([])).toBe("");
  });

  it("renders one icon+label row per broken component", () => {
    const html = seatIssueTooltipHtml(["keyboard", "mouse_scroll"]);
    expect(html).toContain("Broken");
    expect(html).toContain("Keyboard");
    expect(html).toContain("Mouse scroll");
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html.match(/width="14" height="14"/g)).toHaveLength(2);
  });

  it("keeps the report-sheet labels for every component", () => {
    const html = seatIssueTooltipHtml([
      "boot",
      "network",
      "keyboard",
      "mouse_scroll",
      "computer",
    ]);
    expect(html).toContain("Power");
    expect(html).toContain("Network");
    expect(html).toContain("Keyboard");
    expect(html).toContain("Mouse scroll");
    expect(html).toContain("Computer");
    expect(html.match(/<svg/g)).toHaveLength(5);
  });

  it("falls back to the key for an unknown component", () => {
    expect(
      seatIssueTooltipHtml(["mystery" as unknown as "keyboard"]),
    ).toContain("mystery");
  });
});

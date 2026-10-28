import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCustomBadge,
  sanitizeBadges,
} from "../src/features/profile/custom-badges";

const sample = {
  id: "example",
  label: "Example",
  color: "#3366cc",
  icon: "★",
  tooltip: "Fixture badge",
};

describe("sanitizeBadges", () => {
  it("keeps the renderable fields", () => {
    expect(sanitizeBadges([sample])).toEqual([sample]);
  });

  it("drops entries without an id or label", () => {
    expect(
      sanitizeBadges([
        { id: "  ", label: "A" },
        { id: "b", label: "" },
      ]),
    ).toEqual([]);
  });

  it("only allows hex colours and trims optionals", () => {
    const [badge] = sanitizeBadges([
      { id: "a", label: "A", color: "url(evil)", icon: "  ", tooltip: " " },
    ]);
    expect(badge.color).toBeNull();
    expect(badge.icon).toBeNull();
    expect(badge.tooltip).toBeNull();
  });

  it("ignores non-array payloads", () => {
    expect(sanitizeBadges(null)).toEqual([]);
    expect(sanitizeBadges({})).toEqual([]);
  });
});

describe("buildCustomBadge", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the native badge classes, colours and icon", () => {
    const el = buildCustomBadge(sample);
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("inline-flex items-center text-xs");
    expect(el.className).toContain("mx-1 px-3.5 py-1.5 rounded border");
    expect(el.getAttribute("data-ft-custom-badge")).toBe("example");
    expect(el.title).toBe("Fixture badge");
    expect(el.textContent).toBe("Example★");
    expect(el.style.backgroundColor).toBe("rgb(51, 102, 204)");
    expect(el.style.borderColor).toBe("rgb(51, 102, 204)");
    expect(el.style.color).toBe("rgb(255, 255, 255)");
    expect(el.hasAttribute("href")).toBe(false);
  });

  it("leaves the theme colours on the class when no colour is set", () => {
    const el = buildCustomBadge({
      id: "example",
      label: "Example",
      color: null,
      icon: null,
      tooltip: null,
    });
    expect(el.textContent).toBe("Example");
    expect(el.style.backgroundColor).toBe("");
    expect(el.className).toContain("bg-primary");
    expect(el.title).toBe("");
  });

  it("uses dark text on light badge colours", () => {
    const el = buildCustomBadge({ ...sample, color: "#ffee00" });
    expect(el.style.color).toBe("rgb(0, 0, 0)");
  });
});

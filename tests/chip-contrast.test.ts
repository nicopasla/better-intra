import { beforeEach, describe, expect, it } from "vitest";
import { contrastRatio } from "../src/utils/color.ts";
import { refreshChipContrasts } from "../src/features/profile/theme/chip-contrast.ts";

const CREAM = "hsl(37 50% 82%)";

function chip(background: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "text-white";
  el.style.backgroundColor = background;
  document.body.appendChild(el);
  return el;
}

function colorOf(el: HTMLElement): string {
  return getComputedStyle(el).color;
}

describe("chip contrast guard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.className = "dark";
    document.documentElement.style.color = CREAM;
  });

  it("keeps the theme text when it already reads on the chip", () => {
    const el = chip("rgb(20, 16, 24)");

    refreshChipContrasts();

    expect(el.style.getPropertyPriority("color")).toBe("important");
    expect(contrastRatio(colorOf(el), "#141018")).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens the theme text on Intra's teal, periwinkle and salmon chips", () => {
    const chips = [
      chip("rgb(0, 186, 188)"),
      chip("rgb(162, 179, 229)"),
      chip("rgb(237, 129, 121)"),
    ];

    refreshChipContrasts();

    for (const [i, el] of chips.entries()) {
      expect(el.style.getPropertyPriority("color")).toBe("important");
      expect(
        contrastRatio(colorOf(el), ["#00babc", "#a2b3e5", "#ed8179"][i]!),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves chips without an inline background alone", () => {
    const el = document.createElement("div");
    el.className = "text-white";
    document.body.appendChild(el);

    refreshChipContrasts();

    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("clears its override in light mode", () => {
    const el = chip("rgb(0, 186, 188)");
    refreshChipContrasts();
    expect(el.style.getPropertyValue("color")).not.toBe("");

    document.documentElement.className = "";
    refreshChipContrasts();

    expect(el.style.getPropertyValue("color")).toBe("");
  });
});

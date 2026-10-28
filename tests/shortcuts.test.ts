import { describe, it, expect, beforeEach } from "vitest";
import { findLinksBanners } from "../src/features/shortcuts/shortcuts";

const BANNER =
  "w-full flex flex-row gap-8 py-4 px-8 items-center";

const icon = `<svg class="text-legacy-main hidden lg:block"><path d="m3 11 18-5v12L3 14v-3z"></path></svg>`;

function slide(kind: "notice" | "links", clone = false): string {
  const title =
    kind === "notice" ? "Scheduled Maintenance Notice 🛠️" : "Important links: ";
  const body =
    kind === "notice"
      ? "<p>Maintenance window.</p><p>Thanks!</p>"
      : ([] as string[])
          .concat("<p><a href='https://example.test/toolbox'>Tool Box</a></p>")
          .concat("<p><a href='https://example.test/calendar'>Calendar</a></p>")
          .join("");

  const cls = clone
    ? `slide ${kind === "notice" ? "prev-cloned" : "next-cloned"}`
    : "slide";
  return `<div class="${cls}" inert="true">
    <div class="${BANNER}">
      ${icon}
      <div class="flex flex-col text-sm w-full gap-1">
        <div class="flex flex-row gap-4">
          <div class="flex flex-col lg:flex-row justify-between w-full">
            <div class="text-legacy-main font-bold uppercase">${title}</div>
            <div class="text-neutral-600"><button data-state="closed"><span>ago</span></button></div>
          </div>
        </div>
        ${body}
      </div>
    </div>
  </div>`;
}

describe("findLinksBanners", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("picks the important links slide and ignores the notice", () => {
    document.body.innerHTML = `<div class="slider-list">${slide("notice")}${slide("links")}</div>`;

    const banners = findLinksBanners();
    expect(banners).toHaveLength(1);
    expect(banners[0].textContent).toContain("Important links");
  });

  it("includes cloned link slides so the carousel keeps its shortcuts", () => {
    document.body.innerHTML = `<div class="slider-list">${slide("notice", true)}${slide(
      "links",
    )}${slide("links", true)}</div>`;

    expect(findLinksBanners()).toHaveLength(2);
  });

  it("returns nothing when only notices are present", () => {
    document.body.innerHTML = `<div class="slider-list">${slide("notice")}${slide(
      "notice",
      true,
    )}</div>`;

    expect(findLinksBanners()).toEqual([]);
  });

  it("falls back to the presence of links when the title is localised", () => {
    document.body.innerHTML = `<div class="slider-list">
      ${slide("notice").replace("Scheduled Maintenance Notice 🛠️", "Avis")}
      ${slide("links").replace("Important links: ", "Liens utiles")}
    </div>`;

    const banners = findLinksBanners();
    expect(banners).toHaveLength(1);
    expect(banners[0].textContent).toContain("Liens utiles");
  });

  it("never returns a notice that mentions maintenance", () => {
    document.body.innerHTML = `<div class="${BANNER}">
      <div class="text-legacy-main font-bold uppercase">Scheduled Maintenance Notice</div>
      <p><a href="https://example.test">A link inside the notice</a></p>
    </div>`;

    expect(findLinksBanners()).toEqual([]);
  });
});

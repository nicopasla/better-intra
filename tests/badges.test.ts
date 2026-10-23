import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  wrapTitleBadges,
  getTitleBadges,
  applyBadgeLayout,
  applyBadgeIndent,
  badgeIndentPx,
  relocateBadges,
} from "../src/features/profile/badges";
import {
  badgeColorCss,
  usernameBadgeStylesheet,
} from "../src/features/profile/visuals";
import { sanitizeVisualUrls } from "../src/features/profile/visuals-sanitize";
import {
  NAME_BADGE_SELECTOR,
  TITLE_BADGE_SELECTOR,
} from "../src/features/profile/selectors";

function badge(title: string): string {
  return `<div class="inline-flex items-center text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-primary hover:bg-primary/80 border-transparent text-primary-foreground flex-shrink-0 mx-1 px-3.5 py-1.5 rounded border shadow-base">${title}</div>`;
}

describe("wrapTitleBadges", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("wraps the native title badge row", () => {
    document.body.innerHTML = `
      <div class="py-2 flex gap-2 w-full overflow-x-auto" style="scrollbar-color: rgb(181, 22, 63) transparent; scrollbar-width: thin;">
        ${badge("BADGE ONE")}
        ${badge("BADGE TWO")}
        ${badge("BADGE THREE")}
        ${badge("BADGE FOUR")}
        ${badge("BADGE FIVE")}
        ${badge("BADGE SIX")}
      </div>
    `;
    wrapTitleBadges(document);

    const row = document.querySelector<HTMLElement>(".overflow-x-auto")!;
    expect(row.style.getPropertyValue("flex-wrap")).toBe("wrap");
    expect(row.style.getPropertyPriority("flex-wrap")).toBe("important");
  });

  it("does nothing when there are no badges", () => {
    document.body.innerHTML = `<div class="py-2 flex gap-2 w-full overflow-x-auto" style="scrollbar-width: thin;"></div>`;
    wrapTitleBadges(document);

    const row = document.querySelector<HTMLElement>(".overflow-x-auto")!;
    expect(row.style.getPropertyValue("flex-wrap")).toBe("");
  });

  it("leaves unrelated flex rows untouched", () => {
    document.body.innerHTML = `
      <div class="flex gap-2">not badges</div>
      <div class="py-2 flex gap-2 w-full overflow-x-auto">${badge("BADGE ONE")}</div>
    `;
    wrapTitleBadges(document);

    const rows = document.querySelectorAll<HTMLElement>(
      "[class*='overflow-x-auto'], .flex",
    );
    for (const row of rows) {
      const text = row.textContent || "";
      if (text.includes("BADGE ONE")) {
        expect(row.style.getPropertyValue("flex-wrap")).toBe("wrap");
      } else if (text.includes("not badges")) {
        expect(row.style.getPropertyValue("flex-wrap")).toBe("");
      }
    }
  });
});

describe("badge animations", () => {
  const stylesheet = (animation: string) =>
    usernameBadgeStylesheet(NAME_BADGE_SELECTOR, {
      animation,
      bg: "#123456",
      border: "#abcdef",
      text: "#fedcba",
    });

  it("neon glows with the badge accents", () => {
    const css = stylesheet("neon");
    expect(css).toContain("--ft-badge-neon-1: #abcdef");
    expect(css).toContain("--ft-badge-neon-2: #fedcba");
    expect(css).toContain(
      "animation: ft-badge-neon 1.5s ease-in-out infinite alternate !important",
    );
  });

  it("heartbeat keeps the lub-dub and glows with the badge border", () => {
    const css = stylesheet("heartbeat");
    expect(css).toContain("--ft-badge-heartbeat: #abcdef");
    expect(css).toContain(
      "animation: ft-badge-heartbeat 1.4s ease-in-out infinite !important",
    );
  });

  it("echo paints both ghosts from attr(data-text)", () => {
    const css = stylesheet("echo");
    expect(css).toContain("::before {");
    expect(css).toContain("::after {");
    expect(css).toContain("content: attr(data-text)");
    expect(css).toContain("--ft-badge-echo-1: #abcdef");
    expect(css).toContain("--ft-badge-echo-2: #fedcba");
    expect(css).toContain("ft-badge-echo 2s ease-out 1s infinite");
  });

  it("disables the pseudo-element animation under reduced motion", () => {
    const css = stylesheet("echo");
    const block = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(block).toContain("::before");
    expect(block).toContain("::after");
  });

  it("adds no pseudo rules for animations that do not use them", () => {
    const css = stylesheet("glow");
    expect(css).not.toContain("::before {");
  });

  it("soft blur glows with the badge accents and breathes", () => {
    const css = stylesheet("softblur");
    expect(css).toContain("--ft-badge-softblur-1: #abcdef");
    expect(css).toContain("--ft-badge-softblur-2: #fedcba");
    expect(css).toContain("text-shadow: 0 0 0 currentColor");
    expect(css).toContain(
      "animation: ft-badge-softblur 3.2s ease-in-out infinite !important",
    );
  });

  it("elastic squashes and stretches with the compositor", () => {
    const css = stylesheet("elastic");
    expect(css).toContain(
      "animation: ft-badge-elastic 1.6s ease-in-out infinite !important",
    );
    expect(css).toContain("transform-origin: center !important");
    expect(css).toContain("will-change: transform");
  });

  it("pauses and flattens the badge on hover so text can be selected", () => {
    const css = stylesheet("elastic");
    const block = css.slice(css.indexOf("(hover: hover)"));
    expect(block).toContain("animation-play-state: paused !important");
    expect(block).toContain("::before");
    expect(block).toContain("::after");
    expect(block).toContain(`> [data-ft-marquee-inner]`);
    expect(block).toContain("transform: none !important");
    expect(block).toContain("filter: none !important");
    expect(block).toContain("opacity: 1 !important");
  });

  it("keeps every new animation through the cloud sanitiser", () => {
    for (const animation of [
      "neon",
      "echo",
      "softblur",
      "elastic",
      "shimmer-reverse",
      "shimmer-down",
      "shimmer-up",
      "shimmer-diagonal",
    ]) {
      const out = sanitizeVisualUrls({
        usernameBadge: { animation },
      } as never);
      expect(out.usernameBadge?.animation).toBe(animation);
    }
  });

  it("still drops an unknown animation", () => {
    const out = sanitizeVisualUrls({
      usernameBadge: { animation: "not-a-real-effect" },
    } as never);
    expect(out.usernameBadge?.animation).toBe("none");
  });
});

describe("badgeColorCss", () => {
  it("returns empty when no color is set", () => {
    expect(badgeColorCss("")).toBe("");
    expect(badgeColorCss(undefined)).toBe("");
  });

  it("sets a readable text colour with the background and border", () => {
    const dark = badgeColorCss("#613583");
    expect(dark).toContain("background-color: #613583 !important");
    expect(dark).toContain("border-color: #613583 !important");
    expect(dark).toContain("color: #ffffff !important");

    const light = badgeColorCss("#ffffff");
    expect(light).toContain("background-color: #ffffff !important");
    expect(light).toContain("color: #000000 !important");
  });
});

describe("TITLE_BADGE_SELECTOR", () => {
  it("matches the native title badge markup", () => {
    document.body.innerHTML = `
      <div class="py-2 flex gap-2 w-full overflow-x-auto">
        ${badge("BADGE ONE")}
      </div>
    `;
    const match = document.querySelector(TITLE_BADGE_SELECTOR);
    expect(match).toBeTruthy();
    expect(match!.textContent).toBe("BADGE ONE");
  });
});

describe("getTitleBadges", () => {
  it("extracts badge titles in DOM order", () => {
    document.body.innerHTML = `
      <div class="py-2 flex gap-2 w-full overflow-x-auto">
        ${badge("ALPHA")}
        ${badge("BETA")}
        ${badge("GAMMA")}
      </div>
    `;
    const titles = getTitleBadges(document).map((b) => b.title);
    expect(titles).toEqual(["ALPHA", "BETA", "GAMMA"]);
  });

  it("returns an empty array when there are no badges", () => {
    document.body.innerHTML = `<div class="py-2 flex gap-2"></div>`;
    expect(getTitleBadges(document)).toEqual([]);
  });
});

describe("applyBadgeLayout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setup = (titles: string[]) => {
    document.body.innerHTML = `
      <div class="py-2 flex gap-2 w-full overflow-x-auto">
        ${titles.map((t) => badge(t)).join("")}
      </div>
    `;
  };

  it("hides badges prefixed with '-'", () => {
    setup(["ALPHA", "BETA", "GAMMA"]);
    applyBadgeLayout(document, {
      order: ["-BETA"],
      wrap: true,
      align: "center",
    });

    const badges = getTitleBadges(document);
    const beta = badges.find((b) => b.title === "BETA")!;
    expect(beta.el.style.display).toBe("none");
    const alpha = badges.find((b) => b.title === "ALPHA")!;
    expect(alpha.el.style.display).not.toBe("none");
  });

  it("sets wrap to nowrap when wrap is false", () => {
    setup(["ALPHA"]);
    applyBadgeLayout(document, { order: [], wrap: false, align: "center" });
    const row = document.querySelector<HTMLElement>(".overflow-x-auto")!;
    expect(row.style.getPropertyValue("flex-wrap")).toBe("nowrap");
  });

  it("reorders badges to match the configured order", () => {
    setup(["ALPHA", "BETA", "GAMMA"]);
    applyBadgeLayout(document, {
      order: ["GAMMA", "ALPHA"],
      wrap: true,
      align: "center",
    });

    const titles = getTitleBadges(document).map((b) => b.title);
    expect(titles).toEqual(["GAMMA", "ALPHA", "BETA"]);
  });

  it("aligns the badge row via justify-content", () => {
    setup(["ALPHA"]);
    const row = document.querySelector<HTMLElement>(".overflow-x-auto")!;

    applyBadgeLayout(document, { order: [], wrap: true, align: "left" });
    expect(row.style.getPropertyValue("justify-content")).toBe("left");
    expect(row.style.getPropertyPriority("justify-content")).toBe("important");

    applyBadgeLayout(document, { order: [], wrap: true, align: "right" });
    expect(row.style.getPropertyValue("justify-content")).toBe("right");
  });
});

describe("relocateBadges", () => {
  const header = (titles: string[]) => `
    <div class="flex flex-col justify-center gap-4">
      <h2 class="text-2xl font-bold">Ada Lovelace</h2>
      <p class="text-sm">alovelace</p>
      <div class="py-2 flex gap-2 w-full overflow-x-auto">
        ${titles.map((t) => badge(t)).join("")}
      </div>
    </div>`;

  const levelBar = `
    <div class="px-8 flex flex-row gap-2 items-end">
      <h1 class="text-4xl">7</h1>
      <div role="progressbar"></div>
    </div>`;

  const setup = (titles: string[], withLevelBar = true) => {
    document.body.innerHTML = `<div class="ft-profile-card">${header(titles)}${withLevelBar ? levelBar : ""}</div>`;
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the badge row directly above the level/cursus bar", () => {
    setup(["TUTOR", "PHOENIX"]);
    relocateBadges();

    const bar = document.querySelector<HTMLElement>(".px-8.flex.flex-row")!;
    const row = document.querySelector<HTMLElement>("[data-ft-badges-row]")!;
    expect(row.nextElementSibling).toBe(bar);
    expect(bar.previousElementSibling).toBe(row);
  });

  it("is idempotent", () => {
    setup(["TUTOR", "PHOENIX"]);
    relocateBadges();
    const first = document.querySelector<HTMLElement>("[data-ft-badges-row]")!;
    relocateBadges();
    const second = document.querySelector<HTMLElement>("[data-ft-badges-row]")!;
    expect(second).toBe(first);
    expect(second.nextElementSibling).toBe(
      document.querySelector<HTMLElement>(".px-8.flex.flex-row"),
    );
  });

  it("does nothing when there are no badges", () => {
    setup([]);
    relocateBadges();
    expect(document.querySelector("[data-ft-badges-row]")).toBeNull();
  });

  it("does nothing when there is no level bar", () => {
    setup(["TUTOR"], false);
    relocateBadges();
    const row = document.querySelector<HTMLElement>(".overflow-x-auto")!;
    expect(row.hasAttribute("data-ft-badges-row")).toBe(false);
    expect(row.nextElementSibling).toBeNull();
  });
});

describe("badge row start", () => {
  const rect = (left: number, width: number): DOMRect =>
    ({ left, width, right: left + width }) as DOMRect;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="ft-profile-card">
        <div class="flex flex-col justify-center gap-4">
          <h2 class="text-2xl font-bold">Ada Lovelace</h2>
          <p class="text-sm">alovelace</p>
        </div>
        <div class="py-2 flex gap-2 w-full overflow-x-auto" data-ft-badges-row>
          ${badge("TUTOR")}
        </div>
      </div>`;
  });

  it("clamps the indent so the badges never touch the avatar", () => {
    expect(badgeIndentPx(300, 20)).toBe(280);
    expect(badgeIndentPx(20, 20)).toBe(16);
    expect(badgeIndentPx(10, 20)).toBe(16);
  });

  it("removes the indent when the option is off", () => {
    const row = document.querySelector<HTMLElement>("[data-ft-badges-row]")!;
    row.style.setProperty("--ft-badges-indent", "240px");

    applyBadgeIndent(row, false);
    expect(row.style.getPropertyValue("--ft-badges-indent")).toBe("");
  });

  it("starts the row at the info column on desktop", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    const row = document.querySelector<HTMLElement>("[data-ft-badges-row]")!;
    const info =
      document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!.parentElement!;
    row.getBoundingClientRect = () => rect(20, 800);
    info.getBoundingClientRect = () => rect(300, 600);

    applyBadgeIndent(row, true);
    expect(row.style.getPropertyValue("--ft-badges-indent")).toBe("280px");

    vi.unstubAllGlobals();
  });
});

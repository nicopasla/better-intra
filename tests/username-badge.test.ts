import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NAME_BADGE_SELECTOR } from "../src/features/profile/selectors";
import {
  usernameBadgeCss,
  usernameBadgeStylesheet,
  applyUsernameTitleLine,
  applyUsernameMarquee,
} from "../src/features/profile/visuals";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("NAME_BADGE_SELECTOR", () => {
  it("matches the username line of the profile header", () => {
    document.body.innerHTML = `
      <div class="flex flex-col justify-center gap-4">
        <h2 class="text-2xl font-bold text-center py-4 lg:text-left lg:py-0 drop-shadow-md">Grace Hopper</h2>
        <p class="text-sm">ghopper, Compiler Wizard</p>
      </div>`;
    const el = document.querySelector(NAME_BADGE_SELECTOR);
    expect(el?.textContent).toBe("ghopper, Compiler Wizard");
  });

  it("also matches when the header is nested one level deeper", () => {
    document.body.innerHTML = `
      <section class="flex flex-col justify-center gap-4">
        <div class="wrapper">
          <h2 class="text-2xl font-bold">Alan Turing</h2>
          <p class="text-sm">aturing, Enigma Breaker</p>
        </div>
      </section>`;
    const el = document.querySelector(NAME_BADGE_SELECTOR);
    expect(el?.textContent).toBe("aturing, Enigma Breaker");
  });
});

describe("usernameBadgeCss", () => {
  it("renders the default pill when no config is provided", () => {
    const css = usernameBadgeCss(undefined);
    expect(css).toContain("display: flex !important");
    expect(css).toContain("background-color: #00babc !important");
    expect(css).toContain("color: #ffffff !important");
    expect(css).toContain("border: 1px solid #00babc !important");
    expect(css).toContain("border-radius: 0.5rem !important");
  });

  it("applies custom colors, width and shape", () => {
    const css = usernameBadgeCss({
      bg: "#112233",
      text: "#abcdef",
      border: "#ff0000",
      borderWidth: 4,
      shape: "pill",
    });
    expect(css).toContain("background-color: #112233 !important");
    expect(css).toContain("color: #abcdef !important");
    expect(css).toContain("border: 4px solid #ff0000 !important");
    expect(css).toContain("border-radius: 9999px !important");
  });

  it("stacks the badge in a column when the title goes on a new line", () => {
    const css = usernameBadgeCss({ titleNewline: true });
    expect(css).toContain("flex-direction: column !important");
    expect(css).toContain("align-items: center !important");
  });

  it("adds the selected animation", () => {
    expect(usernameBadgeCss({ animation: "glow" })).toContain(
      "animation: ft-badge-glow 2s ease-in-out infinite !important",
    );
    expect(usernameBadgeCss({ animation: "pulse" })).toContain(
      "animation: ft-badge-pulse 1.6s ease-in-out infinite !important",
    );
    expect(usernameBadgeCss({ animation: "shimmer" })).toContain(
      "animation: ft-badge-shimmer 2.2s linear infinite !important",
    );
    expect(usernameBadgeCss({ animation: "none" })).not.toContain("animation:");
  });

  it("applies padding (vertical, then double horizontally)", () => {
    expect(usernameBadgeCss({})).toContain("padding: 4px 8px !important");
    expect(usernameBadgeCss({ padding: 10 })).toContain(
      "padding: 10px 20px !important",
    );
  });

  it("emits a ::after rule only for pseudo-element animations", () => {
    const ring = usernameBadgeStylesheet("#badge", { animation: "ping" });
    expect(ring).toContain('content: ""');
    expect(ring).toContain("ft-badge-ping");

    const glow = usernameBadgeStylesheet("#badge", { animation: "glow" });
    expect(glow).not.toContain('content: ""');
    expect(glow).toContain("ft-badge-glow");
  });

  it("renders the default badge when none is provided", () => {
    expect(usernameBadgeStylesheet("#badge", undefined)).toContain(
      "background-color: #00babc !important",
    );
  });
});

describe("applyUsernameTitleLine", () => {
  const header = (text: string) => `
    <div class="flex flex-col justify-center gap-4">
      <h2 class="text-2xl font-bold">Grace Hopper</h2>
      <p class="text-sm">${text}</p>
    </div>`;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("puts the text after the first comma on its own row", () => {
    document.body.innerHTML = header("ghopper, Compiler Wizard");
    applyUsernameTitleLine(true);

    const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
    const line = el.querySelector<HTMLElement>("[data-ft-title-line]")!;
    expect(line.textContent).toBe("Compiler Wizard");
    expect(line.style.display).toBe("block");
    expect(el.firstChild?.textContent).toBe("ghopper");
  });

  it("restores the original text when disabled", () => {
    document.body.innerHTML = header("ghopper, Compiler Wizard");
    applyUsernameTitleLine(true);
    applyUsernameTitleLine(false);

    const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
    expect(el.querySelector("[data-ft-title-line]")).toBeNull();
    expect(el.textContent).toBe("ghopper, Compiler Wizard");
  });

  it("does nothing when there is no comma", () => {
    document.body.innerHTML = header("ghopper");
    applyUsernameTitleLine(true);
    const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
    expect(el.querySelector("[data-ft-title-line]")).toBeNull();
    expect(el.textContent).toBe("ghopper");
  });

  describe("with a page login", () => {
    afterEach(() => window.history.replaceState({}, "", "/"));

    it("splits username from the title without a comma", () => {
      window.history.replaceState({}, "", "/users/ghopper");
      document.body.innerHTML = header("ghopper Compiler Wizard");
      applyUsernameTitleLine(true);

      const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
      expect(el.firstChild?.textContent).toBe("ghopper");
      expect(
        el.querySelector<HTMLElement>("[data-ft-title-line]")?.textContent,
      ).toBe("Compiler Wizard");
    });

    it("handles the username appearing after the title", () => {
      window.history.replaceState({}, "", "/users/ghopper");
      document.body.innerHTML = header("Compiler Wizard ghopper");
      applyUsernameTitleLine(true);

      const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
      expect(el.firstChild?.textContent).toBe("Compiler Wizard");
      expect(
        el.querySelector<HTMLElement>("[data-ft-title-line]")?.textContent,
      ).toBe("ghopper");
    });

    it("does not match the login inside another word", () => {
      window.history.replaceState({}, "", "/users/ann");
      document.body.innerHTML = header("Johanna");
      applyUsernameTitleLine(true);
      const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
      expect(el.querySelector("[data-ft-title-line]")).toBeNull();
    });
  });
});

describe("applyUsernameMarquee", () => {
  const header = `
    <div class="flex flex-col justify-center gap-4">
      <h2 class="text-2xl font-bold">Grace Hopper</h2>
      <p class="text-sm">ghopper, Compiler Wizard</p>
    </div>`;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("wraps the badge content in a translating inner span", () => {
    document.body.innerHTML = header;
    applyUsernameMarquee(true);

    const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
    const inner = el.querySelector<HTMLElement>("[data-ft-marquee-inner]")!;
    expect(inner).not.toBeNull();
    expect(inner.textContent).toBe("ghopper, Compiler Wizard");
    // content moved into the wrapper, wrapper is the only child
    expect(el.children.length).toBe(1);
  });

  it("unwraps and restores the original content", () => {
    document.body.innerHTML = header;
    applyUsernameMarquee(true);
    applyUsernameMarquee(false);

    const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR)!;
    expect(el.querySelector("[data-ft-marquee-inner]")).toBeNull();
    expect(el.textContent).toBe("ghopper, Compiler Wizard");
  });

  it("is idempotent", () => {
    document.body.innerHTML = header;
    applyUsernameMarquee(true);
    const first = document.querySelector("[data-ft-marquee-inner]");
    applyUsernameMarquee(true);
    expect(document.querySelectorAll("[data-ft-marquee-inner]").length).toBe(1);
    expect(document.querySelector("[data-ft-marquee-inner]")).toBe(first);
  });
});

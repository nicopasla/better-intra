import { describe, it, expect, beforeEach } from "vitest";
import {
  injectCampusFlag,
  initCampusFlag,
} from "../src/features/profile/campus-flags";

const row = (name: string) => `
  <div class="flex flex-col justify-center gap-4">
    <div class="text-white">${name}</div>
    <svg id="pin"></svg>
  </div>`;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("injectCampusFlag", () => {
  it("replaces the pin with the campus emoji", () => {
    document.body.innerHTML = row("Paris");
    injectCampusFlag();
    expect(document.querySelector("#pin")).toBeNull();
    expect(document.body.textContent).toContain("🇫🇷");
    expect(
      document.querySelector<HTMLElement>(".text-white")!.dataset.ftCampusName,
    ).toBe("Paris");
  });

  it("does not add a second emoji when run again", () => {
    document.body.innerHTML = row("Paris");
    injectCampusFlag();
    injectCampusFlag();
    expect((document.body.textContent!.match(/🇫🇷/g) || []).length).toBe(1);
  });

  it("leaves an unknown campus untouched", () => {
    document.body.innerHTML = row("Nowhere");
    injectCampusFlag();
    expect(document.querySelector("#pin")).not.toBeNull();
    expect(document.body.textContent).not.toContain("🇫🇷");
  });

  it("re-injects when the row is re-rendered", () => {
    document.body.innerHTML = row("Paris");
    injectCampusFlag();
    document.body.innerHTML = row("Paris");
    injectCampusFlag();
    expect(document.querySelector("#pin")).toBeNull();
    expect(document.body.textContent).toContain("🇫🇷");
  });
});

describe("initCampusFlag", () => {
  it("flags the campus once the header renders", async () => {
    const stop = initCampusFlag();
    document.body.innerHTML = row("Lyon");
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("#pin")).toBeNull();
    expect(document.body.textContent).toContain("🇫🇷");
    stop();
  });
});

/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { initSelectionGuard } from "../src/utils/selection-guard.ts";

/** One press starting at `target`, then a selection attempt on the body. */
function press(target: Element): boolean {
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  const start = new Event("selectstart", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(start);
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return start.defaultPrevented;
}

beforeEach(() => {
  document.body.innerHTML = "";
  initSelectionGuard();
});

describe("selection guard", () => {
  it("blocks the selection drag started outside an open dialog", () => {
    document.body.innerHTML = `
      <div role="dialog"><p>content</p></div>
      <main><p id="behind">behind the dialog</p></main>`;

    expect(press(document.getElementById("behind")!)).toBe(true);
  });

  it("treats the backdrop as outside even inside a portal wrapper", () => {
    document.body.innerHTML = `
      <div id="portal">
        <div role="dialog"><p>content</p></div>
        <div id="backdrop">backdrop</div>
      </div>`;

    expect(press(document.getElementById("backdrop")!)).toBe(true);
  });

  it("allows selecting text inside the dialog", () => {
    document.body.innerHTML = `
      <div role="dialog"><p id="inside">content</p></div>`;

    expect(press(document.getElementById("inside")!)).toBe(false);
  });

  it("does nothing when no dialog is open", () => {
    document.body.innerHTML = `<main><p id="page">page</p></main>`;

    expect(press(document.getElementById("page")!)).toBe(false);
  });
});

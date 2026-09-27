import { describe, it, expect } from "vitest";
import { moveItem, mergeVisibleOrder } from "../src/utils/sortable";

describe("moveItem", () => {
  it("moves an item forward", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns a copy and leaves the source untouched", () => {
    const source = ["a", "b", "c"];
    const result = moveItem(source, 0, 2);
    expect(source).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(source);
  });

  it("keeps the same order when from === to", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
});

describe("mergeVisibleOrder", () => {
  it("keeps hidden entries pinned while visible ones change", () => {
    const order = ["a", "-b", "c", "d"];
    const visible = ["d", "a", "c"];
    expect(mergeVisibleOrder(order, visible)).toEqual(["d", "-b", "a", "c"]);
  });

  it("returns the visible order when nothing is hidden", () => {
    expect(mergeVisibleOrder(["a", "b", "c"], ["c", "b", "a"])).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

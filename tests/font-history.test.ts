import { describe, it, expect } from "vitest";
import { addFontToHistory, type ImportedFontEntry } from "../src/utils/fonts";

describe("addFontToHistory", () => {
  const entry = (name: string): ImportedFontEntry => ({
    name,
    dataUri: `data:font/woff2;base64,${name}`,
  });

  it("prepends a new entry to an empty history", () => {
    expect(addFontToHistory([], entry("Roboto.ttf"))).toEqual([
      entry("Roboto.ttf"),
    ]);
  });

  it("prepends and deduplicates by file name", () => {
    const history = [entry("A.ttf"), entry("B.ttf")];
    expect(addFontToHistory(history, entry("B.ttf"))).toEqual([
      entry("B.ttf"),
      entry("A.ttf"),
    ]);
  });

  it("keeps at most 3 entries", () => {
    const history = [entry("A.ttf"), entry("B.ttf"), entry("C.ttf")];
    expect(addFontToHistory(history, entry("D.ttf"))).toEqual([
      entry("D.ttf"),
      entry("A.ttf"),
      entry("B.ttf"),
    ]);
  });

  it("does not grow beyond max when duplicated", () => {
    const history = [entry("A.ttf"), entry("B.ttf"), entry("C.ttf")];
    expect(addFontToHistory(history, entry("A.ttf"))).toEqual([
      entry("A.ttf"),
      entry("B.ttf"),
      entry("C.ttf"),
    ]);
  });

  it("ignores empty entries", () => {
    expect(addFontToHistory([entry("A.ttf")], entry(""))).toEqual([
      entry("A.ttf"),
    ]);
    expect(
      addFontToHistory([entry("A.ttf")], { name: "x.ttf", dataUri: "" }),
    ).toEqual([entry("A.ttf")]);
  });
});

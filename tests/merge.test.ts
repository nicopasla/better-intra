import { describe, it, expect } from "vitest";
import { mergeSettings } from "../src/features/account/merge.ts";

describe("mergeSettings", () => {
  it("applies cloud-only changes and keeps local-only changes", () => {
    const base = { a: 1, b: 1 };
    const local = { a: 1, b: 2 };
    const cloud = { a: 3, b: 1 };
    const { apply, conflicts } = mergeSettings(base, local, cloud);
    expect(apply).toEqual({ a: 3 });
    expect(conflicts).toEqual([]);
  });

  it("flags a conflict when both sides changed the same key", () => {
    const base = { a: 1 };
    const local = { a: 2 };
    const cloud = { a: 3 };
    const { apply, conflicts } = mergeSettings(base, local, cloud);
    expect(apply).toEqual({});
    expect(conflicts).toEqual(["a"]);
  });

  it("does nothing when values already match", () => {
    const base = { a: 1 };
    const { apply, conflicts } = mergeSettings(base, { a: 1 }, { a: 1 });
    expect(apply).toEqual({});
    expect(conflicts).toEqual([]);
  });

  it("fills missing keys from the cloud on first run (no baseline)", () => {
    const { apply, conflicts } = mergeSettings(
      null,
      { a: 1 },
      { a: 2, b: 3 },
    );
    expect(apply).toEqual({ b: 3 });
    expect(conflicts).toEqual([]);
  });

  it("treats null and undefined as equal", () => {
    const base = { a: null };
    const { apply, conflicts } = mergeSettings(base, { a: null }, {});
    expect(apply).toEqual({});
    expect(conflicts).toEqual([]);
  });

  it("ignores object key order", () => {
    const base = { a: { x: 1, y: 2 } };
    const local = { a: { y: 2, x: 1 } };
    const cloud = { a: { x: 1, y: 2 } };
    const { apply, conflicts } = mergeSettings(base, local, cloud);
    expect(apply).toEqual({});
    expect(conflicts).toEqual([]);
  });
});

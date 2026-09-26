import { describe, it, expect } from "vitest";
import { diffSettings } from "../src/features/account/conflict-dialog.ts";

describe("diffSettings", () => {
  it("returns only settings that differ", () => {
    const diff = diffSettings(
      { PROFILE_THEME_PRESET: "dark", ADVANCED_OPEN_LINKS_NEW_TAB: true },
      { PROFILE_THEME_PRESET: "nord", ADVANCED_OPEN_LINKS_NEW_TAB: true },
    );
    expect(diff.map((d) => d.key)).toEqual(["PROFILE_THEME_PRESET"]);
    expect(diff[0].local).toBe("dark");
    expect(diff[0].cloud).toBe("nord");
  });

  it("ignores keys that are not part of the cloud sync set", () => {
    const diff = diffSettings(
      {},
      { SOMETHING_UNSYNCED: "x", PROFILE_THEME_PRESET: "light" },
    );
    expect(diff.map((d) => d.key)).toEqual(["PROFILE_THEME_PRESET"]);
  });

  it("treats null and undefined as equal", () => {
    const diff = diffSettings(
      { PROFILE_THEME_PRESET: null },
      { PROFILE_THEME_PRESET: undefined },
    );
    expect(diff).toEqual([]);
  });
});

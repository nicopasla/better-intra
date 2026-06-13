import { describe, it, expect, beforeEach } from "vitest";

// Replicating the getFriendsList parsing logic from friends.ts
// (which defensively handles string JSON, native arrays, and corrupt data)

function getFriendsList(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

describe("getFriendsList", () => {
  it("returns empty array for null input", () => {
    expect(getFriendsList(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(getFriendsList(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(getFriendsList("")).toEqual([]);
  });

  it("returns native array as-is", () => {
    expect(getFriendsList(["alice", "bob"])).toEqual(["alice", "bob"]);
  });

  it("parses JSON-stringified array from storage", () => {
    expect(getFriendsList('["alice","bob"]')).toEqual(["alice", "bob"]);
  });

  it("returns empty for malformed JSON", () => {
    expect(getFriendsList("{broken")).toEqual([]);
  });

  it("returns empty for non-array parsed JSON", () => {
    expect(getFriendsList("{}")).toEqual([]);
  });

  it("returns empty for a number", () => {
    expect(getFriendsList(42)).toEqual([]);
  });

  it("handles empty JSON array", () => {
    expect(getFriendsList("[]")).toEqual([]);
  });
});

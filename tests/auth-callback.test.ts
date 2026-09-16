import { describe, it, expect, beforeEach } from "vitest";
import {
  AUTH_FLOW_TTL_MS,
  consumeAuthFlow,
  isAuthFlowFresh,
  markAuthFlowPending,
} from "../src/features/account/auth-callback";

beforeEach(() => {
  (chrome.storage.local.clear as any)();
});

describe("isAuthFlowFresh", () => {
  it("rejects missing or non-numeric markers", () => {
    expect(isAuthFlowFresh(undefined)).toBe(false);
    expect(isAuthFlowFresh(null)).toBe(false);
    expect(isAuthFlowFresh("123")).toBe(false);
    expect(isAuthFlowFresh(NaN)).toBe(false);
  });

  it("accepts a marker inside the TTL", () => {
    const now = 1_000_000;
    expect(isAuthFlowFresh(now - 1000, now)).toBe(true);
    expect(isAuthFlowFresh(now - AUTH_FLOW_TTL_MS, now)).toBe(true);
  });

  it("rejects expired or future markers", () => {
    const now = 1_000_000;
    expect(isAuthFlowFresh(now - AUTH_FLOW_TTL_MS - 1, now)).toBe(false);
    expect(isAuthFlowFresh(now + 5000, now)).toBe(false);
  });
});

describe("consumeAuthFlow", () => {
  it("returns false when no flow was started (crafted callback link)", async () => {
    expect(await consumeAuthFlow("cloud")).toBe(false);
    expect(await consumeAuthFlow("discord")).toBe(false);
  });

  it("returns true once after markAuthFlowPending, then false", async () => {
    await markAuthFlowPending("cloud");
    expect(await consumeAuthFlow("cloud")).toBe(true);
    expect(await consumeAuthFlow("cloud")).toBe(false);
  });

  it("does not let a cloud login authorise a discord callback", async () => {
    await markAuthFlowPending("cloud");
    expect(await consumeAuthFlow("discord")).toBe(false);
  });

  it("rejects a marker older than the TTL", async () => {
    await markAuthFlowPending("discord");
    const later = Date.now() + AUTH_FLOW_TTL_MS + 1;
    expect(await consumeAuthFlow("discord", later)).toBe(false);
  });
});
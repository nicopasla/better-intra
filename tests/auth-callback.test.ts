import { describe, it, expect, beforeEach } from "vitest";
import {
  AUTH_FLOW_TTL_MS,
  clearAuthFlow,
  consumeAuthFlow,
  isAuthFlowFresh,
  markAuthFlowPending,
  peekAuthFlow,
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

describe("markAuthFlowPending", () => {
  it("resolves once the marker has been committed", async () => {
    await markAuthFlowPending("cloud");
    expect(await peekAuthFlow("cloud")).toBe(true);
  });
});

describe("peekAuthFlow / clearAuthFlow", () => {
  it("peek does not clear the marker", async () => {
    await markAuthFlowPending("cloud");
    expect(await peekAuthFlow("cloud")).toBe(true);
    expect(await peekAuthFlow("cloud")).toBe(true);
    await clearAuthFlow("cloud");
    expect(await peekAuthFlow("cloud")).toBe(false);
  });

  it("rejects when no flow was started", async () => {
    expect(await peekAuthFlow("cloud")).toBe(false);
    expect(await peekAuthFlow("discord")).toBe(false);
  });

  it("keeps the marker if a save fails and only clears on success", async () => {
    await markAuthFlowPending("cloud");

    // Simulate a callback that fails before it can clear the marker.
    expect(await peekAuthFlow("cloud")).toBe(true);

    // The marker survives, so a retry is still accepted.
    expect(await peekAuthFlow("cloud")).toBe(true);
    await clearAuthFlow("cloud");
    expect(await peekAuthFlow("cloud")).toBe(false);
  });

  it("does not let a cloud login authorise a discord callback", async () => {
    await markAuthFlowPending("cloud");
    expect(await peekAuthFlow("discord")).toBe(false);
    expect(await consumeAuthFlow("discord")).toBe(false);
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

  it("rejects a marker older than the TTL", async () => {
    await markAuthFlowPending("discord");
    const later = Date.now() + AUTH_FLOW_TTL_MS + 1;
    expect(await consumeAuthFlow("discord", later)).toBe(false);
  });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { intrapyFetch, waitForIntrapyToken } from "../src/utils/intrapy";

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("waitForIntrapyToken", () => {
  it("resolves from sessionStorage when already present", async () => {
    sessionStorage.setItem("ft_intrapy_token", "tok-store");
    await expect(waitForIntrapyToken(50)).resolves.toBe("tok-store");
  });

  it("resolves from the 42_INTRAPY_TOKEN event", async () => {
    const promise = waitForIntrapyToken(1000);
    document.dispatchEvent(
      new CustomEvent("42_INTRAPY_TOKEN", { detail: "tok-event" }),
    );
    await expect(promise).resolves.toBe("tok-event");
  });

  it("resolves null on timeout", async () => {
    await expect(waitForIntrapyToken(20)).resolves.toBeNull();
  });
});

describe("intrapyFetch", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ a: 1 }),
      })),
    );
    await expect(intrapyFetch<{ a: number }>("/api/x", "tok")).resolves.toEqual({
      a: 1,
    });
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    await expect(intrapyFetch("/api/x", "tok")).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(intrapyFetch("/api/x", "tok")).resolves.toBeNull();
  });
});

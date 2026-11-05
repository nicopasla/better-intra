import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config.ts", () => ({
  getConfig: vi.fn(),
}));
vi.mock("../src/utils/worker.ts", () => ({
  workerFetch: vi.fn(),
}));
vi.mock("../src/utils/crypto.ts", () => ({
  hashLogin: vi.fn(async (login: string) => `hash-${login}`),
}));

import { getConfig } from "../src/config.ts";
import { workerFetch } from "../src/utils/worker.ts";
import {
  blockingSeatCount,
  getComponentStatus,
  getComponentStatusByKey,
  getMinorSeatIssues,
  getSeatSeverity,
  getSeatSeverityByKey,
  loadSeatReports,
  reportedSeatCounts,
  submitSeatReports,
} from "../src/features/clusters/map-dialog/reports";
import { removeStaticCrosses } from "../src/features/clusters/map-dialog/seats";

const seats = [
  {
    host: "fu-r1-p1",
    cluster: "fu",
    components: [
      {
        component: "boot",
        status: "broken",
        updatedAt: 1,
        confirmations: 1,
        reporter: "alice",
      },
      {
        component: "usbc",
        status: "works",
        updatedAt: 1,
        confirmations: 1,
        reporter: "alice",
      },
    ],
  },
  {
    host: "fu-r1-p2",
    cluster: "fu",
    components: [
      {
        component: "keyboard",
        status: "broken",
        updatedAt: 1,
        confirmations: 1,
        reporter: "bob",
      },
    ],
  },
];

function mockAuth(enabled = true): void {
  vi.mocked(getConfig).mockImplementation((async (key: string) => {
    if (!enabled) return "";
    if (key === "CLOUD_TOKEN") return "token";
    if (key === "CLOUD_LOGIN") return "login";
    return "";
  }) as never);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
  vi.mocked(workerFetch).mockResolvedValue(
    jsonResponse({ seats, updatedAt: Date.now() }),
  );
});

describe("seat report state", () => {
  it("loads and splits blocking, minor and presence statuses", async () => {
    expect(await loadSeatReports()).toBe(true);

    expect(getSeatSeverity("fu-r1-p1")).toBe("blocking");
    expect(getSeatSeverityByKey("fur1p1")).toBe("blocking");
    expect(getSeatSeverity("fu-r1-p2")).toBe("minor");
    expect(getComponentStatus("fu-r1-p1", "boot")?.status).toBe("broken");
    expect(getComponentStatusByKey("fur1p1", "usbc")?.status).toBe("works");
    expect(blockingSeatCount(["fur1p1", "fur1p2"])).toBe(1);
    expect(reportedSeatCounts(["fur1p1", "fur1p2"])).toEqual({
      blocking: 1,
      minor: 1,
    });
    expect(getMinorSeatIssues("fu-r1-p1")).toEqual([]);
    expect(getMinorSeatIssues("fu-r1-p2")).toEqual(["keyboard"]);
  });

  it("lists every non-blocking defect for the warning glyph", async () => {
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seats: [
          {
            host: "fu-r3-p1",
            cluster: "fu",
            components: [
              {
                component: "mouse_scroll",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: "alice",
              },
              {
                component: "audio",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: "bob",
              },
              {
                component: "usbc",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: "alice",
              },
            ],
          },
        ],
        updatedAt: Date.now(),
      }),
    );
    await loadSeatReports();
    expect(getMinorSeatIssues("fu-r3-p1")).toEqual(["mouse_scroll", "audio"]);
  });

  it("treats a missing USB-C port as a presence answer, not a defect", async () => {
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seats: [
          {
            host: "fu-r2-p1",
            cluster: "fu",
            components: [
              {
                component: "usbc",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: null,
              },
            ],
          },
          {
            host: "fu-r2-p2",
            cluster: "fu",
            components: [
              {
                component: "usbc",
                status: "works",
                updatedAt: 1,
                confirmations: 1,
                reporter: null,
              },
            ],
          },
        ],
        updatedAt: Date.now(),
      }),
    );
    await loadSeatReports();
    expect(getSeatSeverity("fu-r2-p1")).toBeNull();
    expect(getSeatSeverity("fu-r2-p2")).toBeNull();
    expect(blockingSeatCount(["fur2p1", "fur2p2"])).toBe(0);
  });

  it("crosses an anonymous Power failure when there is no USB-C confirmation", async () => {
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seats: [
          {
            host: "shi-r11-p2",
            cluster: "shi",
            components: [
              {
                component: "boot",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: null,
              },
            ],
          },
        ],
        updatedAt: Date.now(),
      }),
    );
    await loadSeatReports();
    expect(getSeatSeverity("shi-r11-p2")).toBe("blocking");
    expect(blockingSeatCount(["shir11p2"])).toBe(1);
  });

  it("ignores an anonymous Power row when the seat has a signed-in USB-C Yes", async () => {
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seats: [
          {
            host: "shi-r11-p2",
            cluster: "shi",
            components: [
              {
                component: "boot",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: null,
              },
              {
                component: "usbc",
                status: "works",
                updatedAt: 2,
                confirmations: 1,
                reporter: "alice",
              },
            ],
          },
        ],
        updatedAt: Date.now(),
      }),
    );
    await loadSeatReports();
    expect(getSeatSeverity("shi-r11-p2")).toBeNull();
    expect(blockingSeatCount(["shir11p2"])).toBe(0);
  });

  it("still crosses a tracked Power failure", async () => {
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seats: [
          {
            host: "shi-r11-p2",
            cluster: "shi",
            components: [
              {
                component: "boot",
                status: "broken",
                updatedAt: 1,
                confirmations: 1,
                reporter: "alice",
              },
            ],
          },
        ],
        updatedAt: Date.now(),
      }),
    );
    await loadSeatReports();
    expect(getSeatSeverity("shi-r11-p2")).toBe("blocking");
    expect(blockingSeatCount(["shir11p2"])).toBe(1);
  });

  it("hides reports when there is no cloud session", async () => {
    mockAuth(false);
    expect(await loadSeatReports()).toBe(false);
    expect(getSeatSeverity("fu-r1-p1")).toBeNull();
  });

  it("hides reports when the session is rejected", async () => {
    vi.mocked(workerFetch).mockResolvedValue(jsonResponse({}, 401));
    expect(await loadSeatReports()).toBe(false);
    expect(getSeatSeverity("fu-r1-p1")).toBeNull();
  });
});

describe("removeStaticCrosses", () => {
  it("drops the builder's hand-maintained crossed seats", () => {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <g class="crosses"><path class="cross" d="M0 0 L10 10"/></g>
        <path class="cross" d="M1 1 L9 9"/>
        <image id="fu-r1-p1"/>
      </svg>`,
      "image/svg+xml",
    );

    removeStaticCrosses(doc);

    expect(doc.querySelectorAll("g.crosses, path.cross")).toHaveLength(0);
    expect(doc.querySelector("image")).not.toBeNull();
  });
});

describe("submitSeatReports", () => {
  it("posts the component batch to the worker", async () => {
    await loadSeatReports();
    vi.mocked(workerFetch).mockClear();
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seat: {
          host: "fu-r1-p3",
          cluster: "fu",
          components: [
            {
              component: "network",
              status: "broken",
              updatedAt: 2,
              confirmations: 1,
              reporter: "login",
            },
          ],
        },
      }),
    );

    await submitSeatReports("fu-r1-p3", "fu", [
      { component: "network", status: "broken" },
    ]);

    const [path, options] = vi.mocked(workerFetch).mock.calls[0];
    expect(path).toContain("/api/v1/private/cluster/reports");
    expect(path).toContain("login=hash-login");
    expect(options?.method).toBe("POST");
    expect(options?.body).toEqual({
      host: "fu-r1-p3",
      cluster: "fu",
      reports: [{ component: "network", status: "broken" }],
    });
    expect(getSeatSeverity("fu-r1-p3")).toBe("blocking");
  });

  it("does not cross a seat when only USB-C Yes is reported", async () => {
    await loadSeatReports();
    vi.mocked(workerFetch).mockClear();
    vi.mocked(workerFetch).mockResolvedValue(
      jsonResponse({
        seat: {
          host: "fu-r3-p1",
          cluster: "fu",
          components: [
            {
              component: "usbc",
              status: "works",
              updatedAt: 2,
              confirmations: 1,
              reporter: "login",
            },
          ],
        },
      }),
    );

    await submitSeatReports("fu-r3-p1", "fu", [
      { component: "usbc", status: "works" },
    ]);

    const [, options] = vi.mocked(workerFetch).mock.calls[0];
    expect(options?.body).toEqual({
      host: "fu-r3-p1",
      cluster: "fu",
      reports: [{ component: "usbc", status: "works" }],
    });
    expect(getSeatSeverity("fu-r3-p1")).toBeNull();
    expect(blockingSeatCount(["fur3p1"])).toBe(0);
  });
});

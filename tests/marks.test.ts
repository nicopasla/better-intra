import { describe, it, expect } from "vitest";
import {
  renderStatusIcon,
  createChevronElement,
  createProjectLink,
  createTeamRow,
} from "../src/features/profile/marks";

describe("renderStatusIcon", () => {
  it("sets green class and renders check SVG for validated", () => {
    const c = document.createElement("div");
    renderStatusIcon(c, true);
    expect(c.className).toBe("text-green-500");
    expect(c.querySelector(".lucide-check")).toBeTruthy();
    expect(c.querySelector(".lucide-x")).toBeNull();
  });

  it("sets red class and renders X SVG for failed", () => {
    const c = document.createElement("div");
    renderStatusIcon(c, false);
    expect(c.className).toBe("text-red-500");
    expect(c.querySelector(".lucide-x")).toBeTruthy();
    expect(c.querySelector(".lucide-check")).toBeNull();
  });
});

describe("createChevronElement", () => {
  it("returns an SVG element with correct attributes", () => {
    const el = createChevronElement();
    expect(el.tagName.toLowerCase()).toBe("svg");
    expect(el.getAttribute("width")).toBe("18");
    expect(el.getAttribute("height")).toBe("18");
    expect(el.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(el.classList.contains("lucide-chevron-down")).toBe(true);
  });

  it("contains a polyline child", () => {
    const el = createChevronElement();
    const polyline = el.querySelector("polyline");
    expect(polyline).toBeTruthy();
    expect(polyline!.getAttribute("points")).toBe("6 9 12 15 18 9");
  });
});

describe("createProjectLink", () => {
  const mockProject = {
    projects_user_id: 12345,
    project_name: "ft_printf",
    project_slug: "ft_printf",
    final_mark: 100,
    last_event_date: "2024-01-15T10:00:00Z",
    is_validated: true,
    occurrence: 1,
    teams: [{ last_event_date: "", final_mark: 100, is_validated: true, occurrence: 1 }],
  };

  it("returns an anchor with correct href and text", () => {
    const link = createProjectLink(mockProject);
    expect(link.tagName).toBe("A");
    expect(link.href).toContain("ft_printf/projects_users/12345");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noreferrer");
    expect(link.textContent).toBe("ft_printf");
  });

  it("includes occurrence number when multiple teams", () => {
    const multi = { ...mockProject, teams: [{}, {}] as any, occurrence: 3 };
    const link = createProjectLink(multi);
    expect(link.textContent).toBe("ft_printf #3");
  });
});

describe("createTeamRow", () => {
  const mockProject = {
    projects_user_id: 1,
    project_name: "ft_printf",
    project_slug: "ft_printf",
    final_mark: 100,
    last_event_date: "2024-01-15",
    is_validated: true,
    occurrence: 1,
    teams: [] as any[],
  };
  const mockTeam = {
    occurrence: 2,
    last_event_date: "2024-01-20T10:00:00Z",
    final_mark: 85,
    is_validated: false,
  };

  it("returns a row with project occurrence label", () => {
    const row = createTeamRow(mockProject, mockTeam);
    expect(row.querySelector("span")?.textContent).toBe("ft_printf #2");
  });

  it("renders X icon for non-validated team", () => {
    const row = createTeamRow(mockProject, mockTeam);
    expect(row.querySelector(".lucide-x")).toBeTruthy();
  });
});

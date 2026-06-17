import { getConfig } from "../../config.ts";

type SortField = "name" | "date";

interface ProjectItem {
  wrapper: HTMLElement;
  score: number;
  name: string;
  dateMs: number;
  passed: boolean;
}

const HOST_ID = "better-intra-sort-host";

const FIELD_LABELS: Record<SortField, string> = {
  name: "Name",
  date: "Date",
};

const FIELD_DEFAULTS: Record<SortField, "asc" | "desc"> = {
  name: "asc",
  date: "desc",
};

const FIELD_VALUES: SortField[] = ["name", "date"];

const parseRelativeDate = (text: string | null): number => {
  if (!text) return 0;
  const lowered = text.trim().toLowerCase();
  const numMatch = lowered.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 0;
  if (lowered.includes("second")) return num * 1000;
  if (lowered.includes("minute")) return num * 60 * 1000;
  if (lowered.includes("hour")) return num * 3600 * 1000;
  if (lowered.includes("day")) return num * 86400 * 1000;
  if (lowered.includes("month")) return num * 30 * 86400 * 1000;
  if (lowered.includes("year")) return num * 365 * 86400 * 1000;
  return 0;
};

const makeSorter = (
  field: SortField,
  asc: boolean,
): ((a: ProjectItem, b: ProjectItem) => number) => {
  switch (field) {
    case "name":
      return asc
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b.name.localeCompare(a.name);
    case "date":
      return asc
        ? (a, b) => b.dateMs - a.dateMs
        : (a, b) => a.dateMs - b.dateMs;
  }
};

const extractItems = (panel: HTMLElement | null): ProjectItem[] => {
  if (!panel) return [];
  const rows = panel.querySelectorAll<HTMLElement>(
    ".flex.flex-row.justify-between.hover\\:bg-gray-300.p-2",
  );
  if (rows.length < 2) return [];

  const items: ProjectItem[] = [];
  const seen = new Set<HTMLElement>();
  for (const row of rows) {
    let wrapper: HTMLElement | null = row;
    while (
      wrapper &&
      wrapper.parentElement &&
      !wrapper.parentElement.classList.contains("gap-2")
    ) {
      wrapper = wrapper.parentElement;
    }
    if (!wrapper || seen.has(wrapper)) continue;
    seen.add(wrapper);

    const scoreEl =
      row.querySelector(".text-green-500") ??
      row.querySelector(".text-red-500");
    const scoreText = scoreEl?.parentElement?.textContent?.trim();
    const score = scoreText ? parseInt(scoreText) : 0;

    const name = row.querySelector("a")?.textContent?.trim() ?? "";

    const dateText = row.querySelector(".flex.flex-row.gap-1")?.childNodes;
    let dateStr = "";
    if (dateText) {
      for (const child of dateText) {
        if (child.nodeType === Node.TEXT_NODE) {
          dateStr = child.textContent?.trim() ?? "";
          break;
        }
      }
    }

    const dateMs = parseRelativeDate(dateStr);

    items.push({
      wrapper,
      score,
      name,
      dateMs,
      passed: !!row.querySelector(".text-green-500"),
    });
  }
  return items;
};

const buildSvg = (type: "up" | "down") => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const poly = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  poly.setAttribute(
    "points",
    type === "up" ? "18 15 12 9 6 15" : "6 9 12 15 18 9",
  );
  svg.appendChild(poly);
  return svg;
};

export async function initProjectsSort() {
  const enabled = await getConfig("PROFILE_PROJECTS_SORT");
  if (!enabled) return;

  const marksHeader = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".font-bold.text-black.uppercase.text-sm",
    ),
  ).find((el) => el.textContent?.trim() === "Marks");
  if (!marksHeader) return;

  const panel = marksHeader.closest<HTMLElement>(".bg-white");
  if (extractItems(panel).length < 2) return;

  const marksTab = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".cursor-pointer.text-xs.uppercase.font-bold",
    ),
  ).find((el) => el.textContent?.trim() === "Marks");
  const sidebar = marksTab?.parentElement;
  if (!sidebar) return;

  if (sidebar.querySelector(`#${HOST_ID}`)) return;

  const host = document.createElement("span");
  host.id = HOST_ID;
  host.style.display = "block";
  host.style.width = "100%";
  const root = host.attachShadow({ mode: "open" });

  let field: SortField = "date";
  let asc = false;

  const style = document.createElement("style");
  const updateStyle = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const fg = isDark ? "#f9fafb" : "#111827";
    style.textContent = `
      .wrap {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      select {
        font-size: 0.75rem;
        line-height: 1rem;
        border: 1px solid ${isDark ? "#4b5563" : "#d1d5db"};
        border-radius: 0.25rem;
        padding: 0.125rem 0.25rem;
        background: ${isDark ? "#1f2937" : "white"};
        color: ${fg};
        outline: none;
        cursor: pointer;
        width: 100%;
        appearance: none;
      }
      .chevron {
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${fg};
        flex-shrink: 0;
        margin-left: -22px;
        pointer-events: none;
        width: 14px;
      }
    `;
  };
  updateStyle();

  const classObs = new MutationObserver(() => updateStyle());
  classObs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const wrap = document.createElement("div");
  wrap.className = "wrap";

  const select = document.createElement("select");

  const chevron = document.createElement("span");
  chevron.className = "chevron";

  const updateChevron = () => {
    chevron.replaceChildren(buildSvg(asc ? "up" : "down"));
  };

  const rebuildOptions = () => {
    select.replaceChildren();
    for (const f of FIELD_VALUES) {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = FIELD_LABELS[f];
      if (f === field) option.selected = true;
      select.appendChild(option);
    }
    updateChevron();
  };

  const applySort = () => {
    const items = extractItems(panel);
    if (items.length === 0) return;
    const sorter = makeSorter(field, asc);
    items.sort(sorter);

    const container = marksHeader
      .closest(".flex.flex-col.w-full.h-full")
      ?.querySelector<HTMLElement>(".flex.flex-col.gap-2");
    if (!container) return;

    for (const item of items) {
      container.appendChild(item.wrapper);
    }
    rebuildOptions();
  };

  select.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLOptionElement && target.value === field) {
      asc = !asc;
      applySort();
    }
  });

  select.addEventListener("change", () => {
    const newField = select.value as SortField;
    if (newField !== field) {
      field = newField;
      asc = FIELD_DEFAULTS[field] === "asc";
      applySort();
    }
  });

  wrap.appendChild(select);
  wrap.appendChild(chevron);
  root.appendChild(style);
  root.appendChild(wrap);
  sidebar.appendChild(host);

  applySort();
}

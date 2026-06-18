import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import { getCloudLogin } from "../account/account.ts";
import { INTRA_FONT } from "../logtime/constants.ts";

interface MarkedProject {
  projects_user_id: number;
  project_name: string;
  project_slug: string;
  final_mark: number;
  last_event_date: string;
  is_validated: boolean;
  occurrence: number;
  teams: {
    last_event_date: string;
    final_mark: number;
    is_validated: boolean;
    occurrence: number;
  }[];
}

const INJECTED_ID = "ft-marks-injected";

let marksCache: Record<string, MarkedProject[]> = {};
let marksInitialized = false;
let cachedToken: string | null = null;
let cachedLogin: string | null = null;

function waitForToken(timeout = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: CustomEvent) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(e.detail);
    };
    const cleanup = () => {
      document.removeEventListener(
        "42_INTRAPY_TOKEN",
        handler as EventListener,
      );
      clearTimeout(timer);
    };
    document.addEventListener("42_INTRAPY_TOKEN", handler as EventListener);

    const stored = sessionStorage.getItem("ft_intrapy_token");
    if (stored) {
      resolved = true;
      cleanup();
      resolve(stored);
      return;
    }

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const eventMidnight = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const days = Math.floor((todayMidnight - eventMidnight) / 86400000);
  const relative =
    days < 1 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  const real = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${relative} (${real})`;
}

function waitForCursusId(timeout = 10000): Promise<string> {
  return new Promise((resolve) => {
    const stored = sessionStorage.getItem("ft_active_cursus_id");
    if (stored) {
      resolve(stored);
      return;
    }

    let resolved = false;
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: CustomEvent) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(e.detail);
    };
    const cleanup = () => {
      document.removeEventListener("42_CURSUS_ID", handler as EventListener);
      clearTimeout(timer);
    };
    document.addEventListener("42_CURSUS_ID", handler as EventListener);

    timer = setTimeout(() => {
      cleanup();
      resolve("21");
    }, timeout);
  });
}

async function fetchMarks(
  login: string,
  token: string,
  cursusId: string,
): Promise<MarkedProject[]> {
  const url = `https://intrapy.intra.42.fr/api/v1/users/${login}/projects/marked?cursus_id=${cursusId}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: token },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MarkedProject[];
    return data.filter((p) => p.final_mark !== null);
  } catch {
    return [];
  }
}

function findProjectsCard(): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96");
  for (const card of cards) {
    const title = card.querySelector("[class*='uppercase']");
    if (title?.textContent?.trim().toUpperCase() === "PROJECTS") return card;
  }
  return null;
}

export function renderStatusIcon(
  container: HTMLElement,
  isValidated: boolean,
): void {
  container.className = isValidated ? "text-green-500" : "text-red-500";
  render(
    isValidated
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-check"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-x"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>`,
    container,
  );
}

export function createChevronElement(): SVGElement {
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("width", "18");
  chevron.setAttribute("height", "18");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "2");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");
  chevron.classList.add("lucide", "lucide-chevron-down");
  chevron.style.transition = "transform 0.2s";
  const polyline = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "polyline",
  );
  polyline.setAttribute("points", "6 9 12 15 18 9");
  chevron.appendChild(polyline);
  return chevron;
}

export function createProjectLink(project: MarkedProject): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `https://projects.intra.42.fr/projects/${project.project_slug}/projects_users/${project.projects_user_id}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.className = "text-legacy-main hover:underline text-xs";
  link.textContent =
    project.teams.length > 1
      ? `${project.project_name} #${project.occurrence}`
      : project.project_name;
  return link;
}

export function createTeamRow(
  project: MarkedProject,
  team: MarkedProject["teams"][0],
): HTMLElement {
  const row = document.createElement("div");
  row.className =
    "flex flex-row justify-between text-gray-400 hover:text-black hover:bg-gray-300 py-1 px-2";

  const left = document.createElement("div");
  left.className = "flex flex-row gap-1 items-center flex-1";
  const label = document.createElement("span");
  label.className = "text-xs";
  label.textContent = `${project.project_name} #${team.occurrence}`;
  left.appendChild(label);
  const date = document.createElement("span");
  date.className = "text-xs opacity-60";
  date.style.cssText =
    "margin-left: auto; min-width: 170px; text-align: right; flex-shrink: 0; margin-right: 12px;";
  date.textContent = formatDate(team.last_event_date);
  left.appendChild(date);
  row.appendChild(left);

  const right = document.createElement("p");
  right.className = "text-xs flex flex-row items-center gap-1";
  right.style.minWidth = "52px";
  const icon = document.createElement("div");
  renderStatusIcon(icon, team.is_validated);
  right.appendChild(icon);
  right.append(String(team.final_mark));
  row.appendChild(right);

  return row;
}

function injectMarks(marks: MarkedProject[], hasOngoing: boolean) {
  const existing = document.getElementById(INJECTED_ID);
  if (existing) existing.remove();

  const card = findProjectsCard();
  if (!card) return;

  const nativeUl = card.querySelector(".h-full ul");

  if (hasOngoing && nativeUl) {
    const nativeContainer = nativeUl.closest(".h-full");
    if (nativeContainer instanceof HTMLElement) {
      nativeContainer.style.display = "";
      nativeContainer.style.paddingTop = "8px";
      nativeContainer.style.maxHeight = "96px";
      nativeContainer.style.overflowY = "auto";
    }
    if (nativeUl instanceof HTMLElement) {
      nativeUl.style.display = "grid";
      nativeUl.style.gridAutoFlow = "column";
      nativeUl.style.gridTemplateRows = "repeat(2, auto)";
      nativeUl.style.gridTemplateColumns = "repeat(3, 1fr)";
      nativeUl.style.alignContent = "center";
      nativeUl.style.columnGap = "8px";
      nativeUl.style.rowGap = "0";
    }
  } else if (nativeUl && nativeUl.parentElement) {
    nativeUl.parentElement.style.display = "none";
  }

  const container = document.createElement("div");
  container.id = INJECTED_ID;
  container.style.cssText = hasOngoing
    ? `border-top: 1px solid rgba(128,128,128,0.2); margin-top: 0.25rem; padding: 0.25rem 8px 0 0; flex: 1; min-height: 0; overflow-y: auto; font-family: ${INTRA_FONT};`
    : `padding: 0.5rem 8px 0.5rem 0; flex: 1; font-family: ${INTRA_FONT};`;

  const list = document.createElement("div");
  list.className = "flex flex-col";

  if (!hasOngoing) {
    const header = document.createElement("div");
    header.className = "text-xs uppercase font-bold mb-1 opacity-60";
    header.textContent = "Finished projects";
    list.appendChild(header);
  }

  for (const project of marks) {
    if (project.teams && project.teams.length > 1) {
      const wrapper = document.createElement("div");
      wrapper.className = "w-full";

      const uid = `ft-teams-${project.projects_user_id}`;
      let expanded = false;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full text-xs";
      btn.style.fontWeight = "400";

      const row = document.createElement("div");
      row.className =
        "flex flex-row justify-between hover:bg-gray-300 py-1 px-2";

      const left = document.createElement("div");
      left.className = "flex flex-row gap-1 items-center flex-1";
      left.appendChild(createProjectLink(project));
      left.appendChild(createChevronElement());
      const time = document.createElement("span");
      time.className = "text-xs opacity-60";
      time.style.cssText =
        "margin-left: auto; min-width: 170px; text-align: right; flex-shrink: 0; margin-right: 12px;";
      time.textContent = formatDate(project.last_event_date);
      left.appendChild(time);
      row.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center";
      right.style.minWidth = "52px";
      const iconWrap = document.createElement("div");
      renderStatusIcon(iconWrap, project.is_validated);
      right.appendChild(iconWrap);
      const score = document.createElement("span");
      score.textContent = String(project.final_mark);
      right.appendChild(score);
      row.appendChild(right);
      btn.appendChild(row);
      wrapper.appendChild(btn);

      const panel = document.createElement("div");
      panel.id = uid;
      panel.style.display = "none";
      panel.style.padding = "0 0 0 12px";
      panel.style.borderTop = "1px solid rgba(128,128,128,0.1)";

      const sortedTeams = [...project.teams].sort(
        (a, b) => b.occurrence - a.occurrence,
      );
      for (const team of sortedTeams) {
        panel.appendChild(createTeamRow(project, team));
      }

      wrapper.appendChild(panel);

      const chevron = left.querySelector(".lucide-chevron-down") as HTMLElement;
      btn.onclick = (e) => {
        if (
          e.target instanceof HTMLAnchorElement ||
          (e.target as HTMLElement).closest("a")
        )
          return;
        e.preventDefault();
        expanded = !expanded;
        panel.style.display = expanded ? "block" : "none";
        if (chevron) chevron.style.transform = expanded ? "rotate(180deg)" : "";
      };

      list.appendChild(wrapper);
    } else {
      const item = document.createElement("div");
      item.className =
        "flex flex-row justify-between hover:bg-gray-300 py-1 px-2";

      const left = document.createElement("div");
      left.className = "flex flex-row gap-1 items-center flex-1";
      left.appendChild(createProjectLink(project));
      const time = document.createElement("span");
      time.className = "text-xs opacity-60";
      time.style.cssText =
        "margin-left: auto; min-width: 170px; text-align: right; flex-shrink: 0; margin-right: 12px;";
      time.textContent = formatDate(project.last_event_date);
      left.appendChild(time);
      item.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center";
      right.style.minWidth = "52px";
      const iconWrap = document.createElement("div");
      renderStatusIcon(iconWrap, project.is_validated);
      right.appendChild(iconWrap);
      const score = document.createElement("span");
      score.textContent = String(project.final_mark);
      right.appendChild(score);
      item.appendChild(right);
      list.appendChild(item);
    }
  }

  container.appendChild(list);

  const flexContainer = card.querySelector(".flex.flex-col") || card;
  flexContainer.appendChild(container);
}

async function tryInjectMarks(marks: MarkedProject[]) {
  const sortOrder = await getConfig("PROFILE_MARKS_SORT_ORDER");
  const sorted = [...marks].sort((a, b) => {
    const diff =
      new Date(a.last_event_date).getTime() -
      new Date(b.last_event_date).getTime();
    return sortOrder === "oldest_first" ? diff : -diff;
  });
  if (sorted.length === 0) return;

  let attempts = 0;
  const liWait = 8;
  const poll = () => {
    if (++attempts > 50) return;
    const c = findProjectsCard();
    if (!c) {
      requestAnimationFrame(poll);
      return;
    }
    const ul = c.querySelector(".h-full ul");
    const lis = ul?.querySelectorAll("li");
    const hasOngoing = !!(lis && lis.length > 0);
    if (!ul || hasOngoing || attempts >= liWait) {
      injectMarks(sorted, hasOngoing);
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

async function handleCursusSwitch(cursusId: string) {
  const login = cachedLogin;
  const token = cachedToken;
  if (!login || !token) return;

  if (!marksCache[cursusId]) {
    marksCache[cursusId] = await fetchMarks(login, token, cursusId);
  }
  await tryInjectMarks(marksCache[cursusId]);
}

function getLoginFromPage(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(
    'a[href^="https://projects.intra.42.fr/"]',
  );
  if (link) {
    const parts = link.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[href^="https://profile.intra.42.fr/users/"]',
  );
  if (profileLink) {
    const parts = profileLink.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  return null;
}

export async function initMarks() {
  if (marksInitialized) return;

  const showMarks = await getConfig("PROFILE_SHOW_MARKS");
  if (!showMarks) return;

  if (
    location.hostname !== "profile-v3.intra.42.fr" ||
    location.pathname !== "/"
  )
    return;

  const myLogin = (await getCloudLogin()) || getLoginFromPage();
  if (!myLogin) return;

  const token = await waitForToken(30000);
  if (!token) return;

  cachedLogin = myLogin;
  cachedToken = token;
  marksInitialized = true;

  document.addEventListener("42_CURSUS_ID", ((e: CustomEvent) => {
    const cursusId =
      e.detail || sessionStorage.getItem("ft_active_cursus_id") || "21";
    handleCursusSwitch(cursusId);
  }) as EventListener);

  const cursusId = await waitForCursusId(10000);
  if (!marksCache[cursusId]) {
    marksCache[cursusId] = await fetchMarks(myLogin, token, cursusId);
  }
  await tryInjectMarks(marksCache[cursusId]);
}

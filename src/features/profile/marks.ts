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

let initialized = false;
let cachedToken: string | null = null;
let marksCache: MarkedProject[] | null = null;

function waitForToken(timeout = 15000): Promise<string | null> {
  if (cachedToken) return Promise.resolve(cachedToken);

  const stored = sessionStorage.getItem("ft_intrapy_token");
  if (stored) {
    cachedToken = stored;
    return Promise.resolve(stored);
  }

  return new Promise((resolve) => {
    const handler = (e: CustomEvent) => {
      cachedToken = e.detail;
      cleanup();
      resolve(cachedToken);
    };
    const cleanup = () => {
      document.removeEventListener(
        "42_INTRAPY_TOKEN",
        handler as EventListener,
      );
    };
    document.addEventListener("42_INTRAPY_TOKEN", handler as EventListener);
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  const relative =
    days < 1 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  const real = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${relative} (${real})`;
}

async function fetchMarks(
  login: string,
  token: string,
): Promise<MarkedProject[]> {
  const url = `https://intrapy.intra.42.fr/api/v1/users/${login}/projects/marked?cursus_id=21`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: token },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MarkedProject[];
    return data
      .filter((p) => p.final_mark !== null)
      .sort(
        (a, b) =>
          new Date(b.last_event_date).getTime() -
          new Date(a.last_event_date).getTime(),
      );
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

function injectMarks(marks: MarkedProject[]) {
  const existing = document.getElementById(INJECTED_ID);
  if (existing) existing.remove();

  const card = findProjectsCard();
  if (!card) return;

  const nativeUl = card.querySelector(".h-full ul");
  if (nativeUl) {
    const nativeContainer = nativeUl.closest(".h-full");
    if (nativeContainer instanceof HTMLElement) {
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
  }

  const container = document.createElement("div");
  container.id = INJECTED_ID;
  container.style.cssText = `border-top: 1px solid rgba(128,128,128,0.2); margin-top: 0.25rem; padding: 0.25rem 8px 0 0; flex: 1; min-height: 0; overflow-y: auto; font-family: ${INTRA_FONT};`;

  const list = document.createElement("div");
  list.className = "flex flex-col";

  for (const project of marks) {
    const hasTeams = project.teams && project.teams.length > 1;

    if (hasTeams) {
      const wrapper = document.createElement("div");
      wrapper.className = "w-full";

      const uid = `ft-teams-${project.projects_user_id}`;
      let expanded = false;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full";

      const row = document.createElement("div");
      row.className =
        "flex flex-row justify-between hover:bg-gray-300 py-1 px-2";

      const left = document.createElement("div");
      left.className = "flex flex-row gap-1 items-center";

      const link = document.createElement("a");
      link.href = `https://projects.intra.42.fr/projects/${project.project_slug}/projects_users/${project.projects_user_id}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "text-legacy-main hover:underline text-xs";
      link.textContent =
        project.teams.length > 1
          ? `${project.project_name} #${project.occurrence}`
          : project.project_name;
      left.appendChild(link);

      const time = document.createElement("span");
      time.className = "text-xs opacity-60";
      time.textContent = formatDate(project.last_event_date);
      left.appendChild(time);

      const chevron = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
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
      left.appendChild(chevron);

      row.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center";

      const iconWrap = document.createElement("div");
      if (project.is_validated) {
        iconWrap.className = "text-green-500";
        render(
          html`<svg
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
          </svg>`,
          iconWrap,
        );
      } else {
        iconWrap.className = "text-red-500";
        render(
          html`<svg
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
          iconWrap,
        );
      }
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
      panel.style.padding = "0 12px";
      panel.style.borderTop = "1px solid rgba(128,128,128,0.1)";

      const sortedTeams = [...project.teams].sort(
        (a, b) => b.occurrence - a.occurrence,
      );
      for (const team of sortedTeams) {
        const tRow = document.createElement("div");
        tRow.className =
          "flex flex-row justify-between text-gray-400 hover:text-black hover:bg-gray-300 py-1 px-2";

        const tLeft = document.createElement("div");
        tLeft.className = "flex flex-row gap-1 items-center";
        const tLabel = document.createElement("span");
        tLabel.className = "text-xs";
        tLabel.textContent = `${project.project_name} #${team.occurrence}`;
        tLeft.appendChild(tLabel);
        const tDate = document.createElement("span");
        tDate.className = "text-xs opacity-60";
        tDate.textContent = formatDate(team.last_event_date);
        tLeft.appendChild(tDate);
        tRow.appendChild(tLeft);

        const tRight = document.createElement("p");
        tRight.className = "text-xs flex flex-row items-center gap-1";
        const tIcon = document.createElement("div");
        if (team.is_validated) {
          tIcon.className = "text-green-500";
          render(
            html`<svg
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
            </svg>`,
            tIcon,
          );
        } else {
          tIcon.className = "text-red-500";
          render(
            html`<svg
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
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>`,
            tIcon,
          );
        }
        tRight.appendChild(tIcon);
        tRight.append(String(team.final_mark));
        tRow.appendChild(tRight);

        panel.appendChild(tRow);
      }

      wrapper.appendChild(panel);

      btn.addEventListener("click", () => {
        expanded = !expanded;
        panel.style.display = expanded ? "block" : "none";
        chevron.style.transform = expanded ? "rotate(180deg)" : "";
      });

      list.appendChild(wrapper);
    } else {
      const item = document.createElement("div");
      item.className =
        "flex flex-row justify-between hover:bg-gray-300 py-1 px-2";

      const left = document.createElement("div");
      left.className = "flex flex-row gap-1 items-center";

      const link = document.createElement("a");
      link.href = `https://projects.intra.42.fr/projects/${project.project_slug}/projects_users/${project.projects_user_id}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "text-legacy-main hover:underline text-xs";
      link.textContent =
        project.teams.length > 1
          ? `${project.project_name} #${project.occurrence}`
          : project.project_name;
      left.appendChild(link);

      const time = document.createElement("span");
      time.className = "text-xs opacity-60";
      time.textContent = formatDate(project.last_event_date);
      left.appendChild(time);

      item.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center";

      const iconWrap = document.createElement("div");
      if (project.is_validated) {
        iconWrap.className = "text-green-500";
        render(
          html`<svg
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
          </svg>`,
          iconWrap,
        );
      } else {
        iconWrap.className = "text-red-500";
        render(
          html`<svg
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
          iconWrap,
        );
      }
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
  if (initialized) return;
  initialized = true;

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

  if (!marksCache) {
    marksCache = await fetchMarks(myLogin, token);
  }
  const marks = marksCache;
  if (marks.length === 0) return;

  const tryInject = () => {
    const card = findProjectsCard();
    if (card) {
      injectMarks(marks);
      return;
    }
    let attempts = 0;
    const poll = () => {
      if (++attempts > 50) return;
      const c = findProjectsCard();
      if (c) {
        injectMarks(marks);
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  };
  tryInject();
}

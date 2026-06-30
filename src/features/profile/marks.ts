import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import { getCloudLogin } from "../account/account.ts";
import { hashLogin } from "../../utils/crypto.ts";
import { INTRA_FONT } from "../logtime/constants.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

interface MarkedProject {
  projects_user_id: number;
  project_name: string;
  project_slug: string;
  final_mark: number;
  last_event_date: string;
  is_validated: boolean;
  occurrence: number;
  is_outstanding?: number;
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
let otherProfileRunning = false;
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

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + "Z");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
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

let outstandingCache: Record<number, number> | null = null;

async function fetchOutstandingProjects(
  targetLogin?: string,
  count?: number,
): Promise<Record<number, number>> {
  const cacheKey = targetLogin
    ? `OUTSTANDING_CACHE_${targetLogin}`
    : "OUTSTANDING_CACHE";
  const raw = (await chrome.storage.local.get(cacheKey))[cacheKey];
  if (raw && typeof raw === "string") {
    const parsed = JSON.parse(raw);
    const age = Date.now() - parsed.fetchedAt;
    if (age < 12 * 60 * 60 * 1000 && count === parsed.count) {
      if (!targetLogin) outstandingCache = parsed.ids;
      return parsed.ids;
    }
  }

  const cloudLogin = await getCloudLogin();
  const sessionToken = await getConfig("CLOUD_TOKEN");
  if (!cloudLogin || !sessionToken) {
    return targetLogin ? {} : outstandingCache || {};
  }

  const hashedLogin = await hashLogin(cloudLogin);
  try {
    let url = `${WORKER_URL}/api/v1/private/outstanding?login=${encodeURIComponent(hashedLogin)}`;
    if (targetLogin) {
      url += `&target=${encodeURIComponent(targetLogin)}`;
      if (count !== undefined) url += `&count=${count}`;
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) {
      return targetLogin ? {} : outstandingCache || {};
    }

    const data = (await res.json()) as { ids: Record<number, number> };
    const ids: Record<number, number> = {};
    for (const [key, c] of Object.entries(data.ids || {})) {
      ids[Number(key)] = c;
    }
    await chrome.storage.local.set({
      [cacheKey]: JSON.stringify({
        ids,
        count,
        fetchedAt: Date.now(),
      }),
    });
    if (!targetLogin) outstandingCache = ids;
    return ids;
  } catch (err) {
    return targetLogin ? {} : outstandingCache || {};
  }
}

async function fetchMarks(
  login: string,
  token: string,
  cursusId: string,
  targetLogin?: string,
): Promise<MarkedProject[]> {
  const url = `https://intrapy.intra.42.fr/api/v1/users/${login}/projects/marked?cursus_id=${cursusId}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: token },
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as MarkedProject[];
    const filtered = data.filter((p) => p.final_mark !== null);
    const outstanding = await fetchOutstandingProjects(
      targetLogin,
      filtered.length,
    );
    const outstandingCount = Object.keys(outstanding).length;
    let starredCount = 0;
    for (const p of filtered) {
      const oc = outstanding[p.projects_user_id];
      if (oc) {
        p.is_outstanding = oc;
        starredCount++;
      }
    }
    return filtered;
  } catch (err) {
    return [];
  }
}

function findCard(title: "PROJECTS" | "MARKS"): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96");
  for (const card of cards) {
    const titleEl = card.querySelector("[class*='uppercase']");
    const text = titleEl?.textContent?.trim();
    if (text?.toUpperCase() === title) {
      return card;
    }
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

  const card = findCard("PROJECTS");
  if (!card) {
    return;
  }

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
    ? `border-top: 1px solid hsl(var(--border)); margin-top: 0.25rem; padding: 0.25rem 8px 0 0; flex: 1; min-height: 0; overflow-y: auto; font-family: ${INTRA_FONT};`
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
      if (project.is_outstanding) {
        const star = document.createElement("span");
        star.className = "text-xs";
        star.textContent = "⭐".repeat(project.is_outstanding);
        left.appendChild(star);
      }
      left.appendChild(createChevronElement());
      row.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center gap-2";
      right.style.minWidth = "52px";
      const time = document.createElement("span");
      time.className = "opacity-50";
      time.textContent = formatDate(project.last_event_date);
      right.appendChild(time);
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
      panel.style.borderTop = "1px solid hsl(var(--border))";

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
      if (project.is_outstanding) {
        const star = document.createElement("span");
        star.className = "text-xs";
        star.textContent = "⭐".repeat(project.is_outstanding);
        left.appendChild(star);
      }
      item.appendChild(left);

      const right = document.createElement("div");
      right.className = "text-xs flex flex-row items-center gap-2";
      right.style.minWidth = "52px";
      const time = document.createElement("span");
      time.className = "opacity-50";
      time.textContent = formatDate(project.last_event_date);
      right.appendChild(time);
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
  if (sorted.length === 0) {
    return;
  }

  let attempts = 0;
  const liWait = 8;
  const poll = () => {
    if (++attempts > 50) {
      return;
    }
    const c = findCard("PROJECTS");
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
    const login = parts[parts.length - 1] || null;
    return login;
  }
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[href^="https://profile.intra.42.fr/users/"]',
  );
  if (profileLink) {
    const parts = profileLink.pathname.split("/").filter(Boolean);
    const login = parts[parts.length - 1] || null;
    return login;
  }
  return null;
}

async function enhanceExistingMarks(
  card: HTMLElement,
  targetLogin: string,
  marks?: MarkedProject[],
): Promise<boolean> {
  let attempts = 0;
  while (attempts < 30) {
    const container = card.querySelector<HTMLElement>(".flex.flex-col.gap-2");
    if (container) {
      const items = container.querySelectorAll<HTMLElement>(":scope > div");
      if (items.length > 0) {
        const entries: { el: HTMLElement; projectsUserId: number }[] = [];
        for (let i = 0; i < items.length; i++) {
          const link = items[i].querySelector<HTMLAnchorElement>(
            "a[href*='projects_users']",
          );
          if (!link) continue;
          const match = link.href.match(/projects_users\/(\d+)/);
          if (!match) continue;
          entries.push({ el: items[i], projectsUserId: Number(match[1]) });
        }
        const outstanding = await fetchOutstandingProjects(
          targetLogin,
          entries.length,
        );
        let starred = 0;
        for (const entry of entries) {
          const count = outstanding[entry.projectsUserId];
          if (!count) continue;

          const flexRow = entry.el.querySelector<HTMLElement>(
            ".flex.flex-row.justify-between, .flex.flex-row",
          );
          if (!flexRow) continue;

          const link = flexRow.querySelector("a");
          if (!link) continue;

          const star = document.createElement("span");
          star.className = "text-xs";
          star.style.marginLeft = "2px";
          star.textContent = "⭐".repeat(count);
          link.parentElement?.appendChild(star);
          starred++;
        }

        if (marks) {
          const marksById = new Map<number, string>();
          for (const m of marks) {
            marksById.set(m.projects_user_id, m.last_event_date);
          }
          let annotated = 0;
          for (const entry of entries) {
            const project = marks?.find(
              (m) => m.projects_user_id === entry.projectsUserId,
            );
            const ts = marksById.get(entry.projectsUserId);
            if (ts) {
              entry.el.setAttribute("data-last-event-date", ts);
              entry.el.title = formatTooltipDate(ts);
              annotated++;
            }
            if (project && project.teams && project.teams.length > 1) {
              const teamDates: Record<string, string> = {};
              for (const team of project.teams) {
                teamDates[team.occurrence] = team.last_event_date;
              }
              entry.el.setAttribute(
                "data-team-dates",
                JSON.stringify(teamDates),
              );
            }
          }

          const showRealDate = await getConfig("PROFILE_MARKS_SHOW_REAL_DATE");
          if (showRealDate) {
            const RELATIVE_RE =
              /^\s*(about|over|almost|nearly)?\s*(\d+|a|an)\s+(second|minute|hour|day|month|year)s?\s+ago\s*$/i;

            const replaceDatesInContainer = (container: HTMLElement) => {
              const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
              );
              const toReplace: { node: Text; ts: string }[] = [];
              let node: Text | null;
              while ((node = walker.nextNode() as Text | null)) {
                const text = node.textContent ?? "";
                if (!RELATIVE_RE.test(text)) continue;
                const wrapper = node.parentElement?.closest<HTMLElement>(
                  "[data-last-event-date]",
                );
                if (!wrapper) continue;
                let ts = wrapper.getAttribute("data-last-event-date");
                if (!ts) continue;
                const teamDatesStr = wrapper.getAttribute("data-team-dates");
                if (teamDatesStr) {
                  let searchEl: HTMLElement | null = node.parentElement;
                  while (searchEl && searchEl !== wrapper) {
                    const occMatch = (searchEl.textContent ?? "").match(
                      /#(\d+)/,
                    );
                    if (occMatch) {
                      const teamDates = JSON.parse(teamDatesStr) as Record<
                        string,
                        string
                      >;
                      const teamTs = teamDates[occMatch[1]];
                      if (teamTs) ts = teamTs;
                      break;
                    }
                    searchEl = searchEl.parentElement;
                  }
                }
                toReplace.push({ node, ts });
              }
              for (const { node, ts } of toReplace) {
                node.textContent = formatTooltipDate(ts);
              }
              return toReplace.length;
            };
            replaceDatesInContainer(card);

            const dateObserver = new MutationObserver((mutations) => {
              for (const m of mutations) {
                if (m.type === "childList") {
                  for (const node of m.addedNodes) {
                    if (node instanceof HTMLElement) {
                      replaceDatesInContainer(node);
                    }
                  }
                } else if (m.type === "attributes") {
                  if (m.target instanceof HTMLElement) {
                    replaceDatesInContainer(m.target);
                  }
                }
              }
            });
            dateObserver.observe(card, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ["data-state", "hidden"],
            });
          }
        }

        for (const entry of entries) {
          const row = entry.el.querySelector<HTMLElement>(
            ".flex.flex-row.justify-between.hover\\:bg-gray-300",
          );
          if (row) {
            row.style.paddingTop = "0.25rem";
            row.style.paddingBottom = "0.25rem";
            row.style.paddingLeft = "0.5rem";
            row.style.paddingRight = "0.5rem";
          }

          const btn = entry.el.querySelector("button");
          if (btn) {
            btn.style.fontWeight = "400";
            btn.style.fontSize = "inherit";
            btn.style.fontFamily = "inherit";
            btn.style.color = "inherit";
          }

          const leftSide = entry.el.querySelector<HTMLElement>(
            ".flex.flex-row.gap-1",
          );
          if (!leftSide) continue;
          const link = leftSide.querySelector("a");
          if (!link) continue;
          link.style.fontSize = "0.875rem";

          const rightSide = entry.el.querySelector<HTMLElement>(
            ".text-xs.flex.flex-row.items-center",
          );

          let dateNode: Node | null = null;
          for (const child of [...leftSide.childNodes]) {
            if (child === link) continue;
            if (child instanceof SVGElement) continue;
            if (
              child.nodeType === Node.TEXT_NODE &&
              child.textContent?.trim()
            ) {
              dateNode = child;
              break;
            }
            if (
              child instanceof HTMLElement &&
              !child.textContent?.includes("⭐")
            ) {
              dateNode = child;
              break;
            }
          }

          if (dateNode && rightSide) {
            const dateSpan = document.createElement("span");
            dateSpan.className = "opacity-50 text-sm";
            dateSpan.style.whiteSpace = "nowrap";
            dateSpan.textContent = dateNode.textContent?.trim() ?? "";
            (dateNode as ChildNode).replaceWith(dateSpan);
            rightSide.prepend(dateSpan);
            if (!rightSide.style.gap) rightSide.style.gap = "0.25rem";
          }

          let prevSibling: Node = link;
          for (const child of [...leftSide.childNodes]) {
            if (
              child instanceof HTMLSpanElement &&
              child.textContent?.includes("⭐")
            ) {
              if (child.previousSibling !== prevSibling) {
                (prevSibling as ChildNode).after(child);
              }
              prevSibling = child;
            }
          }
        }

        return true;
      }
    }
    await new Promise((r) => requestAnimationFrame(r));
    attempts++;
  }
  return false;
}

export async function initMarks() {
  if (marksInitialized) {
    return;
  }

  const showMarks = await getConfig("PROFILE_SHOW_MARKS");
  if (!showMarks) return;

  if (location.hostname !== "profile-v3.intra.42.fr") {
    return;
  }

  const isOwnProfile = location.pathname === "/";
  if (isOwnProfile) {
    const pageLogin = getLoginFromPage();
    const profileLogin = (await getCloudLogin()) || pageLogin;
    if (!profileLogin) {
      return;
    }

    const token = await waitForToken(30000);
    if (!token) return;

    cachedLogin = profileLogin;
    cachedToken = token;
    marksInitialized = true;

    document.addEventListener("42_CURSUS_ID", ((e: CustomEvent) => {
      const cursusId =
        e.detail || sessionStorage.getItem("ft_active_cursus_id") || "21";
      handleCursusSwitch(cursusId);
    }) as EventListener);

    const cursusId = await waitForCursusId(10000);
    if (!marksCache[cursusId]) {
      marksCache[cursusId] = await fetchMarks(profileLogin, token, cursusId);
    } else {
    }

    await tryInjectMarks(marksCache[cursusId]);
  } else {
    const targetLogin = location.pathname.split("/")[2];
    if (!targetLogin) return;

    if (otherProfileRunning) return;

    const card = findCard("MARKS");
    if (!card) return;

    otherProfileRunning = true;
    let marksData: MarkedProject[] | undefined;
    const token = await waitForToken(15000);
    const cursusId = token ? await waitForCursusId(10000) : null;
    if (token && cursusId) {
      const key = `OTHER_${targetLogin}_${cursusId}`;
      if (!marksCache[key]) {
        marksCache[key] = await fetchMarks(targetLogin, token, cursusId);
      }
      marksData = marksCache[key];
    }
    const enhanced = await enhanceExistingMarks(card, targetLogin, marksData);
    otherProfileRunning = false;
    if (!enhanced) { marksInitialized = true; return; }

    marksInitialized = true;

    const sidebar = card.closest(".w-full")?.previousElementSibling as HTMLElement | null;
    const wrapper = sidebar?.nextElementSibling as HTMLElement | null;
    if (wrapper) {
      let enhancing = false;
      const observer = new MutationObserver(() => {
        if (enhancing) return;
        const marksCard = findCard("MARKS");
        if (!marksCard || !wrapper.contains(marksCard)) return;
        if (marksCard.querySelector("[data-last-event-date]")) return;
        enhancing = true;
        void enhanceExistingMarks(marksCard, targetLogin, marksData).finally(() => {
          enhancing = false;
          const container = marksCard.querySelector<HTMLElement>(".flex.flex-col.gap-2");
          if (container) {
            const items = [...container.children] as HTMLElement[];
            items.sort((a, b) => {
              const da = a.getAttribute("data-last-event-date") || "";
              const db = b.getAttribute("data-last-event-date") || "";
              return db.localeCompare(da);
            });
            for (const item of items) container.appendChild(item);
          }
        });
      });
      observer.observe(wrapper, { childList: true, subtree: true });
    }
  }
}

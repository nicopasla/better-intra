import { getConfig } from "../../config.ts";
import { openClusterDialog } from "../clusters/map-dialog.ts";
import HOLY_GRAPH_SVG from "../../assets/svg/holy-graph.svg?raw";
import GRIP_VERTICAL_SVG from "../../assets/svg/grip-vertical.svg?raw";
import USER_COG_SVG from "../../assets/svg/user-cog.svg?raw";

function getProfileLogin(): string {
  const pathParts = location.pathname.split("/").filter(Boolean);
  if (pathParts[0] === "users" && pathParts[1]) return pathParts[1];
  const loginEl = document.querySelector<HTMLElement>('p[class="text-sm"]');
  return loginEl?.textContent?.trim() || "";
}

export async function initShortcutButtons() {
  const container = document.querySelector<HTMLElement>(
    ".border.border-ft-gray-border.bg-ft-gray\\/50.rounded-xl.flex.justify-center.items-center.w-full",
  );
  if (!container || container.hasAttribute("data-ft-shortcuts")) return;

  const openNewTab = await getConfig("ADVANCED_OPEN_LINKS_NEW_TAB");

  const login = getProfileLogin();
  if (!login) return;

  container.setAttribute("data-ft-shortcuts", "");
  while (container.firstChild) container.removeChild(container.firstChild);

  const style = document.createElement("style");
  style.textContent = `
    [data-ft-shortcuts] a {
      border: 3px solid var(--user-color, hsl(var(--legacy-main))) !important;
      border-radius: 0.5rem;
      color: inherit;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
    }
    [data-ft-shortcuts] a svg {
      width: 20px;
      height: 20px;
      fill: currentColor !important;
      stroke: currentColor !important;
    }
  `;
  container.appendChild(style);

  const makeButton = (
    href: string,
    svg: string,
    label: string,
    openNewTab: boolean,
  ) => {
    const div = document.createElement("div");
    div.className = "py-3 px-4 hover:text-legacy-main";
    const a = document.createElement("a");
    a.href = href;
    if (openNewTab) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    a.insertAdjacentHTML("beforeend", svg);
    const span = document.createElement("span");
    span.textContent = label;
    a.appendChild(span);
    div.appendChild(a);
    container.appendChild(div);
  };

  makeButton(
    `https://projects.intra.42.fr/projects/graph?login=${login}`,
    HOLY_GRAPH_SVG,
    "Holy Graph",
    openNewTab,
  );
  (() => {
    const div = document.createElement("div");
    div.className = "py-3 px-4 hover:text-legacy-main";
    const a = document.createElement("a");
    a.href = "#";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        openClusterDialog();
      } catch (err) {}
    });
    a.insertAdjacentHTML("beforeend", GRIP_VERTICAL_SVG);
    const span = document.createElement("span");
    span.textContent = "Clusters";
    a.appendChild(span);
    div.appendChild(a);
    container.appendChild(div);
  })();
  makeButton(
    "https://profile.intra.42.fr/users/me/edit",
    USER_COG_SVG,
    "Settings",
    openNewTab,
  );
}

import { html, render } from "lit-html";
import { sharedCSS } from "../../assets/shared-styles.ts";

const SHADOW_ID = "project-badges-shadow";

let projectBadgesInitialized = false;

function isExam(name: string): boolean {
  return /exam/i.test(name);
}

function insertBadges(
  card: HTMLElement,
  items: { name: string; href: string }[],
): void {
  if (items.length === 0) return;

  const inner = card.querySelector<HTMLElement>(".flex.flex-col.w-full.h-full");
  if (!inner) return;

  const hFull = inner.querySelector<HTMLElement>(".h-full");
  if (!hFull) return;

  const nativeUl = hFull.querySelector("ul");
  if (nativeUl) nativeUl.style.display = "none";

  const host = document.createElement("div");
  host.id = SHADOW_ID;

  const shadow = host.attachShadow({ mode: "open" });

  const isDark = document.documentElement.classList.contains("dark");
  const theme = isDark ? "dark" : "light";

  const style = document.createElement("style");
  style.textContent = sharedCSS;
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-theme", theme);
  wrapper.style.cssText =
    "display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 8px 14px;";

  render(
    html`
      ${items.map((item) => {
        const exam = isExam(item.name);
        return html`
          <a
            href="${item.href}"
            target="_blank"
            rel="noreferrer"
            class="badge ${exam ? "" : "badge-success"} gap-1 no-underline"
            style="font-weight: 700; ${exam
              ? "background: #ed8179; color: #fff; border-color: #ed8179;"
              : ""}"
          >
            ${item.name}
          </a>
        `;
      })}
    `,
    wrapper,
  );

  shadow.appendChild(wrapper);
  hFull.appendChild(host);
}

export async function initProjectBadges() {
  if (projectBadgesInitialized) return;
  projectBadgesInitialized = true;

  if (
    location.hostname !== "profile-v3.intra.42.fr" ||
    !(location.pathname === "/" || location.pathname.startsWith("/users"))
  )
    return;

  for (let i = 0; i < 100; i++) {
    const cards = document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96");
    const card = [...cards].find((c) => {
      const titleEl = c.querySelector("[class*='uppercase']");
      return titleEl?.textContent?.trim().toUpperCase() === "PROJECTS";
    });
    if (!card) {
      await new Promise((r) => requestAnimationFrame(r));
      continue;
    }

    const ul = card.querySelector(".h-full ul");
    const lis = ul?.querySelectorAll("li");
    if (lis && lis.length > 0) {
      const items: { name: string; href: string }[] = [];
      for (const li of lis) {
        const a = li.querySelector("a");
        if (!a) continue;
        items.push({ name: a.textContent?.trim() || "", href: a.href });
      }
      insertBadges(card, items);
      return;
    }

    const enhanced = card.querySelector(".flex.flex-col.gap-2");
    if (enhanced) {
      const items: { name: string; href: string }[] = [];
      const divs = enhanced.querySelectorAll(":scope > div");
      for (let j = 0; j < Math.min(divs.length, 5); j++) {
        const a = divs[j].querySelector("a");
        if (!a) continue;
        items.push({ name: a.textContent?.trim() || "", href: a.href });
      }
      insertBadges(card, items);
      return;
    }

    if (i >= 90) return;
    await new Promise((r) => requestAnimationFrame(r));
  }
}

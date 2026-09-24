import { html, render } from "lit-html";
import { adoptSharedStyles } from "../../utils/shadow-styles.ts";
import { waitFor } from "../../utils/wait-for.ts";

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

  adoptSharedStyles(shadow);

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
            style="display:inline-flex;align-items:center;gap:0.25rem;font-weight:700;padding:0.125rem 0.75rem;border-radius:9999px;border:1px solid transparent;text-decoration:none;${exam
              ? "background:#ed8179;color:#fff;border-color:#ed8179;"
              : "background:#16a34a;color:#fff;border-color:#16a34a;"}"
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

  const findCard = () => {
    const cards = document.querySelectorAll<HTMLElement>(".bg-white.md\\:h-96");
    return [...cards].find((c) => {
      const titleEl = c.querySelector("[class*='uppercase']");
      return titleEl?.textContent?.trim().toUpperCase() === "PROJECTS";
    });
  };

  await waitFor(() => findCard() !== null, 2000).then((ok) => {
    if (!ok) return;
    const card = findCard()!;
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
    }
  });
}

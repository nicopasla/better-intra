import { html } from "lit-html";
import { until } from "lit-html/directives/until.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { HUB_INFO } from "../hub/hubSettings.data.ts";

import GITHUB_SVG from "../../assets/svg/github.svg?raw";
import HEART_SVG from "../../assets/svg/heart.svg?raw";
import ICON_SVG from "../../assets/svg/icon.svg?raw";
import ISSUES_SVG from "../../assets/svg/issues.svg?raw";
import PERSON_FOLLOW_SVG from "../../assets/svg/person-follow.svg?raw";
import PR_SVG from "../../assets/svg/pr.svg?raw";
import STAR_SVG from "../../assets/svg/star.svg?raw";

const ABOUT_STACK = [
  {
    name: "TypeScript",
    version: __TS_VERSION__,
    color: "bg-primary text-primary-content",
    url: "https://github.com/microsoft/TypeScript",
  },
  {
    name: "Lit",
    version: __LIT_VERSION__,
    color: "bg-secondary text-secondary-content",
    url: "https://github.com/lit/lit",
  },
  {
    name: "Tailwind",
    version: __TW_VERSION__,
    color: "bg-accent text-accent-content",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "DaisyUI",
    version: __DAISY_VERSION__,
    color: "bg-info text-info-content",
    url: "https://github.com/saadeghi/daisyui",
  },
  {
    name: "Vite",
    version: __VITE_VERSION__,
    color: "bg-warning text-warning-content",
    url: "https://github.com/vitejs/vite",
  },
  {
    name: "web-ext",
    version: __WEB_EXT_VERSION__,
    color: "bg-success text-success-content",
    url: "https://github.com/mozilla/web-ext",
  },
];

const QUICK_LINKS = [
  {
    href: HUB_INFO.github,
    svg: GITHUB_SVG,
    label: "GitHub",
    color: "bg-primary text-primary-content",
  },
  {
    href: HUB_INFO.issues,
    svg: ISSUES_SVG,
    label: "Issues",
    color: "bg-secondary text-secondary-content",
  },
  {
    href: `${HUB_INFO.github}/pulls`,
    svg: PR_SVG,
    label: "PRs",
    color: "bg-accent text-accent-content",
  },
];

const starCount = fetch("https://api.github.com/repos/nicopasla/better-intra")
  .then((r) => r.json())
  .then((d) => d.stargazers_count as number)
  .catch(() => null);

const followerCount = fetch("https://api.github.com/users/nicopasla")
  .then((r) => r.json())
  .then((d) => d.followers as number)
  .catch(() => null);

export function renderAboutPanel(): ReturnType<typeof html> {
  return html`
    <div
      class="card bg-base-100 border border-base-300 shadow-sm w-full h-full overflow-hidden select-none"
    >
      <div
        class="card-body p-4 flex flex-col gap-4 text-base-content overflow-y-auto"
      >
        <!-- Hero -->
        <div class="flex flex-col gap-3 shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="size-12 flex items-center justify-center"
                style="color: #00babc;"
              >
                ${unsafeHTML(ICON_SVG)}
              </div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight">
                  ${HUB_INFO.name}
                </h1>
                <a
                  href="${HUB_INFO.github}/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm font-bold transition-all hover:scale-105 active:scale-95"
                >
                  <span>v${HUB_INFO.version}</span>
                </a>
                <a
                  href="https://github.com/nicopasla/better-intra"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm gap-1"
                >
                  <span
                    class="size-4 flex items-center justify-center fill-current"
                  >
                    ${unsafeHTML(STAR_SVG)}
                  </span>
                  <span>Star</span>
                  ${until(
                    starCount.then(
                      (c) =>
                        c != null
                          ? html`<span class="badge badge-sm font-mono">${c}</span>`
                          : "",
                    ),
                    html`<span class="loading loading-spinner loading-xs"></span>`,
                  )}
                </a>
              </div>
            </div>
          </div>
          <p class="text-sm opacity-60 max-w-full">
            UI and UX improvements for 42 Intra v3: logtime calendar, cluster
            map tools, custom profiles, shortcuts, friends widget, and more.
          </p>
        </div>

        <!-- Built With -->
        <div class="flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold uppercase tracking-widest">
              Built With
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          <div class="join w-full">
            ${ABOUT_STACK.map(
              (tech) => html`
                <a
                  href="${tech.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="join-item btn btn-xs flex-1 flex-col gap-0 h-auto py-1.5 leading-tight font-normal border-none ${tech.color} transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span class="text-xs font-semibold">${tech.name}</span>
                  <span class="text-[10px] opacity-70 font-mono font-semibold"
                    >${tech.version}</span
                  >
                </a>
              `,
            )}
          </div>
        </div>

        <!-- Quick Links -->
        <div class="flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold uppercase tracking-widest">
              Quick Links
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          <div class="join w-full">
            ${QUICK_LINKS.map(
              (link) => html`
                <a
                  href="${link.href}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="join-item btn btn-md flex-1 gap-2 border-none ${link.color} transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span
                    class="size-5 flex items-center justify-center fill-current"
                  >
                    ${unsafeHTML(link.svg)}
                  </span>
                  <span class="text-sm font-semibold">${link.label}</span>
                </a>
              `,
            )}
          </div>
        </div>

        <!-- Divider -->
        <div class="divider my-0 opacity-20 shrink-0"></div>

        <!-- Footer -->
        <div class="text-center mt-auto shrink-0">
          <p class="text-sm opacity-50 font-medium">
            Made for 42 Belgium · ${HUB_INFO.license} License
          </p>
          <div class="flex justify-center gap-3 mt-2">
            <a
              href="https://github.com/nicopasla"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm gap-1"
            >
              <span
                class="size-4 flex items-center justify-center fill-current"
              >
                ${unsafeHTML(PERSON_FOLLOW_SVG)}
              </span>
              <span>Follow</span>
              ${until(
                followerCount.then(
                  (c) =>
                    c != null
                      ? html`<span class="badge badge-sm font-mono">${c}</span>`
                      : "",
                ),
                html`<span class="loading loading-spinner loading-xs"></span>`,
              )}
            </a>
            <a
              href="https://github.com/sponsors/nicopasla"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm gap-1"
            >
              <span
                class="size-4 flex items-center justify-center fill-current"
              >
                ${unsafeHTML(HEART_SVG)}
              </span>
              <span>Sponsor</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

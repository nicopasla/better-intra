import { html } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { HUB_INFO } from "../hub/hubSettings.data.ts";

import GITHUB_SVG from "../../assets/svg/github.svg?raw";
import ISSUES_SVG from "../../assets/svg/issues.svg?raw";
import PR_SVG from "../../assets/svg/pr.svg?raw";

const ABOUT_STACK = [
  {
    name: "TypeScript",
    version: __TS_VERSION__,
    color: "badge-primary text-primary-content",
    url: "https://github.com/microsoft/TypeScript",
  },
  {
    name: "Lit",
    version: __LIT_VERSION__,
    color: "badge-secondary text-secondary-content",
    url: "https://github.com/lit/lit",
  },
  {
    name: "Tailwind",
    version: __TW_VERSION__,
    color: "badge-accent text-accent-content",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "DaisyUI",
    version: __DAISY_VERSION__,
    color: "badge-info text-info-content",
    url: "https://github.com/saadeghi/daisyui",
  },
  {
    name: "Vite",
    version: __VITE_VERSION__,
    color: "badge-warning text-warning-content",
    url: "https://github.com/vitejs/vite",
  },
  {
    name: "web-ext",
    version: __WEB_EXT_VERSION__,
    color: "badge-success text-warning-content",
    url: "https://github.com/mozilla/web-ext",
  },
];

const ACTION_LINKS = [
  {
    href: HUB_INFO.github,
    svg: GITHUB_SVG,
    label: "GitHub",
    tooltip: "View source code",
  },
  {
    href: HUB_INFO.issues,
    svg: ISSUES_SVG,
    label: "Issues",
    tooltip: "Report or view issues",
  },
  {
    href: `${HUB_INFO.github}/pulls`,
    svg: PR_SVG,
    label: "PRs",
    tooltip: "View pull requests",
  },
];

export function renderAboutPanel(): ReturnType<typeof html> {
  return html`
    <div
      class="card bg-base-100 border border-base-300 shadow-sm w-full h-full overflow-hidden select-none"
    >
      <div
        class="card-body p-6 flex flex-col gap-6 text-base-content overflow-y-auto"
      >
        <!-- Header Section -->
        <div
          class="flex flex-col gap-3 bg-base-200/40 p-5 rounded-xl border border-base-300 shadow-sm shrink-0"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1 flex-1">
              <h1 class="text-2xl font-bold tracking-tight text-base-content">
                ${HUB_INFO.name}
              </h1>
              <p class="text-sm opacity-70">
                A modern extension designed to enhance the 42 Intra experience.
              </p>
            </div>
            <a
              href="${HUB_INFO.github}/releases"
              target="_blank"
              rel="noopener noreferrer"
              class="badge badge-lg gap-2 px-4 py-3 font-mono font-bold text-primary-content border-none shadow-md transition-all hover:shadow-lg active:scale-95 bg-primary"
            >
              <span>v${HUB_INFO.version}</span>
            </a>
          </div>
        </div>

        <!-- Tech Stack Section -->
        <div class="flex flex-col gap-3 shrink-0">
          <div class="flex items-center gap-2">
            <h2
              class="text-sm font-semibold uppercase tracking-widest text-base-content"
            >
              Built With
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${ABOUT_STACK.map(
              (tech, index) => html`
                <a
                  href="${tech.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="badge ${tech.color} badge-md gap-2 py-3 px-3 font-medium border-none transition-all hover:shadow-md hover:scale-110 active:scale-95 cursor-pointer"
                  title="${tech.name}"
                >
                  <span>${tech.name}</span>
                  <span class="opacity-70 font-mono text-[11px]"
                    >${tech.version}</span
                  >
                </a>
              `,
            )}
          </div>
        </div>

        <!-- Action Buttons Section -->
        <div class="flex flex-col gap-3 shrink-0">
          <div class="flex items-center gap-2">
            <h2
              class="text-sm font-semibold uppercase tracking-widest text-base-content"
            >
              Quick Links
            </h2>
            <div class="flex-1 h-px bg-base-300/40"></div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            ${ACTION_LINKS.map(
              (link, index) => {
                const colors = [
                  "btn-primary",
                  "btn-secondary",
                  "btn-accent",
                ];
                const color = colors[index % colors.length];
                return html`
                  <div
                    class="tooltip tooltip-bottom w-full"
                    data-tip="${link.tooltip}"
                  >
                    <a
                      href="${link.href}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn ${color} btn-sm w-full gap-2 transition-all active:scale-95 text-white shadow-sm hover:shadow-md"
                    >
                      <span
                        class="size-4 flex items-center justify-center fill-current"
                      >
                        ${unsafeHTML(link.svg)}
                      </span>
                      <span class="text-xs font-semibold">${link.label}</span>
                    </a>
                  </div>
                `;
              },
            )}
          </div>
        </div>

        <!-- Divider -->
        <div class="divider my-1 opacity-20 shrink-0"></div>

        <!-- Footer -->
        <div
          class="text-center text-[12px] opacity-50 mt-auto shrink-0 pt-2 space-y-1"
        >
          <p class="font-medium">Made for 42 Belgium</p>
          <a
            href="${HUB_INFO.author}"
            target="_blank"
            rel="noopener noreferrer"
            class="link link-hover font-semibold text-base-content opacity-80 hover:opacity-100"
            >by @nicopasla</a
          >
          <p class="text-[11px] opacity-40 pt-1">${HUB_INFO.license} License</p>
        </div>
      </div>
    </div>
  `;
}

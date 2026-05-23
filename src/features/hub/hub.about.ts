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

export function renderAboutPanel(): ReturnType<typeof html> {
  return html`
    <div
      class="card bg-base-100 border border-base-300 shadow-sm w-full h-full overflow-hidden select-none"
    >
      <div
        class="card-body p-5 flex flex-col gap-6 text-base-content overflow-hidden"
      >
        <div
          class="flex flex-col gap-1 bg-base-200/60 p-4 rounded-xl border border-base-300 shrink-0"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold tracking-wide text-base-content">
              ${HUB_INFO.name}
            </h2>
            <span
              class="badge font-mono px-3 py-2 text-xs font-bold text-white border-none"
              style="background-color: #00babc;"
            >
              v${HUB_INFO.version}
            </span>
          </div>
          <p class="text-xs opacity-70 mt-1">
            A modern extension designed to enhance the 42 Intra experience.
          </p>
        </div>

        <div class="flex flex-col gap-2 shrink-0">
          <h3 class="text-xs font-semibold uppercase tracking-wider opacity-60">
            Built With
          </h3>
          <div class="flex flex-wrap gap-2 items-center">
            ${ABOUT_STACK.map(
              (tech) => html`
                <a
                  href="${tech.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="badge ${tech.color} badge-sm gap-1.5 py-3 px-2.5 font-semibold border-none transition-transform hover:scale-105 active:scale-95"
                >
                  <span>${tech.name}</span>
                  <span class="opacity-80 text-[10px] font-mono"
                    >${tech.version}</span
                  >
                </a>
              `,
            )}
          </div>
        </div>

        <div class="divider my-0.5 opacity-20 shrink-0"></div>

        <div
          class="flex flex-row gap-2 w-full justify-between border border-base-300 bg-base-200/40 p-1.5 rounded-xl shadow-inner shrink-0"
        >
          <a
            href="${HUB_INFO.github}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost hover:bg-base-300/80 border-solid border border-base-300 btn-md flex-1 flex items-center justify-center gap-2 text-sm font-bold text-base-content"
          >
            <span
              class="size-5 flex items-center justify-center fill-current text-base-content"
            >
              ${unsafeHTML(GITHUB_SVG)}
            </span>
            <span>GitHub</span>
          </a>

          <a
            href="${HUB_INFO.issues}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost hover:bg-base-300/80 border-solid border border-base-300 btn-md flex-1 flex items-center justify-center gap-2 text-sm font-bold text-base-content"
          >
            <span
              class="size-5 flex items-center justify-center fill-current text-base-content"
            >
              ${unsafeHTML(ISSUES_SVG)}
            </span>
            <span>Open Issue</span>
          </a>

          <a
            href="${HUB_INFO.github}/pulls"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost hover:bg-base-300/80 border-solid border border-base-300 btn-md flex-1 flex items-center justify-center gap-2 text-sm font-bold text-base-content"
          >
            <span
              class="size-5 flex items-center justify-center fill-current text-base-content"
            >
              ${unsafeHTML(PR_SVG)}
            </span>
            <span>PRs</span>
          </a>
        </div>

        <div class="text-center text-[11px] opacity-40 mt-auto shrink-0">
          Made by
          <a
            href="${HUB_INFO.author}"
            target="_blank"
            rel="noopener noreferrer"
            class="link link-hover font-medium text-base-content"
            >nicopasla</a
          >
        </div>
      </div>
    </div>
  `;
}

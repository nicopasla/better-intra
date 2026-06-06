# Development

## Prerequisites

- Node.js
- npm

## Setup

```bash
git clone https://github.com/nicopasla/better-intra.git
cd better-intra
npm install
```

## Commands

```bash
npm run dev:firefox     # watch + web-ext auto-reload in Firefox
npm run dev:chrome      # watch + web-ext auto-reload in Chrome
npm run dev:brave       # watch + web-ext auto-reload in Brave
npm run build:firefox   # single production build for Firefox
npm run build:chrome    # single production build for Chrome
```

Output goes to `dist-firefox/` or `dist-chrome/`.

## Build pipeline

Always `tsc` (type-check only, `noEmit`) → `vite build` (content script) → `vite build --config vite.popup.config.ts` (popup).

```bash
cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox tsc && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build --config vite.popup.config.ts
```

- `content.js` is bundled as IIFE. `popup.js` is bundled separately.
- `manifest.json` is generated from `manifests/manifest.{chrome,firefox}.json` with version from `package.json`.
- Icons are copied from `public/icons/` on build. To regenerate: `node scripts/generate-icons.js` (requires `sharp`).

## Project structure

- `src/main.ts` — content script entrypoint. Feature init via `featureInitializers` map.
- `src/popup/popup.ts` — popup entrypoint (account/cloud sync UI).
- `src/features/` — self-contained features (logtime, clusters, profile, shortcuts, account, friends, hub).
- `src/config.ts` — single source of truth for all `chrome.storage` keys.
- `manifests/` — per-browser manifest templates.
- `better-intra-worker/` — separate Cloudflare Worker (wrangler) for cloud sync. Has its own `package.json`.

## Toolchain

- **Vite 8** + `@tailwindcss/vite` plugin (Tailwind v4 CSS-driven config, no `tailwind.config.js`).
- **daisyUI 5** — loaded via `@plugin "daisyui"` in `src/assets/style.css`. Scoped to shadow DOM roots. Only a subset of components included: button, toggle, input, select, radio, label, card, tabs, modal, divider, swap, fieldset, status, tooltip, badge, collapse, ring, avatar, indicator, list, loading, join, kbd, dropdown, menu.
- **TypeScript 6** — `strict: true`, `moduleResolution: bundler`, `types: ["chrome"]`.
- **lit-html** — DOM templating for settings UI and popup.
- **web-ext** — running and signing the extension.
- **Icons**: Font Awesome SVG icons in `src/assets/svg/`.

## Worker

```bash
cd better-intra-worker
npm install
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy --remote
```

## CI

- **Release drafter** — on push/PR to `main`; auto-categorizes commits.
- **Publish** — triggers on GitHub Release publish; builds Firefox (`.xpi`) and Chrome (`.zip`); signs Firefox via AMO for full releases.

## Formatting

Prettier is used for formatting (editor-level; no project config file committed). No linter is configured.

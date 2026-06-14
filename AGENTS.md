# Better Intra — Agent Guide

## Quick start

```bash
npm install
npm run build:firefox   # single production build for Firefox
npm run build:chrome    # single production build for Chrome
npm run dev:firefox     # watch + web-ext hot-reload
```

## Project structure

- **`src/main.ts`** — content script entrypoint. Feature init via `featureInitializers` map. Runs on `https://*.intra.42.fr/*` at `document_start`.
- **`src/popup/popup.ts`** — popup entrypoint.
- **`src/features/`** — self-contained features: `logtime/`, `clusters/`, `profile/`, `shortcuts/`, `account/`, `friends/`, `hub/`.
- **`src/config.ts`** — single source of truth for all chrome.storage keys; typed `BetterIntraConfig` interface + defaults.
- **`manifests/manifest.{chrome,firefox}.json`** — per-browser manifests (merged with version from package.json at build time via Vite plugin).
- **`better-intra-worker/`** — separate Cloudflare Worker (wrangler) for cloud settings sync. Has its own `package.json`.
- **`42_level_finder.py`** — standalone tool, not part of the extension.

## Build quirks

Always set **both** `TARGET` and `BUILD_OUT_DIR` env vars (cross-env handles this). The build pipeline is: `tsc` → `vite build` (content script) → `vite build --config vite.popup.config.ts` (popup) → `vite build --config vite.background.config.ts` (background service worker).

```bash
cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox tsc && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build --config vite.popup.config.ts && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build --config vite.background.config.ts
```

- `tsc` type-checks only (`noEmit: true` in tsconfig.json).
- Output is `dist-firefox/` or `dist-chrome/` (gitignored).
- `content.js` is bundled as IIFE. `popup.js` is bundled separately. `background.js` is bundled as IIFE.
- `manifest.json` is generated on the fly from per-browser manifest templates.
- Icons are copied from `public/icons/` on build. To regenerate: `node scripts/generate-icons.js` (requires `sharp`).

## dev scripts

- `npm run dev:firefox` — watch mode + web-ext auto-reload with Firefox.
- `npm run dev:chrome` — watch mode + web-ext auto-reload with Chrome.
- `npm run dev:brave` — like Chrome but uses Brave binary path from `package.json`.

## Framework & toolchain

- **Vite 8** + `@tailwindcss/vite` plugin (no `tailwind.config.js` — Tailwind v4 CSS-driven config).
- **daisyUI 5** — loaded via `@plugin "daisyui"` in `src/assets/style.css`; only a subset of components included.
- **TypeScript 6** — `strict: true`, `moduleResolution: bundler`, `types: ["chrome"]`.
- **`lit-html`** — used for DOM templating in the settings UI (hub) and popup.
- **`web-ext`** — for running and signing the extension.
- **Icons**: Font Awesome SVG icons in `src/assets/svg/`.

## DaisyUI note

daisyUI is scoped to shadow DOM roots (see `style.css` `root:` config). Only these components are included: `button, toggle, input, select, radio, label, card, tabs, modal, divider, swap, fieldset, status, tooltip, badge, collapse, ring, avatar, indicator, list, loading, join, kbd, dropdown, menu`.

## Testing

Tests use Vitest with `jsdom` environment and global API. Run `npm test` (single pass) or `npm run test:watch` (watch mode). Test files: `tests/config.test.ts`, `tests/marks.test.ts`, `tests/visuals.test.ts`, `tests/friends.test.ts`. Setup: `tests/setup.ts`. Config: `vitest.config.ts`.

## Extension mechanics

- Runs as a content script injected at `document_start` on `https://*.intra.42.fr/*`.
- Hooks `window.fetch` in `public/hook.js` (web accessible resource) to intercept `/locations_stats` for logtime data.
- Settings stored in `chrome.storage.local` via typed `getConfig()` helper.
- Cloud sync (optional) talks to `better-intra-worker` Cloudflare Worker via OAuth2 with 42 API.
- Evaluations feature has a background service worker (`src/background.ts`) that polls the worker for pending notifications and shows Chrome notifications. Built separately via `vite.background.config.ts`.
- Discord DM notifications are sent by the worker's 5-min cron — doesn't require browser to be open.

## Worker (`better-intra-worker/`)

### Two KV namespaces

- **`BETTER_INTRA_KV`** — user data (session tokens, settings, encrypted 42 token, discordId), app token cache, project map, friend IDs cache, online cache.
- **`EVAL_KV`** — eval state keys (`EVAL_{hash}_{id}_role`), pending notifications (`PENDING_{hash}`), enabled users list (`EVAL_ENABLED_HASHES`), Discord-linked users list (`DISCORD_HASHES`).

### Commands

```bash
cd better-intra-worker
npm install
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy --remote
npx wrangler kv:namespace create EVAL_KV       # first time, paste id into wrangler.json
npx wrangler secret put DISCORD_BOT_TOKEN       # set Discord bot token
```

### Unified evaluations architecture

Worker cron (`*/5 * * * *`) fetches 42 API `/v2/me/scale_teams` for each user, detects state changes (`null → booked → revealed`), sends Discord DMs, and stores pending notifications in `EVAL_KV`. Extension background service worker polls `/evaluations?action=pending` every 5 min and shows Chrome notifications from whatever pending list the cron prepared. No 42 API call from the extension side.

## CI

- **Release drafter** — on push/PR to `main`; auto-categorizes commits into draft release.
- **Publish** — triggers on GitHub Release publish; builds Firefox (`.xpi`) and Chrome (`.zip`); signs Firefox via AMO for full releases.

## DOs and DON'Ts

- **NEVER use `innerHTML`** — lit-html is always available. Use `render(unsafeHTML(...), container)` from `lit-html` and `lit-html/directives/unsafe-html.js` instead.

## NEVER deploy the worker without explicit user consent

## No linter; Prettier for formatting

Prettier is used for formatting (editor-level; no committed config). No ESLint or similar configured.

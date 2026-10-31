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
- **`better-intra-worker/`** — separate Cloudflare Worker (wrangler): cloud settings sync, D1-backed eval tracking, R2 image hosting, Web Push notifications. Has its own `package.json`.

## Build quirks

Always set **both** `TARGET` and `BUILD_OUT_DIR` env vars (cross-env handles this). The build pipeline is: `tsc` → `vite build` (content script) → `vite build --config vite.popup.config.ts` (popup) → `vite build --config vite.background.config.ts` (background service worker).

```bash
cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox tsc && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build --config vite.popup.config.ts && cross-env TARGET=firefox BUILD_OUT_DIR=dist-firefox vite build --config vite.background.config.ts
```

- `tsc` type-checks only (`noEmit: true` in tsconfig.json).
- Output is `dist-firefox/` or `dist-chrome/` (gitignored).
- `content.js` is a tiny IIFE boot (`public/content.js`) injected at `document_start`: it injects `hook.js` synchronously, then dynamically imports the real app `content-app.js`.
- `content-app.js` is built as **ESM with code-splitting** (`chunks/*.js`). `content-app.js` + `chunks/*.js` are exposed via `web_accessible_resources`. Feature modules (profile/logtime/clusters/…) are lazy-loaded per host in `src/main.ts`.
- `popup.js` is bundled separately. `background.js` is bundled as IIFE.
- Add any new content-script ESM chunk directories to `web_accessible_resources` in both manifests.
- `manifest.json` is generated on the fly from per-browser manifest templates.
- Icons are copied from `public/icons/` on build. To regenerate: `node scripts/generate-icons.js` (requires `sharp`).

## dev scripts

- `npm run dev:firefox` — watch mode + web-ext auto-reload with Firefox.
- `npm run dev:chrome` — watch mode + web-ext auto-reload with Chrome.
- `npm run dev:brave` — like Chrome but runs Brave via `scripts/run-brave.js`, which resolves the Brave binary per OS (override with `BRAVE_BINARY`).

## Framework & toolchain

- **Vite 8** + `@tailwindcss/vite` plugin (no `tailwind.config.js` — Tailwind v4 CSS-driven config).
- **daisyUI 5** — loaded via `@plugin "daisyui"` in `src/assets/style.css`; only a subset of components included.
- **TypeScript 6** — `strict: true`, `moduleResolution: bundler`, `types: ["chrome"]`.
- **`lit-html`** — used for DOM templating in the settings UI (hub) and popup.
- **`web-ext`** — for running and signing the extension.
- **Icons**: Font Awesome SVG icons in `src/assets/svg/`.

## DaisyUI note

daisyUI is scoped to shadow DOM roots (see `style.css` `root:` config). Only these components are included: `button, toggle, input, select, label, card, tab, modal, divider, swap, status, stat, badge, countdown, avatar, indicator, list, loading, skeleton, progress, steps, join, dropdown, menu, alert`. Tailwind content detection is scoped to `src/` via `source("../")` so docs/GIFs don't generate CSS.

## Testing

Tests use Vitest with `jsdom` environment and global API. Run `npm test` (single pass) or `npm run test:watch` (watch mode). Test files: `tests/config.test.ts`, `tests/marks.test.ts`, `tests/visuals.test.ts`, `tests/friends.test.ts`. Setup: `tests/setup.ts`. Config: `vitest.config.ts`.

The worker (`better-intra-worker/`) has its own Vitest suite under `tests/` — run `npm test` within that directory.

## PWA versioning

**Bump the PWA version at commit time**, following semver (keep `better-intra-pwa/package.json` and `package-lock.json` in sync, then rebuild). Do **not** bump for uncommitted edits — a batch of changes since the last commit shares the current version and gets a single bump when committed.

- **major** — breaking changes
- **minor** — new features
- **patch** — fixes

The version is injected at build time as `__APP_VERSION__` (see `better-intra-pwa/vite.config.ts`) and shown in Settings → About & Debug. The extension package version is separate — do not bump it for PWA changes.

**Do not bump the `better-intra-pwa` submodule pointer** in the parent repo's commits.

## Extension mechanics

- Runs as a content script injected at `document_start` on `https://*.intra.42.fr/*`.
- Hooks `window.fetch` in `public/hook.js` (web accessible resource) to intercept `/locations_stats` for logtime data.
- Settings stored in `chrome.storage.local` via typed `getConfig()` helper.
- Cloud sync (optional) talks to `better-intra-worker` Cloudflare Worker via OAuth2 with 42 API.
- `src/background.ts` is a background service worker (built separately via `vite.background.config.ts`) that reloads intra tabs when cloud credentials change. It does **not** poll for notifications.
- Web Push notifications are sent by the worker during eval state transitions and 15 minutes before subscribed 42 events, driven by an external cron (cron-job.org) — doesn't require the browser to be open.

## Worker (`better-intra-worker/`)

Fetch-only Worker (no Durable Objects). Storage:

- **KV `BETTER_INTRA_KV`** — user blobs (session tokens, settings, encrypted 42 token), app token cache, project map, friend IDs cache, cluster SVG cache, calendar tokens, announcement, stats cache.
- **D1 `better_intra_d1`** — eval tracking (`users.evals_enabled`, `eval_users`, `eval_states`, `eval_corrected`) plus caches (`online_cache`, `profile_stats_cache`, `logtime_history`, `calendar_ics`, `themes`, `campus_locations`, `cluster_occupancy_cache`, `projects`, `subjects`, …) and the hand-curated `custom_badges`. See `schema.sql`.
- **R2 `better_intra_images`** — uploaded images.

### Custom profile badges

`custom_badges` has one row per badge and lists its owners: `badge` (slug), `label`, `color`, `icon`, `tooltip`, `sort`, `logins` (comma-separated or a JSON array). There is no write API — grant or revoke by hand:

```bash
npx wrangler d1 execute better-intra-d1 --remote --command \
  "INSERT INTO custom_badges (badge,label,color,icon,tooltip,sort,logins) VALUES ('example','Example','#3366cc','★','Tooltip',10,'login-one,login-two') ON CONFLICT(badge) DO UPDATE SET logins = excluded.logins"

npx wrangler d1 execute better-intra-d1 --remote --command \
  "UPDATE custom_badges SET logins = logins || ',login-three' WHERE badge = 'example'"
```

Read back through `GET /api/v1/private/custom-badges?target=<login>` (KV-cached 60 s) and `customBadges` in `/api/v1/private/profile`. The extension and the PWA render them next to the 42 role badges.

### Commands

```bash
cd better-intra-worker
npm install
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy
npm test          # vitest
npx wrangler d1 execute better-intra-d1 --file=schema.sql   # apply schema (first time)
```

Secrets include `CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `PROXY_SECRET`, `ANNOUNCEMENT_SECRET`, `PROJECT_REFRESH_SECRET`, `AVATAR_URL_SECRET`, `RELAY_URL`, `RELAY_KEY`.

### Cron architecture

42 API work does **not** run from Cloudflare scheduled triggers, because 42 challenges requests made from that context. Instead an external cron (cron-job.org) POSTs to `/api/v1/public/cron`, guarded by `CRON_SECRET` (`X-Cron-Key`) plus a cron-job.org source-IP allowlist. Jobs:

- `main` → `handleMainCron` fetches 42 API `/v2/me/scale_teams`, detects transitions (`null → booked → revealed`), sends Web Push notifications, and persists state in D1 `eval_states` / `eval_corrected`.
- `tick` → `handleRevealCatchup` + `handleTokenRefreshSweep`.

Event reminders are the exception: `triggers.crons` is `["* * * * *"]` and `scheduled()` runs `handleEventReminders`, because that job only reads D1 (`calendar_ics`) and sends Web Push — no 42 API calls.

`handleEventReminders` pushes "Event in 15 min" for events in the user's `calendar_ics` row (the ICS the extension syncs). Dedupe lives in KV (`EVENT_NOTIFIED_<hash>`, 7-day TTL) so no D1 migration is needed; `EVENT_NOTIFY_SOON` in the settings blob opts out (missing = on).

The extension makes no 42 API calls for evals.

## CI

- **Release drafter** — on push/PR to `main`; auto-categorizes commits into draft release.
- **Publish** — triggers on GitHub Release publish; builds Firefox (`.xpi`) and Chrome (`.zip`); signs Firefox via AMO for full releases.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a single subject line — no body, no description.

`type(scope): subject`

- **type** — `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`
- **scope** — the **feature/module** you touched, never the app or submodule name: `profile`, `logtime`, `clusters`, `shortcuts`, `hub`, `friends`, `students`, `calendar`, `notifications`, `theme`, `cron`, `push`, `events`, `sessions`, `settings`, `custom-badges`, … Omit the scope only for repo-wide changes (docs, CI, dependencies).
- **subject** — imperative mood, lowercase after the colon, no trailing period, keep it short

Examples: `feat(shortcuts): pin shortcuts to the important links slide`, `fix(profile): clip header cards to the content column`, `feat(cron): push event reminders`, `docs: document the commit convention`.

Do not use `ext`, `pwa`, `worker` or `repo` as scopes — say which feature changed instead.

Applies to new commits only; existing history is not rewritten.

## DOs and DON'Ts

- **NEVER use `innerHTML`** — lit-html is always available. Use `render(unsafeHTML(...), container)` from `lit-html` and `lit-html/directives/unsafe-html.js` instead.
- **NEVER commit without explicit user approval** — do not run `git commit`, amend, or push unless the user explicitly asks you to.
- **NEVER add commit descriptions** — commit messages must be a single subject line with no body/description.

## NEVER deploy the worker without explicit user consent

## NEVER delete from remote D1

Never run destructive commands against the remote D1 database (`DELETE`, `DROP`, `TRUNCATE`, `wrangler d1 execute --remote` with destructive SQL, etc.). Remote data is not reproducible. To change stored state, rely on the application's own `INSERT OR REPLACE` writes or non-destructive updates; ask the user before any statement that removes rows or schema.

## No linter; Prettier for formatting

Prettier is used for formatting (editor-level; no committed config). No ESLint or similar configured.

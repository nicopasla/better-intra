# Changelog

## [Unreleased]

## [1.1.2] - 2026-06-08

### Features 🎉

- feat: updated events filtering ([2beeefe](https://github.com/nicopasla/better-intra/commit/2beeefe))
- feat: option to hide the 'Important links' ([64654cf](https://github.com/nicopasla/better-intra/commit/64654cf))

### Bug fixes 🐛

- fix: removed FRIENDS_DATA_CACHE from being push to the  KV ([53cbabb](https://github.com/nicopasla/better-intra/commit/53cbabb))
- fix: updated description of the friends feature ([aa9cd3d](https://github.com/nicopasla/better-intra/commit/aa9cd3d))
- fix: emoji limit in logtime was fixed to only one emoji ([bd88626](https://github.com/nicopasla/better-intra/commit/bd88626))
- fix: updated color for the select event button ([66d2cf8](https://github.com/nicopasla/better-intra/commit/66d2cf8))
- fix: added some top/bottom padding to the shortcuts ([0de5ca7](https://github.com/nicopasla/better-intra/commit/0de5ca7))
- fix: hide shortcuts seperator when there 0 shortcuts ([989154b](https://github.com/nicopasla/better-intra/commit/989154b))
- fix: changed formating of last active timestamp ([1a747ae](https://github.com/nicopasla/better-intra/commit/1a747ae))
- fix: added back colored links ([db21be7](https://github.com/nicopasla/better-intra/commit/db21be7))

### Maintenance 🧹

- chore: update subproject commit reference in better-intra-worker ([456139b](https://github.com/nicopasla/better-intra/commit/456139b))
- chore: improve clusters buttons layout ([1a7a89c](https://github.com/nicopasla/better-intra/commit/1a7a89c))
- chore: formatting ([f39d57f](https://github.com/nicopasla/better-intra/commit/f39d57f))

## [1.1.1] - 2026-06-08

### Features 🎉

- feat: add drag and drop to the shortcuts section ([96b6227](https://github.com/nicopasla/better-intra/commit/96b6227))
- feat: auto-pull of friends and settings after connection ([5f529a7](https://github.com/nicopasla/better-intra/commit/5f529a7))
- feat: added Chrome Web Store link ([b5e6d91](https://github.com/nicopasla/better-intra/commit/b5e6d91))
- feat: updated light mode ([d0a9c19](https://github.com/nicopasla/better-intra/commit/d0a9c19))
- feat: add reconnect flow and add connect button to the friends panel ([9a1cc0f](https://github.com/nicopasla/better-intra/commit/9a1cc0f))
- feat: add local cache and last active connection label ([45d5500](https://github.com/nicopasla/better-intra/commit/45d5500))

### Bug fixes 🐛

- fix: layout not working after changes in logtime ([1e4d814](https://github.com/nicopasla/better-intra/commit/1e4d814))
- fix: updated colors for the level ([98a8adf](https://github.com/nicopasla/better-intra/commit/98a8adf))
- fix: render colors differently for dark theme ([6ff3641](https://github.com/nicopasla/better-intra/commit/6ff3641))
- fix: the personnal color was used for others profile percentage ([53696c5](https://github.com/nicopasla/better-intra/commit/53696c5))
- fix: change badges style ([d9f4115](https://github.com/nicopasla/better-intra/commit/d9f4115))
- fix: project button hovering ([27b49f8](https://github.com/nicopasla/better-intra/commit/27b49f8))
- fix: change apparence of delete button and add confirmation prompt ([294a0e7](https://github.com/nicopasla/better-intra/commit/294a0e7))
- fix: update svg selector ([19eb8c0](https://github.com/nicopasla/better-intra/commit/19eb8c0))
- fix: fill empty clusters posts dark ([b34f2ad](https://github.com/nicopasla/better-intra/commit/b34f2ad))
- fix: theme was not applying to the friends panel ([21f5873](https://github.com/nicopasla/better-intra/commit/21f5873))
- fix: update default card order ([63c5810](https://github.com/nicopasla/better-intra/commit/63c5810))
- fix: update hover color for buttons and inputs ([7bad8c5](https://github.com/nicopasla/better-intra/commit/7bad8c5))
- fix: update milestone selector ([f958760](https://github.com/nicopasla/better-intra/commit/f958760))
- fix: remove borders around elements ([286dc57](https://github.com/nicopasla/better-intra/commit/286dc57))

### Maintenance 🧹

- chore: update subproject commit reference in better-intra-worker ([6c17eae](https://github.com/nicopasla/better-intra/commit/6c17eae))
- chore: add new drag and drop to the README ([3b4d17b](https://github.com/nicopasla/better-intra/commit/3b4d17b))
- chore: update profile modal ([02c56d6](https://github.com/nicopasla/better-intra/commit/02c56d6))
- chore: remove friends and account screenshot section ([b24fb8f](https://github.com/nicopasla/better-intra/commit/b24fb8f))
- chore: update README to latest features ([1187975](https://github.com/nicopasla/better-intra/commit/1187975))
- chore: remove outdated images ([71317d4](https://github.com/nicopasla/better-intra/commit/71317d4))
- chore: update subproject commit reference in better-intra-worker ([2051b0d](https://github.com/nicopasla/better-intra/commit/2051b0d))
- chore: add images fro Chrome store ([e879cf0](https://github.com/nicopasla/better-intra/commit/e879cf0))
- chore: update description of manifests ([81283dc](https://github.com/nicopasla/better-intra/commit/81283dc))
- chore: add STORE_LISTING for Chrome listing ([e19dda1](https://github.com/nicopasla/better-intra/commit/e19dda1))
- chore: add PRIVACY file ([43d315b](https://github.com/nicopasla/better-intra/commit/43d315b))
- chore: add DEVELOPMENT file ([5b124e0](https://github.com/nicopasla/better-intra/commit/5b124e0))
- chore: add AGENTS file ([31b4f94](https://github.com/nicopasla/better-intra/commit/31b4f94))

### Other Changes 🔄

- refactor(hub): upgrade settings hub layout ([2c9fb8e](https://github.com/nicopasla/better-intra/commit/2c9fb8e))
- refactor(logtime): migrated some parts of logtime to Daisyui ([de08ee7](https://github.com/nicopasla/better-intra/commit/de08ee7))

## [1.1.0] - 2026-06-04

### Features 🎉

- feat: add new friends menu to track your friends stats ([23427fe](https://github.com/nicopasla/better-intra/commit/23427fe))
- feat: add new icon menu for the account settings ([836973b](https://github.com/nicopasla/better-intra/commit/836973b))
- feat: add basic icon ([4c0a89c](https://github.com/nicopasla/better-intra/commit/4c0a89c))
- feat: add pool month ([2b79117](https://github.com/nicopasla/better-intra/commit/2b79117))

### Bug fixes 🐛

- fix: update old daisyui var ([1d02eec](https://github.com/nicopasla/better-intra/commit/1d02eec))
- fix: remove friends cache ([aea2e98](https://github.com/nicopasla/better-intra/commit/aea2e98))
- fix: updated rainbow animations to be less catchy ([3d0c5e5](https://github.com/nicopasla/better-intra/commit/3d0c5e5))
- fix: input focus after adding a friend ([5a03782](https://github.com/nicopasla/better-intra/commit/5a03782))
- fix: remove console log and add pollTimer ([b7b1cc3](https://github.com/nicopasla/better-intra/commit/b7b1cc3))
- fix: export only once INTRA_FONT ([aee447c](https://github.com/nicopasla/better-intra/commit/aee447c))
- fix: refactor to fix ts issues ([25534a9](https://github.com/nicopasla/better-intra/commit/25534a9))
- fix: remove console log ([2e76d45](https://github.com/nicopasla/better-intra/commit/2e76d45))
- fix: remove strict type errors ([f95f19f](https://github.com/nicopasla/better-intra/commit/f95f19f))
- fix: add console errors when syncMyVisuals fail ([71cf18b](https://github.com/nicopasla/better-intra/commit/71cf18b))
- fix: improve observer in profile main ([f20a139](https://github.com/nicopasla/better-intra/commit/f20a139))

### Maintenance 🧹

- chore: remove account tab ([532fa08](https://github.com/nicopasla/better-intra/commit/532fa08))
- chore: remove tests ([2b46c3f](https://github.com/nicopasla/better-intra/commit/2b46c3f))
- chore: remove handleTestConnection ([17a1a5d](https://github.com/nicopasla/better-intra/commit/17a1a5d))
- chore: refactor shortcut export ([82efc6c](https://github.com/nicopasla/better-intra/commit/82efc6c))
- chore: refactor and delete testing functions ([b1a5f80](https://github.com/nicopasla/better-intra/commit/b1a5f80))
- chore: remove background.ts ([4b11b7d](https://github.com/nicopasla/better-intra/commit/4b11b7d))

## [1.0.9] - 2026-06-03

### Features 🎉

- feat: changed dark mode color ([b526d8b](https://github.com/nicopasla/better-intra/commit/b526d8b))
- feat: improve Chrome and Firefox builds ([11abc21](https://github.com/nicopasla/better-intra/commit/11abc21))

### Bug fixes 🐛

- fix: change config to use boolean instead of true ([ac68878](https://github.com/nicopasla/better-intra/commit/ac68878))
- fix: rename js imports to ts imports ([c0d77f3](https://github.com/nicopasla/better-intra/commit/c0d77f3))
- fix: remove duplicate config call ([f46c8a4](https://github.com/nicopasla/better-intra/commit/f46c8a4))
- fix: remove text-shadow from elements with inline styles ([4dcbd33](https://github.com/nicopasla/better-intra/commit/4dcbd33))
- 
### Maintenance 🧹

- chore: remove alternative layout ([2fc4db9](https://github.com/nicopasla/better-intra/commit/2fc4db9))
- chore: Bump concurrently from ^9.2.1 to ^10.0.0 ([23b5fb7](https://github.com/nicopasla/better-intra/commit/23b5fb7))

## [1.0.8] - 2026-05-29

### Bug fixes 🐛

- fix(theme-manager): clean up code formatting and remove unnecessary whitespace ([a487b5a](https://github.com/nicopasla/better-intra/commit/a487b5a))
- fix(theme-v2): fix cluster layout and remove unused CSS rules ([bce5abb](https://github.com/nicopasla/better-intra/commit/bce5abb))
- fix(theme-manager): correct variable casing for theme imports ([f9fdcc8](https://github.com/nicopasla/better-intra/commit/f9fdcc8))

### Maintenance 🧹

- chore(docs): update README ([e80493b](https://github.com/nicopasla/better-intra/commit/e80493b))

### Other Changes 🔄

- docs: add Intra v2 dark mode feature reference to README ([b9f6b7f](https://github.com/nicopasla/better-intra/commit/b9f6b7f))

## [1.0.7] - 2026-05-27

### Features 🎉

- feat: implement dark mode ([3fa719a](https://github.com/nicopasla/better-intra/commit/3fa719a))

### Bug fixes 🐛

- fix(profile-card): update progress bar styling to hide wave when progress is 0 ([ac01671](https://github.com/nicopasla/better-intra/commit/ac01671))

## [1.0.6] - 2026-05-27

### Features 🎉

- feat(profile): add option to use custom color on profile card ([0aa21c5](https://github.com/nicopasla/better-intra/commit/0aa21c5))
- feat(profile-card): add custom styling and theme application for profile card ([a05cfbb](https://github.com/nicopasla/better-intra/commit/a05cfbb))
- feat(logtime): add new fetched visuals for other profiles ([b255237](https://github.com/nicopasla/better-intra/commit/b255237))
- feat(render): implement capping logic ([b02c43e](https://github.com/nicopasla/better-intra/commit/b02c43e))
- feat(milestones): enhance milestone styles with improved gradients and shadows ([1780b41](https://github.com/nicopasla/better-intra/commit/1780b41))
- feat(hubSettings): implement cloud sync functionality and update save button states ([f8ae016](https://github.com/nicopasla/better-intra/commit/f8ae016))
- feat(account): add sync toggle and update button states in account tab ([2f356ad](https://github.com/nicopasla/better-intra/commit/2f356ad))
- feat(account): add optional success callback to loginWith42 function ([3aac664](https://github.com/nicopasla/better-intra/commit/3aac664))

### Bug fixes 🐛

- fix(logtime-settings): change orders of two options ([42aad6c](https://github.com/nicopasla/better-intra/commit/42aad6c))
- fix(hub-settings): update input field styling and placeholder, adjust maxlength to improve user experience ([7b98dc5](https://github.com/nicopasla/better-intra/commit/7b98dc5))

### Maintenance 🧹

- chore(account): enhance account tab layout and styling with improved card designs and action buttons ([c1dbd1b](https://github.com/nicopasla/better-intra/commit/c1dbd1b))
- chore(about-panel): enhance layout and styling of the about panel with new action links and improved tech stack presentation ([89c3eaa](https://github.com/nicopasla/better-intra/commit/89c3eaa))
- chore(clusters): update overrides for row positions in Belgium clusters ([8934e99](https://github.com/nicopasla/better-intra/commit/8934e99))
- chore: update subproject commit reference in better-intra-worker ([5738919](https://github.com/nicopasla/better-intra/commit/5738919))
- chore(about): add web-ext version to about panel and update vite config ([4357cc1](https://github.com/nicopasla/better-intra/commit/4357cc1))
- chore: update subproject commit reference in better-intra-worker ([6e48db0](https://github.com/nicopasla/better-intra/commit/6e48db0))
- chore: update dependencies in package.json and package-lock.json ([78b74c1](https://github.com/nicopasla/better-intra/commit/78b74c1))

### Other Changes 🔄

- refactor(highlight): enhance structure and readability of highlight logic and style injection ([ad53b78](https://github.com/nicopasla/better-intra/commit/ad53b78))
- refactor(account): simplify account tab rendering and enhance UI layout ([0d59447](https://github.com/nicopasla/better-intra/commit/0d59447))
- refactor(main): streamline feature initialization by using a mapping approach ([3f35e37](https://github.com/nicopasla/better-intra/commit/3f35e37))
- refactor(clusters): modularize cluster handling by separating DOM and UI logic ([28ed341](https://github.com/nicopasla/better-intra/commit/28ed341))
- refactor(account): refactor account management with improved state handling and modular handlers ([c75af7a](https://github.com/nicopasla/better-intra/commit/c75af7a))
- refactor(config): restructure configuration management and enhance type safety ([4a2e052](https://github.com/nicopasla/better-intra/commit/4a2e052))
- refactor(logtime): Split logtime feature into separate modules ([effa28c](https://github.com/nicopasla/better-intra/commit/effa28c))

## [1.0.5] - 2026-05-21

### Features 🎉

- feat(shortcuts): add separator styling to shortcuts display for improved layout ([4463049](https://github.com/nicopasla/better-intra/commit/4463049))
- feat(shortcuts): add emoji support to shortcut links and enhance rendering ([2a1f6c7](https://github.com/nicopasla/better-intra/commit/2a1f6c7))
- feat(milestones): add milestone animations and styles to enhance profile visuals ([256e507](https://github.com/nicopasla/better-intra/commit/256e507))

### Bug fixes 🐛

- fix(profile): update placeholder text and translate alignment labels in modal ([dc1b2d8](https://github.com/nicopasla/better-intra/commit/dc1b2d8))
- fix(milestones): remove not used CSS ([d14a719](https://github.com/nicopasla/better-intra/commit/d14a719))
- fix(milestones): refactor animation function and improve milestone enhancement logic ([a898912](https://github.com/nicopasla/better-intra/commit/a898912))
- fix(logtime): improve log slider behavior and enhance scroll functionality ([66bf033](https://github.com/nicopasla/better-intra/commit/66bf033))
- fix(visuals): enhance text styles for better readability in profile section ([401dbdf](https://github.com/nicopasla/better-intra/commit/401dbdf))
- fix(manifest): ensure incognito mode is set to not allowed ([df97180](https://github.com/nicopasla/better-intra/commit/df97180))
- fix(publish): move Chrome artifact to the root directory ([b9f7291](https://github.com/nicopasla/better-intra/commit/b9f7291))

### Maintenance 🧹

- chore(hubSettings): update description for logtime average display setting ([da0960c](https://github.com/nicopasla/better-intra/commit/da0960c))

## [1.0.4] - 2026-05-20

### Bug fixes 🐛

- fix(hubSettings): prevent event propagation on setting control interactions ([4a00930](https://github.com/nicopasla/better-intra/commit/4a00930))
- fix(logtime): implement fetch hook in separate hook.js file ([7109a19](https://github.com/nicopasla/better-intra/commit/7109a19))

### Maintenance 🧹

- chore: update daisyui version to 5.5.20 ([460c9ae](https://github.com/nicopasla/better-intra/commit/460c9ae))

### Other Changes 🔄

- refactor(publish.yaml): separate web-ext build steps for Firefox and Chrome ([a260a2b](https://github.com/nicopasla/better-intra/commit/a260a2b))
- refactor(package.json): add Brave browser support for development scripts ([6a9b67b](https://github.com/nicopasla/better-intra/commit/6a9b67b))
- refactor(events): integrate Belgium event data and optimize filter logic ([4e1afb2](https://github.com/nicopasla/better-intra/commit/4e1afb2))
- refactor(clusters): integrate Belgium cluster definitions and refactor screen building logic ([6258906](https://github.com/nicopasla/better-intra/commit/6258906))
- refactor(hubSettings): update cluster setting to use select input with options ([c0a202d](https://github.com/nicopasla/better-intra/commit/c0a202d))
- refactor(hubSettings): enhance number input handling with euro suffix and improve select option comparison ([c71e216](https://github.com/nicopasla/better-intra/commit/c71e216))
- refactor(logtime): improve scroll handling and CSS properties for better performance ([6680392](https://github.com/nicopasla/better-intra/commit/6680392))
- refactor: migrate storage API from Firefox to Chrome ([4f58f66](https://github.com/nicopasla/better-intra/commit/4f58f66))
- refactor(games): remove Flagle game integration code ([5ce51de](https://github.com/nicopasla/better-intra/commit/5ce51de))
- refactor(scripts): separate web-ext commands for Firefox and Chrome ([2fa7641](https://github.com/nicopasla/better-intra/commit/2fa7641))
- refactor: migrate storage API from Firefox to Chrome ([c86b983](https://github.com/nicopasla/better-intra/commit/c86b983))


## [1.0.3] - 2026-05-19

### Features 🎉

- feat(profile): add drag-and-drop card ordering UI and layout configuration ([bf8ad75](https://github.com/nicopasla/better-intra/commit/bf8ad75))

### Bug fixes 🐛

- fix(hub): update modal dimensions to be responsive and full-width ([788d794](https://github.com/nicopasla/better-intra/commit/788d794))
- fix(shortcuts): add fallback icon for shortcut links on image load error ([39da338](https://github.com/nicopasla/better-intra/commit/39da338))

### Other Changes 🔄

- refactor(profile): remove 'Hide achievements' setting and update layout configuration ([892e10d](https://github.com/nicopasla/better-intra/commit/892e10d))

## [1.0.2] - 2026-05-18

### Features 🎉

- feat(profile): add alternative layout and hide achievements options ([3cef0e9](https://github.com/nicopasla/better-intra/commit/3cef0e9))
- feat(profile): add banner and background mode options ([2a80d24](https://github.com/nicopasla/better-intra/commit/2a80d24))

### Bug fixes 🐛

- fix(logtime): refine CSS selectors for logtime components ([91670b0](https://github.com/nicopasla/better-intra/commit/91670b0))
- fix(docs): update clone command in README and remove zipping instruction ([1bd69db](https://github.com/nicopasla/better-intra/commit/1bd69db))
- fix(publish): update artifact handling in GitHub Actions workflow ([8c54cf7](https://github.com/nicopasla/better-intra/commit/8c54cf7))

### Maintenance 🧹

- chore(shortcuts): update display styles for shortcut links and improve layout ([8d4daa9](https://github.com/nicopasla/better-intra/commit/8d4daa9))

## [1.0.1] - 2026-05-17

### Features 🎉

- feat(publish): add GitHub Actions workflow for building and publishing releases ([10f11cd](https://github.com/nicopasla/better-intra/commit/10f11cd))
- feat(account): implement login hashing for enhanced security ([d98553f](https://github.com/nicopasla/better-intra/commit/d98553f))

### Bug fixes 🐛

- fix(highlight): update style import and formatting for consistency ([c7a9850](https://github.com/nicopasla/better-intra/commit/c7a9850))
- fix(account): update API endpoints for cloud settings and visuals ([0afa0b3](https://github.com/nicopasla/better-intra/commit/0afa0b3))
- fix(package): update version to 1.0.1 ([b01eafd](https://github.com/nicopasla/better-intra/commit/b01eafd))

## [1.0.0] - 2026-05-17

### Features 🎉

- feat(about): add About panel with technical stack information and SVG icons ([665aa9c](https://github.com/nicopasla/better-intra/commit/665aa9c))
- feat(account): integrate 42 logo SVG and update button styles ([19a5259](https://github.com/nicopasla/better-intra/commit/19a5259))
- feat(hub): add GitHub SVG icon to hub settings modal ([2ca6bac](https://github.com/nicopasla/better-intra/commit/2ca6bac))
- feat(account): enhance button states for push, pull, and test connection actions ([3024960](https://github.com/nicopasla/better-intra/commit/3024960))
- feat(profile): add arrow share icon and migrate to lit ([4fadc7c](https://github.com/nicopasla/better-intra/commit/4fadc7c))
- feat(profile): implement seat highlighting ([6c0be0a](https://github.com/nicopasla/better-intra/commit/6c0be0a))
- feat(clusters): enhance cluster picker with tooltip and improve rendering logic ([471501e](https://github.com/nicopasla/better-intra/commit/471501e))
- feat(events): enhance event filter UI with improved styling and functionality ([5fd1bb4](https://github.com/nicopasla/better-intra/commit/5fd1bb4))
- feat(account): refactor login handling to use cloud login and enhance connection checks ([76ab606](https://github.com/nicopasla/better-intra/commit/76ab606))
- feat(account): enhance cloud synchronization with token management using oAuth from 42 ([d3b6e1c](https://github.com/nicopasla/better-intra/commit/d3b6e1c))
- feat(logtime): refactor fetch hook to use event listener for stats extraction ([9a5ab24](https://github.com/nicopasla/better-intra/commit/9a5ab24))

### Bug fixes 🐛

- fix(manifest): update strict minimum version for Gecko settings to 140.0 ([949ef80](https://github.com/nicopasla/better-intra/commit/949ef80))
- fix(shortcuts): update shortcuts display integration and styling ([de3cdb2](https://github.com/nicopasla/better-intra/commit/de3cdb2))
- fix(manifest): remove redundant match pattern for content scripts ([3bfb6e1](https://github.com/nicopasla/better-intra/commit/3bfb6e1))
- fix(clusters): add type annotations for cluster dimensions ([c9bbe72](https://github.com/nicopasla/better-intra/commit/c9bbe72))
- fix(account): improve 42 authentication handling with message listener and remove polling ([04bcfe5](https://github.com/nicopasla/better-intra/commit/04bcfe5))
- fix(profile): correct avatar opacity handling in updateVisuals function ([d7e2ead](https://github.com/nicopasla/better-intra/commit/d7e2ead))

### Maintenance 🧹

- chore(manifest): update extension ID and add update URL; add updates.json for version management ([b497345](https://github.com/nicopasla/better-intra/commit/b497345))
- chore(docs): add new account connection image and update existing account image ([d4b73e7](https://github.com/nicopasla/better-intra/commit/d4b73e7))
- chore(svg): update settings gear icon ([1f82973](https://github.com/nicopasla/better-intra/commit/1f82973))
- chore: remove GitHub Actions build workflow ([a6ad81b](https://github.com/nicopasla/better-intra/commit/a6ad81b))
- chore(profile): refactor event handling and remove unused profile styles ([accbc08](https://github.com/nicopasla/better-intra/commit/accbc08))
- chore: update dependencies to latest versions ([99b21b8](https://github.com/nicopasla/better-intra/commit/99b21b8))

### Other Changes 🔄

- refactor: migrate entire project from Userscript to standalone Firefox Extension ([5119ec6](https://github.com/nicopasla/better-intra/commit/5119ec6))


## [0.1.0] - 2026-05-13

### Features 🎉

- feat(logtime): add emoji customization and related settings for logtime feature ([829f9f1](https://github.com/nicopasla/better-intra/commit/829f9f1))
- feat(shortcuts): add favicon retrieval and enhance shortcut row UI ([56347ca](https://github.com/nicopasla/better-intra/commit/56347ca))
- feat(shortcuts): add shortcuts feature with UI for managing links ([73492e4](https://github.com/nicopasla/better-intra/commit/73492e4))

### Bug fixes 🐛

- fix(visuals): refine avatar selector to include specific dimensions ([3207100](https://github.com/nicopasla/better-intra/commit/3207100))

### Maintenance 🧹

- chore: Bump version to 0.1.0 and update changelog ([d233063](https://github.com/nicopasla/better-intra/commit/d233063))
- chore(refactor): Migrate from innerHTML to lit-html templates ([e05b07d](https://github.com/nicopasla/better-intra/commit/e05b07d))

### Other Changes 🔄

- refactor(hub): enhance styling and button sizes in hub modal ([61e9112](https://github.com/nicopasla/better-intra/commit/61e9112))
- refactor(clusters): consolidate configuration management and remove utility functions ([3d7d18d](https://github.com/nicopasla/better-intra/commit/3d7d18d))

## [0.0.4] - 2026-05-11

### Bug fixes 🐛

- fix(hub): improve modal header styling and version display ([cbb7171](https://github.com/nicopasla/better-intra/commit/cbb7171))
- fix(logtime): enhance liquid-fill styles and manage past state animations ([63e1878](https://github.com/nicopasla/better-intra/commit/63e1878))

## [0.0.3] - 2026-05-11

### Bug fixes 🐛

- fix(logtime): update fetch hook to support unsafeWindow and ensure proper initialization ([8e54b88](https://github.com/nicopasla/better-intra/commit/8e54b88))

## [0.0.2] - 2026-05-11

### Features 🎉

- feat(hub): update icons and add theme toggle functionality ([cd7f7ca](https://github.com/nicopasla/better-intra/commit/cd7f7ca))
- feat(profile): Rename background variable for consistency and clarity ([d792b01](https://github.com/nicopasla/better-intra/commit/d792b01))
- feat(profile): Make the username font size bigger ([fa119c2](https://github.com/nicopasla/better-intra/commit/fa119c2))
- feat: Add userscript description ([60ece35](https://github.com/nicopasla/better-intra/commit/60ece35))

### Bug fixes 🐛

- fix(logtime): Prevent multiple initializations and optimize resource fetching ([1447068](https://github.com/nicopasla/better-intra/commit/1447068))
- fix(profile): Add findSlotsButton function to manage slots redirection ([80e1694](https://github.com/nicopasla/better-intra/commit/80e1694))
- fix(profile): Adjust font size and improve code readability ([8c54397](https://github.com/nicopasla/better-intra/commit/8c54397))

### Maintenance 🧹

- chore: Add paths to build triggers for push and pull_request ([a324ac0](https://github.com/nicopasla/better-intra/commit/a324ac0))
- chore: Add GitHub Actions workflow for release drafting ([0797d22](https://github.com/nicopasla/better-intra/commit/0797d22))
- chore(profile): Refactor profile visuals ([8aa3ff8](https://github.com/nicopasla/better-intra/commit/8aa3ff8))
- chore: Update README ([773a0f2](https://github.com/nicopasla/better-intra/commit/773a0f2))

[unreleased]: https://github.com/nicopasla/better-intra/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/nicopasla/better-intra/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/nicopasla/better-intra/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nicopasla/better-intra/compare/v1.0.9...v1.1.0
[1.0.9]: https://github.com/nicopasla/better-intra/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/nicopasla/better-intra/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/nicopasla/better-intra/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/nicopasla/better-intra/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/nicopasla/better-intra/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/nicopasla/better-intra/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/nicopasla/better-intra/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/nicopasla/better-intra/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/nicopasla/better-intra/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nicopasla/better-intra/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/nicopasla/better-intra/compare/v0.0.4...v0.1.0
[0.0.4]: https://github.com/nicopasla/better-intra/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/nicopasla/better-intra/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/nicopasla/better-intra/compare/v0.0.1...v0.0.2


**Full Changelog:** https://github.com/nicopasla/better-intra/compare/v0.0.1...HEAD
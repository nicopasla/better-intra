# Better Intra

Collection of features inside a single Firefox Extension that improve UI and UX of the 42 Intra v3.

## ⚡ Quick Start

1. **Install the Extension:** Download the latest signed `.xpi` from the [Releases](https://github.com/nicopasla/better-intra/releases) page.
2. **Accept Permissions:** Allow the extension to access your storage and run on the Intra domain.
3. Refresh your Intra tab and explore the new features.

## Features

### 📅 Logtime
Redesigns logtime tracking to show weekly and total hours.
* **Goal Tracking:** Set a target number of hours (default: 140) to track your progress.
* **Daily Average:** Display your average hours per day.
* **Last active label:** Date can be displayed as "17/04", "2 days ago", or both.
* **Visual Control:** Fully customize calendar and label colors to match your taste.
* **Emoji visualizer:** Custom emoji, emoji value and hourly earning.

---

### 🖥️ Clusters
Improves cluster navigation and visual orientation.
* **Directional Markers:** Adds "chair" icons to the cluster map to show seat orientation.
* **Default Cluster:** Set a preferred Cluster ID to load your favorite cluster instantly.

---

### 👤 Profile
Enhances readability and adds local customization options.
* **Change your:** Avatar, Banner, Background.
> When viewing another person profile with Better Intra installed you will see his custom images.
* **Event Filtering:** Campus Filter, Category Filter.
* Redirection of the "Manage slots" button to the correct webpage.
* Improved readability using a clean system-font stack.

---

### 🔗 Shortcuts
Adds custom quick-access links on the profile page.
* Up to 8 configurable shortcuts.

---

### ☁️ Account
* Store your local settings into a KV database on a Cloudflare Worker.

---

### ⚙️ Settings
<img alt="Settings" src="images/settings.gif"/>

## Screenshots

<img alt="Logtime screenshot" src="images/logtime.png"/>
<img alt="Profile screenshot" src="images/profile.png"/>
<img alt="Events screenshot" src="images/profile-events.png"/>
<img alt="Events screenshot" src="images/shortcuts-settings.png"/>
<img alt="Account screenshot" src="images/account.png"/>

## Uninstall

Go to `about:addons` in Firefox, find **Better Intra** and click **Remove**.

## Disclaimer

This extension is a personal project that only changes the style of the website. It is purely aesthetic and does not fetch anything except esthetics settings when visiting others profiles.
This can break at any time due to intra code changes.
Always use at your own risk!

## Built with:

* TypeScript (Core logic)
* [Vite](https://vite.dev/) (Bundler & asset pipeline)
* [DaisyUI](https://daisyui.com/) & **Tailwind CSS** (UI components & settings modal)
* GitHub Actions (CI/CD for automated builds, versioning, and changelogs)
* Gemini and Copilot Student (Documentation & Optimization)
* Cloudflare Workers & KV (Serverless backend for cloud settings storage)
* 42 API (OAuth2) (Secure user identification and authentication)
* Font Awesome (SVG icons)

## Compatibility

| Browser | Support |           Note            |
|:-------:|:-------:|:-------------------------:|
| Firefox |    ✅    | Main target (Manifest v3) |
| Chrome  |    ❓    | Not officially supported  |
|  Brave  |    ❓    | Not officially supported  |

## Privacy

- This extension runs entirely locally, except when syncing settings with the Cloudflare Worker KV.
- Settings are stored securely via the WebExtensions `browser.storage.local` API.
- The extension requires zero data collection permissions.

## Development

### Prerequisites
- Node.js
- npm

### Setup
```bash
git clone [https://github.com/nicopasla/better-intra.git](https://github.com/nicopasla/better-intra.git)
cd better-intra
npm install
```
* **Development build** (Watch + Live Reload via web-ext):
```bash
npm run dev
```
* **Production build**
```bash
npm run build
```
The output manifest.json and compiled content.js will be generated in the dist/ folder. Zip the contents of this folder to submit your extension.

## License

MIT

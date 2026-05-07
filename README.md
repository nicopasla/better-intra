# Better Intra

Collection of features inside a single Userscript that improve UI and UX of the 42 Intra v3.

## ⚡ Quick Start

1.  **Install a Manager:** **[Violentmonkey](https://violentmonkey.github.io/)** (recommended) or [Tampermonkey](https://www.tampermonkey.net/).
2.  **Install the Script:** **[Click here to install](https://github.com/nicopasla/better-intra/releases/latest/download/better-intra.user.js)**.
3.  Refresh your Intra tab and explore the new features.

## Features

### 📅 Logtime
* **Goal Tracking:** Set a target number of hours (default: 140) to track your progress.
* **Daily Average:** Display your average hours per day.
* **Last active label:** Date can be displayed as "17/04", "2 days ago", or both.
* **Visual Control:** Fully customize calendar and label colors to match your taste.

### 🖥️ Clusters
* **Directional Markers:** Adds "chair" icons to the cluster map to show seat orientation.
* **Default Cluster:** Set a preferred Cluster ID to load your favorite cluster instantly.

### 👤 Profile
* **Locally change your:**
  * Avatar
  * Banner
  * Background

* **Event Filtering:**
  * Campus Filter.
  * Category Filter.
* Redirection of the "Manage slots" button to the correct webpage.
* Improved readability using a clean system-font stack.

### ⚙️ Settings
<img alt="Settings" src="images/settings.gif"/>

## Screenshots

<img alt="Logtime screenshot" src="images/logtime.png"/>
<img alt="Profile screenshot" src="images/profile.png"/>
<img alt="Events screenshot" src="images/profile-events.png"/>

## Uninstall

Disable or remove the script from your userscript manager.

## Disclaimer

This extension is a personal project that only changes the style of the website. It is purely aesthetic and does not fetch anything.
This can break at any time due to intra code changes.
Always use at your own risk!

## Built with:

* Typescript / JavaScript (Core Logic)
* [DaisyUI](https://daisyui.com/) (Modal settings dialog, documentation)
* Gemini and Copilot Student (Documentation & Optimization)

## Compatibility

Tested only on Firefox (Old and new), only work on Intra v3

| Browser | Tampermonkey | Violentmonkey |
| :-----: | :----------: | :-----------: |
| Firefox |      ✅      |      ✅       |
| Chrome  |      ❓      |      ❓       |
|  Brave  |      ❓      |      ❓       |

## Privacy

- This script is only working on local.
- Settings are stored locally (userscript storage).
- The release is created using Github Actions from the source.

## TODO

- At some point it should be converted into a single Firefox extension, for now it's easier to maintain a single Userscript to fix specific bugs

## License

MIT

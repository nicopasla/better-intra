# Privacy Policy for Better Intra

*Last updated: June 2026*

## Data Collection

Better Intra does **not** collect, sell, or share any user data. The extension operates primarily on your local device.

### Local-Only Data

All extension settings (logtime goals, colours, shortcuts, cluster preferences, profile visuals, friend list, feature toggles) are stored locally on your device using `chrome.storage.local`. This data never leaves your browser unless you explicitly enable cloud sync.

Logtime data is read directly from the 42 Intra page — it is never transmitted anywhere.

### Cloud Sync (Optional)

If you enable cloud sync, the following data is transmitted to the extension's Cloudflare Worker at `better-intra-worker.nicopasla.workers.dev`:

- Your **42 login** (hashed) — used to identify your stored settings
- Your **extension settings** — so they can be synced across devices
- Your **friend logins** — to fetch their online status and location
- Your **custom profile visuals** (avatar, banner, background URLs) — so other Better Intra users can see them when viewing your profile

Data stored in Cloudflare KV is keyed under a hash of your login and is only accessible to you. The worker retains **invocation logs** for debugging purposes (request timestamps, endpoints, and HTTP status codes). These logs are not used for tracking or analytics.

The worker also caches **friend user IDs** and **online status** in separate KV keys to reduce calls to the 42 API. This cache is temporary and only contains 42 user IDs and online status booleans.

### OAuth Authentication

When you authenticate via 42 OAuth, a temporary session token is stored locally in `chrome.storage.local`. This token is used to authenticate requests to the Cloudflare Worker. It is never shared with third parties.

### Third-Party Access

- **42 API** (`api.intra.42.fr`): The Cloudflare Worker calls the 42 API on your behalf to fetch friend data and verify your identity. This is done with your OAuth token and is limited to what's needed for the extension's features.
- **No analytics, tracking, or advertising services** are used.
- **No data is sold or transferred** to any third party.

## Data Retention & Deletion

- **Local data**: Cleared when you uninstall the extension or click "Reset" in the Settings Hub.
- **Cloud data**: You can delete all cloud-stored data at any time via the "Wipe All Data" button in the Account section of the popup.
- **Invocation logs**: Retained for up to 30 days for debugging purposes, then automatically deleted.

## Permissions

- `storage` — to save and load your settings locally
- `activeTab` — to reload the current 42 Intra page after applying synced settings
- `https://better-intra-worker.nicopasla.workers.dev/` — to communicate with the extension's Cloudflare Worker for optional cloud features

## Changes to This Policy

If this policy changes, the extension version will be updated and the "Last updated" date at the top of this page will reflect the change.

## Contact

For questions about this privacy policy, open an issue at:
https://github.com/nicopasla/better-intra/issues

import { subjectMeta } from "./features/subjects/meta";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ PENDING_WELCOME: true });
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if ("CLOUD_TOKEN" in changes) {
    void shouldReloadOnTokenChange().then((reload) => {
      if (reload) reloadIntraTabs();
    });
  }
});

async function shouldReloadOnTokenChange(): Promise<boolean> {
  const { WELCOME_ACTIVE_UNTIL } = (await chrome.storage.local.get(
    "WELCOME_ACTIVE_UNTIL",
  )) as { WELCOME_ACTIVE_UNTIL?: number };
  return !WELCOME_ACTIVE_UNTIL || Date.now() >= WELCOME_ACTIVE_UNTIL;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FT_RELOAD_INTRA_TABS") {
    reloadIntraTabs()
      .catch(() => undefined)
      .finally(sendResponse);
    return true;
  }
  if (message?.type === "FT_OPEN_HUB") {
    openHub()
      .catch(() => undefined)
      .finally(sendResponse);
    return true;
  }
  if (message?.type === "FT_SUBJECT_META") {
    subjectMeta(String(message?.url ?? ""))
      .then((modifiedAt) => sendResponse({ modifiedAt }))
      .catch(() => sendResponse({ modifiedAt: null }));
    return true;
  }
  return undefined;
});

async function openHub() {
  const tabs = await chrome.tabs.query({ url: "https://*.intra.42.fr/*" });
  const existing = tabs[0];
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) {
      try {
        await chrome.windows.update(existing.windowId, { focused: true });
      } catch {
        // focusing is best-effort
      }
    }
    chrome.tabs.reload(existing.id);
    return;
  }
  await chrome.tabs.create({ url: "https://profile-v3.intra.42.fr/" });
}

async function reloadIntraTabs() {
  const tabs = await chrome.tabs.query({ url: "https://*.intra.42.fr/*" });
  if (tabs.length === 0) {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (active?.id) chrome.tabs.reload(active.id);
    return;
  }
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.reload(tab.id);
  }
}

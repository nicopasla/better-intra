import { AVATAR_SELECTOR } from "../profile/selectors.ts";

const WELCOME_HOST = "profile-v3.intra.42.fr";

function isProfileShellReady(): boolean {
  return (
    !!document.querySelector(AVATAR_SELECTOR) ||
    !!document.getElementById("hub-gear-btn")
  );
}

async function waitForProfileShell(timeoutMs = 2000): Promise<boolean> {
  if (isProfileShellReady()) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    if (isProfileShellReady()) return true;
  }
  return isProfileShellReady();
}

export async function maybeShowWelcome(): Promise<void> {
  try {
    if (window.location.hostname !== WELCOME_HOST) return;

    const { PENDING_WELCOME } = (await chrome.storage.local.get(
      "PENDING_WELCOME",
    )) as { PENDING_WELCOME?: boolean };

    if (!PENDING_WELCOME) return;

    if (!(await waitForProfileShell())) return;

    const { openWelcome } = await import("./welcome.ui.ts");

    await chrome.storage.local.remove("PENDING_WELCOME");

    try {
      await openWelcome();
    } catch (e) {
      await chrome.storage.local.set({ PENDING_WELCOME: true });
      throw e;
    }
  } catch (e) {
    console.error("Better Intra: failed to show the welcome screen", e);
  }
}

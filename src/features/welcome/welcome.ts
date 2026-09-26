export async function maybeShowWelcome(): Promise<void> {
  try {
    const { PENDING_WELCOME } = (await chrome.storage.local.get(
      "PENDING_WELCOME",
    )) as { PENDING_WELCOME?: boolean };

    if (!PENDING_WELCOME) return;

    await chrome.storage.local.remove("PENDING_WELCOME");

    const { openWelcome } = await import("./welcome.ui.ts");
    await openWelcome();
  } catch (e) {
    console.error("Better Intra: failed to show the welcome screen", e);
  }
}

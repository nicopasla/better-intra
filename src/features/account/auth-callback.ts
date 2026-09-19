/**
 * Guards for the OAuth-style callbacks handled in src/main.ts.
 *
 * The worker redirects back to an intra page with the result in the query
 * string (`?token=&login=` for the 42 login, `?discord_id=` for the Discord
 * link). Because the content script runs on every intra page, anyone could
 * craft such a link and have the victim's extension adopt an attacker-chosen
 * account or Discord id (session fixation).
 *
 * To prevent that, the extension records *when it started* a flow, and the
 * callback is only honoured if a matching flow was started recently.
 */

export type AuthFlow = "cloud" | "discord";

/** How long a started flow stays valid. Generous: the user may take a while to sign in. */
export const AUTH_FLOW_TTL_MS = 10 * 60 * 1000;

const PENDING_KEYS: Record<AuthFlow, string> = {
  cloud: "OAUTH_PENDING_AT",
  discord: "DISCORD_AUTH_PENDING_AT",
};

/**
 * Call right before opening the authentication window. Resolves only once the
 * write has been committed: the extension popup is torn down when the auth
 * window takes focus, and Firefox cancels an in-flight storage write when that
 * happens, which would leave the callback without a marker.
 */
export async function markAuthFlowPending(flow: AuthFlow): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [PENDING_KEYS[flow]]: Date.now() }, () =>
      resolve(),
    );
  });
}

/** Pure check, exported for tests. */
export function isAuthFlowFresh(
  pendingAt: unknown,
  now: number = Date.now(),
): boolean {
  if (typeof pendingAt !== "number" || !Number.isFinite(pendingAt))
    return false;
  const age = now - pendingAt;
  return age >= 0 && age <= AUTH_FLOW_TTL_MS;
}

/**
 * Read the pending marker for a flow without clearing it. Returns true when a
 * matching flow was started recently. Callers should clear it once the callback
 * has been fully processed so a failed handling can be retried.
 */
export async function peekAuthFlow(
  flow: AuthFlow,
  now: number = Date.now(),
): Promise<boolean> {
  const key = PENDING_KEYS[flow];
  const store = await chrome.storage.local.get(key);
  return isAuthFlowFresh(store?.[key], now);
}

/** Clear the pending marker for a flow. */
export async function clearAuthFlow(flow: AuthFlow): Promise<void> {
  await chrome.storage.local.remove(PENDING_KEYS[flow]);
}

/**
 * Consume the pending marker for a flow. Returns true when the callback may be
 * trusted. The marker is always cleared, so a callback can only be used once.
 */
export async function consumeAuthFlow(
  flow: AuthFlow,
  now: number = Date.now(),
): Promise<boolean> {
  const fresh = await peekAuthFlow(flow, now);
  await clearAuthFlow(flow);
  return fresh;
}

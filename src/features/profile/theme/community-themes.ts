import { workerFetch, WORKER_URL } from "../../../utils/worker.ts";
import { getConfig } from "../../../config.ts";
import { hashLogin } from "../../../utils/crypto.ts";
import { sanitizeTheme, type CommunityTheme } from "./theme-schema.ts";

const GALLERY_URL = `${WORKER_URL}/api/v1/public/themes`;
const TTL = 5 * 60_000;

let cache: { themes: CommunityTheme[]; ts: number } | null = null;

export interface CommunityThemesResult {
  themes: CommunityTheme[];
  error: boolean;
}

export async function fetchCommunityThemes(
  force = false,
): Promise<CommunityThemesResult> {
  if (!force && cache && Date.now() - cache.ts < TTL) {
    return { themes: cache.themes, error: false };
  }
  try {
    const res = await fetch(GALLERY_URL, {
      cache: force ? "no-store" : undefined,
    });
    if (!res.ok) return { themes: cache?.themes ?? [], error: true };
    const data = (await res.json()) as { themes?: unknown[] };
    const themes = (data.themes ?? [])
      .map(sanitizeTheme)
      .filter((t): t is CommunityTheme => !!t);
    cache = { themes, ts: Date.now() };
    return { themes, error: false };
  } catch {
    return { themes: cache?.themes ?? [], error: true };
  }
}

export interface ShareResult {
  ok: boolean;
  error?: string;
}

export async function shareCommunityTheme(input: {
  name: string;
  mode: "dark" | "light";
  colors: { dark: Record<string, string>; light: Record<string, string> };
}): Promise<ShareResult> {
  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !login) {
    return { ok: false, error: "Connect your 42 account to share themes." };
  }
  const hashedLogin = await hashLogin(login);
  const theme = sanitizeTheme({
    name: input.name,
    author: login,
    mode: input.mode,
    colors: input.colors,
  });
  if (!theme) return { ok: false, error: "Invalid theme." };

  try {
    const res = await workerFetch(
      `/api/v1/themes?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        token,
        body: {
          name: theme.name,
          author: theme.author,
          mode: theme.mode,
          colors: theme.colors,
        },
      },
    );
    if (res.ok) {
      await fetchCommunityThemes(true);
      return { ok: true };
    }
    if (res.status === 401) {
      return {
        ok: false,
        error: "Session expired — reconnect your 42 account.",
      };
    }
    return { ok: false, error: "Couldn't share the theme." };
  } catch {
    return { ok: false, error: "Network error — try again later." };
  }
}

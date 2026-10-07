import { workerFetch, WORKER_URL } from "../../../utils/worker.ts";
import { getConfig } from "../../../config.ts";
import { hashLogin } from "../../../utils/crypto.ts";
import { sanitizeTheme, type CommunityTheme } from "./theme-schema.ts";

const GALLERY_URL = `${WORKER_URL}/api/v1/public/themes`;

export interface CommunityThemesResult {
  themes: CommunityTheme[];
  error: boolean;
}

export async function fetchCommunityThemes(
  q = "",
): Promise<CommunityThemesResult> {
  const query = q.trim();
  const url = query
    ? `${GALLERY_URL}?q=${encodeURIComponent(query)}`
    : GALLERY_URL;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { themes: [], error: true };
    const data = (await res.json()) as { themes?: unknown[] };
    const themes = (data.themes ?? [])
      .map(sanitizeTheme)
      .filter((t): t is CommunityTheme => !!t);
    return { themes, error: false };
  } catch {
    return { themes: [], error: true };
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
    if (res.ok) return { ok: true };
    if (res.status === 401) {
      return {
        ok: false,
        error: "Session expired — reconnect your 42 account.",
      };
    }
    if (res.status === 409) {
      return { ok: false, error: "That theme name is already taken." };
    }
    return { ok: false, error: "Couldn't share the theme." };
  } catch {
    return { ok: false, error: "Network error — try again later." };
  }
}

/** Anonymous like counter: `delta` is +1 to like, -1 to undo. */
export async function likeTheme(
  id: string,
  delta: 1 | -1,
): Promise<{ ok: boolean; likes?: number }> {
  try {
    const res = await workerFetch(
      `/api/v1/themes/${encodeURIComponent(id)}/like?delta=${delta}`,
      { method: "POST" },
    );
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { likes?: number };
    return { ok: true, likes: data.likes };
  } catch {
    return { ok: false };
  }
}

export async function hideTheme(id: string): Promise<{ ok: boolean }> {
  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !login) return { ok: false };
  const hashedLogin = await hashLogin(login);
  try {
    const res = await workerFetch(
      `/api/v1/themes/${encodeURIComponent(id)}/hide?login=${encodeURIComponent(hashedLogin)}`,
      { method: "POST", token },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

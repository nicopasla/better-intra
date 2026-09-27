const INTRAPY_BASE = "https://intrapy.intra.42.fr";

export function waitForIntrapyToken(
  timeout = 4000,
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: CustomEvent) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(e.detail);
    };
    const cleanup = () => {
      document.removeEventListener(
        "42_INTRAPY_TOKEN",
        handler as EventListener,
      );
      clearTimeout(timer);
    };
    document.addEventListener("42_INTRAPY_TOKEN", handler as EventListener);

    const stored = sessionStorage.getItem("ft_intrapy_token");
    if (stored) {
      resolved = true;
      cleanup();
      resolve(stored);
      return;
    }

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);
  });
}

export async function intrapyFetch<T>(
  path: string,
  token: string,
): Promise<T | null> {
  try {
    const res = await fetch(`${INTRAPY_BASE}${path}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function isPisciner(login: string): Promise<boolean> {
  try {
    const token = await waitForIntrapyToken();
    if (!token) return false;

    const data = await intrapyFetch<
      Array<{ grade?: string; slug?: string }>
    >(`/api/v1/users/${login}/cursus`, token);
    if (!Array.isArray(data)) return false;

    const hasPiscine = data.some((c) => c.grade === "Pisciner");
    if (!hasPiscine) return false;
    const hasCommonCore = data.some((c) => c.slug === "42cursus");
    return !hasCommonCore;
  } catch {
    return false;
  }
}

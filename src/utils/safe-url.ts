/**
 * Return the URL if it is an absolute http(s) URL, otherwise an empty string.
 * Use it before putting any externally provided URL into an href.
 */
export function sanitizeHttpUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const raw = url.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}
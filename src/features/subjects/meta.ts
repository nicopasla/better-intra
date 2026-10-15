/**
 * Subject PDF metadata, resolved from the authenticated CDN. Lives outside the
 * content-script bundle because the fetch needs extension host permissions
 * (to bypass CORS and send the user's session cookies).
 */

/** Parses a PDF `D:YYYYMMDDHHmmSS±HH'MM'` date string into epoch ms. */
export function parsePdfDate(raw: string): number | null {
  if (!raw) return null;
  const m = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = m[4] ? parseInt(m[4], 10) : 0;
  const minute = m[5] ? parseInt(m[5], 10) : 0;
  const second = m[6] ? parseInt(m[6], 10) : 0;
  let ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = raw.match(/([+-])(\d{2})'?(\d{2})?'?$/);
  if (offset) {
    const sign = offset[1] === "-" ? -1 : 1;
    const oh = parseInt(offset[2], 10);
    const om = offset[3] ? parseInt(offset[3], 10) : 0;
    ms -= sign * (oh * 3600 + om * 60) * 1000;
  }
  return Number.isNaN(ms) ? null : ms;
}

/** Reads the PDF's `/ModDate` (or `/CreationDate`) from the first chunk. */
async function scrapePdfModifiedAt(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Range: "bytes=0-32767" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("iso-8859-1").decode(buf);
    const match =
      text.match(/\/ModDate\s*\(([^)]*)\)/) ??
      text.match(/\/CreationDate\s*\(([^)]*)\)/);
    return match ? parsePdfDate(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the subject file's last-update date in epoch ms. Prefers the
 * `Last-Modified` response header (no body downloaded); falls back to the PDF
 * metadata when the header is absent.
 */
export async function subjectMeta(url: string): Promise<number | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const head = await fetch(url, { method: "HEAD", credentials: "include" });
    if (head.ok) {
      const header = head.headers.get("last-modified");
      const ms = header ? Date.parse(header) : NaN;
      if (Number.isFinite(ms)) return ms;
    }
  } catch {
    /* fall through to the metadata scrape */
  }
  return scrapePdfModifiedAt(url);
}

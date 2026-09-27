export const WORKER_URL = "https://api.betterintra.com";

export interface WorkerFetchOptions {
  token?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Fetch a path on the Better Intra worker. Returns the raw Response so callers
 * keep their own 401 / error handling. The token, when given, is sent as a
 * bearer credential; a JSON body is serialised and typed automatically.
 */
export function workerFetch(
  path: string,
  options: WorkerFetchOptions = {},
): Promise<Response> {
  const { token, method, body, headers, signal } = options;
  const finalHeaders: Record<string, string> = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";

  return fetch(path.startsWith("http") ? path : `${WORKER_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
}

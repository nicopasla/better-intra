import { getConfig } from "../../config.ts";
import { hashLogin } from "../../utils/crypto.ts";
import { workerFetch } from "../../utils/worker.ts";

export interface SubjectReportInput {
  slug: string;
  url: string;
  modifiedAt?: number;
}

/**
 * Shares the subject version read from the project page with the worker, which
 * fans it out to PWA users currently doing that project. Best effort: the next
 * visit retries if the cloud is unreachable or the user is signed out.
 */
export async function reportSubjectVersion(
  input: SubjectReportInput,
): Promise<void> {
  if (!input.modifiedAt || !input.slug || !input.url) return;

  const [token, login] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !login) return;

  try {
    const hashed = await hashLogin(login);
    await workerFetch(
      `/api/v1/private/subjects/report?login=${encodeURIComponent(hashed)}`,
      {
        method: "POST",
        token,
        body: {
          items: [
            {
              slug: input.slug,
              url: input.url,
              modifiedAt: input.modifiedAt,
            },
          ],
        },
      },
    );
  } catch {
    /* best effort */
  }
}

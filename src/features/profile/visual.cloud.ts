import { getIntraLogin } from "../account/account.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev/";

export async function fetchUserVisuals(login: string) {
  try {
    const response = await fetch(`${WORKER_URL}?login=${login}`);

    if (!response.ok) return null;
    const data = await response.json();

    return {
      avatar: data.settings?.PROFILE_IMAGE_URL,
      banner: data.settings?.PROFILE_BANNER_URL,
      background: data.settings?.PROFILE_BACKGROUND_URL,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function syncMyVisuals(settings: {
  avatar: string;
  banner: string;
  background: string;
}) {
  const myLogin = getIntraLogin();
  if (!myLogin) return;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: myLogin,
        settings: {
          PROFILE_IMAGE_URL: settings.avatar,
          PROFILE_BANNER_URL: settings.banner,
          PROFILE_BACKGROUND_URL: settings.background,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Worker rejected sync:", text);
    }
  } catch (e) {
    console.error("Cloud Post Error:", e);
  }
}

import { hashLogin } from "./utils/crypto";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

chrome.runtime.onInstalled.addListener(() => {
  createAlarm();
  syncRegistration();
  syncDiscord();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "poll-evaluations") {
    const store = await chrome.storage.local.get([
      "ACTIVE_SCRIPTS",
      "CLOUD_TOKEN",
      "CLOUD_LOGIN",
      "EVALUATIONS_NOTIFY_AS_EVALUATOR",
      "EVALUATIONS_NOTIFY_REVEAL",
    ]);

    const raw = store.ACTIVE_SCRIPTS;
    const activeScripts: string[] = Array.isArray(raw)
      ? raw
      : parseJson(String(raw || "[]"), []);
    if (!activeScripts.includes("evaluations")) return;

    const token = String(store.CLOUD_TOKEN || "");
    const cloudLogin = String(store.CLOUD_LOGIN || "");
    if (!token || !cloudLogin) return;

    const hashedLogin = await hashLogin(cloudLogin);
    const url = `${WORKER_URL}/api/v1/private/evaluations?login=${encodeURIComponent(hashedLogin)}&action=pending`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      console.warn("Poll evaluations: fetch failed");
      return;
    }

    if (res.status === 401 || !res.ok) return;

    let data: { notifications: any[] };
    try {
      data = await res.json();
    } catch {
      console.warn("Poll evaluations: JSON parse failed");
      return;
    }

    const notifyAsEvaluator = store.EVALUATIONS_NOTIFY_AS_EVALUATOR !== false;
    const notifyReveal = store.EVALUATIONS_NOTIFY_REVEAL !== false;

    for (const notif of data.notifications) {
      if (notif.role === "evaluator" && !notifyAsEvaluator) continue;

      const time = formatTime(notif.beginAt);

      if (notif.type === "booked") {
        const project = notif.projectName || "a project";
        notify("Evaluation booked", `Evaluation for ${project} at ${time}`);
      } else if (notif.type === "revealed" && notifyReveal) {
        const project = notif.projectName || "your project";
        notify(
          "Evaluation",
          `You're correcting ${notif.logins} for ${project} at ${time}`,
        );
      }
    }
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if ("TEST_NOTIFICATIONS" in changes && changes.TEST_NOTIFICATIONS.newValue) {
    notify("Evaluation booked", "Evaluation for ft_transcendence at 14:52");
    notify(
      "Evaluation in 15 min",
      "You're correcting elmo, kermit for ft_transcendence at 14:52",
    );
    chrome.storage.local.remove("TEST_NOTIFICATIONS");
    return;
  }

  if ("ACTIVE_SCRIPTS" in changes) {
    const { oldValue, newValue } = changes.ACTIVE_SCRIPTS;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      syncRegistration();
    }
  }
  if ("DISCORD_ENABLED" in changes || "DISCORD_ID" in changes) {
    syncDiscord();
  }
});

async function syncRegistration() {
  const store = await chrome.storage.local.get([
    "ACTIVE_SCRIPTS",
    "CLOUD_TOKEN",
    "CLOUD_LOGIN",
  ]);
  const raw = store.ACTIVE_SCRIPTS;
  const activeScripts: string[] = Array.isArray(raw)
    ? raw
    : parseJson(String(raw || "[]"), []);
  const token = String(store.CLOUD_TOKEN || "");
  const cloudLogin = String(store.CLOUD_LOGIN || "");
  if (!token || !cloudLogin) return;

  const hashedLogin = await hashLogin(cloudLogin);
  const action = activeScripts.includes("evaluations")
    ? "register"
    : "unregister";
  const url = `${WORKER_URL}/api/v1/private/evaluations?login=${encodeURIComponent(hashedLogin)}&action=${action}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      try {
        const body = await res.json();
        if (!body.registered && body.reason === "missing_42_token") {
          notify(
            "Evaluations",
            "Reconnect with 42 to receive evaluation notifications",
          );
        }
      } catch {
        /* ignore parse errors */
      }
    }
  } catch {
    console.warn("syncRegistration: fetch failed");
  }
}

async function syncDiscord() {
  const store = await chrome.storage.local.get([
    "CLOUD_TOKEN",
    "CLOUD_LOGIN",
    "DISCORD_ENABLED",
    "DISCORD_ID",
  ]);
  const token = String(store.CLOUD_TOKEN || "");
  const cloudLogin = String(store.CLOUD_LOGIN || "");
  if (!token || !cloudLogin) return;

  const hashedLogin = await hashLogin(cloudLogin);
  const enabled = store.DISCORD_ENABLED === true;
  const discordId = String(store.DISCORD_ID || "").trim();

  if (enabled && discordId) {
    const url = `${WORKER_URL}/api/v1/private/discord/link?login=${encodeURIComponent(hashedLogin)}`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discordId }),
      });
    } catch {
      console.warn("syncDiscord: link fetch failed");
    }
  } else {
    const url = `${WORKER_URL}/api/v1/private/discord/unlink?login=${encodeURIComponent(hashedLogin)}`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      console.warn("syncDiscord: unlink fetch failed");
    }
  }
}

function createAlarm() {
  chrome.alarms.get("poll-evaluations", (alarm) => {
    if (!alarm) {
      const jitter = Math.random() * 2;
      chrome.alarms.create("poll-evaluations", {
        delayInMinutes: jitter,
        periodInMinutes: 5,
      });
    }
  });
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function notify(title: string, message: string) {
  try {
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: "icons/icon-128.png",
        title,
        message,
        requireInteraction: true,
      },
      () => {},
    );
    return;
  } catch {}
  try {
    chrome.notifications.create(
      { type: "basic", iconUrl: "icons/icon-128.png", title, message },
      () => {},
    );
    return;
  } catch {}
  try {
    new Notification(title, {
      body: message,
      icon: "icons/icon-128.png",
      requireInteraction: true,
    });
  } catch {}
}

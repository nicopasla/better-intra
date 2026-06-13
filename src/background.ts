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
      "EVALUATIONS_NOTIFY_AS_EVALUATED",
      "EVALUATIONS_NOTIFY_REVEAL",
    ]);

    const activeScripts: string[] = parseJson(String(store.ACTIVE_SCRIPTS || "[]"), []);
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
      return;
    }

    if (res.status === 401 || !res.ok) return;

    let data: { notifications: any[] };
    try {
      data = await res.json();
    } catch {
      return;
    }

    const notifyAsEvaluator = store.EVALUATIONS_NOTIFY_AS_EVALUATOR !== false;
    const notifyAsEvaluated = store.EVALUATIONS_NOTIFY_AS_EVALUATED !== false;
    const notifyReveal = store.EVALUATIONS_NOTIFY_REVEAL !== false;

    for (const notif of data.notifications) {
      if (notif.role === "evaluator" && !notifyAsEvaluator) continue;
      if (notif.role === "evaluated" && !notifyAsEvaluated) continue;

      const time = formatTime(notif.beginAt);

      if (notif.type === "booked") {
        const project = notif.projectName || (notif.role === "evaluator" ? "a project" : "your project");
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: "Evaluation booked",
          message: notif.role === "evaluator"
            ? `Evaluation for ${project} at ${time}`
            : `${project} will be evaluated at ${time}`,
        });
      } else if (notif.type === "revealed" && notifyReveal) {
        const project = notif.projectName || "your project";
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: "Evaluation",
          message: notif.role === "evaluator"
            ? `You're correcting ${notif.logins} for ${project} at ${time}`
            : `${notif.login} is about to evaluate ${project} at ${time}`,
        });
      }
    }
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if ("ACTIVE_SCRIPTS" in changes) {
    syncRegistration();
  }
  if ("DISCORD_ENABLED" in changes || "DISCORD_ID" in changes) {
    syncDiscord();
  }
});

async function syncRegistration() {
  const store = await chrome.storage.local.get(["ACTIVE_SCRIPTS", "CLOUD_TOKEN", "CLOUD_LOGIN"]);
  const activeScripts: string[] = parseJson(String(store.ACTIVE_SCRIPTS || "[]"), []);
  const token = String(store.CLOUD_TOKEN || "");
  const cloudLogin = String(store.CLOUD_LOGIN || "");
  if (!token || !cloudLogin) return;

  const hashedLogin = await hashLogin(cloudLogin);
  const action = activeScripts.includes("evaluations") ? "register" : "unregister";
  const url = `${WORKER_URL}/api/v1/private/evaluations?login=${encodeURIComponent(hashedLogin)}&action=${action}`;

  try {
    await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // ignore
  }
}

async function syncDiscord() {
  const store = await chrome.storage.local.get(["CLOUD_TOKEN", "CLOUD_LOGIN", "DISCORD_ENABLED", "DISCORD_ID"]);
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
    } catch {
      // ignore
    }
  } else {
    const url = `${WORKER_URL}/api/v1/private/discord/unlink?login=${encodeURIComponent(hashedLogin)}`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
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
  try { return JSON.parse(raw); } catch { return fallback; }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

async function hashLogin(login: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(login.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

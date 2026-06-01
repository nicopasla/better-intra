import { getConfig } from "./config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

interface ScaleTeam {
  id: number;
  begin_at: string;
  project_name: string;
  user: string;
  kind: "evaluator" | "evaluated";
  can_cancel: boolean;
  can_report: boolean;
}

async function hashLogin(login: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(login.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function showBookingAlert(evaluation: ScaleTeam): void {
  const beginAt = new Date(evaluation.begin_at);
  const timeStr = beginAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = beginAt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const title = encodeURIComponent("Someone booked an evaluation");
  const message = encodeURIComponent(`${evaluation.project_name}`);
  const time = encodeURIComponent(`${dateStr} at ${timeStr}`);

  chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
    windows.forEach((w) => {
      if (w.id) chrome.windows.remove(w.id);
    });
    chrome.windows.create({
      url: `alert.html?title=${title}&message=${message}&time=${time}`,
      type: "popup",
      focused: true,
    });
  });
}

function showReminderAlert(evaluation: ScaleTeam): void {
  const title = encodeURIComponent("Evaluation starting soon!");
  const message = encodeURIComponent(evaluation.project_name);
  const time = encodeURIComponent("Starting in ~14 minutes");
  const link = encodeURIComponent(
    `https://profile.intra.42.fr/users/${evaluation.user}`,
  );
  const type = encodeURIComponent("reminder");
  const user = encodeURIComponent(evaluation.user);

  chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
    windows.forEach((w) => {
      if (w.id) chrome.windows.remove(w.id);
    });
    chrome.windows.create({
      url: `alert.html?title=${title}&message=${message}&time=${time}&link=${link}&type=${type}&user=${user}`,
      type: "popup",
      focused: true,
    });
  });
}

async function checkEvaluations(): Promise<void> {
  console.log(
    `checkEvaluations() called at ${new Date().toLocaleTimeString()}`,
  );

  const token = await getConfig("CLOUD_TOKEN");
  const login = await getConfig("CLOUD_LOGIN");
  const notificationsEnabled = await getConfig("EVAL_NOTIFICATIONS_ENABLED");
  const snapshot = (await getConfig("EVALUATION_SNAPSHOT")) ?? [];
  const reminderSnapshot =
    (await getConfig("EVALUATION_REMINDER_SNAPSHOT")) ?? [];

  console.log("Config:", {
    hasToken: !!token,
    login,
    notificationsEnabled,
    snapshotIds: snapshot,
    reminderSnapshotIds: reminderSnapshot,
  });

  if (!token || !login) {
    console.log("Skipping: not logged in");
    return;
  }
  if (!notificationsEnabled) {
    console.log("Skipping: notifications disabled");
    return;
  }

  try {
    const hashedLogin = await hashLogin(login);
    const url = `${WORKER_URL}/api/v1/private/evaluations?login=${hashedLogin}&intra_login=${encodeURIComponent(login)}`;
    console.log(`Fetching: ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Response status: ${res.status}`);

    if (!res.ok) {
      console.log(`Fetch failed: ${res.status} ${res.statusText}`);
      return;
    }

    const json = (await res.json()) as { evaluations: ScaleTeam[] };
    console.log("Raw response JSON:", JSON.stringify(json, null, 2));

    const { evaluations } = json;
    console.log(`Found ${evaluations.length} upcoming evaluations`);
    evaluations.forEach((e, i) => {
      console.log(`Evaluation #${i + 1}:`, JSON.stringify(e, null, 2));
    });

    const now = Date.now();
    console.log(`Current time: ${new Date(now).toLocaleTimeString()}`);

    const newBookings = evaluations
      .filter((e) => e.kind === "evaluator")
      .filter((e) => !snapshot.includes(e.id));

    console.log(`New bookings (not in snapshot): ${newBookings.length}`);
    newBookings.forEach((e) => {
      console.log(`→ New booking: ${e.project_name} (id: ${e.id})`);
    });

    for (const evaluation of newBookings) {
      showBookingAlert(evaluation);
    }

    const reminderBuffer = 14 * 60 * 1000;
    const reminderDeadline = now + reminderBuffer;
    console.log(
      `Checking reminders between now and ${new Date(reminderDeadline).toLocaleTimeString()}`,
    );

    const upcomingReminders = evaluations
      .filter((e) => e.kind === "evaluator")
      .filter((e) => !reminderSnapshot.includes(e.id))
      .filter((e) => {
        const t = new Date(e.begin_at).getTime();
        const inWindow = t > now && t <= reminderDeadline;
        console.log(
          `Reminder check for ${e.project_name}: begin_at=${e.begin_at}, inWindow=${inWindow}`,
        );
        return inWindow;
      });

    console.log(`Upcoming reminders: ${upcomingReminders.length}`);

    for (const evaluation of upcomingReminders) {
      showReminderAlert(evaluation);
    }

    await chrome.storage.local.set({
      EVALUATION_SNAPSHOT: evaluations.map((e) => e.id),
      EVALUATION_REMINDER_SNAPSHOT: [
        ...reminderSnapshot,
        ...upcomingReminders.map((e) => e.id),
      ],
    });

    console.log(`Snapshot updated. Done. Next check in 15 minutes.`);
  } catch (err) {
    console.error("Evaluation check failed:", err);
  }
}

function ensureAlarm() {
  chrome.alarms.get("evaluation-check", (alarm) => {
    if (!alarm) {
      const randomPeriod = 14 + Math.random();
      chrome.alarms.create("evaluation-check", {
        periodInMinutes: randomPeriod,
      });
      console.log(
        `evaluation-check alarm created with period: ${randomPeriod.toFixed(2)} minutes`,
      );
    } else {
      const nextFire = new Date(alarm.scheduledTime).toLocaleTimeString();
      console.log(`Alarm already exists, next fire at ${nextFire}`);
    }
  });
}

function clearAlarm(): void {
  chrome.alarms.clear("evaluation-check");
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if ("EVAL_NOTIFICATIONS_ENABLED" in changes) {
    if (changes.EVAL_NOTIFICATIONS_ENABLED.newValue) {
      ensureAlarm();
      checkEvaluations();
    } else {
      clearAlarm();
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "evaluation-check") checkEvaluations();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  getConfig("EVAL_NOTIFICATIONS_ENABLED").then((enabled) => {
    if (enabled) checkEvaluations();
  });
});

// For testing purpose
globalThis.checkEvaluations = checkEvaluations;

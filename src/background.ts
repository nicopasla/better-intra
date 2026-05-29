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
  const timeStr = beginAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = beginAt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const title = encodeURIComponent("🎯 Evaluation booked on your project");
  const message = encodeURIComponent(`${evaluation.project_name}`);
  const time = encodeURIComponent(`${dateStr} at ${timeStr}`);

  chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
    windows.forEach((w) => { if (w.id) chrome.windows.remove(w.id); });
    chrome.windows.create({
      url: `alert.html?title=${title}&message=${message}&time=${time}`,
      type: "popup",
      width: 380,
      height: 160,
      focused: true,
    });
  });
}

function showReminderAlert(evaluation: ScaleTeam): void {
  const title = encodeURIComponent("⏰ Evaluation starting soon");
  const message = encodeURIComponent(`${evaluation.project_name} with ${evaluation.user}`);
  const time = encodeURIComponent("Starting in ~15 minutes");
  const link = encodeURIComponent(`https://profile.intra.42.fr/users/${evaluation.user}`);

  chrome.windows.getAll({ windowTypes: ["popup"] }, (windows) => {
    windows.forEach((w) => { if (w.id) chrome.windows.remove(w.id); });
    chrome.windows.create({
      url: `alert.html?title=${title}&message=${message}&time=${time}&link=${link}`,
      type: "popup",
      width: 380,
      height: 180,
      focused: true,
    });
  });
}

async function checkEvaluations(): Promise<void> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getConfig("CLOUD_LOGIN");
  const notificationsEnabled = await getConfig("EVAL_NOTIFICATIONS_ENABLED");
  const snapshot = await getConfig("EVALUATION_SNAPSHOT");
  const reminderSnapshot = await getConfig("EVALUATION_REMINDER_SNAPSHOT");

  if (!token || !login) return;
  if (!notificationsEnabled) return;

  try {
    const hashedLogin = await hashLogin(login);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/evaluations?login=${hashedLogin}&intra_login=${encodeURIComponent(login)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) return;

    const { evaluations } = (await res.json()) as { evaluations: ScaleTeam[] };
    const now = Date.now();

    const newBookings = evaluations
      .filter((e) => e.kind === "evaluated")
      .filter((e) => !snapshot.includes(e.id));

    for (const evaluation of newBookings) {
      showBookingAlert(evaluation);
    }

    const in15min = now + 15 * 60 * 1000;
    const in20min = now + 20 * 60 * 1000;

    const upcomingReminders = evaluations
      .filter((e) => e.kind === "evaluated")
      .filter((e) => !reminderSnapshot.includes(e.id))
      .filter((e) => {
        const t = new Date(e.begin_at).getTime();
        return t > now && t <= in20min;
      });

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

  } catch (err) {
    console.error("Evaluation check failed:", err);
  }
}

chrome.alarms.create("evaluation-check", { periodInMinutes: 15 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "evaluation-check") checkEvaluations();
});
chrome.runtime.onStartup.addListener(checkEvaluations);
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/about.svg",
    title: "Better Intra",
    message: "Extension loaded!",
  });
  checkEvaluations();
});

(globalThis as any).checkEvaluations = checkEvaluations;

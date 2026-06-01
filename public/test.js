const consoleEl = document.getElementById("console");
let logs = [];

// Get background page reference
let backgroundPage = null;
async function getBackgroundPage() {
  if (!backgroundPage) {
    backgroundPage = await chrome.runtime.getBackgroundPage();
  }
  return backgroundPage;
}

function addLog(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
    api: "🔄",
  }[type] || "•";

  const line = `[${timestamp}] ${prefix} ${message}`;
  logs.push(line);
  
  const logEl = document.createElement("div");
  logEl.className = "output-line";
  logEl.textContent = line;
  consoleEl.appendChild(logEl);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setStatus(elementId, text, statusType) {
  const el = document.getElementById(elementId);
  el.innerHTML = `<div class="status ${statusType}">${text}</div>`;
}

function clearConsole() {
  logs = [];
  consoleEl.innerHTML = "";
}

function copyConsole() {
  navigator.clipboard.writeText(logs.join("\n")).then(() => {
    addLog("Console copied to clipboard", "success");
  });
}

async function clearSnapshots() {
  try {
    setStatus("setupStatus", "⏳ Clearing...", "running");
    await chrome.storage.local.remove("EVALUATION_SNAPSHOT");
    await chrome.storage.local.remove("EVALUATION_REMINDER_SNAPSHOT");
    addLog("Snapshots cleared", "success");
    setStatus("setupStatus", "✅ Cleared", "success");
  } catch (err) {
    addLog(`Error: ${err.message}`, "error");
    setStatus("setupStatus", "❌ Failed", "error");
  }
}

async function runTest1() {
  try {
    setStatus("test1Status", "⏳ Running...", "running");
    addLog("Test 1: Booking alert + Reminder (5min later)", "info");
    
    const bg = await getBackgroundPage();
    
    // Show booking dialog immediately (no user)
    addLog("Showing booking dialog", "info");
    bg.showBookingAlert({
      id: 99999,
      begin_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      project_name: "cub3d",
      user: null,
      kind: "evaluator",
      can_cancel: false,
      can_report: false,
    });
    
    // Wait 5 minutes, then show reminder (with user)
    addLog("Waiting 5 minutes before reminder...", "info");
    await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    
    addLog("Showing reminder notification", "info");
    bg.showReminderAlert({
      id: 99999,
      begin_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      project_name: "cub3d",
      user: "nicolas",
      kind: "evaluator",
      can_cancel: false,
      can_report: false,
    });
    
    addLog("Test 1 completed", "success");
    setStatus("test1Status", "✅ Complete (5min wait)", "success");
  } catch (err) {
    addLog(`Test 1 error: ${err.message}`, "error");
    setStatus("test1Status", "❌ Failed", "error");
  }
}

async function runTest2() {
  try {
    setStatus("test2Status", "⏳ Running...", "running");
    addLog("Test 2: Reminder notification (15min before)", "info");
    
    await chrome.storage.local.remove("EVALUATION_REMINDER_SNAPSHOT");
    const bg = await getBackgroundPage();
    const realFetch = bg.fetch;
    
    bg.fetch = async (url, ...args) => {
      if (url.includes("evaluations")) {
        addLog("Mock API called", "api");
        return new Response(JSON.stringify({
          evaluations: [
            {
              id: 88888,
              begin_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              project_name: "push_swap",
              user: "nicolas",
              kind: "evaluator",
              can_cancel: false,
              can_report: false,
            }
          ]
        }), { status: 200 });
      }
      return realFetch(url, ...args);
    };
    
    await bg.checkEvaluations();
    bg.fetch = realFetch;
    
    addLog("Test 2 completed", "success");
    setStatus("test2Status", "✅ Complete", "success");
  } catch (err) {
    addLog(`Test 2 error: ${err.message}`, "error");
    setStatus("test2Status", "❌ Failed", "error");
  }
}

async function runFullSuite() {
  try {
    setStatus("fullStatus", "⏳ Running full suite...", "running");
    addLog("Starting full test suite", "info");
    
    await clearSnapshots();
    await new Promise(r => setTimeout(r, 500));
    
    await runTest1();
    await new Promise(r => setTimeout(r, 500));
    
    await runTest2();
    
    addLog("Full suite completed", "success");
    setStatus("fullStatus", "✅ All tests done", "success");
  } catch (err) {
    addLog(`Suite error: ${err.message}`, "error");
    setStatus("fullStatus", "❌ Failed", "error");
  }
}

// Event listeners
document.getElementById("clearBtn").addEventListener("click", clearSnapshots);
document.getElementById("test1Btn").addEventListener("click", runTest1);
document.getElementById("test2Btn").addEventListener("click", runTest2);
document.getElementById("fullBtn").addEventListener("click", runFullSuite);
document.getElementById("clearConsoleBtn").addEventListener("click", clearConsole);
document.getElementById("copyBtn").addEventListener("click", copyConsole);

// Initialize
addLog("Tester ready", "success");
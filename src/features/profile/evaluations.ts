import { getConfig } from "../../config.ts";

const CARD_TITLE = "PENDING EVALUATIONS";

function findNativeCard(): HTMLElement | null {
  const grid =
    document.querySelector(".dash-main") ||
    document.querySelector(".bg-white.md\\:h-96")?.parentElement ||
    document.body;
  const cards = grid.querySelectorAll(".bg-white");
  for (const card of cards) {
    if (card.textContent?.toUpperCase().includes(CARD_TITLE)) {
      return card as HTMLElement;
    }
  }
  return null;
}

let sorted = false;

function sortRows(nativeCard: HTMLElement) {
  const oldWraps = nativeCard.querySelectorAll(
    ".ft-ev-top, .ft-ev-bot, .ft-ev-fdb",
  );
  for (const wrap of oldWraps) {
    const p = wrap.parentElement!;
    while (wrap.firstChild) {
      p.insertBefore(wrap.firstChild, wrap);
    }
    wrap.remove();
  }
  nativeCard.querySelectorAll(".ft-ev-label").forEach((e) => e.remove());

  const rows = Array.from(
    nativeCard.querySelectorAll<HTMLElement>(
      ".flex.justify-between.w-full.items-center, .flex.flex-row.justify-between",
    ),
  );
  if (rows.length === 0) return;

  const parent = rows[0].parentElement!;
  parent.style.cssText = "display:flex;flex-direction:column;height:100%";

  const feedbackRows: HTMLElement[] = [];
  const evaluatorRows: HTMLElement[] = [];
  const evaluatedRows: HTMLElement[] = [];
  for (const row of rows) {
    row.style.fontSize = "0.9375rem";
    const text = row.textContent || "";
    if (text.includes("days left to feedback")) feedbackRows.push(row);
    else if (
      text.includes("You will evaluate") ||
      text.includes("You are ready to evaluate")
    )
      evaluatorRows.push(row);
    else if (text.includes("You will be evaluated by")) evaluatedRows.push(row);
  }

  if (feedbackRows.length > 0) {
    const fdbWrap = document.createElement("div");
    fdbWrap.className = "ft-ev-fdb";
    fdbWrap.style.cssText =
      "flex:1;display:flex;flex-direction:column;padding:0";
    parent.insertBefore(fdbWrap, parent.firstChild);

    const fdbLabel = document.createElement("div");
    fdbLabel.className = "ft-ev-label";
    fdbLabel.style.cssText =
      "font-weight:600;font-size:1rem;color:hsl(var(--foreground));margin:0 0 4px 4px;flex-shrink:0";
    fdbLabel.textContent = `To Feedback (${feedbackRows.length})`;
    fdbWrap.insertBefore(fdbLabel, fdbWrap.firstChild);

    for (const row of feedbackRows) fdbWrap.appendChild(row);
  }

  const topWrap = document.createElement("div");
  topWrap.className = "ft-ev-top";
  topWrap.style.cssText =
    feedbackRows.length > 0
      ? "flex:1;display:flex;flex-direction:column;border-top:1px solid hsl(var(--border));padding:8px 0;margin-top:-1px"
      : "flex:1;display:flex;flex-direction:column;padding:0";
  parent.appendChild(topWrap);

  const botWrap = document.createElement("div");
  botWrap.className = "ft-ev-bot";
  botWrap.style.cssText =
    "flex:1;display:flex;flex-direction:column;border-top:1px solid hsl(var(--border));padding:8px 0;margin-top:-1px";
  parent.appendChild(botWrap);

  for (const row of evaluatorRows) topWrap.appendChild(row);
  for (const row of evaluatedRows) botWrap.appendChild(row);

  const evLabel = document.createElement("div");
  evLabel.className = "ft-ev-label";
  evLabel.style.cssText =
    "font-weight:600;font-size:1rem;color:hsl(var(--foreground));margin:0 0 4px 4px;flex-shrink:0";
  evLabel.textContent = `Evaluator (${evaluatorRows.length})`;
  topWrap.insertBefore(evLabel, topWrap.firstChild);

  const edLabel = document.createElement("div");
  edLabel.className = "ft-ev-label";
  edLabel.style.cssText =
    "font-weight:600;font-size:1rem;color:hsl(var(--foreground));margin:4px 0 4px 4px;flex-shrink:0";
  edLabel.textContent = `Evaluated (${evaluatedRows.length})`;
  botWrap.insertBefore(edLabel, botWrap.firstChild);

  sorted = true;

  nativeCard.querySelectorAll(".lucide-clock5").forEach((svg) => {
    const btn = svg.closest("button");
    if (btn) btn.style.fontSize = "0.80rem";
  });

  const hideBtn = findHideBtn(nativeCard);
  if (hideBtn) hideBtn.textContent = "Show";
}

function unsortRows(nativeCard: HTMLElement) {
  const fdbWrap = nativeCard.querySelector(".ft-ev-fdb");
  const topWrap = nativeCard.querySelector(".ft-ev-top");
  const botWrap = nativeCard.querySelector(".ft-ev-bot");
  if (!fdbWrap && !topWrap && !botWrap) return;

  const contentParent = (fdbWrap || topWrap || botWrap)!.parentElement!;

  if (fdbWrap) {
    while (fdbWrap.firstChild) {
      contentParent.insertBefore(fdbWrap.firstChild, fdbWrap);
    }
    fdbWrap.remove();
  }
  if (topWrap) {
    while (topWrap.firstChild) {
      contentParent.insertBefore(topWrap.firstChild, topWrap);
    }
    topWrap.remove();
  }
  if (botWrap) {
    while (botWrap.firstChild) {
      contentParent.appendChild(botWrap.firstChild);
    }
    botWrap.remove();
  }

  contentParent.querySelectorAll(".ft-ev-label").forEach((l) => l.remove());

  const rows = contentParent.querySelectorAll<HTMLElement>(
    ".flex.justify-between.w-full.items-center, .flex.flex-row.justify-between",
  );
  for (const row of rows) {
    row.style.fontSize = "";
  }

  contentParent.style.cssText = "";

  sorted = false;

  const hideBtn = findHideBtn(nativeCard);
  if (hideBtn) hideBtn.textContent = "Hide";
}

function findHideBtn(nativeCard: HTMLElement): HTMLElement | null {
  const btns = nativeCard.querySelectorAll<HTMLElement>("[class*='uppercase']");
  for (const btn of btns) {
    const t = btn.textContent?.trim().toLowerCase() || "";
    if (t === "hide" || t === "show") return btn;
  }
  return null;
}

function toggleSort(nativeCard: HTMLElement) {
  if (sorted) {
    unsortRows(nativeCard);
    chrome.storage.local.set({ PROFILE_SHOW_EVALUATIONS: false });
  } else {
    sortRows(nativeCard);
    chrome.storage.local.set({ PROFILE_SHOW_EVALUATIONS: true });
  }
}

function hookToggleButton(nativeCard: HTMLElement) {
  nativeCard.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const t = target.textContent?.trim().toLowerCase() || "";
    if (t === "hide" || t === "show") {
      e.preventDefault();
      e.stopPropagation();
      toggleSort(nativeCard);
    }
  });
}

let evInitialized = false;

export async function initEvaluations() {
  if (evInitialized) return;
  evInitialized = true;

  if (
    location.hostname !== "profile-v3.intra.42.fr" ||
    !(location.pathname === "/" || location.pathname.startsWith("/users"))
  )
    return;

  const show = await getConfig("PROFILE_SHOW_EVALUATIONS");

  const check = () => {
    const native = findNativeCard();
    if (!native) {
      requestAnimationFrame(check);
      return;
    }
    const rows = native.querySelectorAll(
      ".flex.justify-between.w-full.items-center, .flex.flex-row.justify-between",
    );
    if (rows.length === 0) {
      requestAnimationFrame(check);
      return;
    }
    if (show) {
      sortRows(native);
    } else {
      const btn = findHideBtn(native);
      if (btn) btn.textContent = "Hide";
    }
    hookToggleButton(native);
  };

  requestAnimationFrame(check);
}

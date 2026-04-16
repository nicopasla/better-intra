// ==UserScript==
// @name         42 Intra Logtime
// @namespace    https://github.com/nicopasla/42-userscripts
// @version      0.1.1
// @updateURL	   https://raw.githubusercontent.com/nicopasla/42-userscripts/main/logtime.user.js
// @license      MIT
// @author       nicopasla
// @description  Redesign the logtime to show weekly and total hours on 42 Intra v3
// @match        https://profile-v3.intra.42.fr/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    GOAL_HOURS: 140,
    MAX_INTENSITY_SECS: 3600 * 12,
    SHOW_AVERAGE: true,
    SHOW_GOAL: true,
    SHOW_TACOS: false,
    CALENDAR_COLOR: "#00BCBA",
    LABELS_COLOR: "#26a641",
    BG_CARD: "#ffffff",
    CARD_RADIUS: "16px",
    CELL_RADIUS: "6px",
    GAP_BETWEEN_CARDS: "16px",
    CARD_WIDTH: "280px",
    HOVER_OPACITY: 1.0,
    PAST_MONTHS_OPACITY: 0.8,
    AVG_ONLY_ACTIVE_DAYS: true,
    COLORS: {
      BORDER: "#e2e8f0",
      TEXT_DARK: "#1e293b",
      TEXT_LIGHT: "#94a3b8",
      CELL_EMPTY: "#f8fafc",
    },
    INTRA_FONT:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  };

  const STORABLE_KEYS = [
    "GOAL_HOURS",
    "CALENDAR_COLOR",
    "LABELS_COLOR",
    "SHOW_AVERAGE",
    "SHOW_GOAL",
    "SHOW_TACOS",
  ];
  const CONFIG = { ...DEFAULT_CONFIG };

  STORABLE_KEYS.forEach((key) => {
    const stored = localStorage.getItem(`logtime_${key}`);
    if (stored !== null) {
      if (typeof DEFAULT_CONFIG[key] === "boolean")
        CONFIG[key] = stored === "true";
      else if (typeof DEFAULT_CONFIG[key] === "number")
        CONFIG[key] = parseFloat(stored);
      else CONFIG[key] = stored;
    }
  });

  function saveConfig() {
    STORABLE_KEYS.forEach((key) =>
      localStorage.setItem(`logtime_${key}`, CONFIG[key].toString()),
    );
  }

  const style = document.createElement("style");
  style.textContent = `
    [class*="logtime"], .card, .card-body, .row, .col-md-12 {
      overflow: visible !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .log-slider-fixed {
      overflow-x: auto !important;
      overflow-y: hidden !important;
      width: 100%;
      margin-top: -10px !important;
      font-family: ${CONFIG.INTRA_FONT};
      display: flex !important;
      scroll-behavior: smooth;
    }

    .log-slider-fixed::-webkit-scrollbar { height: 6px; }
    .log-slider-fixed::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

    .grid-centering-container {
      display: flex;
      gap: ${CONFIG.GAP_BETWEEN_CARDS};
      padding: 10px 20px 20px 20px;
      margin: 0 auto;
      min-width: min-content;
    }

    .month-card {
      transition: opacity 0.2s ease;
      border: 1px solid ${CONFIG.COLORS.BORDER};
    }

    .month-card.current-month {
      border: 2px solid ${CONFIG.CALENDAR_COLOR} !important;
      box-shadow: 0 0 15px ${CONFIG.CALENDAR_COLOR}33 !important;
      opacity: 1 !important;
    }

    .day-cell { transition: transform 0.1s ease; cursor: pointer; position: relative; }
    .day-cell:hover { transform: scale(1.2); filter: brightness(0.9); z-index: 50 !important; }

    .today-highlight {
      box-shadow: 0 0 0 2px ${CONFIG.CALENDAR_COLOR}, 0 0 8px ${CONFIG.CALENDAR_COLOR}88;
      border: none !important;
      z-index: 10;
    }

    .day-tooltip {
      display: none; position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px;
      z-index: 100; white-space: nowrap; pointer-events: none;
    }
    .day-cell:hover .day-tooltip { display: block; }
  `;
  document.head.appendChild(style);

  const fmtHours = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  };

  const getLastSeenFormatted = (stats) => {
    const dates = Object.keys(stats).sort();
    if (dates.length === 0) return null;

    const activeDays = Object.entries(stats)
      .filter(([_, time]) => time !== "00:00:00")
      .map(([date]) => date)
      .sort();

    if (activeDays.length === 0) {
      const [y, m, d] = dates[0].split("-");
      return `before ${d}/${m}/${y}`;
    }

    const lastDate = activeDays[activeDays.length - 1];
    const [y, m, d] = lastDate.split("-");
    return `${d}/${m}`;
  };

  function render(stats) {
    if (!stats) return;
    const byMonth = {};
    Object.keys(stats)
      .sort()
      .forEach((d) => {
        const ym = d.slice(0, 7);
        if (!byMonth[ym]) byMonth[ym] = {};
        const parts = (stats[d] || "00:00:00").split(":").map(Number);
        byMonth[ym][d] = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
      });

    const scrollWrapper = document.createElement("div");
    scrollWrapper.className = "log-slider-fixed";
    const gridContainer = document.createElement("div");
    gridContainer.className = "grid-centering-container";

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const monthKeys = Object.keys(byMonth).sort();

    monthKeys.forEach((ym, index) => {
      const isCurrent = index === monthKeys.length - 1;
      const [year, mon] = ym.split("-").map(Number);
      const data = byMonth[ym];
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      const lastDayDate = new Date(year, mon, 0).getDate();

      const divisor = CONFIG.AVG_ONLY_ACTIVE_DAYS
        ? Object.values(data).filter((s) => s > 0).length || 1
        : isCurrent
          ? now.getDate()
          : lastDayDate;
      const avg = total / divisor;

      const card = document.createElement("div");
      card.className = `month-card ${isCurrent ? "current-month" : ""}`;
      card.style.cssText = `
        background:${CONFIG.BG_CARD};
        border-radius:${CONFIG.CARD_RADIUS}; padding:16px; width:${CONFIG.CARD_WIDTH};
        flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        opacity: ${isCurrent ? "1" : CONFIG.PAST_MONTHS_OPACITY};
      `;

      card.innerHTML = `
			<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
				<span style="font-size:22px; font-weight:700; color:${CONFIG.COLORS.TEXT_DARK};">${new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, mon - 1))}</span>
				<span style="font-size:16px; font-weight:800; color:${CONFIG.LABELS_COLOR}; background:rgba(38,166,65,0.08); padding:4px 10px; border-radius:8px;">${fmtHours(total)}${CONFIG.SHOW_GOAL ? `/ ${CONFIG.GOAL_HOURS}h` : ""}</span>
			</div>

			<div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; color:${CONFIG.LABELS_COLOR}; margin-bottom:10px;">
				<div class="day-cell" style="background:transparent; width:auto; height:auto; padding:0; cursor:help;">
					${CONFIG.SHOW_GOAL ? `<b>${Math.round((total / (CONFIG.GOAL_HOURS * 3600)) * 100)}% </b>` : ""}${CONFIG.SHOW_TACOS ? ` ${Math.round(((total / 3600) * 2) / 8)} 🌮` : ""}
					${CONFIG.SHOW_GOAL ? `<div class="day-tooltip">Remaining: ${fmtHours(Math.max(0, CONFIG.GOAL_HOURS * 3600 - total))}</div>` : ""}  
				</div>
				
				${CONFIG.SHOW_AVERAGE ? `<span>Avg: <b>${fmtHours(avg)}</b></span>` : "<span></span>"}
			</div>

			${
        CONFIG.SHOW_GOAL
          ? `<div style="width:100%; height:4px; background:#f1f5f9; border-radius:2px; margin-bottom:16px; overflow:hidden;">
				<div style="width:${Math.min((total / (CONFIG.GOAL_HOURS * 3600)) * 100, 100)}%; height:100%; background:${CONFIG.LABELS_COLOR};"></div>
			</div>`
          : ""
      }
		`;

      const grid = document.createElement("div");
      grid.style.cssText = `display:grid; grid-template-columns:repeat(7, 1fr) 58px; gap:8px 5px;`;

      ["M", "T", "W", "T", "F", "S", "S", "Total"].forEach((d, idx) => {
        const el = document.createElement("div");
        el.textContent = d;
        el.style.cssText = `font-size:11px; font-weight:800; text-align:center; color:${CONFIG.COLORS.TEXT_LIGHT}; ${idx === 7 ? "border-left:1px solid #f1f5f9; color:" + CONFIG.LABELS_COLOR : ""}`;
        grid.appendChild(el);
      });

      const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
      for (let i = 0; i < offset; i++)
        grid.appendChild(document.createElement("div"));

      let weekSecs = 0;
      for (let day = 1; day <= lastDayDate; day++) {
        const dKey = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const s = data[dKey] ?? 0;
        weekSecs += s;

        const cell = document.createElement("div");
        cell.className = `day-cell ${dKey === todayStr ? "today-highlight" : ""}`;
        cell.textContent = day;
        const rgbaCache = new Map();
        function hexToRgba(hex, opacity) {
          const key = hex + opacity;
          if (rgbaCache.has(key)) return rgbaCache.get(key);

          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const val = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          rgbaCache.set(key, val);
          return val;
        }

        const alpha = Math.min(s / CONFIG.MAX_INTENSITY_SECS, 1).toFixed(2);

        cell.style.cssText = `
          aspect-ratio: 1/1; 
          border-radius: ${CONFIG.CELL_RADIUS}; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-size: 11px; 
          font-weight: 700; 
          background: ${s > 0 ? hexToRgba(CONFIG.CALENDAR_COLOR, alpha) : CONFIG.COLORS.CELL_EMPTY};
          color: ${s > CONFIG.MAX_INTENSITY_SECS / 2 ? "#fff" : CONFIG.COLORS.TEXT_DARK};
        `;

        const tt = document.createElement("div");
        tt.className = "day-tooltip";
        tt.textContent = s > 0 ? fmtHours(s) : "0h";
        cell.appendChild(tt);
        grid.appendChild(cell);

        if ((offset + day) % 7 === 0 || day === lastDayDate) {
          if (day === lastDayDate && (offset + day) % 7 !== 0) {
            for (let j = 0; j < 7 - ((offset + day) % 7); j++)
              grid.appendChild(document.createElement("div"));
          }
          const w = document.createElement("div");
          w.textContent = weekSecs > 0 ? fmtHours(weekSecs) : "";
          w.style.cssText = `font-size:14px; font-weight:700; text-align:right; color:${CONFIG.LABELS_COLOR}; border-left:1px solid #f1f5f9; padding-right:4px; display:flex; align-items:center; justify-content:flex-end;`;
          grid.appendChild(w);
          weekSecs = 0;
        }
      }
      card.appendChild(grid);
      gridContainer.appendChild(card);
    });

    scrollWrapper.appendChild(gridContainer);

    const obs = new MutationObserver((_, o) => {
      const label = Array.from(
        document.querySelectorAll("div.font-bold.text-black.uppercase.text-sm"),
      ).find((el) => el.textContent === "Logtime");

      if (label && !label.querySelector("#logtime-settings-trigger")) {
        label.style.display = "inline-flex";
        label.style.alignItems = "center";
        label.style.width = "100%";
        label.style.gap = "8px";

        const lastSeenValue = getLastSeenFormatted(stats);
        if (lastSeenValue) {
          const lastSeenSpan = document.createElement("span");
          lastSeenSpan.style.cssText = `
          font-family: ${CONFIG.INTRA_FONT};
          font-size: 12px;
          color: ${CONFIG.LABELS_COLOR};
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          padding: 2px 12px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 10px;
          letter-spacing: 0.02em;
          line-height: 1;
          height: 30px;
        `;

          const prefix = lastSeenValue.startsWith("before")
            ? "Last connected "
            : "Last connected: ";
          lastSeenSpan.textContent = `${prefix}${lastSeenValue}`;
          label.appendChild(lastSeenSpan);
        }

        const btn = document.createElement("button");
        btn.id = "logtime-settings-trigger";
        btn.style.cssText = `
        font-family: ${CONFIG.INTRA_FONT};
        font-size: 12px;
        color: black;
        background: #f8fafc;
        border: 2px solid #e2e8f0;
        padding: 2px 12px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        letter-spacing: 0.02em;
        display: flex;
        line-height: 1;
        margin-left: auto;
        height: 30px;
      `;
        btn.innerHTML = "Settings";
        btn.onmouseover = () => {
          btn.style.borderColor = CONFIG.LABELS_COLOR;
          btn.style.background = "#fff";
        };
        btn.onmouseout = () => {
          btn.style.borderColor = "#e2e8f0";
          btn.style.background = "#f8fafc";
        };
        btn.onclick = (e) => {
          e.preventDefault();
          document.getElementById("logtime-settings-modal").style.display =
            "flex";
        };
        label.appendChild(btn);
      }

      const t = document.querySelector("div.flex.flex-row.flex-wrap.w-full");
      if (t) {
        o.disconnect();
        t.replaceWith(scrollWrapper);
        setTimeout(() => {
          scrollWrapper.scrollTo({
            left: scrollWrapper.scrollWidth,
            behavior: "smooth",
          });
        }, 300);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  const modal = document.createElement("div");
  modal.id = "logtime-settings-modal";
  modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: none; align-items: center; justify-content: center; z-index: 10000; font-family: ${CONFIG.INTRA_FONT};`;

  modal.innerHTML = `
      <div style="background: white; border-radius: 12px; max-width: 350px; width: 90%; overflow: visible; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); font-family: ${CONFIG.INTRA_FONT}; position: relative;">
        
        <div style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
          Settings
          <button id="reset-log-cfg" style="background: transparent; border: 1px solid #cbd5e1; color: #64748b; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">RESTORE DEFAULTS</button>
          <button id="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
          </div>
        
        <div style="padding: 15px; display: flex; flex-direction: column; gap: 12px;">
          <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Goal (Hours)</label>
          <input type="number" id="set-goal-val" value="${CONFIG.GOAL_HOURS}" style="padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;">
              
          <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Highlight Color</label>
          <input type="color" id="set-color" value="${CONFIG.CALENDAR_COLOR}" style="width: 100%; height: 30px; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; background: white; padding: 2px;">

          <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Labels Color</label>
          <input type="color" id="set-color-labels" value="${CONFIG.LABELS_COLOR}" style="width: 100%; height: 30px; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; background: white; padding: 2px;">

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 5px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b; cursor: pointer; font-weight: 500;">
              <input type="checkbox" id="set-avg" ${CONFIG.SHOW_AVERAGE ? "checked" : ""}> Show Average
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b; cursor: pointer; font-weight: 500;">
              <input type="checkbox" id="set-show-goal" ${CONFIG.SHOW_GOAL ? "checked" : ""}> Show Goal
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b; cursor: pointer; font-weight: 500;">
              <input type="checkbox" id="set-show-tacos" ${CONFIG.SHOW_TACOS ? "checked" : ""}> Show Tacos
            </label>
          </div>
        </div>

        <div style="padding: 15px; border-top: 1px solid #e2e8f0;">
          <button id="save-log-cfg" style="width: 100%; padding: 10px; background: #00BCBA; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">SAVE & RELOAD</button>
        </div>
      </div>`;

  document.body.appendChild(modal);

  document.getElementById("save-log-cfg").onclick = () => {
    CONFIG.GOAL_HOURS = parseFloat(
      document.getElementById("set-goal-val").value,
    );
    CONFIG.CALENDAR_COLOR = document.getElementById("set-color").value;
    CONFIG.LABELS_COLOR = document.getElementById("set-color-labels").value;
    CONFIG.SHOW_AVERAGE = document.getElementById("set-avg").checked;
    CONFIG.SHOW_GOAL = document.getElementById("set-show-goal").checked;
    CONFIG.SHOW_TACOS = document.getElementById("set-show-tacos").checked;
    saveConfig();
    location.reload();
  };

  document.getElementById("reset-log-cfg").onclick = () => {
    if (confirm("Reset all settings to default?")) {
      STORABLE_KEYS.forEach((key) => localStorage.removeItem(`logtime_${key}`));
      location.reload();
    }
  };
  const closeModal = () => (modal.style.display = "none");

  document.getElementById("close-modal").onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  const _f = window.fetch;
  window.fetch = function (...a) {
    const p = _f.apply(this, a);
    if (a[0]?.includes?.("locations_stats"))
      p.then((r) => r.clone().json()).then(render);
    return p;
  };
})();

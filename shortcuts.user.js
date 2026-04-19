// ==UserScript==
// @name         42 Intra Shortcuts
// @namespace    https://github.com/nicopasla/42-userscripts
// @version      0.0.1
// @updateURL    https://raw.githubusercontent.com/nicopasla/42-userscripts/main/Shortcuts.user.js
// @license      MIT
// @author       nicopasla
// @description  Add shortcuts to your Intra v3
// @match        https://profile-v3.intra.42.fr/
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
  "use strict";

  const SETTINGS_KEY = "42_intra_shortcuts_clean_v1";
  const CONTAINER_ID = "42-shortcuts-wrapper";
  const MODAL_ID = "shortcuts-settings-modal";
  const INTRA_FONT =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const SETTINGS_TRIGGER_ID = "shortcuts-settings-trigger";

  const EMPTY_SLOT = () => ({ name: "", url: "", color: "#7dd3fc" });
  const INITIAL_STATE = [EMPTY_SLOT()];

  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  const escapeHTML = (str) => {
    if (!str) return "";
    return str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  };

  const sanitizeColor = (color) =>
    HEX_COLOR_RE.test(String(color || "").trim())
      ? String(color).trim()
      : "#7dd3fc";

  const sanitizeUrl = (url) => {
    if (!url) return "";
    const raw = String(url).trim();
    if (!raw) return "";

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const parsed = new URL(withProtocol);
      return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : "";
    } catch {
      return "";
    }
  };

  const normalizeLink = (link) => {
    if (!link || typeof link !== "object") return EMPTY_SLOT();
    return {
      name: typeof link.name === "string" ? link.name.trim() : "",
      url: sanitizeUrl(link.url),
      color: sanitizeColor(link.color),
    };
  };
  const getSavedLinks = () => {
    const saved = GM_getValue(SETTINGS_KEY);
    try {
      const parsed = saved ? JSON.parse(saved) : INITIAL_STATE;
      if (!Array.isArray(parsed)) return INITIAL_STATE;
      const normalized = parsed.map(normalizeLink).slice(0, 8);
      return normalized.length ? normalized : INITIAL_STATE;
    } catch {
      return INITIAL_STATE;
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    #${MODAL_ID} { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: none; align-items: center; justify-content: center; z-index: 10000; font-family: ${INTRA_FONT}; }

    #${MODAL_ID} .modal-content { background:#fff; border-radius:12px; max-width:520px; width:94%; max-height:90vh; overflow:hidden; box-shadow:0 20px 25px -5px rgba(0,0,0,.1); position:relative; }
    #${MODAL_ID} .shortcuts-form { display:flex; flex-direction:column; max-height:90vh; }
    #${MODAL_ID} .modal-header { padding:12px 14px; border-bottom:1px solid #e2e8f0; font-weight:700; color:#1e293b; display:flex; align-items:center; }
    #${MODAL_ID} .modal-title { flex-grow:1; text-align:center; font-size:15px; letter-spacing:-.01em; }

    #reset-shortcuts-btn { background:#fff; border:1px solid #fee2e2; color:#ef4444; font-size:11px; padding:4px 8px; border-radius:6px; cursor:pointer; font-weight:700; transition:all .2s ease; }
    #reset-shortcuts-btn:hover { background:#fef2f2; border-color:#f87171; }

    #close-shortcuts-modal { display:flex; position:relative; width:28px; height:28px; padding:0; border:none; border-radius:50%; background:#f1f5f9; color:#64748b; cursor:pointer; transition:all .3s ease; }
    #close-shortcuts-modal:hover { background:#e2e8f0; color:#1e293b; }
    #close-shortcuts-modal::before, #close-shortcuts-modal::after { content:" "; position:absolute; top:50%; left:50%; width:2px; height:14px; background-color:currentColor; border-radius:1px; }
    #close-shortcuts-modal::before { transform:translate(-50%,-50%) rotate(45deg); }
    #close-shortcuts-modal::after { transform:translate(-50%,-50%) rotate(-45deg); }

    #${MODAL_ID} .modal-body { padding:12px 14px; display:flex; flex-direction:column; gap:10px; overflow-y:auto; }
    .shortcuts-list { display:flex; flex-direction:column; gap:10px; }

    .link-group { display:grid; grid-template-columns: 1fr 1.8fr 46px 24px; align-items:center; gap:8px; border:1px solid #e2e8f0; border-radius:8px; padding:8px; background:#fafcff; }
    .field-control { width:100%; box-sizing:border-box; font-size:14px; font-family:${INTRA_FONT}; padding:10px 12px; min-height:42px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; }
    .set-name:invalid { border-color:#ef4444; }

    .set-color { width:44px; height:32px; padding:0; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; }

    .delete-row-btn { display:flex; position:relative; width:24px; height:24px; padding:0; border:none; border-radius:50%; background:#fee2e2; color:#ef4444; cursor:pointer; transition:all .3s ease; font-size:0; }
    .delete-row-btn:hover { background:#fecaca; color:#dc2626; }
    .delete-row-btn::before, .delete-row-btn::after { content:" "; position:absolute; top:50%; left:50%; width:2px; height:12px; background-color:currentColor; border-radius:1px; }
    .delete-row-btn::before { transform:translate(-50%,-50%) rotate(45deg); }
    .delete-row-btn::after { transform:translate(-50%,-50%) rotate(-45deg); }

    #add-link-row { padding:8px; border:2px dashed #cbd5e1; border-radius:6px; background:transparent; color:#64748b; cursor:pointer; font-weight:700; font-size:12px; }
    #add-link-row:hover { background:#fff; border-color:#94a3b8; }

    #${MODAL_ID} .modal-footer { padding:12px 14px; border-top:1px solid #e2e8f0; }
    #save-shortcuts-btn { width:100%; padding:9px; background:#00BCBA; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:700; cursor:pointer; transition:opacity .2s; font-family:${INTRA_FONT}; }
    #save-shortcuts-btn:hover { opacity:.9; }

    #shortcuts-settings-trigger { position:absolute; top:16px; right:32px; display:flex; align-items:center; justify-content:center; height:30px; padding:2px 12px; background:#f8fafc; color:black; border:2px solid #e2e8f0; border-radius:12px; font-family:${INTRA_FONT}; font-size:12px; font-weight:600; letter-spacing:.02em; cursor:pointer; transition:all .2s ease; line-height:1; z-index:5; }
    #shortcuts-settings-trigger:hover { background:#fff; border-color:#00BCBA; color:#00BCBA; }
  `;
  document.head.appendChild(style);

  const getContrastColor = (hex) => {
    const safeHex = sanitizeColor(hex);
    const r = parseInt(safeHex.slice(1, 3), 16),
      g = parseInt(safeHex.slice(3, 5), 16),
      b = parseInt(safeHex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#ffffff";
  };

  const renderLinkRow = (link) => `
    <div class="link-group">
      <input type="text" class="field-control set-name" value="${escapeHTML(link.name)}" placeholder="Name" required>
      <input type="text" class="field-control set-url" value="${escapeHTML(link.url)}" placeholder="https://example.com">
      <input type="color" class="set-color" value="${sanitizeColor(link.color)}">
      <button type="button" class="delete-row-btn" title="Remove Link" aria-label="Remove Link"></button>
    </div>`;

  const createSettingsModal = () => {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      document.body.appendChild(modal);
    }

    const links = getSavedLinks();
    modal.innerHTML = `
      <div class="modal-content">
        <form id="shortcuts-form" class="shortcuts-form">
          <div class="modal-header">
            <button type="button" id="reset-shortcuts-btn">Reset</button>
            <span class="modal-title">Settings</span>
            <button type="button" id="close-shortcuts-modal" aria-label="Close"></button>
          </div>

          <div class="modal-body">
            <div id="links-list" class="shortcuts-list">
              ${links.map((link) => renderLinkRow(link)).join("")}
            </div>
            <button type="button" id="add-link-row" ${links.length >= 8 ? 'style="display:none;"' : ""}>+ Add link</button>
          </div>

          <div class="modal-footer">
            <button type="submit" id="save-shortcuts-btn">Save & Reload</button>
          </div>
        </form>
      </div>`;

    modal.style.display = "flex";

    modal.onkeydown = (e) => {
      if (
        e.key === "Enter" &&
        (e.target.classList.contains("set-name") ||
          e.target.classList.contains("set-url"))
      ) {
        e.preventDefault();
      }
    };

    const linksList = document.getElementById("links-list");
    linksList.addEventListener("click", (e) => {
      const btn = e.target.closest(".delete-row-btn");
      if (!btn) return;
      btn.closest(".link-group")?.remove();
      const addBtn = document.getElementById("add-link-row");
      if (addBtn) addBtn.style.display = "block";
    });

    const close = () => (modal.style.display = "none");
    document.getElementById("close-shortcuts-modal").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    };

    modal.querySelector(".modal-content").addEventListener("click", (e) => {
      e.stopPropagation();
    });
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };

    document.getElementById("add-link-row").onclick = function () {
      const list = document.getElementById("links-list");
      if (list.querySelectorAll(".link-group").length < 8) {
        const div = document.createElement("div");
        div.innerHTML = renderLinkRow(EMPTY_SLOT());
        list.appendChild(div.firstElementChild);
        if (list.querySelectorAll(".link-group").length >= 8) {
          this.style.display = "none";
        }
      }
    };

    document.getElementById("reset-shortcuts-btn").onclick = () => {
      if (confirm("Reset shortcuts?")) {
        GM_deleteValue(SETTINGS_KEY);
        window.location.reload();
      }
    };

    document.getElementById("shortcuts-form").onsubmit = (e) => {
      e.preventDefault();
      const groups = modal.querySelectorAll(".link-group");
      const updated = Array.from(groups)
        .map((g) =>
          normalizeLink({
            name: g.querySelector(".set-name").value,
            url: g.querySelector(".set-url").value,
            color: g.querySelector(".set-color").value,
          }),
        )
        .filter((l) => l.url !== "" && l.name !== "");

      GM_setValue(
        SETTINGS_KEY,
        JSON.stringify(updated.length ? updated : INITIAL_STATE),
      );
      setTimeout(() => window.location.reload(), 100);
    };
  };

  function inject() {
    const existingWrapper = document.getElementById(CONTAINER_ID);
    const existingBtn = document.getElementById(SETTINGS_TRIGGER_ID);

    if (existingWrapper && existingBtn) return;
    if (existingWrapper) existingWrapper.remove();
    if (existingBtn) existingBtn.remove();

    const banner = document.querySelector(
      ".w-full.flex.flex-row.gap-8.py-4.px-8.items-center",
    );
    const info = banner?.querySelector(".flex.flex-col.text-sm.w-full.gap-1");
    if (!info) return;

    banner.style.position = "relative";
    const wrapper = document.createElement("div");
    wrapper.id = CONTAINER_ID;
    wrapper.style.cssText =
      "display: flex; flex-direction: row; align-items: center; gap: 16px; width: 50%; margin-right: 100px; box-sizing: border-box;";

    const grid = document.createElement("div");
    grid.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex-grow: 1;`;

    const activeLinks = getSavedLinks().filter(
      (link) => link.url !== "" && link.name !== "",
    );

    grid.innerHTML = activeLinks
      .map((link) => {
        try {
          const color = sanitizeColor(link.color);
          const domain = new URL(link.url).hostname;
          return `
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 py-3 px-3 rounded-xl no-underline shadow-sm"
              style="background-color: ${color}; transition: transform 0.1s ease; cursor: pointer;">
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" style="width:20px;height:20px;border-radius:3px;flex-shrink:0;">
            <span class="font-bold uppercase text-[9px] tracking-widest truncate" style="color: ${getContrastColor(color)}; line-height: 1;">${escapeHTML(link.name)}</span>
          </a>`;
        } catch (e) {
          return "";
        }
      })
      .join("");

    const btn = document.createElement("button");
    btn.id = SETTINGS_TRIGGER_ID;
    btn.innerHTML = "Shortcuts";
    btn.onclick = (e) => {
      e.preventDefault();
      createSettingsModal();
    };

    wrapper.append(grid);
    info.style.width = "50%";
    info.classList.remove("w-full");
    banner.appendChild(wrapper);
    banner.appendChild(btn);
  }

  let timer;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const hasWrapper = !!document.getElementById(CONTAINER_ID);
      const hasBtn = !!document.getElementById(SETTINGS_TRIGGER_ID);
      if (!(hasWrapper && hasBtn)) inject();
    }, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => observer.disconnect(), {
    once: true,
  });

  inject();
})();

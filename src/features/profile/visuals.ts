import { html, render } from "lit-html";
import { gmSetValue, gmDeleteValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
import { getIntraLogin, fetchUserVisuals, syncMyVisuals } from "../account/account.ts";

let isFetching = false;
let visualCache: any = null;
let lastUser: string | null = null;

export const injectCustomStyles = () => {
  if (document.getElementById("ft-hub-custom-styles")) return;
  const style = document.createElement("style");
  style.id = "ft-hub-custom-styles";
  style.textContent = `
      .bg-ft-gray b,
      .bg-ft-gray span {font-size: 1.2rem !important;font-weight: bold !important;font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;}
      p.text-sm:nth-child(2) {font-size: 1.3rem !important;}
      #profile-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent;z-index: 10000; display: flex; align-items: center; justify-content: center;}
      .profile-ft-modal { background: #121212; padding: 25px; border-radius: 16px; width: 380px; color: white; border: 1px solid #00babc;box-shadow: 0 0 30px rgba(0,0,0,0.9);}
      .profile-field-group { margin-bottom: 18px; }
      .ft-input { width: 100%; padding: 12px; background: #1e1e1e; border: 1px solid #333; color: white; border-radius: 8px; box-sizing: border-box; outline: none; }
      .ft-input:focus { border-color: #00babc; }
      .profile-ft-modal-footer { display: flex; flex-direction: column; gap: 10px; margin-top: 25px; }
      .profile-footer-main-btns { display: flex; gap: 10px; }
      .btn-ft { padding: 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 13px; }
      .btn-preview { flex: 1; background: #333; color: white; }
      .btn-save { flex: 1; background: #00babc; color: white; }
      .btn-reset { padding: 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 13px; }
      .btn-reset:hover { color: #e74c3c; }
    `;
  document.head.appendChild(style);
};

export const applyImgs = (urls: any) => {
  if (!urls) return;

  const avatar = document.querySelector(
    'div.rounded-full.w-52.h-52[style*="background-image"]',
  );
  const banner = document.querySelector(
    "div.border-neutral-600.bg-ft-gray\\/50",
  );
  const background = document.querySelector(
    ".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black",
  );

  if (avatar && urls.avatar) {
    (avatar as HTMLElement).style.setProperty(
      "background-image",
      `url("${urls.avatar}")`,
      "important",
    );
  }
  if (banner && urls.banner) {
    (banner as HTMLElement).style.setProperty(
      "background-image",
      `url("${urls.banner}")`,
      "important",
    );
  }
  if (background && urls.background) {
    (background as HTMLElement).style.setProperty(
      "background-image",
      `url("${urls.background}")`,
      "important",
    );
  }
};

export const updateVisuals = async () => {
  const myLogin = getIntraLogin();
  if (!myLogin) return;

  const pathParts = location.pathname.split("/").filter((p) => p);
  const targetLogin =
    pathParts[0] === "users" && pathParts[1] ? pathParts[1] : myLogin;

  if (targetLogin !== lastUser) {
    visualCache = null;
    lastUser = targetLogin;
    isFetching = false;
  }

  if (targetLogin === myLogin) {
    const avatarEl = document.querySelector(
      'div.rounded-full[style*="background-image"]',
    ) as HTMLElement;
    if (avatarEl && !avatarEl.dataset.modalListener) {
      avatarEl.style.cursor = "pointer";
      avatarEl.onclick = (e) => {
        e.stopPropagation();
        createSettingsModal();
      };
      avatarEl.dataset.modalListener = "true";
    }
  }

  if (visualCache) {
    applyImgs(visualCache);
    return;
  }

  if (!isFetching) {
    if (targetLogin === myLogin) {
      visualCache = {
        avatar: await getConfig("PROFILE_IMAGE_URL"),
        banner: await getConfig("PROFILE_BANNER_URL"),
        background: await getConfig("PROFILE_BACKGROUND_URL"),
      };

      applyImgs(visualCache);
    } else {
      isFetching = true;
      const cloudUrls = await fetchUserVisuals(targetLogin);

      if (cloudUrls) {
        visualCache = cloudUrls;
        applyImgs(visualCache);
      }
    }
  }
};

function renderModalContent(saved: {
  avatar: string;
  banner: string;
  background: string;
}) {
  return html`<div class="profile-ft-modal">
    <div class="profile-field-group">
      <label>Avatar URL</label>
      <input
        type="text"
        id="in-avatar"
        class="ft-input"
        .value="${saved.avatar}"
      />
    </div>
    <div class="profile-field-group">
      <label>Banner URL</label>
      <input
        type="text"
        id="in-banner"
        class="ft-input"
        .value="${saved.banner}"
      />
    </div>
    <div class="profile-field-group">
      <label>Background URL</label>
      <input
        type="text"
        id="in-background"
        class="ft-input"
        .value="${saved.background}"
      />
    </div>
    <div class="profile-ft-modal-footer">
      <div class="profile-footer-main-btns">
        <button id="btn-preview" class="btn-ft btn-preview">Preview</button>
        <button id="btn-save" class="btn-ft btn-save">Save</button>
      </div>
      <button id="btn-reset" class="btn-ft btn-reset">Restore defaults</button>
    </div>
  </div>`;
}

function setupModalEventListeners(overlay: HTMLElement) {
  const previewBtn = overlay.querySelector("#btn-preview");
  const saveBtn = overlay.querySelector("#btn-save");
  const resetBtn = overlay.querySelector("#btn-reset");

  previewBtn?.addEventListener("click", () => {
    const avatarInput = document.getElementById(
      "in-avatar",
    ) as HTMLInputElement;
    const bannerInput = document.getElementById(
      "in-banner",
    ) as HTMLInputElement;
    const backgroundInput = document.getElementById(
      "in-background",
    ) as HTMLInputElement;

    applyImgs({
      avatar: avatarInput.value,
      banner: bannerInput.value,
      background: backgroundInput.value,
    });
  });

  saveBtn?.addEventListener("click", async () => {
    const vals = {
      avatar: (
        document.getElementById("in-avatar") as HTMLInputElement
      ).value.trim(),
      banner: (
        document.getElementById("in-banner") as HTMLInputElement
      ).value.trim(),
      background: (
        document.getElementById("in-background") as HTMLInputElement
      ).value.trim(),
    };

    await gmSetValue("PROFILE_IMAGE_URL", vals.avatar);
    await gmSetValue("PROFILE_BANNER_URL", vals.banner);
    await gmSetValue("PROFILE_BACKGROUND_URL", vals.background);
    visualCache = vals;
    await syncMyVisuals(vals);
    await applyImgs(vals);
    overlay.remove();
  });

  resetBtn?.addEventListener("click", async () => {
    if (confirm("Reset visuals?")) {
      await gmDeleteValue("PROFILE_IMAGE_URL");
      await gmDeleteValue("PROFILE_BANNER_URL");
      await gmDeleteValue("PROFILE_BACKGROUND_URL");
      visualCache = null;
      await syncMyVisuals({ avatar: "", banner: "", background: "" });
      location.reload();
    }
  });

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

export const createSettingsModal = async () => {
  if (document.getElementById("profile-modal-overlay")) return;

  const saved = {
    avatar: await getConfig("PROFILE_IMAGE_URL"),
    banner: await getConfig("PROFILE_BANNER_URL"),
    background: await getConfig("PROFILE_BACKGROUND_URL"),
  };

  const overlay = document.createElement("div");
  overlay.id = "profile-modal-overlay";

  render(renderModalContent(saved), overlay);

  document.body.appendChild(overlay);

  setupModalEventListeners(overlay);
};

import { html, render } from "lit-html";
import { gmGetValue, gmSetValue, gmDeleteValue } from "../../lib/gm.ts";

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

export const updateVisuals = async () => {
  const avatar = document.querySelector(
    'div.rounded-full[style*="background-image"]',
  ) as HTMLElement;

  if (avatar && !avatar.dataset.modalListener) {
    avatar.style.cursor = "pointer";
    avatar.addEventListener("click", (e) => {
      e.stopPropagation();
      createSettingsModal();
    });
    avatar.dataset.modalListener = "true";
  }

  await applyImgs();
};

export const applyImgs = async (urls?: {
  avatar?: string;
  banner?: string;
  background?: string;
}) => {
  const currentUrls = urls || {
    avatar: await gmGetValue("PROFILE_IMAGE_URL", ""),
    banner: await gmGetValue("PROFILE_BANNER_URL", ""),
    background: await gmGetValue("PROFILE_BACKGROUND_URL", ""),
  };

  const avatar = document.querySelector(
    'div.rounded-full.w-52.h-52[style*="background-image"]',
  ) as HTMLElement;
  const banner = document.querySelector(
    "div.border-neutral-600.bg-ft-gray\\/50",
  ) as HTMLElement;
  const background = document.querySelector(
    ".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black",
  ) as HTMLElement;

  if (avatar && currentUrls.avatar)
    avatar.style.setProperty(
      "background-image",
      `url("${currentUrls.avatar}")`,
      "important",
    );
  if (banner && currentUrls.banner)
    banner.style.setProperty(
      "background-image",
      `url("${currentUrls.banner}")`,
      "important",
    );
  if (background && currentUrls.background)
    background.style.setProperty(
      "background-image",
      `url("${currentUrls.background}")`,
      "important",
    );
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
    const avatarInput = document.getElementById(
      "in-avatar",
    ) as HTMLInputElement;
    const bannerInput = document.getElementById(
      "in-banner",
    ) as HTMLInputElement;
    const backgroundInput = document.getElementById(
      "in-background",
    ) as HTMLInputElement;

    await gmSetValue("PROFILE_IMAGE_URL", avatarInput.value.trim());
    await gmSetValue("PROFILE_BANNER_URL", bannerInput.value.trim());
    await gmSetValue("PROFILE_BACKGROUND_URL", backgroundInput.value.trim());
    location.reload();
  });

  resetBtn?.addEventListener("click", async () => {
    if (confirm("Reset visuals?")) {
      await gmDeleteValue("PROFILE_IMAGE_URL");
      await gmDeleteValue("PROFILE_BANNER_URL");
      await gmDeleteValue("PROFILE_BACKGROUND_URL");
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
    avatar: await gmGetValue("PROFILE_IMAGE_URL", ""),
    banner: await gmGetValue("PROFILE_BANNER_URL", ""),
    background: await gmGetValue("PROFILE_BACKGROUND_URL", ""),
  };

  const overlay = document.createElement("div");
  overlay.id = "profile-modal-overlay";

  render(renderModalContent(saved), overlay);

  document.body.appendChild(overlay);

  setupModalEventListeners(overlay);
};

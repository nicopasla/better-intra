import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getConfig } from "../../config.ts";
import { syncMyVisuals } from "../account/account.ts";
import { applyImgs, injectCustomStyles } from "./visuals.ts";

import PROFILE_CSS from "./profile.css?inline";

function handleLivePreview(shadow: ShadowRoot) {
  applyImgs({
    avatar:
      (shadow.getElementById("PROFILE_IMAGE_URL") as HTMLInputElement)?.value ||
      "",
    banner:
      (shadow.getElementById("PROFILE_BANNER_URL") as HTMLInputElement)
        ?.value || "",
    background:
      (shadow.getElementById("PROFILE_BACKGROUND_URL") as HTMLInputElement)
        ?.value || "",
  });
}

function renderUrlField(
  id: string,
  label: string,
  value: string,
  shadow: ShadowRoot,
) {
  return html`
    <div class="form-control w-full">
      <label class="label py-1"
        ><span class="label-text opacity-80">${label}</span></label
      >
      <label
        class="input input-accent validator flex items-center gap-2 w-full"
      >
        <svg
          class="h-[1em] opacity-50"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            ></path>
            <path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            ></path>
          </g>
        </svg>
        <input
          type="url"
          id="${id}"
          required
          placeholder="https://example.com/image.png"
          .value="${value}"
          data-setting-key="${id}"
          pattern="^(https?://)?.*"
          class="grow"
          @input="${() => handleLivePreview(shadow)}"
        />
      </label>
    </div>
  `;
}

function renderModalContent(
  saved: { avatar: string; banner: string; background: string },
  currentTheme: string,
  onClose: () => void,
  onReset: () => void,
  shadow: ShadowRoot,
) {
  return html`
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      ${unsafeHTML(PROFILE_CSS)} #profile-shadow-wrapper.modal {
        background: transparent !important;
        background-color: transparent !important;
      }
    </style>

    <div
      id="profile-shadow-wrapper"
      class="modal modal-open flex justify-center h-full w-full"
      data-theme="${currentTheme}"
      @mousedown="${(e: MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
      }}"
    >
      <div
        class="modal-box p-6 pt-12 rounded-3xl shadow-2xl flex flex-col relative border border-neutral-700/30 bg-base-100 text-base-content"
        style="width: min(480px, calc(100dvw - 2rem)); max-width: min(480px, calc(100dvw - 2rem));"
        @mousedown="${(e: MouseEvent) => e.stopPropagation()}"
      >
        <button
          class="btn btn-circle btn-ghost btn-sm absolute right-4 top-4"
          @click="${onClose}"
        >
          ✕
        </button>

        <fieldset
          class="fieldset rounded-box gap-4 border border-base-300 bg-base-200/50 p-4"
        >
          ${renderUrlField(
            "PROFILE_IMAGE_URL",
            "Avatar URL",
            saved.avatar,
            shadow,
          )}
          ${renderUrlField(
            "PROFILE_BANNER_URL",
            "Banner URL",
            saved.banner,
            shadow,
          )}
          ${renderUrlField(
            "PROFILE_BACKGROUND_URL",
            "Background URL",
            saved.background,
            shadow,
          )}
        </fieldset>

        <div class="mt-6 flex flex-col gap-2">
          <button
            id="profile-save"
            class="btn btn-success font-bold flex items-center justify-center gap-2"
          >
            Save Changes
          </button>
          <button
            type="button"
            @click="${onReset}"
            class="btn btn-error btn-outline font-bold"
          >
            Restore defaults
          </button>
        </div>
      </div>
    </div>
  `;
}

export const createSettingsModal = async (
  onSaveCallback: (updatedVisuals: any) => void,
) => {
  if (document.getElementById("profile-modal-host")) return;

  const saved = {
    avatar: await getConfig("PROFILE_IMAGE_URL"),
    banner: await getConfig("PROFILE_BANNER_URL"),
    background: await getConfig("PROFILE_BACKGROUND_URL"),
  };

  const host = document.createElement("div");
  host.id = "profile-modal-host";
  document.body.appendChild(host);

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  const shadow = host.attachShadow({ mode: "open" });
  const currentTheme =
    (await getConfig("BETTER_INTRA_THEME")) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");

  const close = () => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    host.remove();
  };

  const reset = async () => {
    if (confirm("Reset visuals?")) {
      const keys = [
        "PROFILE_IMAGE_URL",
        "PROFILE_BANNER_URL",
        "PROFILE_BACKGROUND_URL",
      ];
      await browser.storage.local.remove(keys);
      try {
        await syncMyVisuals({ avatar: "", banner: "", background: "" });
      } catch (e) {}
      close();
      location.reload();
    }
  };

  injectCustomStyles();
  render(renderModalContent(saved, currentTheme, close, reset, shadow), shadow);

  shadow.querySelector("#profile-save")?.addEventListener("click", async () => {
    const keys = [
      "PROFILE_IMAGE_URL",
      "PROFILE_BANNER_URL",
      "PROFILE_BACKGROUND_URL",
    ];
    const batchData: Record<string, string> = {};
    const keysToRemove: string[] = [];

    keys.forEach((key) => {
      const input = shadow.getElementById(key) as HTMLInputElement;
      const val = input?.value.trim() || "";
      if (!val) keysToRemove.push(key);
      else batchData[key] = val;
    });

    if (Object.keys(batchData).length > 0)
      await browser.storage.local.set(batchData);
    if (keysToRemove.length > 0)
      await browser.storage.local.remove(keysToRemove);

    const updatedVisuals = {
      avatar: batchData["PROFILE_IMAGE_URL"] || "",
      banner: batchData["PROFILE_BANNER_URL"] || "",
      background: batchData["PROFILE_BACKGROUND_URL"] || "",
    };

    try {
      await syncMyVisuals(updatedVisuals);
    } catch (e) {}
    onSaveCallback(updatedVisuals);
    close();
  });
};

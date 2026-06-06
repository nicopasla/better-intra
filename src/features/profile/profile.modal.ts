import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getConfig } from "../../config.ts";
import { syncMyVisuals } from "../account/account.ts";
import { applyImgs, injectCustomStyles } from "./visuals.ts";
import CSS from "../../assets/style.css?inline";

function handleLivePreview(e: Event) {
  const root = (e.target as HTMLElement).getRootNode() as ShadowRoot;
  applyImgs({
    avatar:
      (root.getElementById("PROFILE_IMAGE_URL") as HTMLInputElement)?.value ||
      "",
    banner:
      (root.getElementById("PROFILE_BANNER_URL") as HTMLInputElement)?.value ||
      "",
    bannerMode:
      (root.getElementById("PROFILE_BANNER_MODE") as HTMLSelectElement)
        ?.value || "fill",
    background:
      (root.getElementById("PROFILE_BACKGROUND_URL") as HTMLInputElement)
        ?.value || "",
    backgroundMode:
      (root.getElementById("PROFILE_BACKGROUND_MODE") as HTMLSelectElement)
        ?.value || "fill",
  });
}

function renderUrlField(id: string, label: string, value: string) {
  return html`
    <div class="form-control w-full">
      <label class="label py-1">
        <span class="label-text opacity-80">${label}</span>
      </label>
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
          pattern="^(https?://)?.*"
          class="grow"
          @input="${handleLivePreview}"
        />
      </label>
    </div>
  `;
}

function renderModeSelect(id: string, label: string, currentValue: string) {
  const modes = ["fill", "fit", "stretch", "center", "tile"];
  return html`
    <div class="form-control w-full mt-1">
      <label class="label py-0.5">
        <span class="label-text text-xs opacity-60">${label}</span>
      </label>
      <select
        id="${id}"
        class="select select-bordered select-sm w-full"
        @change="${handleLivePreview}"
      >
        ${modes.map(
          (m) =>
            html`<option value="${m}" ?selected="${currentValue === m}">
              ${m.charAt(0).toUpperCase() + m.slice(1)}
            </option>`,
        )}
      </select>
    </div>
  `;
}

function renderPanelContent(
  saved: {
    avatar: string;
    banner: string;
    bannerMode: string;
    background: string;
    backgroundMode: string;
  },
  currentTheme: string,
  onClose: () => void,
  onReset: () => void,
) {
  return html`
    <style>
      :host { display: block; width: 100%; height: 100%; }
      ${unsafeHTML(CSS)}
    </style>
    <div
      data-theme="${currentTheme}"
      class="flex flex-col h-full p-4 gap-3 bg-base-100 rounded-2xl"
    >
      <div class="flex justify-between items-center">
        <button
          type="button"
          @click="${onReset}"
          class="btn btn-ghost btn-sm text-error"
        >
          Reset
        </button>
        <button class="btn btn-circle btn-ghost btn-sm" @click="${onClose}">
          ✕
        </button>
      </div>
      <fieldset
        class="fieldset rounded-box gap-3 border border-base-300 bg-base-200/50 p-3"
      >
        ${renderUrlField("PROFILE_IMAGE_URL", "Avatar URL", saved.avatar)}
        <div class="border-t border-base-300 pt-3">
          ${renderUrlField("PROFILE_BANNER_URL", "Banner URL", saved.banner)}
          ${renderModeSelect(
            "PROFILE_BANNER_MODE",
            "Alignment",
            saved.bannerMode,
          )}
        </div>
        <div class="border-t border-base-300 pt-3">
          ${renderUrlField(
            "PROFILE_BACKGROUND_URL",
            "Background URL",
            saved.background,
          )}
          ${renderModeSelect(
            "PROFILE_BACKGROUND_MODE",
            "Alignment",
            saved.backgroundMode,
          )}
        </div>
      </fieldset>
      <div class="flex flex-col gap-2">
        <button id="profile-save" class="btn btn-success font-bold">
          Save Changes
        </button>
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
    bannerMode: (await getConfig("PROFILE_BANNER_MODE")) || "fill",
    background: await getConfig("PROFILE_BACKGROUND_URL"),
    backgroundMode: (await getConfig("PROFILE_BACKGROUND_MODE")) || "fill",
  };

  const themePref = await getConfig("BETTER_INTRA_THEME");
  const currentTheme =
    themePref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : themePref || "dark";

  const dialog = Object.assign(document.createElement("dialog"), {
    id: "profile-modal-host",
  });
  Object.assign(dialog.style, {
    marginTop: "auto",
    marginBottom: "10vh",
    width: "min(540px, calc(100dvw - 2rem))",
    maxHeight: "80vh",
    borderRadius: "1.5rem",
    overflow: "hidden",
    padding: "0",
    border: "1px solid rgba(128,128,128,0.3)",
  });

  const content = document.createElement("div");
  content.style.cssText =
    "width:100%;height:100%;display:flex;flex-direction:column;";
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  const shadow = content.attachShadow({ mode: "open" });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const reset = async () => {
    if (!confirm("Reset visuals?")) return;
    await chrome.storage.local.remove([
      "PROFILE_IMAGE_URL",
      "PROFILE_BANNER_URL",
      "PROFILE_BANNER_MODE",
      "PROFILE_BACKGROUND_URL",
      "PROFILE_BACKGROUND_MODE",
    ]);
    close();
    location.reload();
  };

  injectCustomStyles();
  render(renderPanelContent(saved, currentTheme, close, reset), shadow);

  content.addEventListener("click", (e) => e.stopPropagation());
  dialog.addEventListener("click", () => close());

  dialog.showModal();

  shadow.querySelector("#profile-save")?.addEventListener("click", async () => {
    const batchData: Record<string, string> = {};
    const keysToRemove: string[] = [];
    const fields = [
      { urlKey: "PROFILE_IMAGE_URL" },
      { urlKey: "PROFILE_BANNER_URL", modeKey: "PROFILE_BANNER_MODE" },
      { urlKey: "PROFILE_BACKGROUND_URL", modeKey: "PROFILE_BACKGROUND_MODE" },
    ];

    for (const { urlKey, modeKey } of fields) {
      const input = shadow.getElementById(urlKey) as HTMLInputElement;
      const val = input?.value.trim() || "";
      if (!val) {
        keysToRemove.push(urlKey);
        if (modeKey) keysToRemove.push(modeKey);
      } else {
        batchData[urlKey] = val;
        if (modeKey) {
          const select = shadow.getElementById(modeKey) as HTMLSelectElement;
          batchData[modeKey] = select?.value || "fill";
        }
      }
    }

    if (Object.keys(batchData).length > 0)
      await chrome.storage.local.set(batchData);
    if (keysToRemove.length > 0)
      await chrome.storage.local.remove(keysToRemove);

    const updatedVisuals = {
      avatar: batchData["PROFILE_IMAGE_URL"] || "",
      banner: batchData["PROFILE_BANNER_URL"] || "",
      bannerMode: batchData["PROFILE_BANNER_MODE"] || "fill",
      background: batchData["PROFILE_BACKGROUND_URL"] || "",
      backgroundMode: batchData["PROFILE_BACKGROUND_MODE"] || "fill",
    };

    try {
      await syncMyVisuals(updatedVisuals);
    } catch (e) {
      console.error("Failed to sync visuals:", e);
    }
    onSaveCallback(updatedVisuals);
    close();
  });
};

import { render } from "lit-html";
import { renderAboutPanel } from "./hub.about.ts";
import {
  FEATURE_DEFS,
  HUB_SETTING_DEFS,
  type FeatureId,
} from "./hubSettings.data.ts";
import { getConfig, setConfig, type ConfigKey } from "../../config.ts";
import { showConfirmDialog } from "../../utils/confirm-dialog.ts";

export function loadAboutPanel(shadow: ShadowRoot): void {
  const placeholder = shadow.querySelector<HTMLElement>(
    "[data-about-placeholder]",
  );
  if (!placeholder) return;
  const target = placeholder.parentElement;
  if (!target) return;
  const slot = document.createElement("div");
  slot.className = "w-full h-full";
  render(renderAboutPanel(), slot);
  placeholder.remove();
  target.appendChild(slot);
}

export function setupSubTabs(root: ParentNode): void {
  root
    .querySelectorAll<HTMLInputElement>('input[name^="hub_subtabs_"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        const group = radio.dataset.subTab ?? "";
        const container = radio.closest<HTMLElement>("[data-sub-tabs-group]");
        if (!container) return;
        container
          .querySelectorAll<HTMLInputElement>('input[name^="hub_subtabs_"]')
          .forEach((r) => {
            r.closest(".tab")?.classList.toggle(
              "tab-active",
              r.dataset.subTab === group,
            );
          });
        container
          .querySelectorAll<HTMLElement>("[data-sub-panel]")
          .forEach((p) => {
            p.classList.toggle("hidden", p.dataset.subPanel !== group);
          });
      });
    });
}

export function bindPanelControls(root: ParentNode, shadow: ShadowRoot): void {
  root.querySelectorAll("input.hub-feature-toggle").forEach((toggle: any) => {
    toggle.addEventListener("change", async () => {
      const id = toggle.dataset.id;
      const isEnabled = toggle.checked;

      const panel =
        shadow.querySelector(`[data-feature-panel="${id}"]`) ??
        (toggle as HTMLElement).closest(".sub-panel");
      panel?.classList.toggle("opacity-40", !isEnabled);
      panel?.classList.toggle("grayscale", !isEnabled);
      panel
        ?.querySelectorAll("[data-setting-key]")
        .forEach((c: any) => (c.disabled = !isEnabled));
      panel?.querySelectorAll(".card").forEach((card: any) => {
        if (isEnabled) {
          card.classList.remove("opacity-40", "grayscale");
        } else {
          card.classList.add("opacity-40", "grayscale");
        }
      });

      const currentScripts = await getConfig("ACTIVE_SCRIPTS");
      const updated = isEnabled
        ? [...currentScripts, id]
        : currentScripts.filter((f: string) => f !== id);
      await setConfig("ACTIVE_SCRIPTS", updated);
    });
  });

  root.querySelectorAll("[data-reset-feature]").forEach((btn: any) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.resetFeature;
      const name =
        FEATURE_DEFS.find((f) => f.id === id)?.name ??
        (id ? String(id) : "this section");
      const ok = await showConfirmDialog({
        title: `Reset ${name}`,
        message: `Reset all ${name} settings? This can't be undone.`,
        confirmLabel: "Reset",
        danger: true,
      });
      if (!ok) return;
      await resetFeatureSettings(shadow, id);
    });
  });
}

async function resetFeatureSettings(
  root: ShadowRoot | HTMLElement,
  featureId: FeatureId,
): Promise<void> {
  const keysToRemove = (HUB_SETTING_DEFS[featureId] ?? [])
    .map((def) => def.key)
    .filter((k): k is ConfigKey => k !== undefined);
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
  (HUB_SETTING_DEFS[featureId] ?? []).forEach((def) => {
    const controls = root.querySelectorAll<HTMLInputElement>(
      `[data-setting-key="${def.key}"]`,
    );
    const val = def.defaultValue ?? (def.kind === "toggle" ? false : "");

    controls.forEach((control) => {
      if (control.type === "radio") {
        control.checked = control.value === String(val);
      } else if (control.type === "checkbox") {
        control.checked = Boolean(val);
      } else {
        control.value = String(val);
      }
    });
  });
}

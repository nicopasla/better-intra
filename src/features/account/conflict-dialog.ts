import { html, render, TemplateResult } from "lit-html";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";
import { CLOUD_SYNC_KEYS } from "../../config.ts";
import { FEATURE_DEFS, HUB_SETTING_DEFS } from "../hub/hubSettings.data.ts";

export type ConflictResolution = "pull" | "keep" | "cancel";

export interface SettingDiff {
  key: string;
  label: string;
  local: unknown;
  cloud: unknown;
}

const LABELS: Record<string, string> = {};
const KEY_FEATURE: Record<string, string> = {};
for (const [featureId, defs] of Object.entries(HUB_SETTING_DEFS)) {
  for (const def of defs) {
    if (!def.key) continue;
    LABELS[def.key] = def.label;
    KEY_FEATURE[def.key] = featureId;
  }
}

const FEATURE_NAME: Record<string, string> = {};
for (const def of FEATURE_DEFS) FEATURE_NAME[def.id] = def.name;

const SYNCED_KEYS = new Set<string>(CLOUD_SYNC_KEYS);

function prettify(key: string): string {
  const words = key.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function normalize(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function humanizeValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    if (json.length <= 60) return json;
    if (Array.isArray(value)) return `${value.length} items`;
    return `${Object.keys(value).length} fields`;
  }
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function diffSettings(
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): SettingDiff[] {
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  const changes: SettingDiff[] = [];
  for (const key of keys) {
    if (!SYNCED_KEYS.has(key)) continue;
    if (normalize(local[key]) === normalize(cloud[key])) continue;
    changes.push({
      key,
      label: LABELS[key] ?? prettify(key),
      local: local[key],
      cloud: cloud[key],
    });
  }
  return changes.sort((a, b) => a.label.localeCompare(b.label));
}

export function groupDiffs(
  diff: SettingDiff[],
): { name: string; items: SettingDiff[] }[] {
  const groups = new Map<string, SettingDiff[]>();
  for (const item of diff) {
    const featureId = KEY_FEATURE[item.key];
    const name = featureId ? (FEATURE_NAME[featureId] ?? "Other") : "Other";
    const list = groups.get(name);
    if (list) list.push(item);
    else groups.set(name, [item]);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
}

export function renderConflictList(diff: SettingDiff[]): TemplateResult {
  const sections = groupDiffs(diff);
  if (sections.length === 0) {
    return html`<p class="text-sm opacity-60">No differences found.</p>`;
  }
  return html`<div class="flex flex-col gap-3">
    ${sections.map(
      (section) =>
        html`<div class="flex flex-col gap-2">
          <span class="text-xs font-bold uppercase tracking-wide opacity-50"
            >${section.name}</span
          >
          <div class="flex flex-col gap-1">
            ${section.items.map(
              (item) =>
                html`<div
                  class="flex flex-col gap-1 rounded-lg bg-base-200/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span class="text-sm">${item.label}</span>
                  <span class="flex items-center gap-2 text-xs">
                    <span class="badge badge-warning badge-sm font-mono"
                      >${humanizeValue(item.local)}</span
                    >
                    <span class="opacity-40">→</span>
                    <span class="badge badge-success badge-sm font-mono"
                      >${humanizeValue(item.cloud)}</span
                    >
                  </span>
                </div>`,
            )}
          </div>
        </div>`,
    )}
  </div>`;
}

export async function showSettingsConflictDialog(
  diff: SettingDiff[],
): Promise<ConflictResolution> {
  document.getElementById("ft-settings-conflict")?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "ft-settings-conflict";
  dialog.className = "bg-transparent backdrop:bg-black/50";
  Object.assign(dialog.style, {
    margin: "auto",
    padding: "0",
    border: "none",
    borderRadius: "1rem",
    width: "min(720px, calc(100dvw - 2rem))",
    maxHeight: "calc(100dvh - 2rem)",
  });

  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });

  let resolvePromise!: (value: ConflictResolution) => void;
  const promise = new Promise<ConflictResolution>((r) => (resolvePromise = r));
  const resolve = (value: ConflictResolution) => {
    dialog.close();
    dialog.remove();
    resolvePromise(value);
  };

  render(
    html`
      <div
        data-theme="${theme}"
        class="card bg-base-100 text-base-content shadow-2xl rounded-2xl overflow-hidden"
      >
        <div class="flex flex-col gap-1 p-5 pb-3">
          <h3 class="font-bold text-lg">Settings changed on another device</h3>
          <p class="text-sm opacity-70">
            These settings differ between this device and the cloud. Choose
            which version to keep.
          </p>
        </div>
        <div class="px-5 overflow-auto" style="max-height:50vh;">
          ${renderConflictList(diff)}
        </div>
        <div class="flex flex-wrap justify-end gap-2 p-5 pt-4">
          <button
            class="btn btn-sm btn-ghost"
            @click="${() => resolve("cancel")}"
          >
            Cancel
          </button>
          <button
            class="btn btn-sm btn-warning font-bold"
            @click="${() => resolve("keep")}"
          >
            Keep this device
          </button>
          <button
            class="btn btn-sm btn-success font-bold"
            @click="${() => resolve("pull")}"
          >
            Use cloud
          </button>
        </div>
      </div>
    `,
    shadow,
  );
  adoptShadowStyles(shadow);

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) resolve("cancel");
  });

  return promise;
}

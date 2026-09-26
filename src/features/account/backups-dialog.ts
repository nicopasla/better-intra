import { html, render } from "lit-html";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";
import {
  showAlertDialog,
  showConfirmDialog,
} from "../../utils/confirm-dialog.ts";
import { getConfig } from "../../config.ts";
import { formatRelative } from "../../utils/dates.ts";
import {
  fetchSettingsHistory,
  restoreLocalBackup,
  restoreSettingsSnapshot,
  type SettingsHistoryEntryView,
} from "./account.ts";

export async function showBackupsDialog(): Promise<void> {
  document.getElementById("ft-backups-dialog")?.remove();

  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  const dialog = document.createElement("dialog");
  dialog.id = "ft-backups-dialog";
  dialog.className = "bg-transparent backdrop:bg-black/50";
  Object.assign(dialog.style, {
    margin: "auto",
    padding: "0",
    border: "none",
    borderRadius: "1rem",
    width: "min(560px, calc(100dvw - 2rem))",
    maxHeight: "calc(100dvh - 2rem)",
  });

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const renderDialog = (
    history: SettingsHistoryEntryView[],
    local: { at: number }[],
    loading: boolean,
  ) => {
    render(
      html`
        <div
          data-theme="${theme}"
          class="card bg-base-100 text-base-content shadow-2xl rounded-2xl overflow-hidden"
        >
          <div class="flex items-center justify-between gap-2 p-5 pb-2">
            <h3 class="font-bold text-lg">Backups</h3>
            <button
              class="btn btn-circle btn-ghost btn-sm"
              type="button"
              @click="${close}"
            >
              ✕
            </button>
          </div>
          <div
            class="px-5 pb-5 flex flex-col gap-4 overflow-auto"
            style="max-height:60vh;"
          >
            ${loading
              ? html`<span
                  class="loading loading-spinner loading-md self-center"
                ></span>`
              : html`
                  <div class="flex flex-col gap-2">
                    <span
                      class="text-xs font-bold uppercase tracking-wide opacity-50"
                      >Cloud snapshots</span
                    >
                    ${history.length === 0
                      ? html`<span class="text-sm opacity-60"
                          >No cloud snapshots yet.</span
                        >`
                      : history.map(
                          (h) => html`
                            <div
                              class="flex items-center justify-between gap-2 rounded-lg bg-base-200/60 px-3 py-2"
                            >
                              <span class="text-sm"
                                >${formatRelative(h.createdAt)}</span
                              >
                              <button
                                class="btn btn-xs btn-outline font-bold"
                                type="button"
                                @click="${() => restoreCloud(h.index)}"
                              >
                                Restore
                              </button>
                            </div>
                          `,
                        )}
                  </div>
                  <div class="flex flex-col gap-2">
                    <span
                      class="text-xs font-bold uppercase tracking-wide opacity-50"
                      >Local snapshots</span
                    >
                    ${local.length === 0
                      ? html`<span class="text-sm opacity-60"
                          >No local snapshots.</span
                        >`
                      : local.map(
                          (b, i) => html`
                            <div
                              class="flex items-center justify-between gap-2 rounded-lg bg-base-200/60 px-3 py-2"
                            >
                              <span class="text-sm"
                                >${formatRelative(b.at)}</span
                              >
                              <button
                                class="btn btn-xs btn-outline font-bold"
                                type="button"
                                @click="${() => restoreLocalAt(i)}"
                              >
                                Restore
                              </button>
                            </div>
                          `,
                        )}
                  </div>
                `}
          </div>
        </div>
      `,
      shadow,
    );
    adoptShadowStyles(shadow);
  };

  const refresh = async () => {
    renderDialog([], [], true);
    const [history, localRaw] = await Promise.all([
      fetchSettingsHistory(),
      getConfig("SETTINGS_BACKUP_LOCAL"),
    ]);
    renderDialog(history, localRaw || [], false);
  };

  const restoreCloud = async (index: number) => {
    const confirmed = await showConfirmDialog({
      title: "Restore cloud snapshot",
      message: "Replace your current settings with this snapshot?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    const ok = await restoreSettingsSnapshot(index);
    if (!ok) {
      await showAlertDialog({
        title: "Restore failed",
        message: "Could not restore that snapshot.",
      });
      return;
    }
    window.location.reload();
  };

  const restoreLocalAt = async (index: number) => {
    const confirmed = await showConfirmDialog({
      title: "Restore local snapshot",
      message: "Replace your current settings with this local snapshot?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    const ok = await restoreLocalBackup(index);
    if (!ok) {
      await showAlertDialog({
        title: "Restore failed",
        message: "Could not restore that snapshot.",
      });
      return;
    }
    window.location.reload();
  };

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  void refresh();
}

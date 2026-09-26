import {
  applyCloudSettings,
  clearAuthFailed,
  collectLocalSettings,
  fetchCloudSettings,
  fetchMySettings,
  fetchSessions,
  loginWith42,
  logoutCloud,
  pushLocalBackup,
  revokeSession,
  syncToCloud,
  testCloudConnection,
  wipeAllCloudData,
} from "./account";
import { diffSettings } from "./conflict-dialog.ts";
import { showBackupsDialog } from "./backups-dialog.ts";
import {
  showAlertDialog,
  showConfirmDialog,
} from "../../utils/confirm-dialog.ts";
import { AccountState, resetButtonState } from "./state";

export function createHandlers(state: AccountState, updateUI: () => void) {
  const handleLogin42 = () => {
    loginWith42(async () => {
      await clearAuthFailed();
      void chrome.runtime
        .sendMessage({ type: "FT_RELOAD_INTRA_TABS" })
        .catch(() => reloadActiveTab());
      window.close();
    });
  };

  const reloadActiveTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) chrome.tabs.reload(tab.id);
  };

  const reloadTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) chrome.tabs.reload(tab.id);
  };

  const handleDelete = async () => {
    const confirmed = await showConfirmDialog({
      title: "Disconnect",
      message: "Disconnect and clear your cloud session data locally?",
      confirmLabel: "Disconnect",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    // Clearing CLOUD_TOKEN closes the popup and makes the background reload
    // the intra tabs, so no explicit reload is needed here.
    await logoutCloud();
  };

  const handleWipe = async () => {
    const confirmed = await showConfirmDialog({
      title: "Wipe all cloud data",
      message:
        "This will permanently delete ALL your saved settings and sessions from the cloud. Are you sure?",
      confirmLabel: "Wipe",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    const success = await wipeAllCloudData();
    if (success) {
      // The popup closes automatically when the token is cleared and the
      // background reloads the intra tabs.
      return;
    }
    await showAlertDialog({
      title: "Wipe failed",
      message: "Failed to delete cloud data. Please try again.",
    });
  };

  const handlePush = async () => {
    if (state.buttons.push.loading) return;

    state.buttons.push = { loading: true, text: "Connecting..." } as any;
    updateUI();

    if (!(await testCloudConnection())) {
      state.buttons.push = {
        loading: false,
        error: true,
        text: "Connection Failed",
      } as any;
      updateUI();
      setTimeout(() => {
        resetButtonState(state, "push", "Push Settings");
        updateUI();
      }, 2500);
      return;
    }

    const result = await syncToCloud();

    if (result.status === "conflict") {
      resetButtonState(state, "push", "Push Settings");
      await loadReview(result.cloud ?? {});
      return;
    }

    if (result.status === "ok") {
      await clearAuthFailed();
      state.buttons.push = {
        loading: false,
        success: true,
        text: "Synced!",
      } as any;
    } else {
      state.buttons.push = {
        loading: false,
        error: true,
        text: "Sync Failed",
      } as any;
    }
    updateUI();
    setTimeout(() => {
      resetButtonState(state, "push", "Push Settings");
      updateUI();
    }, 2500);
  };

  const loadReview = async (cloud?: Record<string, unknown>) => {
    const cloudSettings = cloud ?? (await fetchCloudSettings())?.settings;
    if (!cloudSettings) return;
    const local = await collectLocalSettings();
    state.reviewDiff = diffSettings(local, cloudSettings);
    state.reviewOpen = true;
    updateUI();
  };

  const handleReviewConflict = async () => {
    await loadReview();
  };

  const handleDismissReview = () => {
    state.reviewOpen = false;
    updateUI();
  };

  const handleUseCloud = async () => {
    const cloud = await fetchCloudSettings();
    if (!cloud) return;
    await pushLocalBackup();
    await applyCloudSettings(cloud.settings as never);
    await chrome.storage.local.set({
      CLOUD_BASELINE: cloud.settings,
      CLOUD_REVISION: cloud.revision,
      CLOUD_SYNC_CONFLICT: false,
      LAST_CLOUD_SYNC: Date.now(),
    });
    state.conflict = false;
    state.reviewOpen = false;
    state.reviewDiff = [];
    updateUI();
  };

  const handleKeepMine = async () => {
    const local = await collectLocalSettings();
    await syncToCloud({ force: true });
    await chrome.storage.local.set({
      CLOUD_BASELINE: local,
      CLOUD_SYNC_CONFLICT: false,
    });
    state.conflict = false;
    state.reviewOpen = false;
    state.reviewDiff = [];
    updateUI();
  };

  const handleOpenBackups = () => {
    void showBackupsDialog();
  };

  const handlePull = async () => {
    if (state.buttons.pull.loading) return;
    const confirmed = await showConfirmDialog({
      title: "Pull settings",
      message: "Overwrite current local settings with cloud backup?",
      confirmLabel: "Pull",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    state.buttons.pull = { loading: true, text: "Connecting..." } as any;
    updateUI();

    if (!(await testCloudConnection())) {
      state.buttons.pull = {
        loading: false,
        error: true,
        text: "Connection Failed",
      } as any;
      updateUI();
      setTimeout(() => {
        resetButtonState(state, "pull", "Pull Settings");
        updateUI();
      }, 2000);
      return;
    }

    const settings = await fetchMySettings();
    if (settings) {
      await clearAuthFailed();
      await pushLocalBackup();
      await applyCloudSettings(settings);
      await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
      state.buttons.pull = {
        loading: false,
        success: true,
        text: "Restored!",
      } as any;
      updateUI();
      setTimeout(() => reloadTab(), 1500);
    } else {
      state.buttons.pull = {
        loading: false,
        error: true,
        text: "No Data Found",
      } as any;
      updateUI();
      setTimeout(() => {
        resetButtonState(state, "pull", "Pull Settings");
        updateUI();
      }, 2000);
    }
  };

  const handleRevokeSession = async (id: string) => {
    const session = state.sessions.find((s) => s.id === id);
    const confirmed = await showConfirmDialog({
      title: "Revoke session",
      message: `Sign out ${session?.label || "this device"}?`,
      confirmLabel: "Revoke",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    state.revokingId = id;
    updateUI();
    const ok = await revokeSession(id);
    state.revokingId = null;

    if (!ok) {
      updateUI();
      await showAlertDialog({
        title: "Revoke failed",
        message: "Could not revoke that session. Please try again.",
      });
      return;
    }

    if (session?.current) {
      await logoutCloud();
      return;
    }

    const { sessions, max } = await fetchSessions();
    state.sessions = sessions;
    state.sessionsMax = max;
    state.activeSessions = sessions.length;
    updateUI();
  };

  const handleRevokeOthers = async () => {
    const others = state.sessions.filter((s) => !s.current);
    if (others.length === 0) return;

    const confirmed = await showConfirmDialog({
      title: "Sign out other sessions",
      message: `Sign out ${others.length} other ${
        others.length === 1 ? "session" : "sessions"
      }?`,
      confirmLabel: "Sign out",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    state.revokingOthers = true;
    updateUI();
    const results = await Promise.all(others.map((s) => revokeSession(s.id)));
    state.revokingOthers = false;

    const { sessions, max } = await fetchSessions();
    state.sessions = sessions;
    state.sessionsMax = max;
    state.activeSessions = sessions.length;
    updateUI();

    if (results.some((ok) => !ok)) {
      await showAlertDialog({
        title: "Some sessions weren't signed out",
        message: "Please try again.",
      });
    }
  };

  return {
    handleLogin42,
    handleDelete,
    handleWipe,
    handlePush,
    handlePull,
    handleRevokeSession,
    handleRevokeOthers,
    handleReviewConflict,
    handleDismissReview,
    handleUseCloud,
    handleKeepMine,
    handleOpenBackups,
  };
}

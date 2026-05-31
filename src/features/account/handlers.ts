import {
  applyCloudSettings,
  fetchMySettings,
  loginWith42,
  logoutCloud,
  syncToCloud,
  testCloudConnection,
  wipeAllCloudData,
} from "./account";
import { AccountState, resetButtonState } from "./state";

export function createHandlers(state: AccountState, updateUI: () => void) {
  const handleLogin42 = () => {
    loginWith42(() => {
      console.log("Settings refreshed without reload!");
      updateUI();
    });
  };

  const handleToggleSync = async (enabled: boolean) => {
    state.isSyncEnabled = enabled;
    await chrome.storage.local.set({ CLOUD_SYNC_ENABLED: enabled });
    updateUI();
  };

  const handleTestConnection = async () => {
    state.buttons.testLoading = true;
    updateUI();
    state.activeSessions = await testCloudConnection();
    state.buttons.testLoading = false;
    updateUI();
  };

  const handleDelete = async () => {
    if (confirm("Disconnect and clear your cloud session data locally?")) {
      await logoutCloud();
      window.location.reload();
    }
  };

  const handleWipe = async () => {
    if (
      !confirm(
        "This will permanently delete ALL your saved settings and sessions from the cloud. Are you sure?",
      )
    )
      return;

    const success = await wipeAllCloudData();
    if (success) {
      alert("All cloud data successfully wiped.");
      window.location.reload();
    } else {
      alert("Failed to delete cloud data. Please try again.");
    }
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

    const success = await syncToCloud();
    if (success) {
      await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
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

  const handlePull = async () => {
    if (state.buttons.pull.loading) return;
    if (!confirm("Overwrite current local settings with cloud backup?")) return;

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
      await applyCloudSettings(settings);
      await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
      state.buttons.pull = {
        loading: false,
        success: true,
        text: "Restored!",
      } as any;
      updateUI();
      setTimeout(() => window.location.reload(), 1500);
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
  const handleToggleNotifications = async (enabled: boolean) => {
    state.isNotificationsEnabled = enabled;
    await chrome.storage.local.set({ EVAL_NOTIFICATIONS_ENABLED: enabled });
    updateUI();
  };

  return {
    handleLogin42,
    handleToggleSync,
    handleToggleNotifications,
    handleTestConnection,
    handleDelete,
    handleWipe,
    handlePush,
    handlePull,
  };
}

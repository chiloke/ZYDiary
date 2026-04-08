import { getDefaultState } from "../core/constants.js";
import { chooseStorageDirectory, createExportPayload, getRecoverySnapshotInfo, getStorageDirectoryInfo, openStorageDirectory, parseImportedFile, resetPersistedState } from "../core/storage.js";
import { mergeState } from "../core/state.js";
import { $ } from "../core/utils.js";

export function initProfilePage(context) {
  if (document.body.dataset.page !== "profile") return;

  context.updateRealmWidgets();
  context.renderAbilityList($("#profileAbilities"));
  context.renderRealmList($("#realmList"));
  context.renderAuraTimeline($("#profileTimeline"));

  const exportButton = $("#exportDataButton");
  const importInput = $("#importDataInput");
  const resetDemoButton = $("#resetDemoButton");
  const clearDataButton = $("#clearDataButton");
  const openDirectoryButton = $("#openStorageDirectoryButton");
  const changeDirectoryButton = $("#changeStorageDirectoryButton");
  const saveUsernameButton = $("#saveUsernameButton");
  const usernameInput = $("#usernameInput");
  const themeSelect = $("#themeSelect");
  const saveThemeButton = $("#saveThemeButton");
  const reminderEnabledInput = $("#reminderEnabledInput");
  const dailyReminderEnabledInput = $("#dailyReminderEnabledInput");
  const dailyReminderTimeInput = $("#dailyReminderTimeInput");
  const goalsReminderEnabledInput = $("#goalsReminderEnabledInput");
  const goalsReminderTimeInput = $("#goalsReminderTimeInput");
  const recurringReminderEnabledInput = $("#recurringReminderEnabledInput");
  const recurringReminderTimeInput = $("#recurringReminderTimeInput");
  const saveReminderSettingsButton = $("#saveReminderSettingsButton");
  const requestNotificationPermissionButton = $("#requestNotificationPermissionButton");
  const reminderSettingsMessage = $("#reminderSettingsMessage");
  const message = $("#dataToolsMessage");
  const recoverySavedAt = $("#recoverySavedAt");
  const recoverySchemaVersion = $("#recoverySchemaVersion");
  const recoveryStateSize = $("#recoveryStateSize");
  const storageDirectoryPath = $("#storageDirectoryPath");
  const storageDirectoryMode = $("#storageDirectoryMode");
  const storageStateFile = $("#storageStateFile");
  const storageSnapshotFile = $("#storageSnapshotFile");

  usernameInput.value = context.getUserName();
  if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
  renderReminderSettings();

  async function renderRecoverySnapshot() {
    const info = await getRecoverySnapshotInfo();
    if (!info) {
      recoverySavedAt.textContent = "暂无快照";
      recoverySchemaVersion.textContent = "--";
      recoveryStateSize.textContent = "--";
      return;
    }

    recoverySavedAt.textContent = info.savedAt ? info.savedAt.replace("T", " ").slice(0, 16) : "暂无时间";
    recoverySchemaVersion.textContent = `v${info.schemaVersion || "--"}`;
    recoveryStateSize.textContent = `${Math.max(1, Math.round((info.stateSize || 0) / 1024))} KB`;
  }

  async function renderStorageDirectory() {
    const info = await getStorageDirectoryInfo();
    storageDirectoryPath.textContent = info?.directory || "当前无法读取存储目录";
    storageStateFile.textContent = info?.stateFile || "--";
    storageSnapshotFile.textContent = info?.snapshotFile || "--";
    if (info?.mode === "desktop-file") {
      storageDirectoryMode.textContent = "桌面文件存储";
      openDirectoryButton.disabled = false;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "更改目录";
      return;
    }

    if (info?.mode === "native-documents") {
      storageDirectoryMode.textContent = "安卓文档目录存储";
      openDirectoryButton.disabled = true;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "切换存储位置";
      return;
    }

    if (info?.mode === "native-private") {
      storageDirectoryMode.textContent = "安卓应用私有存储";
      openDirectoryButton.disabled = true;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "切换存储位置";
      return;
    }

    storageDirectoryMode.textContent = "浏览器本地存储";
    openDirectoryButton.disabled = true;
    changeDirectoryButton.disabled = true;
  }

  saveUsernameButton.addEventListener("click", async () => {
    const nextName = usernameInput.value.trim();
    if (!nextName) {
      message.textContent = "请先输入用户名。";
      return;
    }
    context.state.settings.username = nextName;
    await context.saveState();
    context.updateIdentityWidgets();
    message.textContent = `用户名已更新为「${nextName}」。下次启动时开屏问候也会同步变化。`;
  });

  saveThemeButton?.addEventListener("click", async () => {
    context.state.settings.theme = themeSelect.value || "dawn";
    await context.saveState();
    context.applyTheme();
    message.textContent = `主题已切换为「${themeSelect.value === "ink" ? "夜墨青金" : "晨雾米金"}」。`;
  });

  saveReminderSettingsButton?.addEventListener("click", async () => {
    context.state.settings.reminders = {
      enabled: Boolean(reminderEnabledInput?.checked),
      daily: Boolean(dailyReminderEnabledInput?.checked),
      dailyTime: dailyReminderTimeInput?.value || "21:30",
      goals: Boolean(goalsReminderEnabledInput?.checked),
      goalsTime: goalsReminderTimeInput?.value || "20:30",
      recurring: Boolean(recurringReminderEnabledInput?.checked),
      recurringTime: recurringReminderTimeInput?.value || "10:00"
    };
    await context.saveState();
    reminderSettingsMessage.textContent = "提醒设置已保存，新的时间会从下一次检查开始生效。";
  });

  requestNotificationPermissionButton?.addEventListener("click", async () => {
    const result = await context.requestNativeNotificationPermission();
    reminderSettingsMessage.textContent = result.granted
      ? "原生通知能力已开启，后续提醒会尝试同步到系统通知。"
      : "原生通知权限未开启，应用仍会继续使用页面内轻提醒。";
    if ("Notification" in window && requestNotificationPermissionButton) {
      requestNotificationPermissionButton.textContent = result.granted
        ? "系统通知已开启"
        : "启用系统通知权限";
    }
  });

  exportButton.addEventListener("click", () => {
    const payload = createExportPayload(context.state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zy-diary-backup-${context.todayKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.textContent = "备份文件已导出。";
  });

  importInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const imported = await parseImportedFile(file);
      const merged = mergeState({
        ...imported,
        meta: {
          ...(imported.meta || {}),
          lastImportedAt: new Date().toISOString()
        }
      });
      context.replaceState(merged);
      usernameInput.value = context.getUserName();
      if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
      renderReminderSettings();
      await context.saveState();
      message.textContent = "备份导入成功，已刷新当前状态。";
      context.applyTheme();
      context.updateRealmWidgets();
      await renderRecoverySnapshot();
      await renderStorageDirectory();
    } catch {
      message.textContent = "导入失败：请确认文件是有效的 ZY Diary JSON 备份。";
    } finally {
      importInput.value = "";
    }
  });

  resetDemoButton.addEventListener("click", async () => {
    if (!window.confirm("这会恢复为空白初始状态并清空当前记录，是否继续？")) return;
    const nextState = mergeState(getDefaultState());
    context.replaceState(nextState);
    usernameInput.value = context.getUserName();
    await resetPersistedState(nextState);
    if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
    renderReminderSettings();
    message.textContent = "已经恢复为空白初始状态。";
    context.applyTheme();
    context.updateRealmWidgets();
    await renderRecoverySnapshot();
    await renderStorageDirectory();
  });

  clearDataButton.addEventListener("click", async () => {
    if (!window.confirm("这会清空当前本地数据，是否继续？")) return;
    const emptyState = mergeState(getDefaultState(new Date()));
    emptyState.goals = [];
    emptyState.goalLogs = [];
    emptyState.expenses = [];
    emptyState.reviewEntries = [];
    emptyState.annotations = [];
    emptyState.auraEvents = {};
    emptyState.recurringExpenses = [];
    emptyState.review = { win: "", block: "", next: "", summary: "", savedAt: "", rewardedDate: "" };
    context.replaceState(emptyState);
    usernameInput.value = context.getUserName();
    if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
    renderReminderSettings();
    await resetPersistedState(emptyState);
    message.textContent = "本地数据已清空。";
    context.applyTheme();
    context.updateRealmWidgets();
    await renderRecoverySnapshot();
    await renderStorageDirectory();
  });

  openDirectoryButton.addEventListener("click", async () => {
    const opened = await openStorageDirectory();
    message.textContent = opened ? "已尝试打开数据目录。" : "当前平台暂不支持直接打开目录，但你仍然可以查看或切换存储位置。";
  });

  changeDirectoryButton.addEventListener("click", async () => {
    try {
      const nextInfo = await chooseStorageDirectory(context.state);
      if (!nextInfo) {
        message.textContent = "已取消更改数据目录。";
        return;
      }
      message.textContent = nextInfo.mode === "native-documents"
        ? "已切换到设备文档目录，当前状态也已迁移。"
        : nextInfo.mode === "native-private"
          ? "已切换到应用私有目录，当前状态也已迁移。"
          : "数据目录已更新，当前状态也已迁移到新目录。";
      await renderStorageDirectory();
      await renderRecoverySnapshot();
    } catch (error) {
      message.textContent = error?.message || "切换存储位置失败，请稍后再试。";
    }
  });

  renderRecoverySnapshot();
  renderStorageDirectory();

  function renderReminderSettings() {
    const reminders = context.state.settings.reminders || {};
    if (reminderEnabledInput) reminderEnabledInput.checked = reminders.enabled !== false;
    if (dailyReminderEnabledInput) dailyReminderEnabledInput.checked = reminders.daily !== false;
    if (dailyReminderTimeInput) dailyReminderTimeInput.value = reminders.dailyTime || "21:30";
    if (goalsReminderEnabledInput) goalsReminderEnabledInput.checked = reminders.goals !== false;
    if (goalsReminderTimeInput) goalsReminderTimeInput.value = reminders.goalsTime || "20:30";
    if (recurringReminderEnabledInput) recurringReminderEnabledInput.checked = reminders.recurring !== false;
    if (recurringReminderTimeInput) recurringReminderTimeInput.value = reminders.recurringTime || "10:00";
    if (requestNotificationPermissionButton && "Notification" in window) {
      requestNotificationPermissionButton.textContent = Notification.permission === "granted"
        ? "系统通知已开启"
        : "启用系统通知权限";
    }
  }
}

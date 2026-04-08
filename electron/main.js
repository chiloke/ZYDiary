const { app, BrowserWindow, Notification, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const APP_CONFIG_FILE = "desktop-config.json";
const STATE_FILE_NAME = "zy-diary-state.json";
const SNAPSHOT_FILE_NAME = "zy-diary-recovery-snapshot.json";
const APP_ICON_PATH = path.join(__dirname, "..", "build", "icon.png");
const scheduledNotificationTimers = new Map();

function getConfigPath() {
  return path.join(app.getPath("userData"), APP_CONFIG_FILE);
}

function getDefaultStorageDirectory() {
  return path.join(app.getPath("documents"), "ZY Diary Data");
}

async function ensureDirectory(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, data) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readConfig() {
  const config = await readJson(getConfigPath());
  return config && typeof config === "object" ? config : {};
}

async function writeConfig(config) {
  await writeJson(getConfigPath(), config);
}

async function getStorageDirectory() {
  const config = await readConfig();
  return config.storageDirectory || getDefaultStorageDirectory();
}

async function getStorageInfo() {
  const directory = await getStorageDirectory();
  return {
    mode: "desktop-file",
    directory,
    stateFile: path.join(directory, STATE_FILE_NAME),
    snapshotFile: path.join(directory, SNAPSHOT_FILE_NAME)
  };
}

async function writeSnapshot(directory, state) {
  const snapshot = {
    savedAt: new Date().toISOString(),
    schemaVersion: state?.meta?.schemaVersion || 0,
    state
  };
  await writeJson(path.join(directory, SNAPSHOT_FILE_NAME), snapshot);
}

async function loadState() {
  const info = await getStorageInfo();
  await ensureDirectory(info.directory);
  return readJson(info.stateFile);
}

async function saveState(state) {
  const info = await getStorageInfo();
  await ensureDirectory(info.directory);
  await writeJson(info.stateFile, state);
  await writeSnapshot(info.directory, state);
  return true;
}

async function resetState(state) {
  return saveState(state);
}

async function getRecoverySnapshotInfo() {
  const info = await getStorageInfo();
  const snapshot = await readJson(info.snapshotFile);
  if (!snapshot) return null;

  try {
    const stat = await fs.stat(info.snapshotFile);
    return {
      savedAt: snapshot.savedAt || "",
      schemaVersion: snapshot.schemaVersion || 0,
      stateSize: stat.size
    };
  } catch {
    return {
      savedAt: snapshot.savedAt || "",
      schemaVersion: snapshot.schemaVersion || 0,
      stateSize: 0
    };
  }
}

async function chooseStorageDirectory(currentState, parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: "选择 ZY Diary 数据目录",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  const directory = result.filePaths[0];
  await ensureDirectory(directory);
  const currentConfig = await readConfig();
  await writeConfig({ ...currentConfig, storageDirectory: directory });

  if (currentState && typeof currentState === "object") {
    await writeJson(path.join(directory, STATE_FILE_NAME), currentState);
    await writeSnapshot(directory, currentState);
  }

  return getStorageInfo();
}

async function openStorageDirectory() {
  const info = await getStorageInfo();
  await ensureDirectory(info.directory);
  const result = await shell.openPath(info.directory);
  return result === "";
}

function clearScheduledDesktopNotifications() {
  scheduledNotificationTimers.forEach((timer) => clearTimeout(timer));
  scheduledNotificationTimers.clear();
}

function syncDesktopNotifications(notifications = []) {
  clearScheduledDesktopNotifications();
  if (!Notification.isSupported()) {
    return { supported: false, scheduled: 0 };
  }

  const now = Date.now();
  let scheduled = 0;

  notifications.forEach((item) => {
    const at = new Date(item.at).getTime();
    if (!Number.isFinite(at) || at <= now) return;
    const delay = Math.min(at - now, 2147483647);
    const timer = setTimeout(() => {
      const notice = new Notification({
        title: item.title || "ZY Diary",
        body: item.body || "",
        icon: APP_ICON_PATH,
        silent: true
      });
      notice.show();
      scheduledNotificationTimers.delete(item.id);
    }, delay);
    scheduledNotificationTimers.set(item.id, timer);
    scheduled += 1;
  });

  return { supported: true, scheduled };
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#efe9df",
    autoHideMenuBar: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
  return win;
}

app.whenReady().then(() => {
  const mainWindow = createMainWindow();

  ipcMain.handle("storage:load-state", () => loadState());
  ipcMain.handle("storage:save-state", (_event, state) => saveState(state));
  ipcMain.handle("storage:reset-state", (_event, state) => resetState(state));
  ipcMain.handle("storage:get-recovery-snapshot-info", () => getRecoverySnapshotInfo());
  ipcMain.handle("storage:get-info", () => getStorageInfo());
  ipcMain.handle("storage:choose-directory", (_event, state) => chooseStorageDirectory(state, BrowserWindow.fromWebContents(_event.sender) || mainWindow));
  ipcMain.handle("storage:open-directory", () => openStorageDirectory());
  ipcMain.handle("notifications:sync", (_event, notifications) => syncDesktopNotifications(notifications));
  ipcMain.handle("notifications:supported", () => Notification.isSupported());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  clearScheduledDesktopNotifications();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

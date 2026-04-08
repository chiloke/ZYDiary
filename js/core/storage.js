import { DB_NAME, DB_VERSION, LEGACY_KEY, RECOVERY_SNAPSHOT_KEY, SCHEMA_VERSION, STATE_KEY, STORE_NAME } from "./constants.js";
import { clone } from "./utils.js";

const NATIVE_STORAGE_MODE_KEY = "zy-diary-native-storage-mode";
const NATIVE_STORAGE_PRIVATE = "private";
const NATIVE_STORAGE_DOCUMENTS = "documents";
const NATIVE_FOLDER = "ZYDiary";
const NATIVE_STATE_FILE = `${NATIVE_FOLDER}/zy-diary-state.json`;
const NATIVE_SNAPSHOT_FILE = `${NATIVE_FOLDER}/zy-diary-recovery-snapshot.json`;

let db = null;

function getDesktopBridge() {
  return typeof window !== "undefined" && window.zyDesktop ? window.zyDesktop : null;
}

function getCapacitorBridge() {
  if (typeof window === "undefined" || !window.Capacitor) return null;
  const isNative = typeof window.Capacitor.isNativePlatform === "function"
    ? window.Capacitor.isNativePlatform()
    : false;
  return isNative ? window.Capacitor : null;
}

function getFilesystemPlugin() {
  return getCapacitorBridge()?.Plugins?.Filesystem || null;
}

function getNativePlatform() {
  return getCapacitorBridge()?.getPlatform?.() || "";
}

function getNativeStorageMode() {
  try {
    return localStorage.getItem(NATIVE_STORAGE_MODE_KEY) || NATIVE_STORAGE_PRIVATE;
  } catch {
    return NATIVE_STORAGE_PRIVATE;
  }
}

function setNativeStorageMode(mode) {
  try {
    localStorage.setItem(NATIVE_STORAGE_MODE_KEY, mode);
  } catch {}
}

function getNativeDirectory(mode = getNativeStorageMode()) {
  return mode === NATIVE_STORAGE_DOCUMENTS ? "DOCUMENTS" : "DATA";
}

function getNativeDirectoryLabel(mode = getNativeStorageMode()) {
  if (mode === NATIVE_STORAGE_DOCUMENTS) {
    return "设备文档目录 / Documents / ZYDiary";
  }
  return "应用私有目录 / Android App Storage / ZYDiary";
}

async function requestNativePublicStoragePermission() {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return false;

  try {
    const status = await filesystem.requestPermissions();
    return status?.publicStorage === "granted";
  } catch {
    return false;
  }
}

async function ensureNativeDirectory(mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return;

  try {
    await filesystem.mkdir({
      path: NATIVE_FOLDER,
      directory: getNativeDirectory(mode),
      recursive: true
    });
  } catch {}
}

async function readNativeJson(path) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return null;

  const primaryMode = getNativeStorageMode();
  const fallbackMode = primaryMode === NATIVE_STORAGE_PRIVATE ? NATIVE_STORAGE_DOCUMENTS : NATIVE_STORAGE_PRIVATE;

  for (const mode of [primaryMode, fallbackMode]) {
    try {
      const result = await filesystem.readFile({
        path,
        directory: getNativeDirectory(mode),
        encoding: "utf8"
      });
      const text = typeof result?.data === "string" ? result.data : "";
      if (text) {
        if (mode !== primaryMode) {
          setNativeStorageMode(mode);
        }
        return JSON.parse(text);
      }
    } catch {}
  }

  return null;
}

async function writeNativeJson(path, data, mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return;

  await ensureNativeDirectory(mode);
  await filesystem.writeFile({
    path,
    directory: getNativeDirectory(mode),
    data: JSON.stringify(data, null, 2),
    encoding: "utf8",
    recursive: true
  });
}

async function getNativeFileInfo(path, mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) {
    return { uri: "", size: 0 };
  }

  try {
    const stat = await filesystem.stat({
      path,
      directory: getNativeDirectory(mode)
    });
    return {
      uri: stat?.uri || "",
      size: stat?.size || 0
    };
  } catch {
    return { uri: "", size: 0 };
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(key) {
  return new Promise((resolve) => {
    if (!db) {
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
      return;
    }

    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => resolve(null);
  });
}

function dbSet(key, value) {
  return new Promise((resolve) => {
    if (!db) {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
      resolve();
      return;
    }

    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ key, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function writeLocalRecoverySnapshot(state) {
  try {
    const snapshot = {
      savedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      state: clone(state)
    };
    localStorage.setItem(RECOVERY_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function writeNativeRecoverySnapshot(state, mode = getNativeStorageMode()) {
  const snapshot = {
    savedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    state: clone(state)
  };
  await writeNativeJson(NATIVE_SNAPSHOT_FILE, snapshot, mode);
}

export async function initStorage() {
  if (getDesktopBridge() || getFilesystemPlugin()) return;
  db = await openDb();
}

export async function loadPersistedState() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.loadState();
  }

  if (getFilesystemPlugin()) {
    return readNativeJson(NATIVE_STATE_FILE);
  }

  return dbGet(STATE_KEY);
}

export async function savePersistedState(state) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.saveState(clone(state));
  }

  if (getFilesystemPlugin()) {
    const mode = getNativeStorageMode();
    writeLocalRecoverySnapshot(state);
    await writeNativeJson(NATIVE_STATE_FILE, clone(state), mode);
    await writeNativeRecoverySnapshot(state, mode);
    return true;
  }

  writeLocalRecoverySnapshot(state);
  return dbSet(STATE_KEY, state);
}

export async function resetPersistedState(defaultState) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.resetState(clone(defaultState));
  }

  if (getFilesystemPlugin()) {
    return savePersistedState(defaultState);
  }

  writeLocalRecoverySnapshot(defaultState);
  return dbSet(STATE_KEY, defaultState);
}

export function createExportPayload(state) {
  const payload = clone(state);
  const exportedFrom = getDesktopBridge()
    ? "electron-desktop"
    : getFilesystemPlugin()
      ? `${getNativePlatform()}-native`
      : "local-browser";

  payload.meta = {
    ...(payload.meta || {}),
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exportManifest: {
      app: "ZY Diary",
      schemaVersion: SCHEMA_VERSION,
      exportedFrom
    }
  };
  return payload;
}

export async function parseImportedFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份文件内容无效");
  }
  if (!parsed.meta || typeof parsed.meta !== "object") {
    throw new Error("备份文件缺少元数据");
  }
  return parsed;
}

export async function getRecoverySnapshotInfo() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.getRecoverySnapshotInfo();
  }

  if (getFilesystemPlugin()) {
    const snapshot = await readNativeJson(NATIVE_SNAPSHOT_FILE);
    const info = await getNativeFileInfo(NATIVE_SNAPSHOT_FILE);
    if (!snapshot) return null;
    return {
      savedAt: snapshot.savedAt || "",
      schemaVersion: snapshot.schemaVersion || 0,
      stateSize: info.size || 0
    };
  }

  try {
    const raw = localStorage.getItem(RECOVERY_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      savedAt: parsed.savedAt || "",
      schemaVersion: parsed.schemaVersion || 0,
      stateSize: raw.length
    };
  } catch {
    return null;
  }
}

export async function getStorageDirectoryInfo() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.getStorageInfo();
  }

  if (getFilesystemPlugin()) {
    const mode = getNativeStorageMode();
    const stateInfo = await getNativeFileInfo(NATIVE_STATE_FILE, mode);
    const snapshotInfo = await getNativeFileInfo(NATIVE_SNAPSHOT_FILE, mode);
    return {
      mode: mode === NATIVE_STORAGE_DOCUMENTS ? "native-documents" : "native-private",
      directory: getNativeDirectoryLabel(mode),
      stateFile: stateInfo.uri || NATIVE_STATE_FILE,
      snapshotFile: snapshotInfo.uri || NATIVE_SNAPSHOT_FILE
    };
  }

  return {
    mode: "browser",
    directory: "浏览器本地存储（IndexedDB / localStorage）",
    stateFile: "",
    snapshotFile: ""
  };
}

export async function chooseStorageDirectory(state) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.chooseStorageDirectory(clone(state));
  }

  if (!getFilesystemPlugin()) return null;

  const currentMode = getNativeStorageMode();
  const wantsDocuments = window.confirm("确定切换到设备文档目录吗？\n\n选择“确定”会把数据迁移到手机文档目录中，便于备份与调试；选择“取消”则使用应用私有目录。");
  const nextMode = wantsDocuments ? NATIVE_STORAGE_DOCUMENTS : NATIVE_STORAGE_PRIVATE;

  if (nextMode === NATIVE_STORAGE_DOCUMENTS) {
    const granted = await requestNativePublicStoragePermission();
    if (!granted) {
      throw new Error("未获得设备文档访问权限");
    }
  }

  setNativeStorageMode(nextMode);
  await savePersistedState(state);

  return {
    ...(await getStorageDirectoryInfo()),
    changedFrom: currentMode,
    changedTo: nextMode
  };
}

export async function openStorageDirectory() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.openStorageDirectory();
  }

  return false;
}

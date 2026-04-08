const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zyDesktop", {
  loadState: () => ipcRenderer.invoke("storage:load-state"),
  saveState: (state) => ipcRenderer.invoke("storage:save-state", state),
  resetState: (state) => ipcRenderer.invoke("storage:reset-state", state),
  getRecoverySnapshotInfo: () => ipcRenderer.invoke("storage:get-recovery-snapshot-info"),
  getStorageInfo: () => ipcRenderer.invoke("storage:get-info"),
  chooseStorageDirectory: (state) => ipcRenderer.invoke("storage:choose-directory", state),
  openStorageDirectory: () => ipcRenderer.invoke("storage:open-directory"),
  syncNotifications: (notifications) => ipcRenderer.invoke("notifications:sync", notifications),
  notificationsSupported: () => ipcRenderer.invoke("notifications:supported")
});

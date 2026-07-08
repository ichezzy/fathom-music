const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tavernloops", {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateDownloaded: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("update:downloaded", handler);
    return () => ipcRenderer.removeListener("update:downloaded", handler);
  },
  setMiniPlayer: (on) => ipcRenderer.invoke("window:setMini", !!on),
  setTrayEnabled: (on) => ipcRenderer.invoke("tray:setEnabled", !!on),
  windowControls: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximizeToggle"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (callback) => {
      const handler = (_event, isMax) => callback(!!isMax);
      ipcRenderer.on("window:maximized", handler);
      return () => ipcRenderer.removeListener("window:maximized", handler);
    },
  },
  storage: {
    loadState: () => ipcRenderer.invoke("storage:loadState"),
    saveState: (state) => ipcRenderer.invoke("storage:saveState", state),
    putFile: (id, name, type, bytes) =>
      ipcRenderer.invoke("storage:putFile", id, name, type, bytes),
    getFile: (id) => ipcRenderer.invoke("storage:getFile", id),
    deleteFile: (id) => ipcRenderer.invoke("storage:deleteFile", id),
    listFiles: () => ipcRenderer.invoke("storage:listFiles"),
    clearFiles: () => ipcRenderer.invoke("storage:clearFiles"),
  },
});

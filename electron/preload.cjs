const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tavernloops", {
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

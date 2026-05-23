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
});

const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { startStaticServer } = require("./staticServer.cjs");

const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://127.0.0.1:5173";

let mainWindow = null;
let staticServer = null;

async function loadRenderer() {
  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    return;
  }
  // Serve the build over http so the renderer has a real origin (YouTube
  // embeds need it). Fall back to file:// if the server can't start.
  const distDir = path.join(__dirname, "..", "dist");
  try {
    staticServer = await startStaticServer(distDir);
    await mainWindow.loadURL(staticServer.url);
  } catch (err) {
    console.error("[static-server] falling back to file://:", err?.message);
    await mainWindow.loadFile(path.join(distDir, "index.html"));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#14110e",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open target=_blank / external links in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  void loadRenderer();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdates() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update:downloaded", {
      version: info?.version ?? null,
    });
  });
  autoUpdater.on("error", (err) => {
    console.error("[updater]", err == null ? "unknown" : err.message);
  });

  // Scan for updates on launch, then re-check every 6 hours.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(
    () => autoUpdater.checkForUpdatesAndNotify().catch(() => {}),
    6 * 60 * 60 * 1000,
  );
}

ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("update:check", async () => {
  if (isDev) return { status: "dev" };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: "ok", version: result?.updateInfo?.version ?? null };
  } catch (err) {
    return { status: "error", message: err?.message ?? "unknown" };
  }
});
ipcMain.handle("update:install", () => {
  if (!isDev) autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void staticServer?.close();
});

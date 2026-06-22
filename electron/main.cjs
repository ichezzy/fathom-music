const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { startStaticServer } = require("./staticServer.cjs");
const { registerStorageIpc } = require("./storage.cjs");

registerStorageIpc(ipcMain);

// Let the YouTube IFrame player start playback after a user click without
// being blocked by Chromium's "needs gesture" autoplay policy. Local
// <audio> elements get a pass, but cross-origin iframes (the YT embed)
// don't — so without this YT playback silently fails in the installed app.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://127.0.0.1:5173";

// Serve the packaged app from a FIXED loopback port. IndexedDB (where all
// playlists, settings and uploaded files live) is keyed by origin, and the
// origin includes the port — so a changing port silently wipes user data on
// every launch. A constant port keeps the origin stable across updates.
const APP_PORT = 47615;

let mainWindow = null;
let staticServer = null;

async function loadRenderer() {
  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    return;
  }
  // Serve the build over http on a fixed port so the renderer has a real,
  // stable origin: YouTube embeds need a real origin, and IndexedDB needs a
  // stable one. Fall back to file:// only if the port can't be bound.
  const distDir = path.join(__dirname, "..", "dist");
  try {
    staticServer = await startStaticServer(distDir, { port: APP_PORT });
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

  // Let the renderer enumerate audio output devices with labels (needed for
  // the output-device picker in Settings). Granting "media" up front keeps
  // the one-time getUserMedia() unlock silent.
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(permission === "media");
    },
  );

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

// A single instance keeps one owner of the fixed port and the user's data.
// A second launch just focuses the existing window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createWindow();
    setupAutoUpdates();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void staticServer?.close();
});

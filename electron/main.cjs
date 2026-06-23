const { app, BrowserWindow, Menu, Tray, shell, ipcMain } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { startStaticServer } = require("./staticServer.cjs");
const { registerStorageIpc } = require("./storage.cjs");
const windowState = require("./windowState.cjs");

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

// Mini-player window size (compact transport bar).
const MINI = { width: 520, height: 130 };

let mainWindow = null;
let staticServer = null;
let trayIcon = null;
let stateMgr = null;
let trayEnabled = false;
let miniActive = false;
let quitting = false;

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
  const saved = windowState.load();
  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: windowState.MIN.width,
    minHeight: windowState.MIN.height,
    backgroundColor: "#14110e",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  stateMgr = windowState.attach(mainWindow);

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

  // Hide-on-close when tray is enabled; real quit only via the tray menu
  // or app.quit().
  mainWindow.on("close", (e) => {
    if (trayEnabled && !quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    stateMgr = null;
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

// ---- Mini player ----

function enterMini() {
  if (!mainWindow || miniActive) return;
  miniActive = true;
  stateMgr?.suspend();
  mainWindow.setMinimumSize(360, 110);
  mainWindow.setSize(MINI.width, MINI.height);
  mainWindow.setAlwaysOnTop(true);
}

function exitMini() {
  if (!mainWindow || !miniActive) return;
  miniActive = false;
  mainWindow.setAlwaysOnTop(false);
  const last = stateMgr?.lastBounds();
  if (last) {
    mainWindow.setSize(last.width, last.height);
    if (typeof last.x === "number" && typeof last.y === "number") {
      mainWindow.setPosition(last.x, last.y);
    }
  }
  mainWindow.setMinimumSize(windowState.MIN.width, windowState.MIN.height);
  stateMgr?.resume();
}

ipcMain.handle("window:setMini", (_e, on) => {
  on ? enterMini() : exitMini();
});

// ---- Tray ----

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Show TavernLoops",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
}

function enableTray() {
  if (trayIcon) return;
  try {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");
    trayIcon = new Tray(iconPath);
    trayIcon.setToolTip("TavernLoops");
    trayIcon.setContextMenu(buildTrayMenu());
    trayIcon.on("click", () => {
      if (mainWindow?.isVisible()) mainWindow.hide();
      else mainWindow?.show();
    });
    trayEnabled = true;
  } catch (err) {
    console.error("[tray] failed to create icon:", err?.message);
  }
}

function disableTray() {
  trayEnabled = false;
  if (trayIcon) {
    trayIcon.destroy();
    trayIcon = null;
  }
}

ipcMain.handle("tray:setEnabled", (_e, enabled) => {
  if (enabled) enableTray();
  else disableTray();
});

// ---- App version / updates ----

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
    mainWindow.show();
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
  // If tray is enabled the window only hides, so this rarely fires; on
  // macOS we follow the convention of staying open.
  if (process.platform !== "darwin" && !trayEnabled) app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  void staticServer?.close();
  disableTray();
});

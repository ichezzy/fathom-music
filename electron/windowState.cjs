const fs = require("node:fs");
const path = require("node:path");
const { app, screen } = require("electron");

// Persist BrowserWindow bounds so the next launch reopens at the same
// position and size. Written under userData (independent of the renderer
// origin / Vite dev port, like the rest of our state).

const DEFAULTS = { width: 1320, height: 860, x: undefined, y: undefined };
const MIN = { width: 940, height: 620 };

function statePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    return sanitize(raw);
  } catch {
    return { ...DEFAULTS };
  }
}

/** Drop saved bounds that no longer fit any connected display. */
function sanitize(state) {
  const out = { ...DEFAULTS, ...state };
  if (typeof out.x === "number" && typeof out.y === "number") {
    const onScreen = screen.getAllDisplays().some((d) => {
      const r = d.bounds;
      return (
        out.x >= r.x - 16 &&
        out.y >= r.y - 16 &&
        out.x + out.width <= r.x + r.width + 16 &&
        out.y + out.height <= r.y + r.height + 16
      );
    });
    if (!onScreen) {
      out.x = undefined;
      out.y = undefined;
    }
  }
  out.width = Math.max(MIN.width, out.width || DEFAULTS.width);
  out.height = Math.max(MIN.height, out.height || DEFAULTS.height);
  return out;
}

function save(bounds) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify(bounds));
  } catch {
    // ignore — losing bounds for one session is non-fatal
  }
}

/** Snapshot the window's *restored* bounds plus its maximized flag. */
function snapshot(win) {
  const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
  return { ...b, maximized: win.isMaximized() };
}

/** Wire a BrowserWindow so its bounds are persisted on resize/move/close. */
function attach(win) {
  // Track only the "normal" bounds; ignore changes while the user is in
  // the mini player (the renderer flips this flag via IPC).
  let suspended = false;
  let timer = null;
  let last = snapshot(win);

  const schedule = () => {
    if (suspended || win.isDestroyed() || win.isMinimized()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      last = snapshot(win);
      save(last);
    }, 400);
  };

  win.on("resize", schedule);
  win.on("move", schedule);
  win.on("maximize", schedule);
  win.on("unmaximize", schedule);
  win.on("close", () => {
    if (!suspended && !win.isMinimized()) save(snapshot(win));
    else save(last);
  });

  return {
    suspend() {
      // Remember the last full bounds before something temporary (mini
      // player) shrinks the window.
      last = snapshot(win);
      suspended = true;
    },
    resume() {
      suspended = false;
    },
    lastBounds() {
      return last;
    },
  };
}

module.exports = { load, save, attach, MIN };

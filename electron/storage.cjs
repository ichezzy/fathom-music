const { app } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

// Filesystem-backed persistence under userData/store. Unlike renderer
// IndexedDB this is independent of the page origin, so it survives updates,
// port changes and the file://→http:// move that previously wiped data.
//
// Layout:
//   userData/store/state.json        the persisted app state
//   userData/store/files/<id>        raw file bytes (uploaded audio)
//   userData/store/files-meta.json   { [id]: { name, type } }

let dirs = null;
let manifest = null;

function resolveDirs() {
  if (dirs) return dirs;
  const root = path.join(app.getPath("userData"), "store");
  dirs = {
    root,
    files: path.join(root, "files"),
    state: path.join(root, "state.json"),
    meta: path.join(root, "files-meta.json"),
  };
  fs.mkdirSync(dirs.files, { recursive: true });
  return dirs;
}

async function loadManifest() {
  if (manifest) return manifest;
  const { meta } = resolveDirs();
  try {
    manifest = JSON.parse(await fsp.readFile(meta, "utf8"));
  } catch {
    manifest = {};
  }
  return manifest;
}

async function saveManifest() {
  const { meta } = resolveDirs();
  await atomicWrite(meta, JSON.stringify(manifest ?? {}));
}

/** Write via a temp file + rename so a crash can't leave a half-written file. */
async function atomicWrite(target, data) {
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, target);
}

async function loadState() {
  const { state } = resolveDirs();
  try {
    return JSON.parse(await fsp.readFile(state, "utf8"));
  } catch {
    return null;
  }
}

async function saveState(state) {
  const { state: statePath } = resolveDirs();
  await atomicWrite(statePath, JSON.stringify(state));
}

async function putFile(id, name, type, bytes) {
  const { files } = resolveDirs();
  await loadManifest();
  await atomicWrite(path.join(files, id), Buffer.from(bytes));
  manifest[id] = { name: name ?? id, type: type ?? "" };
  await saveManifest();
}

async function getFile(id) {
  const { files } = resolveDirs();
  await loadManifest();
  const m = manifest[id];
  if (!m) return null;
  try {
    const bytes = await fsp.readFile(path.join(files, id));
    return { bytes, name: m.name, type: m.type };
  } catch {
    return null;
  }
}

async function deleteFile(id) {
  const { files } = resolveDirs();
  await loadManifest();
  delete manifest[id];
  await saveManifest();
  await fsp.rm(path.join(files, id), { force: true });
}

/** Metadata for every stored file (no bytes) — used for prune/export. */
async function listFiles() {
  await loadManifest();
  return Object.entries(manifest).map(([id, m]) => ({
    id,
    name: m.name,
    type: m.type,
  }));
}

async function clearFiles() {
  const { files } = resolveDirs();
  await loadManifest();
  await Promise.all(
    Object.keys(manifest).map((id) =>
      fsp.rm(path.join(files, id), { force: true }),
    ),
  );
  manifest = {};
  await saveManifest();
}

/** Wire all storage IPC channels. Call once from the main process. */
function registerStorageIpc(ipcMain) {
  ipcMain.handle("storage:loadState", () => loadState());
  ipcMain.handle("storage:saveState", (_e, state) => saveState(state));
  ipcMain.handle("storage:putFile", (_e, id, name, type, bytes) =>
    putFile(id, name, type, bytes),
  );
  ipcMain.handle("storage:getFile", (_e, id) => getFile(id));
  ipcMain.handle("storage:deleteFile", (_e, id) => deleteFile(id));
  ipcMain.handle("storage:listFiles", () => listFiles());
  ipcMain.handle("storage:clearFiles", () => clearFiles());
}

module.exports = { registerStorageIpc };

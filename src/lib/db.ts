import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PersistedState } from "../types";
import { desktop } from "./desktop";

interface FileRecord {
  id: string;
  blob: Blob;
  name: string;
  type: string;
}

/**
 * Storage backend. Two implementations: IndexedDB (web / dev) and the desktop
 * filesystem (Electron, via IPC). The desktop backend is origin-independent,
 * so data survives updates and origin changes — the bug that previously wiped
 * libraries. The exported helpers below delegate to whichever is active.
 */
interface Backend {
  loadState(): Promise<PersistedState | undefined>;
  saveState(state: PersistedState): Promise<void>;
  putRaw(id: string, blob: Blob, name: string, type: string): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
  listIds(): Promise<string[]>;
  listRecords(): Promise<FileRecord[]>;
  clear(): Promise<void>;
}

/* ------------------------------ IndexedDB ------------------------------ */

interface TavernDB extends DBSchema {
  files: {
    key: string;
    value: { id: string; blob: Blob; name: string; type: string };
  };
  state: {
    key: string;
    value: PersistedState;
  };
}

const DB_NAME = "tavernloops";
const DB_VERSION = 1;
const STATE_KEY = "app";

let dbPromise: Promise<IDBPDatabase<TavernDB>> | null = null;

function db(): Promise<IDBPDatabase<TavernDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TavernDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("files")) {
          database.createObjectStore("files", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("state")) {
          database.createObjectStore("state");
        }
      },
    });
  }
  return dbPromise;
}

const idbBackend: Backend = {
  async loadState() {
    return (await db()).get("state", STATE_KEY);
  },
  async saveState(state) {
    await (await db()).put("state", state, STATE_KEY);
  },
  async putRaw(id, blob, name, type) {
    await (await db()).put("files", { id, blob, name, type });
  },
  async getBlob(id) {
    const record = await (await db()).get("files", id);
    return record?.blob ?? null;
  },
  async remove(id) {
    await (await db()).delete("files", id);
  },
  async listIds() {
    return (await db()).getAllKeys("files") as Promise<string[]>;
  },
  async listRecords() {
    return (await db()).getAll("files");
  },
  async clear() {
    const database = await db();
    const keys = await database.getAllKeys("files");
    const tx = database.transaction("files", "readwrite");
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  },
};

/* ------------------------------- Desktop ------------------------------- */

function desktopBackend(storage: NonNullable<typeof desktop>["storage"]): Backend {
  const s = storage!;
  return {
    async loadState() {
      return (await s.loadState()) as PersistedState | undefined;
    },
    async saveState(state) {
      await s.saveState(state);
    },
    async putRaw(id, blob, name, type) {
      await s.putFile(id, name, type, await blob.arrayBuffer());
    },
    async getBlob(id) {
      const record = await s.getFile(id);
      if (!record) return null;
      return new Blob([record.bytes as BlobPart], {
        type: record.type || "application/octet-stream",
      });
    },
    async remove(id) {
      await s.deleteFile(id);
    },
    async listIds() {
      return (await s.listFiles()).map((f) => f.id);
    },
    async listRecords() {
      const metas = await s.listFiles();
      const records: FileRecord[] = [];
      for (const meta of metas) {
        const blob = await this.getBlob(meta.id);
        if (blob) {
          records.push({ id: meta.id, blob, name: meta.name, type: meta.type });
        }
      }
      return records;
    },
    async clear() {
      await s.clearFiles();
    },
  };
}

/* ------------------------------- Active -------------------------------- */

const backend: Backend = desktop?.storage
  ? desktopBackend(desktop.storage)
  : idbBackend;

/**
 * One-time copy of an existing IndexedDB library into the desktop filesystem
 * store. Runs on desktop only, and only when the filesystem store is still
 * empty — so upgrading users keep the library they built in earlier versions.
 */
export async function ensureMigrated(): Promise<void> {
  if (!desktop?.storage) return;
  const alreadyThere = await backend.loadState();
  if (alreadyThere) return; // filesystem store already populated
  const legacyState = await idbBackend.loadState();
  if (!legacyState) return; // nothing to migrate (fresh install)

  const records = await idbBackend.listRecords();
  for (const r of records) {
    await backend.putRaw(r.id, r.blob, r.name, r.type);
  }
  await backend.saveState(legacyState);
}

/* ------------------------------ Public API ----------------------------- */

const urlCache = new Map<string, string>();

/** Store an uploaded file blob and return its key. */
export async function putFile(id: string, file: File): Promise<void> {
  await backend.putRaw(id, file, file.name, file.type);
}

/** Restore a file blob from a backup without going through a File object. */
export async function putRawFile(
  id: string,
  blob: Blob,
  name: string,
  type: string,
): Promise<void> {
  await backend.putRaw(id, blob, name, type);
  revokeFileUrl(id);
}

export async function deleteFile(id: string): Promise<void> {
  await backend.remove(id);
  revokeFileUrl(id);
}

/** All stored file records — used to build a full backup. */
export async function getAllFileRecords(): Promise<FileRecord[]> {
  return backend.listRecords();
}

/** Wipe every file blob (used before restoring a backup). */
export async function clearAllFiles(): Promise<void> {
  const ids = await backend.listIds();
  await backend.clear();
  for (const id of ids) revokeFileUrl(id);
}

/** Lazily create (and cache) an object URL for a stored file. */
export async function getFileUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await backend.getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function getFileBlob(id: string): Promise<Blob | null> {
  return backend.getBlob(id);
}

export function revokeFileUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export async function loadState(): Promise<PersistedState | undefined> {
  return backend.loadState();
}

export async function saveState(state: PersistedState): Promise<void> {
  await backend.saveState(state);
}

/** Remove file blobs that are no longer referenced by any track/sound. */
export async function pruneOrphanFiles(referenced: Set<string>): Promise<void> {
  const ids = await backend.listIds();
  await Promise.all(
    ids
      .filter((id) => !referenced.has(id))
      .map((id) => {
        revokeFileUrl(id);
        return backend.remove(id);
      }),
  );
}

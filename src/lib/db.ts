import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PersistedState } from "../types";

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

/** Store an uploaded file blob and return its key. */
export async function putFile(id: string, file: File): Promise<void> {
  const database = await db();
  await database.put("files", {
    id,
    blob: file,
    name: file.name,
    type: file.type,
  });
}

export async function deleteFile(id: string): Promise<void> {
  const database = await db();
  await database.delete("files", id);
  revokeFileUrl(id);
}

/** All stored file records — used to build a full backup. */
export async function getAllFileRecords(): Promise<
  { id: string; blob: Blob; name: string; type: string }[]
> {
  const database = await db();
  return database.getAll("files");
}

/** Restore a file blob from a backup without going through a File object. */
export async function putRawFile(
  id: string,
  blob: Blob,
  name: string,
  type: string,
): Promise<void> {
  const database = await db();
  await database.put("files", { id, blob, name, type });
  revokeFileUrl(id);
}

/** Wipe every file blob (used before restoring a backup). */
export async function clearAllFiles(): Promise<void> {
  const database = await db();
  const keys = await database.getAllKeys("files");
  const tx = database.transaction("files", "readwrite");
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
  for (const key of keys) revokeFileUrl(key);
}

const urlCache = new Map<string, string>();

/** Lazily create (and cache) an object URL for a stored file. */
export async function getFileUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const database = await db();
  const record = await database.get("files", id);
  if (!record) return null;
  const url = URL.createObjectURL(record.blob);
  urlCache.set(id, url);
  return url;
}

export async function getFileBlob(id: string): Promise<Blob | null> {
  const database = await db();
  const record = await database.get("files", id);
  return record?.blob ?? null;
}

export function revokeFileUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export async function loadState(): Promise<PersistedState | undefined> {
  const database = await db();
  return database.get("state", STATE_KEY);
}

export async function saveState(state: PersistedState): Promise<void> {
  const database = await db();
  await database.put("state", state, STATE_KEY);
}

/** Remove file blobs that are no longer referenced by any track/sound. */
export async function pruneOrphanFiles(referenced: Set<string>): Promise<void> {
  const database = await db();
  const keys = await database.getAllKeys("files");
  const tx = database.transaction("files", "readwrite");
  await Promise.all(
    keys
      .filter((key) => !referenced.has(key))
      .map((key) => {
        revokeFileUrl(key);
        return tx.store.delete(key);
      }),
  );
  await tx.done;
}

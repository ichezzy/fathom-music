export interface StorageFileMeta {
  id: string;
  name: string;
  type: string;
}

export interface StorageBridge {
  loadState(): Promise<unknown>;
  saveState(state: unknown): Promise<void>;
  putFile(
    id: string,
    name: string,
    type: string,
    bytes: ArrayBuffer,
  ): Promise<void>;
  getFile(
    id: string,
  ): Promise<{ bytes: ArrayBuffer; name: string; type: string } | null>;
  deleteFile(id: string): Promise<void>;
  listFiles(): Promise<StorageFileMeta[]>;
  clearFiles(): Promise<void>;
}

export interface DesktopBridge {
  platform?: string;
  getVersion(): Promise<string>;
  checkForUpdates(): Promise<{
    status: "ok" | "dev" | "error";
    version?: string | null;
    message?: string;
  }>;
  installUpdate(): Promise<void>;
  onUpdateDownloaded(
    callback: (payload: { version: string | null }) => void,
  ): () => void;
  setMiniPlayer(on: boolean): Promise<void>;
  setTrayEnabled(on: boolean): Promise<void>;
  windowControls?: {
    minimize(): Promise<void>;
    maximizeToggle(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(callback: (isMax: boolean) => void): () => void;
  };
  storage?: StorageBridge;
}

declare global {
  interface Window {
    tavernloops?: DesktopBridge;
  }
}

/** Present only inside the Electron build; null in a plain browser. */
export const desktop: DesktopBridge | null =
  typeof window !== "undefined" && window.tavernloops ? window.tavernloops : null;

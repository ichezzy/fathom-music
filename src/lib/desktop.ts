export interface DesktopBridge {
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
}

declare global {
  interface Window {
    tavernloops?: DesktopBridge;
  }
}

/** Present only inside the Electron build; null in a plain browser. */
export const desktop: DesktopBridge | null =
  typeof window !== "undefined" && window.tavernloops ? window.tavernloops : null;

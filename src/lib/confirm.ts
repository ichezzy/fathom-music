import { useStore } from "../store/store";
import { translate } from "./i18n";

/**
 * In-app confirmation, replacing window.confirm(). Native confirm()/alert()
 * dialogs break keyboard focus in packaged Electron apps (inputs stop
 * accepting keystrokes until the window is re-focused), which is exactly the
 * "can't type in this field anymore" bug. The ConfirmDialog component in App
 * renders the pending request; these helpers resolve it.
 */

let resolver: ((ok: boolean) => void) | null = null;

export interface ConfirmRequest {
  message: string;
  detail: string | null;
}

/** Show the in-app confirm dialog. Resolves true when the user confirms. */
export function askConfirm(
  message: string,
  detail?: string | null,
): Promise<boolean> {
  // Settle any dangling request defensively (e.g. double-trigger).
  resolver?.(false);
  return new Promise((resolve) => {
    resolver = resolve;
    useStore.setState({ confirmRequest: { message, detail: detail ?? null } });
  });
}

/** Called by the dialog's buttons / escape handler. */
export function settleConfirm(ok: boolean): void {
  useStore.setState({ confirmRequest: null });
  resolver?.(ok);
  resolver = null;
}

/**
 * Ask before a destructive action, honoring the "confirm before deleting"
 * setting (fast-path true when it's off).
 */
export function confirmDelete(name?: string): Promise<boolean> {
  const s = useStore.getState().settings;
  if (!s.confirmBeforeDelete) return Promise.resolve(true);
  return askConfirm(translate(s.language, "common.delete.confirm"), name);
}

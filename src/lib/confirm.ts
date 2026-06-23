import { useStore } from "../store/store";
import { translate } from "./i18n";

/**
 * Ask the user before performing a destructive action, but only if the
 * "Confirm before deleting" setting is on. Returns true when the action
 * should proceed.
 *
 * `name` is woven into the prompt where supported; falls back to the generic
 * confirm string otherwise.
 */
export function confirmDelete(name?: string): boolean {
  const s = useStore.getState().settings;
  if (!s.confirmBeforeDelete) return true;
  const generic = translate(s.language, "common.delete.confirm");
  const message = name ? `${generic}\n\n${name}` : generic;
  return window.confirm(message);
}

/**
 * Hotkey registry. Each action has a stable id, a default binding (KeyboardEvent.code)
 * and an i18n key for its label. The user can override any binding from the
 * Settings → Shortcuts tab.
 */

export const HOTKEY_ACTIONS = [
  "togglePlay",
  "next",
  "previous",
  "stopLoops",
  "pad1",
  "pad2",
  "pad3",
  "pad4",
  "pad5",
  "pad6",
  "pad7",
  "pad8",
  "pad9",
] as const;

export type HotkeyAction = (typeof HOTKEY_ACTIONS)[number];

export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  togglePlay: "Space",
  next: "ArrowRight",
  previous: "ArrowLeft",
  stopLoops: "Escape",
  pad1: "Digit1",
  pad2: "Digit2",
  pad3: "Digit3",
  pad4: "Digit4",
  pad5: "Digit5",
  pad6: "Digit6",
  pad7: "Digit7",
  pad8: "Digit8",
  pad9: "Digit9",
};

/** i18n keys for action labels (kept here so a single map updates UI + settings). */
export const HOTKEY_LABEL_KEYS: Record<HotkeyAction, string> = {
  togglePlay: "hotkey.togglePlay",
  next: "hotkey.next",
  previous: "hotkey.previous",
  stopLoops: "hotkey.stopLoops",
  pad1: "hotkey.pad",
  pad2: "hotkey.pad",
  pad3: "hotkey.pad",
  pad4: "hotkey.pad",
  pad5: "hotkey.pad",
  pad6: "hotkey.pad",
  pad7: "hotkey.pad",
  pad8: "hotkey.pad",
  pad9: "hotkey.pad",
};

/** Effective binding for an action (user override → default). */
export function bindingFor(
  action: HotkeyAction,
  overrides: Partial<Record<HotkeyAction, string>> | undefined,
): string {
  return overrides?.[action] ?? DEFAULT_HOTKEYS[action];
}

/** Reverse lookup: what action (if any) is bound to this KeyboardEvent.code? */
export function actionFor(
  code: string,
  overrides: Partial<Record<HotkeyAction, string>> | undefined,
): HotkeyAction | null {
  for (const action of HOTKEY_ACTIONS) {
    if (bindingFor(action, overrides) === code) return action;
  }
  return null;
}

/** Human-readable form of a KeyboardEvent.code. Falls back to the raw code. */
export function formatKey(code: string): string {
  if (!code) return "—";
  if (code === "Space") return "Space";
  if (code === "Escape") return "Esc";
  if (code === "Enter") return "Enter";
  if (code === "Tab") return "Tab";
  if (code === "Backspace") return "⌫";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return code;
}

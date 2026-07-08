import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { LANGUAGES, useT } from "../lib/i18n";
import { askConfirm } from "../lib/confirm";
import {
  HOTKEY_ACTIONS,
  HOTKEY_LABEL_KEYS,
  actionFor,
  bindingFor,
  formatKey,
  type HotkeyAction,
} from "../lib/hotkeys";
import { Modal } from "./common";

type Tab = "general" | "audio" | "hotkeys" | "backup" | "about";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("settings.tab.general") },
    { id: "audio", label: t("settings.tab.audio") },
    { id: "hotkeys", label: t("settings.tab.hotkeys") },
    { id: "backup", label: t("settings.tab.backup") },
    { id: "about", label: t("settings.tab.about") },
  ];

  return (
    <Modal title={t("settings.title")} onClose={onClose}>
      <div className="settings-tabs" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={`settings-tabs__btn${tab === tb.id ? " is-on" : ""}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="settings-tabs__panel">
        {tab === "general" && <GeneralTab />}
        {tab === "audio" && <AudioTab />}
        {tab === "hotkeys" && <HotkeysTab />}
        {tab === "backup" && <BackupTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </Modal>
  );
}

function GeneralTab() {
  const t = useT();
  const language = useStore((s) => s.settings.language);
  const autoOpen = useStore((s) => s.settings.autoOpenLastCampaign);
  const confirmDel = useStore((s) => s.settings.confirmBeforeDelete);
  const minToTray = useStore((s) => s.settings.minimizeToTray);
  const setLanguage = useStore((s) => s.setLanguage);
  const setSetting = useStore((s) => s.setSetting);

  return (
    <>
      <div className="field">
        <span>{t("settings.language")}</span>
        <div className="seg seg--wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`seg__btn${language === l.code ? " is-on" : ""}`}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>{t("settings.startup")}</span>
        <button
          className={`toggle${autoOpen ? " is-on" : ""}`}
          onClick={() => setSetting("autoOpenLastCampaign", !autoOpen)}
        >
          <span className="toggle__dot" />
          {t("settings.autoOpen")}
        </button>
        <p className="field__hint">{t("settings.autoOpenHint")}</p>
      </div>

      <div className="field">
        <span>{t("common.delete.confirm")}</span>
        <button
          className={`toggle${confirmDel ? " is-on" : ""}`}
          onClick={() => setSetting("confirmBeforeDelete", !confirmDel)}
        >
          <span className="toggle__dot" />
          {t("settings.confirmDelete")}
        </button>
        <p className="field__hint">{t("settings.confirmDeleteHint")}</p>
      </div>

      {desktop && (
        <div className="field">
          <span>{t("settings.window")}</span>
          <button
            className={`toggle${minToTray ? " is-on" : ""}`}
            onClick={() => setSetting("minimizeToTray", !minToTray)}
          >
            <span className="toggle__dot" />
            {t("settings.minimizeToTray")}
          </button>
          <p className="field__hint">{t("settings.minimizeToTrayHint")}</p>
        </div>
      )}
    </>
  );
}

function AudioTab() {
  const t = useT();
  const audioOut = useStore((s) => s.settings.audioOutputDeviceId);
  const setAudioOutputDevice = useStore((s) => s.setAudioOutputDevice);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);

  // Enumerate output devices. Labels stay blank until we hold a media
  // permission for the session; a one-shot getUserMedia call unlocks them
  // and we drop the stream immediately so the mic isn't actually used.
  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let list = await navigator.mediaDevices.enumerateDevices();
    const needsUnlock = list.some(
      (d) => d.kind === "audiooutput" && !d.label,
    );
    if (needsUnlock) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((tr) => tr.stop());
        list = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // permission denied: labels stay blank, ids still work
      }
    }
    setOutputs(list.filter((d) => d.kind === "audiooutput"));
  };

  useEffect(() => {
    void refreshDevices();
  }, []);

  return (
    <div className="field">
      <span>{t("settings.output")}</span>
      <div className="settings__output">
        <select
          value={audioOut}
          onChange={(e) => void setAudioOutputDevice(e.target.value)}
        >
          <option value="">{t("settings.output.default")}</option>
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 12)}
            </option>
          ))}
        </select>
        <button
          className="btn btn--ghost btn--small"
          onClick={() => void refreshDevices()}
          title={t("settings.output.refresh")}
        >
          ↻
        </button>
      </div>
      <p className="field__hint">{t("settings.output.hint")}</p>
    </div>
  );
}

function HotkeysTab() {
  const t = useT();
  const overrides = useStore((s) => s.settings.hotkeys);
  const setHotkey = useStore((s) => s.setHotkey);
  const resetHotkeys = useStore((s) => s.resetHotkeys);
  const [capturing, setCapturing] = useState<HotkeyAction | null>(null);

  // While capturing, swallow the next keystroke and assign it to the action.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setCapturing(null);
        return;
      }
      // Ignore modifier-only presses; require a real key.
      if (
        e.code === "ControlLeft" ||
        e.code === "ControlRight" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight" ||
        e.code === "AltLeft" ||
        e.code === "AltRight" ||
        e.code === "MetaLeft" ||
        e.code === "MetaRight"
      ) {
        return;
      }
      setHotkey(capturing, e.code);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, setHotkey]);

  const label = (action: HotkeyAction) => {
    const key = HOTKEY_LABEL_KEYS[action];
    if (key === "hotkey.pad") {
      return `${t("hotkey.pad")} ${action.replace("pad", "")}`;
    }
    return t(key);
  };

  return (
    <div className="field">
      <span>{t("settings.shortcuts")}</span>
      <ul className="hotkey-list">
        {HOTKEY_ACTIONS.map((action) => {
          const code = bindingFor(action, overrides);
          // Conflict: same code bound to a different action (effective binding).
          const owner = actionFor(code, overrides);
          const conflict = owner && owner !== action ? owner : null;
          return (
            <li key={action} className="hotkey-list__row">
              <span className="hotkey-list__label">{label(action)}</span>
              <button
                className={`hotkey-list__bind${
                  capturing === action ? " is-capturing" : ""
                }${conflict ? " has-conflict" : ""}`}
                onClick={() =>
                  setCapturing((cur) => (cur === action ? null : action))
                }
                title={t("hotkey.rebind")}
              >
                {capturing === action ? t("hotkey.press") : formatKey(code)}
              </button>
              {conflict && capturing !== action && (
                <span className="hotkey-list__conflict">
                  {t("hotkey.conflict")} {label(conflict)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <button className="btn btn--ghost btn--small" onClick={resetHotkeys}>
        {t("hotkey.reset")}
      </button>
    </div>
  );
}

function BackupTab() {
  const t = useT();
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setError(null);
    setBusy("export");
    try {
      await exportBackup();
    } finally {
      setBusy(null);
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (!(await askConfirm(t("settings.backup.importConfirm")))) return;
    setError(null);
    setBusy("import");
    try {
      await importBackup(file);
      // On success the app reloads.
    } catch {
      setError(t("settings.backup.importError"));
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="field">
      <span>{t("settings.backup")}</span>
      <p className="field__hint">{t("settings.backup.desc")}</p>
      <div className="settings__backup">
        <button
          className="btn btn--ghost"
          disabled={busy !== null}
          onClick={() => void onExport()}
        >
          {busy === "export"
            ? t("settings.backup.exporting")
            : t("settings.backup.export")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        <button
          className="btn btn--ghost"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "import"
            ? t("settings.backup.importing")
            : t("settings.backup.import")}
        </button>
      </div>
      {error && <p className="add-track__error">{error}</p>}
    </div>
  );
}

function AboutTab() {
  const t = useT();
  const [version, setVersion] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void desktop.getVersion().then((v) => active && setVersion(v));
    return () => {
      active = false;
    };
  }, []);

  const onCheckUpdates = async () => {
    if (!desktop) return;
    setChecking(true);
    setUpdateMsg(t("settings.update.checking"));
    try {
      const r = await desktop.checkForUpdates();
      if (r.status === "ok" && r.version && r.version !== version) {
        setUpdateMsg(t("settings.update.found", { version: r.version }));
      } else if (r.status === "error") {
        setUpdateMsg(t("settings.update.error"));
      } else {
        setUpdateMsg(t("settings.update.upToDate"));
      }
    } catch {
      setUpdateMsg(t("settings.update.error"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      {desktop && (
        <div className="field">
          <span>{t("settings.update")}</span>
          <button
            className="btn btn--ghost"
            disabled={checking}
            onClick={() => void onCheckUpdates()}
          >
            {t("settings.checkUpdates")}
          </button>
          {updateMsg && <p className="field__hint">{updateMsg}</p>}
        </div>
      )}

      <div className="field">
        <span>{t("settings.about")}</span>
        <p className="field__hint">
          Fathom Music · {t("settings.version")}{" "}
          {version ?? t("settings.web")}
        </p>
      </div>
    </>
  );
}

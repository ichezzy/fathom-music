import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { LANGUAGES, useT } from "../lib/i18n";
import { Modal } from "./common";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const language = useStore((s) => s.settings.language);
  const autoOpen = useStore((s) => s.settings.autoOpenLastCampaign);
  const setLanguage = useStore((s) => s.setLanguage);
  const setSetting = useStore((s) => s.setSetting);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);

  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void desktop.getVersion().then((v) => active && setVersion(v));
    return () => {
      active = false;
    };
  }, []);

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
    if (!window.confirm(t("settings.backup.importConfirm"))) return;
    setError(null);
    setBusy("import");
    try {
      await importBackup(file);
      // On success the app reloads, so we won't get here.
    } catch {
      setError(t("settings.backup.importError"));
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Modal title={t("settings.title")} onClose={onClose}>
      <div className="field">
        <span>{t("settings.language")}</span>
        <div className="seg">
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

      <div className="field">
        <span>{t("settings.shortcuts")}</span>
        <ul className="settings__shortcuts">
          <li>{t("settings.shortcuts.playpause")}</li>
          <li>{t("settings.shortcuts.nextprev")}</li>
          <li>{t("settings.shortcuts.pads")}</li>
          <li>{t("settings.shortcuts.stop")}</li>
        </ul>
      </div>

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
          TavernLoops · {t("settings.version")}{" "}
          {version ?? t("settings.web")}
        </p>
      </div>
    </Modal>
  );
}

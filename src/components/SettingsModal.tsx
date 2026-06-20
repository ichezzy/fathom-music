import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { LANGUAGES, useT } from "../lib/i18n";
import { Modal } from "./common";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const language = useStore((s) => s.settings.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);

  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <span>{t("settings.about")}</span>
        <p className="field__hint">
          TavernLoops · {t("settings.version")}{" "}
          {version ?? t("settings.web")}
        </p>
      </div>
    </Modal>
  );
}

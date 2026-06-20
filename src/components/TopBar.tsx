import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { useT } from "../lib/i18n";
import { Slider } from "./common";
import { SettingsModal } from "./SettingsModal";

export function TopBar() {
  const t = useT();
  const mixer = useStore((s) => s.mixer);
  const setMixer = useStore((s) => s.setMixer);
  const [version, setVersion] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void desktop.getVersion().then((v) => {
      if (active) setVersion(v);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">🍻</span>
        <div>
          <h1>TavernLoops</h1>
          <p>
            {t("app.subtitle")}
            {version && <span className="brand__version">v{version}</span>}
          </p>
        </div>
      </div>

      <div className="mixer">
        <div className="mixer__channel mixer__channel--master">
          <Slider
            label={t("mixer.master")}
            value={mixer.master}
            onChange={(v) => setMixer({ master: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label={t("mixer.music")}
            value={mixer.music}
            onChange={(v) => setMixer({ music: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label={t("mixer.ambient")}
            value={mixer.ambient}
            onChange={(v) => setMixer({ ambient: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label={t("mixer.soundboard")}
            value={mixer.soundboard}
            onChange={(v) => setMixer({ soundboard: v })}
          />
        </div>
      </div>

      <button
        className="icon-btn topbar__settings"
        title={t("settings.open")}
        aria-label={t("settings.open")}
        onClick={() => setSettingsOpen(true)}
      >
        ⚙
      </button>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}

import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { useT } from "../lib/i18n";
import { EditableText, Slider } from "./common";
import { SettingsModal } from "./SettingsModal";
import { Icon } from "./Icon";
import logo from "../assets/logo.png";

/** Left navigation rail: brand, live mixer, and app actions. */
export function Sidebar() {
  const t = useT();
  const mixer = useStore((s) => s.mixer);
  const setMixer = useStore((s) => s.setMixer);
  const beginExitTransition = useStore((s) => s.beginExitTransition);
  const setMiniPlayer = useStore((s) => s.setMiniPlayer);
  const renameCampaign = useStore((s) => s.renameCampaign);
  const activeCampaignId = useStore((s) => s.activeCampaignId);
  const campaignName = useStore(
    (s) => s.campaigns.find((c) => c.id === s.activeCampaignId)?.name ?? "",
  );
  const showMini = Boolean(desktop);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void desktop.getVersion().then((v) => active && setVersion(v));
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <button
          className="icon-btn icon-btn--mini"
          title={t("menu.back")}
          aria-label={t("menu.back")}
          onClick={() => beginExitTransition()}
        >
          <Icon name="back" size={16} />
        </button>
        <img className="sidebar__mark" src={logo} alt="" aria-hidden />
        <div className="sidebar__brand-text">
          <span className="sidebar__app">Fathom</span>
          <EditableText
            className="sidebar__campaign"
            inputClassName="sidebar__campaign sidebar__campaign--input"
            value={campaignName || t("app.subtitle")}
            title={t("music.renameHint")}
            onSubmit={(next) => renameCampaign(activeCampaignId, next)}
          />
        </div>
      </div>

      <div className="sidebar__mixer">
        <span className="sidebar__label">{t("settings.tab.audio")}</span>
        <Slider
          label={t("mixer.master")}
          value={mixer.master}
          onChange={(v) => setMixer({ master: v })}
        />
        <Slider
          label={t("mixer.music")}
          value={mixer.music}
          onChange={(v) => setMixer({ music: v })}
        />
        <Slider
          label={t("mixer.ambient")}
          value={mixer.ambient}
          onChange={(v) => setMixer({ ambient: v })}
        />
        <Slider
          label={t("mixer.soundboard")}
          value={mixer.soundboard}
          onChange={(v) => setMixer({ soundboard: v })}
        />
      </div>

      <div className="sidebar__spacer" />

      <div className="sidebar__actions">
        {showMini && (
          <button
            className="icon-btn"
            title={t("miniPlayer.toggle")}
            aria-label={t("miniPlayer.toggle")}
            onClick={() => setMiniPlayer(true)}
          >
            <Icon name="mini" />
          </button>
        )}
        <button
          className="icon-btn"
          title={t("settings.open")}
          aria-label={t("settings.open")}
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" />
        </button>
        {version && <span className="sidebar__version">v{version}</span>}
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}

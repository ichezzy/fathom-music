import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { desktop } from "../lib/desktop";
import { useT } from "../lib/i18n";
import { EditableText, Slider } from "./common";
import { SettingsModal } from "./SettingsModal";
import { Icon } from "./Icon";

/** Left navigation rail: brand, campaign, nav, live mixer, and app actions. */
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
  // Library is a placeholder view for now; the toggle is purely visual.
  const [nav, setNav] = useState<"player" | "library">("player");

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
      <button
        className="sidebar__back"
        title={t("sidebar.backToMenu")}
        onClick={() => beginExitTransition()}
      >
        <Icon name="back" size={16} />
        <span>{t("sidebar.backToMenu")}</span>
      </button>

      <div className="sidebar__campaign-block">
        <span className="sidebar__section">{t("sidebar.campaign")}</span>
        <EditableText
          className="sidebar__campaign"
          inputClassName="sidebar__campaign sidebar__campaign--input"
          value={campaignName || t("app.subtitle")}
          title={t("music.renameHint")}
          onSubmit={(next) => renameCampaign(activeCampaignId, next)}
        />
      </div>

      <nav className="sidebar__nav">
        <button
          className={`sidebar__nav-item${nav === "player" ? " is-active" : ""}`}
          onClick={() => setNav("player")}
        >
          <Icon name="music" size={16} />
          {t("nav.player")}
        </button>
        <button
          className={`sidebar__nav-item${nav === "library" ? " is-active" : ""}`}
          onClick={() => setNav("library")}
        >
          <Icon name="library" size={16} />
          {t("nav.library")}
        </button>
      </nav>

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
        <SidebarCrossfade />
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

/**
 * Crossfade control for the active playlist, moved out of the playlist view so
 * that view stays a pure track list. Sits under the audio mixer.
 */
function SidebarCrossfade() {
  const t = useT();
  // Target the playlist the user is looking at (or the playing/first one), so
  // the transition mode is editable any time — not only during playback.
  const playlist = useStore(
    (s) =>
      s.playlists.find((p) => p.id === s.viewedPlaylistId) ??
      s.playlists.find((p) => p.id === s.activePlaylistId) ??
      s.playlists[0],
  );
  const updatePlaylist = useStore((s) => s.updatePlaylist);

  const disabled = !playlist;
  const on = Boolean(playlist?.crossfade);

  return (
    <div className="sidebar__crossfade">
      <span className="sidebar__label">{t("music.transition")}</span>
      <button
        className={`toggle toggle--full${on ? " is-on" : ""}`}
        disabled={disabled}
        onClick={() =>
          playlist && updatePlaylist(playlist.id, { crossfade: !on })
        }
      >
        <span className="toggle__dot" />
        {on ? t("music.crossfadeOn") : t("music.hardCut")}
      </button>
      {on && playlist && (
        <label className="cf-seconds">
          <input
            type="range"
            min={1}
            max={15}
            value={playlist.crossfadeSeconds}
            onChange={(e) =>
              updatePlaylist(playlist.id, {
                crossfadeSeconds: Number(e.target.value),
              })
            }
          />
          <span>{playlist.crossfadeSeconds}s</span>
        </label>
      )}
    </div>
  );
}

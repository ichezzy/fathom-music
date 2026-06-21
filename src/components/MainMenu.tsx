import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { CAMPAIGN_COLORS, CAMPAIGN_ICONS } from "../lib/format";
import { desktop } from "../lib/desktop";
import type { Campaign } from "../types";
import {
  ColorPicker,
  EditableText,
  IconPicker,
  Modal,
} from "./common";
import { SettingsModal } from "./SettingsModal";

const MAX_CAMPAIGNS = 4;

export function MainMenu() {
  const t = useT();
  const campaigns = useStore((s) => s.campaigns);
  const activeId = useStore((s) => s.activeCampaignId);
  // Live counts for the active campaign come from the top-level mirror.
  const playlists = useStore((s) => s.playlists);
  const ambient = useStore((s) => s.ambient);
  const soundboard = useStore((s) => s.soundboard);

  const openCampaign = useStore((s) => s.openCampaign);
  const renameCampaign = useStore((s) => s.renameCampaign);
  const deleteCampaign = useStore((s) => s.deleteCampaign);

  const [creating, setCreating] = useState(false);
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

  const countsFor = (c: Campaign) =>
    c.id === activeId
      ? { playlists: playlists.length, sounds: ambient.length + soundboard.length }
      : { playlists: c.playlists.length, sounds: c.ambient.length + c.soundboard.length };

  const onDelete = (c: Campaign) => {
    if (window.confirm(t("menu.deleteConfirm", { name: c.name }))) {
      void deleteCampaign(c.id);
    }
  };

  return (
    <div className="menu">
      <button
        className="icon-btn menu__settings"
        title={t("settings.open")}
        aria-label={t("settings.open")}
        onClick={() => setSettingsOpen(true)}
      >
        ⚙
      </button>

      <header className="menu__head">
        <span className="menu__mark">🍻</span>
        <h1>TavernLoops</h1>
        <p>{t("menu.subtitle")}</p>
        {version && <span className="menu__version">v{version}</span>}
      </header>

      <div className="menu__grid">
        {campaigns.map((c) => {
          const counts = countsFor(c);
          return (
            <div
              key={c.id}
              className="campaign-card"
              style={{
                borderColor: c.color ?? "var(--line)",
              }}
            >
              <button
                className="campaign-card__open"
                style={{
                  background: `linear-gradient(160deg, ${
                    c.color ?? "#3a2f25"
                  }, rgba(0,0,0,0.25))`,
                }}
                onClick={() => openCampaign(c.id)}
                title={t("menu.open")}
              >
                <span className="campaign-card__icon">{c.icon ?? "🍺"}</span>
              </button>
              <div className="campaign-card__body">
                <EditableText
                  className="campaign-card__name"
                  inputClassName="campaign-card__name campaign-card__name--input"
                  value={c.name}
                  title={t("music.renameHint")}
                  onSubmit={(next) => renameCampaign(c.id, next)}
                />
                <p className="campaign-card__meta">
                  {t("menu.playlistsCount", { n: counts.playlists })} ·{" "}
                  {t("menu.soundsCount", { n: counts.sounds })}
                </p>
                <div className="campaign-card__actions">
                  <button
                    className="btn btn--small"
                    onClick={() => openCampaign(c.id)}
                  >
                    {t("menu.open")}
                  </button>
                  {!c.isDefault && (
                    <button
                      className="icon-btn icon-btn--mini"
                      title={t("menu.delete")}
                      onClick={() => onDelete(c)}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {campaigns.length < MAX_CAMPAIGNS && (
          <button
            className="campaign-card campaign-card--new"
            onClick={() => setCreating(true)}
          >
            <span className="campaign-card__plus">＋</span>
            <span>{t("menu.new")}</span>
          </button>
        )}
      </div>

      {creating && <NewCampaignModal onClose={() => setCreating(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const createCampaign = useStore((s) => s.createCampaign);
  const openCampaign = useStore((s) => s.openCampaign);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CAMPAIGN_ICONS[0]);
  const [color, setColor] = useState(CAMPAIGN_COLORS[0]);

  const onCreate = () => {
    const id = createCampaign(name, icon, color);
    if (id) openCampaign(id);
    onClose();
  };

  return (
    <Modal title={t("menu.newTitle")} onClose={onClose}>
      <label className="field">
        <span>{t("ambient.name")}</span>
        <input
          type="text"
          autoFocus
          placeholder={t("menu.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreate();
          }}
        />
      </label>
      <div className="field">
        <span>{t("menu.icon")}</span>
        <IconPicker icons={CAMPAIGN_ICONS} value={icon} onChange={setIcon} />
      </div>
      <div className="field">
        <span>{t("menu.color")}</span>
        <ColorPicker
          colors={CAMPAIGN_COLORS}
          value={color}
          onChange={setColor}
        />
      </div>
      <button className="btn" onClick={onCreate}>
        {t("menu.create")}
      </button>
    </Modal>
  );
}

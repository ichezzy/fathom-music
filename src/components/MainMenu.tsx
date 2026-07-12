import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { CAMPAIGN_COLORS } from "../lib/format";
import { desktop } from "../lib/desktop";
import { askConfirm } from "../lib/confirm";
import { deleteFile, getFileUrl, putFile } from "../lib/db";
import { uid } from "../lib/id";
import { Icon } from "./Icon";
import type { Campaign } from "../types";
import { ColorPicker, EditableText, Modal } from "./common";
import { SettingsModal } from "./SettingsModal";
import logo from "../assets/logo.png";

const MAX_CAMPAIGNS = 4;

export function MainMenu() {
  const t = useT();
  const campaigns = useStore((s) => s.campaigns);
  const activeId = useStore((s) => s.activeCampaignId);
  const playlists = useStore((s) => s.playlists);
  const ambient = useStore((s) => s.ambient);
  const soundboard = useStore((s) => s.soundboard);

  const beginCampaignTransition = useStore((s) => s.beginCampaignTransition);
  const renameCampaign = useStore((s) => s.renameCampaign);
  const deleteCampaign = useStore((s) => s.deleteCampaign);

  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [campaignSettingsFor, setCampaignSettingsFor] =
    useState<Campaign | null>(null);
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
    void askConfirm(t("menu.deleteConfirm", { name: c.name })).then((ok) => {
      if (ok) void deleteCampaign(c.id);
    });
  };

  return (
    <div className="menu">
      <div className="menu__topbar">
        <div className="menu__brand">
          <img className="menu__mark" src={logo} alt="" aria-hidden />
          <h1>Fathom</h1>
          <p>{t("app.subtitle")}</p>
        </div>
        <button
          className="icon-btn menu__settings"
          title={t("settings.open")}
          aria-label={t("settings.open")}
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" />
        </button>
      </div>

      <header className="menu__head">
        <h2>{t("menu.subtitle")}</h2>
        <p>{t("menu.subtitleHint")}</p>
      </header>

      <ol className="menu__list">
        {campaigns.map((c) => {
          const counts = countsFor(c);
          const isActive = c.id === activeId;
          const color = c.color ?? "#0a1e38";
          return (
            <li
              key={c.id}
              className={`campaign-card${isActive ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              title={t("menu.open")}
              onClick={() => beginCampaignTransition(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") beginCampaignTransition(c.id);
              }}
            >
              <CampaignCardArt campaign={c} color={color} />
              <div className="campaign-card__body">
                {(c.tags?.length ?? 0) > 0 && (
                  <span className="campaign-card__tags">
                    {c.tags!.map((tag) => (
                      <span key={tag} className="campaign-card__tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
                <EditableText
                  className="campaign-card__name"
                  inputClassName="campaign-card__name campaign-card__name--input"
                  value={c.name}
                  title={t("music.renameHint")}
                  onSubmit={(next) => renameCampaign(c.id, next)}
                />
                {c.description && (
                  <span className="campaign-card__desc">{c.description}</span>
                )}
                <span className="campaign-card__meta">
                  {t("menu.playlistsCount", { n: counts.playlists })} ·{" "}
                  {t("menu.soundsCount", { n: counts.sounds })}
                  {isActive && (
                    <span className="campaign-card__badge">
                      {t("menu.active")}
                    </span>
                  )}
                </span>
              </div>
              <span className="campaign-card__actions">
                <button
                  className="icon-btn icon-btn--mini"
                  title={t("campaign.settings")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCampaignSettingsFor(c);
                  }}
                >
                  <Icon name="settings" size={14} />
                </button>
                {!c.isDefault && (
                  <button
                    className="icon-btn icon-btn--mini"
                    title={t("menu.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </span>
            </li>
          );
        })}

        {campaigns.length < MAX_CAMPAIGNS && (
          <li>
            <button
              className="campaign-card--new"
              onClick={() => setCreating(true)}
            >
              <span className="campaign-card__plus">
                <Icon name="plus" size={22} />
              </span>
              <span>{t("menu.new")}</span>
            </button>
          </li>
        )}
      </ol>

      {version && <p className="menu__version">v{version}</p>}

      {creating && <NewCampaignModal onClose={() => setCreating(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {campaignSettingsFor && (
        <CampaignSettingsModal
          campaign={campaignSettingsFor}
          onClose={() => setCampaignSettingsFor(null)}
        />
      )}
    </div>
  );
}

/**
 * Card backdrop: the uploaded background image (darkened towards the bottom
 * for text contrast), or the Fathom d20 on a depth gradient when none is set.
 */
function CampaignCardArt({
  campaign,
  color,
}: {
  campaign: Campaign;
  color: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (campaign.imageFileId) {
      void getFileUrl(campaign.imageFileId).then(
        (u) => active && setUrl(u),
      );
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [campaign.imageFileId]);

  return (
    <div
      className="campaign-card__bg"
      style={
        url
          ? undefined
          : {
              background: `linear-gradient(180deg, ${color} 0%, ${color}90 45%, #030d18 100%)`,
            }
      }
    >
      {url ? (
        <>
          <img className="campaign-card__img" src={url} alt="" />
          <div
            className="campaign-card__shade"
            style={{
              background: `linear-gradient(to top, ${color}f0 0%, ${color}55 40%, transparent 100%)`,
            }}
          />
        </>
      ) : (
        <img className="campaign-card__d20" src={logo} alt="" aria-hidden />
      )}
    </div>
  );
}

/** Edit a campaign's card: name, flavor text, tags, image, icon and color. */
function CampaignSettingsModal({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const t = useT();
  const updateCampaignMeta = useStore((s) => s.updateCampaignMeta);

  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [tags, setTags] = useState<string[]>(campaign.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [color, setColor] = useState(campaign.color ?? CAMPAIGN_COLORS[0]);
  // Image changes are staged locally and only written on save.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (imageRemoved || !campaign.imageFileId) {
      setPreviewUrl(null);
      return;
    }
    let active = true;
    void getFileUrl(campaign.imageFileId).then(
      (u) => active && setPreviewUrl(u),
    );
    return () => {
      active = false;
    };
  }, [imageFile, imageRemoved, campaign.imageFileId]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput("");
  };

  const onSave = async () => {
    let imageFileId = imageRemoved ? undefined : campaign.imageFileId;
    if (imageFile) {
      const newId = uid("img");
      await putFile(newId, imageFile);
      imageFileId = newId;
    }
    // Drop the previous blob once it's replaced or removed.
    if (campaign.imageFileId && imageFileId !== campaign.imageFileId) {
      void deleteFile(campaign.imageFileId);
    }
    updateCampaignMeta(campaign.id, {
      name,
      description: description.trim(),
      tags,
      color,
      imageFileId,
    });
    onClose();
  };

  return (
    <Modal title={t("campaign.settings")} onClose={onClose}>
      <label className="field">
        <span>{t("ambient.name")}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t("campaign.description")}</span>
        <input
          type="text"
          placeholder={t("campaign.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("campaign.tags")}</span>
        {tags.length > 0 && (
          <div className="tag-chips">
            {tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
                <button
                  type="button"
                  className="tag-chip__remove"
                  aria-label={t("queue.remove")}
                  onClick={() =>
                    setTags((prev) => prev.filter((x) => x !== tag))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="tag-add">
          <input
            type="text"
            placeholder={t("campaign.addTag")}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
            }}
          />
          <button className="btn btn--small btn--ghost" onClick={addTag}>
            +
          </button>
        </div>
      </div>
      <div className="field">
        <span>{t("campaign.image")}</span>
        <div className="image-field">
          <div className="image-field__preview">
            {previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <img
                className="image-field__d20"
                src={logo}
                alt=""
                aria-hidden
              />
            )}
          </div>
          <div className="image-field__actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImageFile(file);
                  setImageRemoved(false);
                }
                e.target.value = "";
              }}
            />
            <button
              className="btn btn--small btn--ghost"
              onClick={() => fileRef.current?.click()}
            >
              {t("campaign.imageChoose")}
            </button>
            {previewUrl && (
              <button
                className="btn btn--small btn--ghost"
                onClick={() => {
                  setImageFile(null);
                  setImageRemoved(true);
                }}
              >
                {t("queue.remove")}
              </button>
            )}
          </div>
        </div>
        <p className="field__hint">{t("campaign.imageHint")}</p>
      </div>
      <div className="field">
        <span>{t("menu.color")}</span>
        <ColorPicker
          colors={CAMPAIGN_COLORS}
          value={color}
          onChange={setColor}
        />
      </div>
      <button className="btn" onClick={() => void onSave()}>
        {t("common.save")}
      </button>
    </Modal>
  );
}

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const createCampaign = useStore((s) => s.createCampaign);
  const openCampaign = useStore((s) => s.openCampaign);

  const [name, setName] = useState("");
  const [color, setColor] = useState(CAMPAIGN_COLORS[0]);

  const onCreate = () => {
    const id = createCampaign(name, undefined, color);
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

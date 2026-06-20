import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { AMBIENT_ICONS } from "../lib/format";
import { useT } from "../lib/i18n";
import { EditableText, IconPicker, Modal, Slider } from "./common";

export function AmbientSection() {
  const t = useT();
  const ambient = useStore((s) => s.ambient);
  const activeIds = useStore((s) => s.ambientActiveIds);
  const toggleAmbient = useStore((s) => s.toggleAmbient);
  const setAmbientVolume = useStore((s) => s.setAmbientVolume);
  const deleteAmbient = useStore((s) => s.deleteAmbient);
  const renameAmbient = useStore((s) => s.renameAmbient);

  const [adding, setAdding] = useState(false);

  return (
    <section className="panel ambient">
      <div className="panel__head">
        <h2>🌫️ {t("ambient.title")}</h2>
        <button className="btn btn--small" onClick={() => setAdding(true)}>
          {t("ambient.addSound")}
        </button>
      </div>

      <div className="ambient__grid">
        {ambient.length === 0 && <p className="empty">{t("ambient.empty")}</p>}
        {ambient.map((sound) => {
          const isOn = activeIds.includes(sound.id);
          return (
            <div
              key={sound.id}
              className={`ambient-tile${isOn ? " is-on" : ""}`}
            >
              <button
                className="ambient-tile__main"
                onClick={() => toggleAmbient(sound.id)}
              >
                <span className="ambient-tile__icon">{sound.icon}</span>
                <span className="ambient-tile__state">
                  {isOn ? t("ambient.running") : t("ambient.stopped")}
                </span>
              </button>
              <EditableText
                className="ambient-tile__name"
                inputClassName="ambient-tile__name ambient-tile__name--input"
                value={sound.name}
                title={t("music.renameHint")}
                onSubmit={(next) => renameAmbient(sound.id, next)}
              />
              <Slider
                value={sound.volume}
                ariaLabel={`${sound.name} Lautstärke`}
                onChange={(v) => setAmbientVolume(sound.id, v)}
              />
              <button
                className="icon-btn icon-btn--mini ambient-tile__del"
                title={t("ambient.delete")}
                onClick={() => void deleteAmbient(sound.id)}
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>

      {adding && <AddAmbientModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddAmbientModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const addAmbientLocal = useStore((s) => s.addAmbientLocal);
  const addAmbientYouTube = useStore((s) => s.addAmbientYouTube);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(AMBIENT_ICONS[0]);
  const [ytUrl, setYtUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAddLocal = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("ambient.pickFile"));
      return;
    }
    await addAmbientLocal(file, name, icon);
    onClose();
  };

  const onAddYouTube = () => {
    if (!addAmbientYouTube(ytUrl, name, icon)) {
      setError(t("music.invalidYt"));
      return;
    }
    onClose();
  };

  return (
    <Modal title={t("ambient.addTitle")} onClose={onClose}>
      <label className="field">
        <span>{t("ambient.name")}</span>
        <input
          type="text"
          placeholder={t("ambient.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field">
        <span>{t("ambient.icon")}</span>
        <IconPicker icons={AMBIENT_ICONS} value={icon} onChange={setIcon} />
      </div>

      <div className="field">
        <span>{t("ambient.sourceFile")}</span>
        <input ref={fileRef} type="file" accept="audio/*" />
        <button className="btn btn--ghost" onClick={() => void onAddLocal()}>
          {t("ambient.fromFile")}
        </button>
      </div>

      <div className="field">
        <span>{t("ambient.sourceYt")}</span>
        <input
          type="text"
          placeholder={t("ambient.ytPlaceholder")}
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
        />
        <button className="btn btn--ghost" onClick={onAddYouTube}>
          {t("ambient.fromYt")}
        </button>
      </div>

      {error && <p className="add-track__error">{error}</p>}
    </Modal>
  );
}

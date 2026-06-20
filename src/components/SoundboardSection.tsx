import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { SFX_COLORS, SFX_ICONS } from "../lib/format";
import { ColorPicker, EditableText, IconPicker, Modal, Slider } from "./common";

export function SoundboardSection() {
  const soundboard = useStore((s) => s.soundboard);
  const playEffect = useStore((s) => s.playEffect);
  const deleteEffect = useStore((s) => s.deleteEffect);
  const setEffectVolume = useStore((s) => s.setEffectVolume);
  const renameEffect = useStore((s) => s.renameEffect);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <section className="panel soundboard">
      <div className="panel__head">
        <h2>🔊 Soundboard</h2>
        <div className="panel__head-actions">
          <button
            className={`btn btn--small btn--ghost${editing ? " is-on" : ""}`}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Fertig" : "Bearbeiten"}
          </button>
          <button className="btn btn--small" onClick={() => setAdding(true)}>
            + Effekt
          </button>
        </div>
      </div>

      <div className="soundboard__grid">
        {soundboard.length === 0 && (
          <p className="empty">
            Lade kurze Soundeffekte hoch (Schwertstreich, Donner, Würfel…).
          </p>
        )}
        {soundboard.map((effect) => (
          <div key={effect.id} className="pad-wrap">
            <button
              className="pad"
              style={{ background: effect.color }}
              onClick={() => playEffect(effect.id)}
            >
              <span className="pad__icon">{effect.icon}</span>
              <EditableText
                className="pad__name"
                inputClassName="pad__name pad__name--input"
                value={effect.name}
                onSubmit={(next) => renameEffect(effect.id, next)}
              />
            </button>
            {editing && (
              <div className="pad__edit">
                <Slider
                  value={effect.volume}
                  ariaLabel={`${effect.name} Lautstärke`}
                  onChange={(v) => setEffectVolume(effect.id, v)}
                />
                <button
                  className="icon-btn icon-btn--mini"
                  title="Löschen"
                  onClick={() => void deleteEffect(effect.id)}
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && <AddEffectModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddEffectModal({ onClose }: { onClose: () => void }) {
  const addEffect = useStore((s) => s.addEffect);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(SFX_ICONS[0]);
  const [color, setColor] = useState(SFX_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Bitte eine Audiodatei wählen.");
      return;
    }
    await addEffect(file, name, icon, color);
    onClose();
  };

  return (
    <Modal title="Soundeffekt hinzufügen" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          placeholder="z. B. Schwertstreich"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="field">
        <span>Icon</span>
        <IconPicker icons={SFX_ICONS} value={icon} onChange={setIcon} />
      </div>
      <div className="field">
        <span>Farbe</span>
        <ColorPicker colors={SFX_COLORS} value={color} onChange={setColor} />
      </div>
      <div className="field">
        <span>Audiodatei (kurz)</span>
        <input ref={fileRef} type="file" accept="audio/*" />
      </div>
      <button className="btn" onClick={() => void onAdd()}>
        Hinzufügen
      </button>
      {error && <p className="add-track__error">{error}</p>}
    </Modal>
  );
}

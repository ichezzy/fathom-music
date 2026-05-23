import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { AMBIENT_ICONS } from "../lib/format";
import { IconPicker, Modal, Slider } from "./common";

export function AmbientSection() {
  const ambient = useStore((s) => s.ambient);
  const activeIds = useStore((s) => s.ambientActiveIds);
  const toggleAmbient = useStore((s) => s.toggleAmbient);
  const setAmbientVolume = useStore((s) => s.setAmbientVolume);
  const deleteAmbient = useStore((s) => s.deleteAmbient);

  const [adding, setAdding] = useState(false);

  return (
    <section className="panel ambient">
      <div className="panel__head">
        <h2>🌫️ Ambient</h2>
        <button className="btn btn--small" onClick={() => setAdding(true)}>
          + Sound
        </button>
      </div>

      <div className="ambient__grid">
        {ambient.length === 0 && (
          <p className="empty">
            Lege Höhlen-, Stadt- oder Tavernen-Loops an und mische sie frei.
          </p>
        )}
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
                <span className="ambient-tile__name">{sound.name}</span>
                <span className="ambient-tile__state">
                  {isOn ? "läuft" : "aus"}
                </span>
              </button>
              <Slider
                value={sound.volume}
                ariaLabel={`${sound.name} Lautstärke`}
                onChange={(v) => setAmbientVolume(sound.id, v)}
              />
              <button
                className="icon-btn icon-btn--mini ambient-tile__del"
                title="Löschen"
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
      setError("Bitte eine Audiodatei wählen.");
      return;
    }
    await addAmbientLocal(file, name, icon);
    onClose();
  };

  const onAddYouTube = () => {
    if (!addAmbientYouTube(ytUrl, name, icon)) {
      setError("Ungültiger YouTube-Link.");
      return;
    }
    onClose();
  };

  return (
    <Modal title="Ambient-Sound hinzufügen" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          placeholder="z. B. Taverne, Höhle, Regen…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Icon</span>
        <IconPicker icons={AMBIENT_ICONS} value={icon} onChange={setIcon} />
      </div>

      <div className="field">
        <span>Quelle: Datei</span>
        <input ref={fileRef} type="file" accept="audio/*" />
        <button className="btn btn--ghost" onClick={() => void onAddLocal()}>
          Aus Datei hinzufügen
        </button>
      </div>

      <div className="field">
        <span>Quelle: YouTube</span>
        <input
          type="text"
          placeholder="YouTube-Link…"
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
        />
        <button className="btn btn--ghost" onClick={onAddYouTube}>
          Aus YouTube hinzufügen
        </button>
      </div>

      {error && <p className="add-track__error">{error}</p>}
    </Modal>
  );
}

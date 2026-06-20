import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { SFX_COLORS, SFX_ICONS } from "../lib/format";
import { useT } from "../lib/i18n";
import type { EffectPlayback, SoundEffect } from "../types";
import { ColorPicker, EditableText, IconPicker, Modal, Slider } from "./common";

export function SoundboardSection() {
  const t = useT();
  const soundboard = useStore((s) => s.soundboard);
  const loopingIds = useStore((s) => s.soundboardLoopingIds);
  const playEffect = useStore((s) => s.playEffect);
  const deleteEffect = useStore((s) => s.deleteEffect);
  const setEffectVolume = useStore((s) => s.setEffectVolume);
  const renameEffect = useStore((s) => s.renameEffect);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <section className="panel soundboard">
      <div className="panel__head">
        <h2>🔊 {t("sfx.title")}</h2>
        <div className="panel__head-actions">
          <button
            className={`btn btn--small btn--ghost${editing ? " is-on" : ""}`}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? t("sfx.done") : t("sfx.edit")}
          </button>
          <button className="btn btn--small" onClick={() => setAdding(true)}>
            {t("sfx.add")}
          </button>
        </div>
      </div>

      <div className="soundboard__grid">
        {soundboard.length === 0 && <p className="empty">{t("sfx.empty")}</p>}
        {soundboard.map((effect) => {
          const looping = loopingIds.includes(effect.id);
          return (
            <div key={effect.id} className="pad-wrap">
              <button
                className={`pad${looping ? " is-looping" : ""}`}
                style={{ background: effect.color }}
                onClick={() => playEffect(effect.id)}
              >
                <span className="pad__icon">{effect.icon}</span>
                <EditableText
                  className="pad__name"
                  inputClassName="pad__name pad__name--input"
                  value={effect.name}
                  title={t("music.renameHint")}
                  onSubmit={(next) => renameEffect(effect.id, next)}
                />
                {effect.playback.mode === "interval" && (
                  <span className="pad__loop-badge">⟳</span>
                )}
              </button>
              {editing && (
                <div className="pad__edit">
                  <Slider
                    value={effect.volume}
                    ariaLabel={effect.name}
                    onChange={(v) => setEffectVolume(effect.id, v)}
                  />
                  <PlaybackEditor effect={effect} />
                  <button
                    className="icon-btn icon-btn--mini"
                    title={t("sfx.delete")}
                    onClick={() => void deleteEffect(effect.id)}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding && <AddEffectModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function PlaybackEditor({ effect }: { effect: SoundEffect }) {
  const t = useT();
  const setEffectPlayback = useStore((s) => s.setEffectPlayback);
  const pb = effect.playback;
  const isInterval = pb.mode === "interval";
  const isRandom = isInterval && pb.minSeconds !== pb.maxSeconds;

  const update = (next: EffectPlayback) => setEffectPlayback(effect.id, next);

  const min = isInterval ? pb.minSeconds : 30;
  const max = isInterval ? pb.maxSeconds : 60;

  return (
    <div className="playback">
      <div className="seg seg--mini">
        <button
          className={`seg__btn${!isInterval ? " is-on" : ""}`}
          onClick={() => update({ mode: "once" })}
        >
          {t("sfx.playback.once")}
        </button>
        <button
          className={`seg__btn${isInterval ? " is-on" : ""}`}
          onClick={() =>
            update({ mode: "interval", minSeconds: 30, maxSeconds: 30 })
          }
        >
          {t("sfx.playback.interval")}
        </button>
      </div>

      {isInterval && (
        <>
          <div className="seg seg--mini">
            <button
              className={`seg__btn${!isRandom ? " is-on" : ""}`}
              onClick={() =>
                update({ mode: "interval", minSeconds: min, maxSeconds: min })
              }
            >
              {t("sfx.playback.fixed")}
            </button>
            <button
              className={`seg__btn${isRandom ? " is-on" : ""}`}
              onClick={() =>
                update({
                  mode: "interval",
                  minSeconds: min,
                  maxSeconds: Math.max(max, min + 1),
                })
              }
            >
              {t("sfx.playback.random")}
            </button>
          </div>

          {isRandom ? (
            <label className="playback__row">
              <span>{t("sfx.playback.between")}</span>
              <input
                type="number"
                min={1}
                value={min}
                onChange={(e) =>
                  update({
                    mode: "interval",
                    minSeconds: clampSec(e.target.value),
                    maxSeconds: max,
                  })
                }
              />
              <span>{t("sfx.playback.and")}</span>
              <input
                type="number"
                min={1}
                value={max}
                onChange={(e) =>
                  update({
                    mode: "interval",
                    minSeconds: min,
                    maxSeconds: clampSec(e.target.value),
                  })
                }
              />
            </label>
          ) : (
            <label className="playback__row">
              <span>{t("sfx.playback.everySeconds")}</span>
              <input
                type="number"
                min={1}
                value={min}
                onChange={(e) => {
                  const v = clampSec(e.target.value);
                  update({ mode: "interval", minSeconds: v, maxSeconds: v });
                }}
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}

function clampSec(value: string): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 3600);
}

function AddEffectModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const addEffect = useStore((s) => s.addEffect);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(SFX_ICONS[0]);
  const [color, setColor] = useState(SFX_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("sfx.pickFile"));
      return;
    }
    await addEffect(file, name, icon, color);
    onClose();
  };

  return (
    <Modal title={t("sfx.addTitle")} onClose={onClose}>
      <label className="field">
        <span>{t("sfx.name")}</span>
        <input
          type="text"
          placeholder={t("sfx.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("sfx.icon")}</span>
        <IconPicker icons={SFX_ICONS} value={icon} onChange={setIcon} />
      </div>
      <div className="field">
        <span>{t("sfx.color")}</span>
        <ColorPicker colors={SFX_COLORS} value={color} onChange={setColor} />
      </div>
      <div className="field">
        <span>{t("sfx.file")}</span>
        <input ref={fileRef} type="file" accept="audio/*" />
      </div>
      <button className="btn" onClick={() => void onAdd()}>
        {t("sfx.addBtn")}
      </button>
      {error && <p className="add-track__error">{error}</p>}
    </Modal>
  );
}

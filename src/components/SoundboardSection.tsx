import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { SFX_COLORS, SFX_ICONS } from "../lib/format";
import { useT } from "../lib/i18n";
import { confirmDelete, askConfirm } from "../lib/confirm";
import { sectionize } from "../lib/grouping";
import type { EffectPlayback, SoundEffect } from "../types";
import { GroupHeader } from "./GroupHeader";
import { ColorPicker, EditableText, IconPicker, Modal, Slider } from "./common";

export function SoundboardSection() {
  const t = useT();
  const soundboard = useStore((s) => s.soundboard);
  const groups = useStore((s) => s.soundboardGroups);
  const createGroup = useStore((s) => s.createSoundboardGroup);
  const renameGroup = useStore((s) => s.renameSoundboardGroup);
  const deleteGroup = useStore((s) => s.deleteSoundboardGroup);
  const moveGroup = useStore((s) => s.moveSoundboardGroup);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const sections = sectionize(soundboard, groups);

  return (
    <section className="panel soundboard">
      <div className="panel__head">
        <h2>🔊 {t("sfx.title")}</h2>
        <div className="panel__head-actions">
          {editing && (
            <button
              className="btn btn--small btn--ghost"
              onClick={() => createGroup(t("group.new"))}
            >
              {t("group.add")}
            </button>
          )}
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

      {soundboard.length === 0 && groups.length === 0 ? (
        <p className="empty">{t("sfx.empty")}</p>
      ) : (
        sections.map((section, si) => (
          <div key={section.group?.id ?? "__ungrouped"} className="sound-section">
            {(groups.length > 0 || section.group) && (
              <GroupHeader
                group={section.group}
                editing={editing}
                groupIndex={
                  section.group
                    ? groups.findIndex((g) => g.id === section.group!.id)
                    : -1
                }
                groupCount={groups.length}
                onRename={(name) =>
                  section.group && renameGroup(section.group.id, name)
                }
                onMove={(dir) => {
                  const idx = groups.findIndex((g) => g.id === section.group?.id);
                  if (idx >= 0) moveGroup(idx, idx + dir);
                }}
                onDelete={() => {
                  const g = section.group;
                  if (!g) return;
                  void askConfirm(
                    t("group.deleteConfirm", { name: g.name }),
                  ).then((ok) => ok && deleteGroup(g.id));
                }}
              />
            )}
            <div className="soundboard__grid">
              {section.entries.map((entry, pos) => (
                <Pad
                  key={entry.item.id}
                  effect={entry.item}
                  flatIndex={entry.index}
                  editing={editing}
                  canUp={pos > 0}
                  canDown={pos < section.entries.length - 1}
                  prevIndex={section.entries[pos - 1]?.index}
                  nextIndex={section.entries[pos + 1]?.index}
                />
              ))}
              {section.entries.length === 0 && (
                <p className="empty empty--mini">·</p>
              )}
            </div>
            {si < sections.length - 1 && <div className="sound-section__sep" />}
          </div>
        ))
      )}

      {adding && <AddEffectModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function Pad({
  effect,
  flatIndex,
  editing,
  canUp,
  canDown,
  prevIndex,
  nextIndex,
}: {
  effect: SoundEffect;
  flatIndex: number;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  prevIndex?: number;
  nextIndex?: number;
}) {
  const t = useT();
  const groups = useStore((s) => s.soundboardGroups);
  const looping = useStore((s) => s.soundboardLoopingIds.includes(effect.id));
  const playEffect = useStore((s) => s.playEffect);
  const deleteEffect = useStore((s) => s.deleteEffect);
  const moveEffect = useStore((s) => s.moveEffect);
  const setEffectVolume = useStore((s) => s.setEffectVolume);
  const renameEffect = useStore((s) => s.renameEffect);
  const setEffectGroup = useStore((s) => s.setEffectGroup);

  return (
    <div className="pad-wrap">
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
          {groups.length > 0 && (
            <select
              className="tile-group-select"
              value={effect.groupId ?? ""}
              onChange={(e) =>
                setEffectGroup(effect.id, e.target.value || undefined)
              }
            >
              <option value="">{t("group.none")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <div className="pad__order">
            <button
              className="icon-btn icon-btn--mini"
              title={t("common.moveUp")}
              disabled={!canUp}
              onClick={() =>
                prevIndex !== undefined && moveEffect(flatIndex, prevIndex)
              }
            >
              ◀
            </button>
            <button
              className="icon-btn icon-btn--mini"
              title={t("common.moveDown")}
              disabled={!canDown}
              onClick={() =>
                nextIndex !== undefined && moveEffect(flatIndex, nextIndex)
              }
            >
              ▶
            </button>
            <button
              className="icon-btn icon-btn--mini"
              title={t("sfx.delete")}
              onClick={() =>
                void confirmDelete(effect.name).then(
                  (ok) => ok && void deleteEffect(effect.id),
                )
              }
            >
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
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

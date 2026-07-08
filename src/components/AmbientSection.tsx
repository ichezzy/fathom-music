import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { AMBIENT_ICONS } from "../lib/format";
import { useT } from "../lib/i18n";
import { confirmDelete, askConfirm } from "../lib/confirm";
import { sectionize } from "../lib/grouping";
import type { AmbientSound } from "../types";
import { GroupHeader } from "./GroupHeader";
import { EditableText, IconPicker, Modal, Slider } from "./common";

export function AmbientSection() {
  const t = useT();
  const ambient = useStore((s) => s.ambient);
  const groups = useStore((s) => s.ambientGroups);
  const createGroup = useStore((s) => s.createAmbientGroup);
  const renameGroup = useStore((s) => s.renameAmbientGroup);
  const deleteGroup = useStore((s) => s.deleteAmbientGroup);
  const moveGroup = useStore((s) => s.moveAmbientGroup);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const sections = sectionize(ambient, groups);

  return (
    <section className="panel ambient">
      <div className="panel__head">
        <h2>🌫️ {t("ambient.title")}</h2>
        <div className="panel__head-actions">
          {editing && (
            <button
              className="btn btn--small btn--ghost"
              onClick={() => createGroup(t("group.new"))}
            >
              {t("group.add")}
            </button>
          )}
          {(ambient.length > 1 || groups.length > 0) && (
            <button
              className={`btn btn--small btn--ghost${editing ? " is-on" : ""}`}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? t("common.done") : t("common.edit")}
            </button>
          )}
          <button className="btn btn--small" onClick={() => setAdding(true)}>
            {t("ambient.addSound")}
          </button>
        </div>
      </div>

      {ambient.length === 0 && groups.length === 0 ? (
        <p className="empty">{t("ambient.empty")}</p>
      ) : (
        sections.map((section, si) => (
          <div key={section.group?.id ?? "__ungrouped"} className="sound-section">
            {(groups.length > 0 || section.group) && (
              <GroupHeader
                group={section.group}
                editing={editing}
                groupIndex={
                  section.group ? groups.findIndex((g) => g.id === section.group!.id) : -1
                }
                groupCount={groups.length}
                onRename={(name) => section.group && renameGroup(section.group.id, name)}
                onMove={(dir) => {
                  const idx = groups.findIndex((g) => g.id === section.group?.id);
                  if (idx >= 0) moveGroup(idx, idx + dir);
                }}
                onDelete={() => {
                  const g = section.group;
                  if (!g) return;
                  void askConfirm(t("group.deleteConfirm", { name: g.name })).then(
                    (ok) => ok && deleteGroup(g.id),
                  );
                }}
              />
            )}
            <div className="ambient__grid">
              {section.entries.map((entry, pos) => (
                <AmbientTile
                  key={entry.item.id}
                  sound={entry.item}
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

      {adding && <AddAmbientModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function AmbientTile({
  sound,
  flatIndex,
  editing,
  canUp,
  canDown,
  prevIndex,
  nextIndex,
}: {
  sound: AmbientSound;
  flatIndex: number;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  prevIndex?: number;
  nextIndex?: number;
}) {
  const t = useT();
  const activeIds = useStore((s) => s.ambientActiveIds);
  const groups = useStore((s) => s.ambientGroups);
  const toggleAmbient = useStore((s) => s.toggleAmbient);
  const setAmbientVolume = useStore((s) => s.setAmbientVolume);
  const deleteAmbient = useStore((s) => s.deleteAmbient);
  const renameAmbient = useStore((s) => s.renameAmbient);
  const moveAmbient = useStore((s) => s.moveAmbient);
  const setAmbientGroup = useStore((s) => s.setAmbientGroup);

  const isOn = activeIds.includes(sound.id);
  const onDelete = () =>
    void confirmDelete(sound.name).then((ok) => ok && void deleteAmbient(sound.id));

  return (
    <div className={`ambient-tile${isOn ? " is-on" : ""}`}>
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
        ariaLabel={sound.name}
        onChange={(v) => setAmbientVolume(sound.id, v)}
      />
      {editing ? (
        <>
          {groups.length > 0 && (
            <select
              className="tile-group-select"
              value={sound.groupId ?? ""}
              onChange={(e) =>
                setAmbientGroup(sound.id, e.target.value || undefined)
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
          <div className="ambient-tile__edit">
            <button
              className="icon-btn icon-btn--mini"
              title={t("common.moveUp")}
              disabled={!canUp}
              onClick={() => prevIndex !== undefined && moveAmbient(flatIndex, prevIndex)}
            >
              ◀
            </button>
            <button
              className="icon-btn icon-btn--mini"
              title={t("common.moveDown")}
              disabled={!canDown}
              onClick={() => nextIndex !== undefined && moveAmbient(flatIndex, nextIndex)}
            >
              ▶
            </button>
            <button
              className="icon-btn icon-btn--mini ambient-tile__del"
              title={t("ambient.delete")}
              onClick={onDelete}
            >
              🗑
            </button>
          </div>
        </>
      ) : (
        <button
          className="icon-btn icon-btn--mini ambient-tile__del"
          title={t("ambient.delete")}
          onClick={onDelete}
        >
          🗑
        </button>
      )}
    </div>
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

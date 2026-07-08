import { useT } from "../lib/i18n";
import type { SoundGroup } from "../types";
import { EditableText } from "./common";
import { Icon } from "./Icon";

/**
 * Header row for a group section (shared by ambient + soundboard). For the
 * implicit ungrouped bucket (`group === null`) it shows the "General" label
 * with no controls. In edit mode a real group can be renamed, reordered and
 * deleted.
 */
export function GroupHeader({
  group,
  editing,
  groupIndex,
  groupCount,
  onRename,
  onMove,
  onDelete,
}: {
  group: SoundGroup | null;
  editing: boolean;
  groupIndex: number;
  groupCount: number;
  onRename: (name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useT();

  if (!group) {
    return (
      <div className="group-head group-head--muted">
        <span className="group-head__name">{t("group.ungrouped")}</span>
      </div>
    );
  }

  return (
    <div className="group-head">
      <EditableText
        className="group-head__name"
        inputClassName="group-head__name group-head__name--input"
        value={group.name}
        title={t("music.renameHint")}
        onSubmit={onRename}
      />
      {editing && (
        <span className="group-head__actions">
          <button
            className="icon-btn icon-btn--mini"
            title={t("common.moveUp")}
            disabled={groupIndex <= 0}
            onClick={() => onMove(-1)}
          >
            <Icon name="chevronUp" size={13} />
          </button>
          <button
            className="icon-btn icon-btn--mini"
            title={t("common.moveDown")}
            disabled={groupIndex >= groupCount - 1}
            onClick={() => onMove(1)}
          >
            <Icon name="chevronDown" size={13} />
          </button>
          <button
            className="icon-btn icon-btn--mini"
            title={t("group.delete")}
            onClick={onDelete}
          >
            <Icon name="trash" size={13} />
          </button>
        </span>
      )}
    </div>
  );
}

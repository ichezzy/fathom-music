import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { Icon } from "./Icon";

/** Slide-in "Up next" panel, opened from the now-playing bar. */
export function QueuePanel() {
  const t = useT();
  const open = useStore((s) => s.queueOpen);
  const setOpen = useStore((s) => s.setQueueOpen);
  const status = useStore((s) => s.status);
  const tracks = useStore((s) => s.tracks);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const moveInQueue = useStore((s) => s.moveInQueue);
  const jumpTo = useStore((s) => s.jumpToQueueIndex);
  const clearQueue = useStore((s) => s.clearQueue);

  if (!open) return null;

  const queue = status.queue;
  const pos = status.position;
  const current = queue[pos];
  const upcoming = queue
    .map((id, index) => ({ id, index }))
    .filter((e) => e.index > pos);

  const titleOf = (id: string) => tracks[id]?.title ?? id;
  const isYt = (id: string) => tracks[id]?.source.kind === "youtube";

  return (
    <>
      <div className="queue-scrim" onClick={() => setOpen(false)} />
      <aside className="queue-panel">
        <div className="queue-panel__head">
          <h2>{t("queue.title")}</h2>
          <div className="queue-panel__head-actions">
            {upcoming.length > 0 && (
              <button className="btn btn--ghost btn--small" onClick={clearQueue}>
                {t("queue.clear")}
              </button>
            )}
            <button
              className="icon-btn icon-btn--mini"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        <div className="queue-panel__body">
          {current && (
            <>
              <p className="queue-panel__label">{t("queue.nowPlaying")}</p>
              <div className="queue-row is-current">
                <span className="queue-row__icon">{isYt(current) ? "📺" : "🎶"}</span>
                <span className="queue-row__title">{titleOf(current)}</span>
              </div>
            </>
          )}

          <p className="queue-panel__label">{t("queue.upNext")}</p>
          {upcoming.length === 0 && (
            <p className="empty">{t("queue.empty")}</p>
          )}
          {upcoming.map((entry, i) => (
            <div key={`${entry.id}-${entry.index}`} className="queue-row">
              <button
                className="queue-row__play"
                title={t("music.playThis")}
                onClick={() => jumpTo(entry.index)}
              >
                <Icon name="play" size={13} />
              </button>
              <span className="queue-row__icon">
                {isYt(entry.id) ? "📺" : "🎶"}
              </span>
              <span className="queue-row__title">{titleOf(entry.id)}</span>
              <span className="queue-row__order">
                <button
                  className="icon-btn icon-btn--mini"
                  title={t("common.moveUp")}
                  disabled={i === 0}
                  onClick={() => moveInQueue(entry.index, entry.index - 1)}
                >
                  <Icon name="chevronUp" size={13} />
                </button>
                <button
                  className="icon-btn icon-btn--mini"
                  title={t("common.moveDown")}
                  disabled={i === upcoming.length - 1}
                  onClick={() => moveInQueue(entry.index, entry.index + 1)}
                >
                  <Icon name="chevronDown" size={13} />
                </button>
              </span>
              <button
                className="icon-btn icon-btn--mini"
                title={t("queue.remove")}
                onClick={() => removeFromQueue(entry.index)}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

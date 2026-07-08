import { useStore } from "../store/store";
import { formatTime } from "../lib/format";
import { useT } from "../lib/i18n";
import { LoopButton } from "./LoopButton";
import { Icon } from "./Icon";

export function NowPlayingBar() {
  const t = useT();
  const status = useStore((s) => s.status);
  const track = useStore((s) =>
    status.trackId ? s.tracks[status.trackId] : null,
  );
  const playlist = useStore((s) =>
    s.playlists.find((p) => p.id === s.activePlaylistId),
  );
  const togglePlay = useStore((s) => s.togglePlay);
  const next = useStore((s) => s.next);
  const previous = useStore((s) => s.previous);
  const seek = useStore((s) => s.seek);
  const setQueueOpen = useStore((s) => s.setQueueOpen);
  const queueOpen = useStore((s) => s.queueOpen);

  const hasTrack = Boolean(track);
  const duration = status.durationSec || 0;

  return (
    <footer className="nowplaying">
      <div className="nowplaying__meta">
        <span className="nowplaying__icon">
          {track?.source.kind === "youtube" ? "📺" : "🎶"}
        </span>
        <div className="nowplaying__text">
          <span className="nowplaying__title">
            {track ? track.title : t("now.nothing")}
          </span>
          <span className="nowplaying__sub">
            {playlist ? playlist.name : t("now.pickPlaylist")}
          </span>
        </div>
      </div>

      <div className="nowplaying__controls">
        <button
          className="icon-btn"
          onClick={previous}
          disabled={!hasTrack}
          aria-label={t("now.prev")}
        >
          <Icon name="prev" />
        </button>
        <button
          className="icon-btn icon-btn--play"
          onClick={togglePlay}
          disabled={!hasTrack}
          aria-label={status.playing ? "Pause" : "Play"}
        >
          <Icon name={status.playing ? "pause" : "play"} size={22} />
        </button>
        <button
          className="icon-btn"
          onClick={next}
          disabled={!hasTrack}
          aria-label={t("now.next")}
        >
          <Icon name="next" />
        </button>
        <LoopButton />
        <button
          className={`icon-btn${queueOpen ? " is-on" : ""}`}
          title={t("queue.open")}
          aria-label={t("queue.open")}
          onClick={() => setQueueOpen(!queueOpen)}
        >
          <Icon name="queue" />
        </button>
      </div>

      <div className="nowplaying__progress">
        <span className="nowplaying__time">{formatTime(status.currentSec)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          value={Math.floor(status.currentSec)}
          disabled={!hasTrack || duration <= 0}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t("now.position")}
        />
        <span className="nowplaying__time">{formatTime(duration)}</span>
      </div>
    </footer>
  );
}

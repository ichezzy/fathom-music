import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { formatTime } from "../lib/format";
import { Slider } from "./common";
import { LoopButton } from "./LoopButton";
import { Icon } from "./Icon";

/**
 * Compact transport bar used when the user activates the mini player. The
 * Electron main process shrinks the window and pins it always-on-top while
 * this is shown.
 */
export function MiniPlayer() {
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
  const mixer = useStore((s) => s.mixer);
  const setMixer = useStore((s) => s.setMixer);
  const setMiniPlayer = useStore((s) => s.setMiniPlayer);

  const hasTrack = Boolean(track);
  const duration = status.durationSec || 0;

  return (
    <div className="mini">
      <div className="mini__row mini__row--top">
        <div className="mini__meta">
          <span className="mini__icon">
            {track?.source.kind === "youtube" ? "📺" : "🎶"}
          </span>
          <div className="mini__text">
            <span className="mini__title">
              {track ? track.title : t("now.nothing")}
            </span>
            <span className="mini__sub">
              {playlist ? playlist.name : t("now.pickPlaylist")}
            </span>
          </div>
        </div>
        <button
          className="icon-btn"
          title={t("miniPlayer.expand")}
          onClick={() => setMiniPlayer(false)}
        >
          <Icon name="expand" />
        </button>
      </div>

      <div className="mini__row mini__row--bottom">
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
        <span className="mini__time">
          {formatTime(status.currentSec)} / {formatTime(duration)}
        </span>
        <div className="mini__vol">
          <Slider
            value={mixer.master}
            ariaLabel={t("mixer.master")}
            onChange={(v) => setMixer({ master: v })}
          />
        </div>
      </div>
    </div>
  );
}

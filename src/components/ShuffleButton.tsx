import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { Icon } from "./Icon";

/**
 * Toggles the active playlist's shuffle mode. Lives in the transport bar next
 * to the loop button (like the Figma player). Disabled without a playlist.
 */
export function ShuffleButton() {
  const t = useT();
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const playlist = useStore((s) =>
    s.playlists.find((p) => p.id === s.activePlaylistId),
  );
  const updatePlaylist = useStore((s) => s.updatePlaylist);

  const on = Boolean(playlist?.shuffle);
  const label = on ? t("music.shuffleOn") : t("music.shuffleOff");

  return (
    <button
      className={`icon-btn${on ? " is-on" : ""}`}
      disabled={!activePlaylistId || !playlist}
      onClick={() => playlist && updatePlaylist(playlist.id, { shuffle: !on })}
      title={label}
      aria-label={label}
    >
      <Icon name="shuffle" />
    </button>
  );
}

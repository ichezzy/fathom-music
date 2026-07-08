import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import type { RepeatMode } from "../types";
import { Icon } from "./Icon";

const NEXT: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};

/**
 * Cycles the active playlist's repeat mode: off → all → one (loop current
 * track) → off. Highlights when looping is active. Disabled when there's no
 * active playlist (nothing to loop).
 */
export function LoopButton({ small = false }: { small?: boolean }) {
  const t = useT();
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const playlist = useStore((s) =>
    s.playlists.find((p) => p.id === s.activePlaylistId),
  );
  const updatePlaylist = useStore((s) => s.updatePlaylist);

  const mode: RepeatMode = playlist?.repeat ?? "off";
  const disabled = !activePlaylistId;
  const onClick = () => {
    if (!playlist) return;
    updatePlaylist(playlist.id, { repeat: NEXT[mode] });
  };

  const label =
    mode === "one"
      ? t("loop.track")
      : mode === "all"
        ? t("loop.playlist")
        : t("loop.off");

  return (
    <button
      className={`icon-btn loop-btn${mode !== "off" ? " is-on" : ""}${
        small ? " icon-btn--mini" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon name={mode === "one" ? "repeatOne" : "repeat"} />
    </button>
  );
}

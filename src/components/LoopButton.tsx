import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import type { IconName } from "./Icon";
import type { RepeatMode } from "../types";
import { Icon } from "./Icon";

// Cycle: off → repeat current forever → repeat current once → off.
const NEXT: Record<RepeatMode, RepeatMode> = {
  off: "one",
  one: "once",
  once: "off",
};

const ICON: Record<RepeatMode, IconName> = {
  off: "repeat",
  one: "repeatInfinite",
  once: "repeatOne",
};

/**
 * Cycles the active playlist's per-track loop mode. The playlist itself always
 * keeps playing (and restarts at the end), so there is no "loop playlist" mode.
 * Dim when off, glowing cyan when on. Disabled without an active playlist.
 */
export function LoopButton({ small = false }: { small?: boolean }) {
  const t = useT();
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const playlist = useStore((s) =>
    s.playlists.find((p) => p.id === s.activePlaylistId),
  );
  const updatePlaylist = useStore((s) => s.updatePlaylist);

  // Coerce any legacy value (e.g. the old "all") to a current mode.
  const raw = playlist?.repeat;
  const mode: RepeatMode = raw === "one" || raw === "once" ? raw : "off";
  const disabled = !activePlaylistId;

  const onClick = () => {
    if (!playlist) return;
    updatePlaylist(playlist.id, { repeat: NEXT[mode] });
  };

  const label =
    mode === "one"
      ? t("loop.one")
      : mode === "once"
        ? t("loop.once")
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
      <Icon name={ICON[mode]} />
    </button>
  );
}

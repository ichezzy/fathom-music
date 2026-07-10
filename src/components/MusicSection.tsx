import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/store";
import type { RepeatMode } from "../types";
import { useT } from "../lib/i18n";
import { confirmDelete } from "../lib/confirm";
import { EditableText, WaveAnim } from "./common";
import { Icon } from "./Icon";

export function MusicSection() {
  const t = useT();
  const playlists = useStore((s) => s.playlists);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const movePlaylist = useStore((s) => s.movePlaylist);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const effectiveId =
    (selectedId && playlists.some((p) => p.id === selectedId) && selectedId) ||
    activePlaylistId ||
    playlists[0]?.id ||
    null;

  return (
    <section className="panel music">
      <div className="panel__head">
        <h2>🎵 {t("music.title")}</h2>
        <div className="panel__head-actions">
          <button
            className={`btn btn--small btn--ghost${editing ? " is-on" : ""}`}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? t("common.done") : t("common.edit")}
          </button>
          <button
            className="btn btn--small"
            onClick={() => {
              const id = createPlaylist(t("music.newPlaylist"));
              setSelectedId(id);
            }}
          >
            {t("music.addPlaylist")}
          </button>
        </div>
      </div>

      <div className="music__body">
        <ul className="playlist-list">
          {playlists.length === 0 && (
            <li className="empty">{t("music.noPlaylists")}</li>
          )}
          {playlists.map((pl, index) => (
            <li key={pl.id} className="playlist-list__row">
              <button
                className={`playlist-list__item${
                  pl.id === effectiveId ? " is-selected" : ""
                }${pl.id === activePlaylistId ? " is-active" : ""}`}
                onClick={() => setSelectedId(pl.id)}
              >
                <span className="playlist-list__name">{pl.name}</span>
                <span className="playlist-list__count">
                  {pl.trackIds.length}
                </span>
              </button>
              {editing && (
                <span className="playlist-list__order">
                  <button
                    className="icon-btn icon-btn--mini"
                    title={t("common.moveUp")}
                    disabled={index === 0}
                    onClick={() => movePlaylist(index, index - 1)}
                  >
                    <Icon name="chevronUp" size={13} />
                  </button>
                  <button
                    className="icon-btn icon-btn--mini"
                    title={t("common.moveDown")}
                    disabled={index === playlists.length - 1}
                    onClick={() => movePlaylist(index, index + 1)}
                  >
                    <Icon name="chevronDown" size={13} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="music__detail">
          {effectiveId ? (
            <PlaylistDetail playlistId={effectiveId} />
          ) : (
            <div className="empty empty--center">{t("music.pickToAdd")}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlaylistDetail({ playlistId }: { playlistId: string }) {
  const t = useT();
  const playlist = useStore((s) =>
    s.playlists.find((p) => p.id === playlistId),
  );
  const tracks = useStore((s) => s.tracks);
  const status = useStore((s) => s.status);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const renamePlaylist = useStore((s) => s.renamePlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const updatePlaylist = useStore((s) => s.updatePlaylist);
  const playPlaylist = useStore((s) => s.playPlaylist);
  const removeTrackFromPlaylist = useStore((s) => s.removeTrackFromPlaylist);
  const moveTrackInPlaylist = useStore((s) => s.moveTrackInPlaylist);
  const deleteTrack = useStore((s) => s.deleteTrack);
  const renameTrack = useStore((s) => s.renameTrack);
  const addLocalTracks = useStore((s) => s.addLocalTracks);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  // "…" / right-click context menu + "Added to queue" toast (prototype).
  const [ctxMenu, setCtxMenu] = useState<{
    trackId: string;
    x: number;
    y: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  if (!playlist) return null;
  const isActive = activePlaylistId === playlist.id;

  const onDropReorder = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      moveTrackInPlaylist(playlist.id, dragIndex, index);
    }
    setDragIndex(null);
    setDragOver(null);
  };

  const onDropFiles = async (files: FileList) => {
    setFileOver(false);
    const audio = Array.from(files).filter((f) => f.type.startsWith("audio/"));
    if (audio.length === 0) return;
    const ids = await addLocalTracks(audio);
    ids.forEach((id) => addTrackToPlaylist(playlist.id, id));
  };

  const setRepeat = (mode: RepeatMode) =>
    updatePlaylist(playlist.id, { repeat: mode });

  const onRemoveTrack = async (index: number) => {
    const trackId = playlist.trackIds[index];
    const trackName =
      useStore.getState().tracks[trackId]?.title ?? "";
    if (!(await confirmDelete(trackName))) return;
    removeTrackFromPlaylist(playlist.id, index);
    // Drop the track entirely if no playlist references it anymore.
    const stillUsed = useStore
      .getState()
      .playlists.some((p) => p.trackIds.includes(trackId));
    if (!stillUsed) void deleteTrack(trackId);
  };

  return (
    <div className="detail">
      <div className="detail__head">
        <input
          className="detail__name"
          value={playlist.name}
          onChange={(e) => renamePlaylist(playlist.id, e.target.value)}
        />
        <div className="detail__head-actions">
          <button
            className="btn"
            disabled={playlist.trackIds.length === 0}
            onClick={() => void playPlaylist(playlist.id, 0)}
          >
            {t("music.play")}
          </button>
          <button
            className="icon-btn"
            title={t("music.deletePlaylist")}
            onClick={() => {
              void confirmDelete(playlist.name).then((ok) => {
                if (ok) deletePlaylist(playlist.id);
              });
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <div className="modes">
        <div className="modes__group">
          <span className="modes__title">{t("music.loopMode")}</span>
          <div className="seg">
            {(["off", "all", "one"] as RepeatMode[]).map((mode) => (
              <button
                key={mode}
                className={`seg__btn${playlist.repeat === mode ? " is-on" : ""}`}
                onClick={() => setRepeat(mode)}
              >
                {t(`music.loop.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="modes__group">
          <span className="modes__title">{t("music.transition")}</span>
          <div className="modes__row">
            <button
              className={`toggle${playlist.crossfade ? " is-on" : ""}`}
              onClick={() =>
                updatePlaylist(playlist.id, { crossfade: !playlist.crossfade })
              }
            >
              <span className="toggle__dot" />
              {playlist.crossfade ? t("music.crossfadeOn") : t("music.hardCut")}
            </button>
            <label className="cf-seconds">
              <input
                type="range"
                min={1}
                max={15}
                value={playlist.crossfadeSeconds}
                disabled={!playlist.crossfade}
                onChange={(e) =>
                  updatePlaylist(playlist.id, {
                    crossfadeSeconds: Number(e.target.value),
                  })
                }
              />
              <span>{playlist.crossfadeSeconds}s</span>
            </label>
          </div>
        </div>

        <div className="modes__group">
          <span className="modes__title">{t("music.shuffle")}</span>
          <button
            className={`toggle${playlist.shuffle ? " is-on" : ""}`}
            onClick={() =>
              updatePlaylist(playlist.id, { shuffle: !playlist.shuffle })
            }
          >
            <span className="toggle__dot" />
            {playlist.shuffle ? t("music.on") : t("music.off")}
          </button>
        </div>
      </div>

      <ol
        className={`tracklist${fileOver ? " is-file-over" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setFileOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setFileOver(false);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            void onDropFiles(e.dataTransfer.files);
          }
        }}
      >
        {playlist.trackIds.length === 0 && (
          <li className="empty">{t("music.noTracks")}</li>
        )}
        {playlist.trackIds.map((trackId, index) => {
          const track = tracks[trackId];
          if (!track) return null;
          const isCurrent = isActive && status.trackId === trackId;
          return (
            <li
              key={`${trackId}-${index}`}
              className={`tracklist__row${isCurrent ? " is-current" : ""}${
                dragOver === index ? " is-drag-over" : ""
              }${dragIndex === index ? " is-dragging" : ""}`}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOver(null);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return; // let file-drop bubble to <ol>
                e.preventDefault();
                e.stopPropagation();
                if (dragOver !== index) setDragOver(index);
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.stopPropagation();
                onDropReorder(index);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ trackId, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="tracklist__index" aria-hidden>
                {isCurrent ? <WaveAnim playing={status.playing} /> : index + 1}
              </span>
              <button
                className="tracklist__play"
                onClick={() => void playPlaylist(playlist.id, index)}
                title={t("music.playThis")}
              >
                <Icon
                  name={isCurrent && status.playing ? "pause" : "play"}
                  size={13}
                />
              </button>
              <EditableText
                className="tracklist__title tracklist__title--editable"
                inputClassName="tracklist__title tracklist__title--input"
                value={track.title}
                title={t("music.renameHint")}
                onSubmit={(next) => renameTrack(trackId, next)}
              />
              <span className="tracklist__badge">
                {track.source.kind === "youtube" ? "YT" : "MP3"}
              </span>
              <button
                className="icon-btn icon-btn--mini"
                title={t("queue.add")}
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  setCtxMenu({ trackId, x: r.left, y: r.bottom + 4 });
                }}
              >
                <Icon name="more" size={13} />
              </button>
              <span className="tracklist__order">
                <button
                  className="icon-btn icon-btn--mini"
                  disabled={index === 0}
                  onClick={() =>
                    moveTrackInPlaylist(playlist.id, index, index - 1)
                  }
                >
                  <Icon name="chevronUp" size={13} />
                </button>
                <button
                  className="icon-btn icon-btn--mini"
                  disabled={index === playlist.trackIds.length - 1}
                  onClick={() =>
                    moveTrackInPlaylist(playlist.id, index, index + 1)
                  }
                >
                  <Icon name="chevronDown" size={13} />
                </button>
              </span>
              <button
                className="icon-btn icon-btn--mini"
                title={t("music.remove")}
                onClick={() => void onRemoveTrack(index)}
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          );
        })}
      </ol>

      <AddTrackForm playlistId={playlist.id} />

      {ctxMenu && (
        <TrackContextMenu
          trackId={ctxMenu.trackId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onAddedToQueue={() => showToast(t("queue.added"))}
        />
      )}
      {toast &&
        createPortal(
          <div className="toast">
            <Icon name="check" size={13} /> {toast}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Prototype track menu ("…" button or right-click): add the track to the
 * manual queue, or toggle it in/out of any playlist via checkboxes.
 */
function TrackContextMenu({
  trackId,
  x,
  y,
  onClose,
  onAddedToQueue,
}: {
  trackId: string;
  x: number;
  y: number;
  onClose: () => void;
  onAddedToQueue: () => void;
}) {
  const t = useT();
  const track = useStore((s) => s.tracks[trackId]);
  const playlists = useStore((s) => s.playlists);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useStore((s) => s.removeTrackFromPlaylist);
  const enqueueTrack = useStore((s) => s.enqueueTrack);
  const [view, setView] = useState<"main" | "playlists">("main");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!track) return null;

  const toggleInPlaylist = (playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const index = pl.trackIds.indexOf(trackId);
    if (index >= 0) removeTrackFromPlaylist(playlistId, index);
    else addTrackToPlaylist(playlistId, trackId);
  };

  const style: React.CSSProperties = {
    top: Math.min(y, window.innerHeight - 220),
    left: Math.min(x, window.innerWidth - 230),
  };

  return createPortal(
    <div ref={menuRef} className="ctx-menu" style={style} role="menu">
      {view === "main" ? (
        <>
          <div className="ctx-menu__title">{track.title}</div>
          <button
            className="ctx-menu__item"
            onClick={() => setView("playlists")}
          >
            <Icon name="plus" size={13} /> {t("track.addToPlaylist")}
          </button>
          <button
            className="ctx-menu__item"
            onClick={() => {
              enqueueTrack(trackId);
              onAddedToQueue();
              onClose();
            }}
          >
            <Icon name="queue" size={13} /> {t("queue.add")}
          </button>
        </>
      ) : (
        <>
          <button
            className="ctx-menu__item ctx-menu__item--back"
            onClick={() => setView("main")}
          >
            <Icon name="chevronLeft" size={13} /> {t("common.back")}
          </button>
          <div className="ctx-menu__list">
            {playlists.map((pl) => {
              const has = pl.trackIds.includes(trackId);
              return (
                <button
                  key={pl.id}
                  className="ctx-menu__item"
                  onClick={() => toggleInPlaylist(pl.id)}
                >
                  <span
                    className={`ctx-menu__check${has ? " is-on" : ""}`}
                    aria-hidden
                  >
                    {has && <Icon name="check" size={10} />}
                  </span>
                  <span className="ctx-menu__name">{pl.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

function AddTrackForm({ playlistId }: { playlistId: string }) {
  const t = useT();
  const addLocalTracks = useStore((s) => s.addLocalTracks);
  const addYouTubeTrack = useStore((s) => s.addYouTubeTrack);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);
  const fileRef = useRef<HTMLInputElement>(null);

  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const ids = await addLocalTracks(files);
    ids.forEach((id) => addTrackToPlaylist(playlistId, id));
    if (fileRef.current) fileRef.current.value = "";
  };

  const onAddYouTube = () => {
    setError(null);
    const id = addYouTubeTrack(ytUrl, ytTitle);
    if (!id) {
      setError(t("music.invalidYt"));
      return;
    }
    addTrackToPlaylist(playlistId, id);
    setYtUrl("");
    setYtTitle("");
  };

  return (
    <div className="add-track">
      <div className="add-track__local">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          id={`file-${playlistId}`}
          hidden
          onChange={(e) => void onFiles(e.target.files)}
        />
        <label className="btn btn--ghost" htmlFor={`file-${playlistId}`}>
          {t("music.uploadMp3")}
        </label>
      </div>
      <div className="add-track__yt">
        <input
          type="text"
          placeholder={t("music.ytPlaceholder")}
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
        />
        <input
          type="text"
          placeholder={t("music.ytTitlePlaceholder")}
          value={ytTitle}
          onChange={(e) => setYtTitle(e.target.value)}
        />
        <button className="btn btn--ghost" onClick={onAddYouTube}>
          {t("music.addYt")}
        </button>
      </div>
      {error && <p className="add-track__error">{error}</p>}
    </div>
  );
}

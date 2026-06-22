import { useRef, useState } from "react";
import { useStore } from "../store/store";
import type { RepeatMode } from "../types";
import { useT } from "../lib/i18n";
import { EditableText } from "./common";

export function MusicSection() {
  const t = useT();
  const playlists = useStore((s) => s.playlists);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId =
    (selectedId && playlists.some((p) => p.id === selectedId) && selectedId) ||
    activePlaylistId ||
    playlists[0]?.id ||
    null;

  return (
    <section className="panel music">
      <div className="panel__head">
        <h2>🎵 {t("music.title")}</h2>
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

      <div className="music__body">
        <ul className="playlist-list">
          {playlists.length === 0 && (
            <li className="empty">{t("music.noPlaylists")}</li>
          )}
          {playlists.map((pl) => (
            <li key={pl.id}>
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

  const onRemoveTrack = (index: number) => {
    const trackId = playlist.trackIds[index];
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
            onClick={() => deletePlaylist(playlist.id)}
          >
            🗑
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
            >
              <span className="tracklist__grip" aria-hidden title="">
                ⠿
              </span>
              <button
                className="tracklist__play"
                onClick={() => void playPlaylist(playlist.id, index)}
                title={t("music.playThis")}
              >
                {isCurrent && status.playing ? "♪" : "▶"}
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
              <span className="tracklist__order">
                <button
                  className="icon-btn icon-btn--mini"
                  disabled={index === 0}
                  onClick={() =>
                    moveTrackInPlaylist(playlist.id, index, index - 1)
                  }
                >
                  ▲
                </button>
                <button
                  className="icon-btn icon-btn--mini"
                  disabled={index === playlist.trackIds.length - 1}
                  onClick={() =>
                    moveTrackInPlaylist(playlist.id, index, index + 1)
                  }
                >
                  ▼
                </button>
              </span>
              <button
                className="icon-btn icon-btn--mini"
                title={t("music.remove")}
                onClick={() => onRemoveTrack(index)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ol>

      <AddTrackForm playlistId={playlist.id} />
    </div>
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

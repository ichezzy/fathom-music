import { useRef, useState } from "react";
import { useStore } from "../store/store";
import type { RepeatMode } from "../types";
import { EditableText } from "./common";

export function MusicSection() {
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
        <h2>🎵 Musik</h2>
        <button
          className="btn btn--small"
          onClick={() => {
            const id = createPlaylist("Neue Playlist");
            setSelectedId(id);
          }}
        >
          + Playlist
        </button>
      </div>

      <div className="music__body">
        <ul className="playlist-list">
          {playlists.length === 0 && (
            <li className="empty">Noch keine Playlist.</li>
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
            <div className="empty empty--center">
              Erstelle eine Playlist, um Tracks hinzuzufügen.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlaylistDetail({ playlistId }: { playlistId: string }) {
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

  if (!playlist) return null;
  const isActive = activePlaylistId === playlist.id;

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
            ▶ Abspielen
          </button>
          <button
            className="icon-btn"
            title="Playlist löschen"
            onClick={() => deletePlaylist(playlist.id)}
          >
            🗑
          </button>
        </div>
      </div>

      <div className="modes">
        <div className="modes__group">
          <span className="modes__title">Loop Mode</span>
          <div className="seg">
            {(["off", "all", "one"] as RepeatMode[]).map((mode) => (
              <button
                key={mode}
                className={`seg__btn${playlist.repeat === mode ? " is-on" : ""}`}
                onClick={() => setRepeat(mode)}
              >
                {mode === "off" ? "Aus" : mode === "all" ? "Playlist" : "Track"}
              </button>
            ))}
          </div>
        </div>

        <div className="modes__group">
          <span className="modes__title">Transition Mode</span>
          <div className="modes__row">
            <button
              className={`toggle${playlist.crossfade ? " is-on" : ""}`}
              onClick={() =>
                updatePlaylist(playlist.id, { crossfade: !playlist.crossfade })
              }
            >
              <span className="toggle__dot" />
              {playlist.crossfade ? "Crossfade an" : "Hartschnitt"}
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
          <span className="modes__title">Shuffle</span>
          <button
            className={`toggle${playlist.shuffle ? " is-on" : ""}`}
            onClick={() =>
              updatePlaylist(playlist.id, { shuffle: !playlist.shuffle })
            }
          >
            <span className="toggle__dot" />
            {playlist.shuffle ? "An" : "Aus"}
          </button>
        </div>
      </div>

      <ol className="tracklist">
        {playlist.trackIds.length === 0 && (
          <li className="empty">Keine Tracks. Füge unten welche hinzu.</li>
        )}
        {playlist.trackIds.map((trackId, index) => {
          const track = tracks[trackId];
          if (!track) return null;
          const isCurrent = isActive && status.trackId === trackId;
          return (
            <li
              key={`${trackId}-${index}`}
              className={`tracklist__row${isCurrent ? " is-current" : ""}`}
            >
              <button
                className="tracklist__play"
                onClick={() => void playPlaylist(playlist.id, index)}
                title="Diesen Track abspielen"
              >
                {isCurrent && status.playing ? "♪" : "▶"}
              </button>
              <EditableText
                className="tracklist__title tracklist__title--editable"
                inputClassName="tracklist__title tracklist__title--input"
                value={track.title}
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
                title="Entfernen"
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
      setError("Ungültiger YouTube-Link.");
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
          ⬆ MP3 hochladen
        </label>
      </div>
      <div className="add-track__yt">
        <input
          type="text"
          placeholder="YouTube-Link einfügen…"
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
        />
        <input
          type="text"
          placeholder="Titel (optional)"
          value={ytTitle}
          onChange={(e) => setYtTitle(e.target.value)}
        />
        <button className="btn btn--ghost" onClick={onAddYouTube}>
          + YouTube
        </button>
      </div>
      {error && <p className="add-track__error">{error}</p>}
    </div>
  );
}

import { create } from "zustand";
import type {
  AmbientSound,
  MixerState,
  PersistedState,
  Playlist,
  RepeatMode,
  SoundEffect,
  Track,
} from "../types";
import { uid, parseYouTubeId } from "../lib/id";
import {
  deleteFile,
  loadState,
  pruneOrphanFiles,
  putFile,
  saveState,
} from "../lib/db";
import { MusicEngine, type MusicStatus } from "../audio/MusicEngine";
import { AmbientEngine } from "../audio/AmbientEngine";
import { SoundboardEngine } from "../audio/SoundboardEngine";

const STATE_VERSION = 1;

const DEFAULT_MIXER: MixerState = {
  master: 0.9,
  music: 0.8,
  ambient: 0.6,
  soundboard: 0.85,
};

const blankStatus: MusicStatus = {
  trackId: null,
  position: 0,
  playing: false,
  durationSec: 0,
  currentSec: 0,
};

interface StoreState extends PersistedState {
  // Runtime / non-persisted
  ready: boolean;
  music: MusicEngine | null;
  ambientEngine: AmbientEngine | null;
  soundboard_engine: SoundboardEngine | null;
  status: MusicStatus;
  activePlaylistId: string | null;
  ambientActiveIds: string[];

  // Lifecycle
  hydrate: () => Promise<void>;
  initEngines: (host: HTMLElement) => void;

  // Track / library
  addLocalTracks: (files: FileList | File[]) => Promise<string[]>;
  addYouTubeTrack: (url: string, title?: string) => string | null;
  renameTrack: (trackId: string, title: string) => void;
  deleteTrack: (trackId: string) => Promise<void>;

  // Playlists
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, index: number) => void;
  moveTrackInPlaylist: (playlistId: string, from: number, to: number) => void;
  updatePlaylist: (id: string, patch: Partial<Playlist>) => void;

  // Music transport
  playPlaylist: (playlistId: string, startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (sec: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleCrossfade: () => void;
  setCrossfadeSeconds: (sec: number) => void;
  toggleShuffle: () => void;

  // Ambient
  addAmbientLocal: (file: File, name: string, icon: string) => Promise<void>;
  addAmbientYouTube: (url: string, name: string, icon: string) => boolean;
  renameAmbient: (id: string, name: string) => void;
  deleteAmbient: (id: string) => Promise<void>;
  toggleAmbient: (id: string) => void;
  setAmbientVolume: (id: string, volume: number) => void;

  // Soundboard
  addEffect: (
    file: File,
    name: string,
    icon: string,
    color: string,
  ) => Promise<void>;
  renameEffect: (id: string, name: string) => void;
  deleteEffect: (id: string) => Promise<void>;
  setEffectVolume: (id: string, volume: number) => void;
  playEffect: (id: string) => void;

  // Mixer
  setMixer: (patch: Partial<MixerState>) => void;
}

let saveTimer: number | undefined;
function schedulePersist(get: () => StoreState): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const s = get();
    const snapshot: PersistedState = {
      version: STATE_VERSION,
      tracks: s.tracks,
      playlists: s.playlists,
      ambient: s.ambient,
      soundboard: s.soundboard,
      mixer: s.mixer,
    };
    void saveState(snapshot);
  }, 400);
}

function referencedFileIds(s: PersistedState): Set<string> {
  const ids = new Set<string>();
  for (const t of Object.values(s.tracks)) {
    if (t.source.kind === "local") ids.add(t.source.fileId);
  }
  for (const a of s.ambient) {
    if (a.source.kind === "local") ids.add(a.source.fileId);
  }
  for (const e of s.soundboard) ids.add(e.fileId);
  return ids;
}

function applyMixer(get: () => StoreState): void {
  const { mixer, music, ambientEngine, soundboard_engine } = get();
  music?.setOutputScale(mixer.master * mixer.music);
  ambientEngine?.setOutputScale(mixer.master * mixer.ambient);
  soundboard_engine?.setOutputScale(mixer.master * mixer.soundboard);
}

function settingsOf(pl: Playlist) {
  return {
    repeat: pl.repeat,
    crossfade: pl.crossfade,
    crossfadeSeconds: pl.crossfadeSeconds,
    shuffle: pl.shuffle,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  version: STATE_VERSION,
  tracks: {},
  playlists: [],
  ambient: [],
  soundboard: [],
  mixer: DEFAULT_MIXER,

  ready: false,
  music: null,
  ambientEngine: null,
  soundboard_engine: null,
  status: blankStatus,
  activePlaylistId: null,
  ambientActiveIds: [],

  hydrate: async () => {
    const saved = await loadState();
    if (saved) {
      set({
        tracks: saved.tracks ?? {},
        playlists: saved.playlists ?? [],
        ambient: saved.ambient ?? [],
        soundboard: saved.soundboard ?? [],
        mixer: { ...DEFAULT_MIXER, ...(saved.mixer ?? {}) },
      });
    }
    set({ ready: true });
  },

  initEngines: (host) => {
    if (get().music) return;
    const music = new MusicEngine(host, {
      onStatus: (status) => set({ status }),
    });
    const ambientEngine = new AmbientEngine(host, (ids) =>
      set({ ambientActiveIds: ids }),
    );
    const soundboard_engine = new SoundboardEngine();
    set({ music, ambientEngine, soundboard_engine });
    applyMixer(get);
  },

  addLocalTracks: async (files) => {
    const list = Array.from(files);
    const created: string[] = [];
    const newTracks: Record<string, Track> = {};
    for (const file of list) {
      const fileId = uid("file");
      await putFile(fileId, file);
      const id = uid("trk");
      newTracks[id] = {
        id,
        title: file.name.replace(/\.[^.]+$/, ""),
        source: { kind: "local", fileId, fileName: file.name },
      };
      created.push(id);
    }
    set((s) => ({ tracks: { ...s.tracks, ...newTracks } }));
    schedulePersist(get);
    return created;
  },

  addYouTubeTrack: (url, title) => {
    const videoId = parseYouTubeId(url);
    if (!videoId) return null;
    const id = uid("trk");
    const track: Track = {
      id,
      title: title?.trim() || `YouTube ${videoId}`,
      source: { kind: "youtube", videoId },
    };
    set((s) => ({ tracks: { ...s.tracks, [id]: track } }));
    schedulePersist(get);
    return id;
  },

  renameTrack: (trackId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((s) => {
      const existing = s.tracks[trackId];
      if (!existing) return s;
      return { tracks: { ...s.tracks, [trackId]: { ...existing, title: trimmed } } };
    });
    schedulePersist(get);
  },

  deleteTrack: async (trackId) => {
    const track = get().tracks[trackId];
    set((s) => {
      const tracks = { ...s.tracks };
      delete tracks[trackId];
      const playlists = s.playlists.map((pl) => ({
        ...pl,
        trackIds: pl.trackIds.filter((tid) => tid !== trackId),
      }));
      return { tracks, playlists };
    });
    if (track?.source.kind === "local") {
      const refs = referencedFileIds(get());
      if (!refs.has(track.source.fileId)) await deleteFile(track.source.fileId);
    }
    schedulePersist(get);
  },

  createPlaylist: (name) => {
    const id = uid("pl");
    const playlist: Playlist = {
      id,
      name: name.trim() || "Neue Playlist",
      trackIds: [],
      repeat: "all",
      crossfade: true,
      crossfadeSeconds: 4,
      shuffle: false,
    };
    set((s) => ({ playlists: [...s.playlists, playlist] }));
    schedulePersist(get);
    return id;
  },

  renamePlaylist: (id, name) => {
    set((s) => ({
      playlists: s.playlists.map((pl) =>
        pl.id === id ? { ...pl, name } : pl,
      ),
    }));
    schedulePersist(get);
  },

  deletePlaylist: (id) => {
    set((s) => ({
      playlists: s.playlists.filter((pl) => pl.id !== id),
      activePlaylistId: s.activePlaylistId === id ? null : s.activePlaylistId,
    }));
    schedulePersist(get);
  },

  addTrackToPlaylist: (playlistId, trackId) => {
    set((s) => ({
      playlists: s.playlists.map((pl) =>
        pl.id === playlistId
          ? { ...pl, trackIds: [...pl.trackIds, trackId] }
          : pl,
      ),
    }));
    syncActiveQueue(get);
    schedulePersist(get);
  },

  removeTrackFromPlaylist: (playlistId, index) => {
    set((s) => ({
      playlists: s.playlists.map((pl) =>
        pl.id === playlistId
          ? { ...pl, trackIds: pl.trackIds.filter((_, i) => i !== index) }
          : pl,
      ),
    }));
    syncActiveQueue(get);
    schedulePersist(get);
  },

  moveTrackInPlaylist: (playlistId, from, to) => {
    set((s) => ({
      playlists: s.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const trackIds = [...pl.trackIds];
        if (to < 0 || to >= trackIds.length) return pl;
        const [moved] = trackIds.splice(from, 1);
        trackIds.splice(to, 0, moved);
        return { ...pl, trackIds };
      }),
    }));
    syncActiveQueue(get);
    schedulePersist(get);
  },

  updatePlaylist: (id, patch) => {
    set((s) => ({
      playlists: s.playlists.map((pl) =>
        pl.id === id ? { ...pl, ...patch } : pl,
      ),
    }));
    if (get().activePlaylistId === id) {
      const pl = get().playlists.find((p) => p.id === id);
      if (pl) get().music?.updateSettings(settingsOf(pl));
    }
    schedulePersist(get);
  },

  playPlaylist: async (playlistId, startIndex = 0) => {
    const { playlists, tracks, music, soundboard_engine } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl || !music) return;
    void soundboard_engine?.unlock();
    const queue = pl.trackIds
      .map((tid) => tracks[tid])
      .filter((t): t is Track => Boolean(t));
    if (queue.length === 0) return;
    set({ activePlaylistId: playlistId });
    music.setQueue(queue, settingsOf(pl));
    await music.playPosition(Math.min(startIndex, queue.length - 1));
  },

  togglePlay: () => {
    void get().music?.togglePlay();
  },
  next: () => {
    void get().music?.next();
  },
  previous: () => {
    void get().music?.previous();
  },
  seek: (sec) => {
    get().music?.seek(sec);
  },

  setRepeat: (mode) => {
    const id = get().activePlaylistId;
    if (id) get().updatePlaylist(id, { repeat: mode });
    else get().music?.updateSettings({ repeat: mode });
  },
  toggleCrossfade: () => {
    const id = get().activePlaylistId;
    const pl = get().playlists.find((p) => p.id === id);
    if (id && pl) get().updatePlaylist(id, { crossfade: !pl.crossfade });
  },
  setCrossfadeSeconds: (sec) => {
    const id = get().activePlaylistId;
    if (id) get().updatePlaylist(id, { crossfadeSeconds: sec });
  },
  toggleShuffle: () => {
    const id = get().activePlaylistId;
    const pl = get().playlists.find((p) => p.id === id);
    if (id && pl) get().updatePlaylist(id, { shuffle: !pl.shuffle });
  },

  addAmbientLocal: async (file, name, icon) => {
    const fileId = uid("file");
    await putFile(fileId, file);
    const sound: AmbientSound = {
      id: uid("amb"),
      name: name.trim() || file.name,
      icon,
      source: { kind: "local", fileId, fileName: file.name },
      volume: 0.7,
    };
    set((s) => ({ ambient: [...s.ambient, sound] }));
    schedulePersist(get);
  },

  addAmbientYouTube: (url, name, icon) => {
    const videoId = parseYouTubeId(url);
    if (!videoId) return false;
    const sound: AmbientSound = {
      id: uid("amb"),
      name: name.trim() || `YouTube ${videoId}`,
      icon,
      source: { kind: "youtube", videoId },
      volume: 0.7,
    };
    set((s) => ({ ambient: [...s.ambient, sound] }));
    schedulePersist(get);
    return true;
  },

  renameAmbient: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      ambient: s.ambient.map((a) => (a.id === id ? { ...a, name: trimmed } : a)),
    }));
    schedulePersist(get);
  },

  deleteAmbient: async (id) => {
    const sound = get().ambient.find((a) => a.id === id);
    get().ambientEngine?.stop(id);
    set((s) => ({ ambient: s.ambient.filter((a) => a.id !== id) }));
    if (sound?.source.kind === "local") {
      const refs = referencedFileIds(get());
      if (!refs.has(sound.source.fileId)) await deleteFile(sound.source.fileId);
    }
    schedulePersist(get);
  },

  toggleAmbient: (id) => {
    const sound = get().ambient.find((a) => a.id === id);
    if (sound) void get().ambientEngine?.toggle(sound);
  },

  setAmbientVolume: (id, volume) => {
    set((s) => ({
      ambient: s.ambient.map((a) => (a.id === id ? { ...a, volume } : a)),
    }));
    get().ambientEngine?.setChannelVolume(id, volume);
    schedulePersist(get);
  },

  addEffect: async (file, name, icon, color) => {
    const fileId = uid("file");
    await putFile(fileId, file);
    const effect: SoundEffect = {
      id: uid("sfx"),
      name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
      icon,
      fileId,
      fileName: file.name,
      color,
      volume: 1,
    };
    set((s) => ({ soundboard: [...s.soundboard, effect] }));
    schedulePersist(get);
  },

  renameEffect: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      soundboard: s.soundboard.map((e) =>
        e.id === id ? { ...e, name: trimmed } : e,
      ),
    }));
    schedulePersist(get);
  },

  deleteEffect: async (id) => {
    const effect = get().soundboard.find((e) => e.id === id);
    set((s) => ({ soundboard: s.soundboard.filter((e) => e.id !== id) }));
    if (effect) {
      get().soundboard_engine?.forget(effect.fileId);
      const refs = referencedFileIds(get());
      if (!refs.has(effect.fileId)) await deleteFile(effect.fileId);
    }
    schedulePersist(get);
  },

  setEffectVolume: (id, volume) => {
    set((s) => ({
      soundboard: s.soundboard.map((e) =>
        e.id === id ? { ...e, volume } : e,
      ),
    }));
    schedulePersist(get);
  },

  playEffect: (id) => {
    const effect = get().soundboard.find((e) => e.id === id);
    if (effect) void get().soundboard_engine?.play(effect.fileId, effect.volume);
  },

  setMixer: (patch) => {
    set((s) => ({ mixer: { ...s.mixer, ...patch } }));
    applyMixer(get);
    schedulePersist(get);
  },
}));

/** Re-push the active playlist's queue to the engine after edits. */
function syncActiveQueue(get: () => StoreState): void {
  const { activePlaylistId, playlists, tracks, music } = get();
  if (!activePlaylistId || !music) return;
  const pl = playlists.find((p) => p.id === activePlaylistId);
  if (!pl) return;
  const queue = pl.trackIds
    .map((tid) => tracks[tid])
    .filter((t): t is Track => Boolean(t));
  music.setQueue(queue, settingsOf(pl));
}

/** Best-effort cleanup of unreferenced blobs; call occasionally. */
export async function prune(): Promise<void> {
  await pruneOrphanFiles(referencedFileIds(useStore.getState()));
}

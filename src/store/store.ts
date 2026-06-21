import { create } from "zustand";
import type {
  AmbientSound,
  AppSettings,
  EffectPlayback,
  Language,
  MixerState,
  PersistedState,
  Playlist,
  RepeatMode,
  SoundEffect,
  Track,
} from "../types";
import { uid, parseYouTubeId } from "../lib/id";
import {
  clearAllFiles,
  deleteFile,
  ensureMigrated,
  getAllFileRecords,
  loadState,
  pruneOrphanFiles,
  putFile,
  putRawFile,
  saveState,
} from "../lib/db";
import { MusicEngine, type MusicStatus } from "../audio/MusicEngine";
import { AmbientEngine } from "../audio/AmbientEngine";
import { SoundboardEngine } from "../audio/SoundboardEngine";

const STATE_VERSION = 2;
const BACKUP_MAGIC = "tavernloops-backup";

const DEFAULT_MIXER: MixerState = {
  master: 0.9,
  music: 0.8,
  ambient: 0.6,
  soundboard: 0.85,
};

const DEFAULT_SETTINGS: AppSettings = {
  language: "de",
};

const DEFAULT_PLAYBACK: EffectPlayback = { mode: "once" };

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
  soundboardLoopingIds: string[];

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
  setEffectPlayback: (id: string, playback: EffectPlayback) => void;
  deleteEffect: (id: string) => Promise<void>;
  setEffectVolume: (id: string, volume: number) => void;
  playEffect: (id: string) => void;

  // Mixer
  setMixer: (patch: Partial<MixerState>) => void;

  // Settings & backup
  setLanguage: (language: Language) => void;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<void>;
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
      settings: s.settings,
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
  settings: DEFAULT_SETTINGS,

  ready: false,
  music: null,
  ambientEngine: null,
  soundboard_engine: null,
  status: blankStatus,
  activePlaylistId: null,
  ambientActiveIds: [],
  soundboardLoopingIds: [],

  hydrate: async () => {
    // On desktop, copy any IndexedDB library from earlier versions into the
    // filesystem store on first launch. No-op on web or after the first run.
    await ensureMigrated();
    const saved = await loadState();
    if (saved) {
      set({
        tracks: saved.tracks ?? {},
        playlists: saved.playlists ?? [],
        ambient: saved.ambient ?? [],
        // Older saves predate per-effect playback; default it to one-shot.
        soundboard: (saved.soundboard ?? []).map((e) => ({
          ...e,
          playback: e.playback ?? DEFAULT_PLAYBACK,
        })),
        mixer: { ...DEFAULT_MIXER, ...(saved.mixer ?? {}) },
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
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
    const soundboard_engine = new SoundboardEngine((ids) =>
      set({ soundboardLoopingIds: ids }),
    );
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
      playback: DEFAULT_PLAYBACK,
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

  setEffectPlayback: (id, playback) => {
    set((s) => ({
      soundboard: s.soundboard.map((e) =>
        e.id === id ? { ...e, playback } : e,
      ),
    }));
    // If it was looping and is now one-shot (or vice versa), stop the loop.
    get().soundboard_engine?.stopLoop(id);
    schedulePersist(get);
  },

  deleteEffect: async (id) => {
    const effect = get().soundboard.find((e) => e.id === id);
    get().soundboard_engine?.stopLoop(id);
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
    const engine = get().soundboard_engine;
    if (!effect || !engine) return;
    if (effect.playback.mode === "interval") {
      // Tapping an interval pad toggles its loop on/off.
      if (engine.isLooping(id)) {
        engine.stopLoop(id);
      } else {
        engine.startLoop(
          id,
          effect.fileId,
          effect.volume,
          effect.playback.minSeconds,
          effect.playback.maxSeconds,
        );
      }
      return;
    }
    void engine.play(effect.fileId, effect.volume);
  },

  setMixer: (patch) => {
    set((s) => ({ mixer: { ...s.mixer, ...patch } }));
    applyMixer(get);
    schedulePersist(get);
  },

  setLanguage: (language) => {
    set((s) => ({ settings: { ...s.settings, language } }));
    schedulePersist(get);
  },

  exportBackup: async () => {
    const s = get();
    const files = await getAllFileRecords();
    const encoded = await Promise.all(
      files.map(async (f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        data: await blobToBase64(f.blob),
      })),
    );
    const payload = {
      magic: BACKUP_MAGIC,
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      state: {
        version: STATE_VERSION,
        tracks: s.tracks,
        playlists: s.playlists,
        ambient: s.ambient,
        soundboard: s.soundboard,
        mixer: s.mixer,
        settings: s.settings,
      } satisfies PersistedState,
      files: encoded,
    };
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `tavernloops-backup-${stamp}.json`);
  },

  importBackup: async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data?.magic !== BACKUP_MAGIC || !data.state) {
      throw new Error("invalid backup");
    }
    // Stop everything that might hold a file URL before swapping the data.
    get().music?.stop();
    get().ambientEngine?.stopAll();
    get().soundboard_engine?.stopAllLoops();

    await clearAllFiles();
    for (const f of data.files ?? []) {
      await putRawFile(f.id, base64ToBlob(f.data, f.type), f.name, f.type);
    }
    const state = data.state as PersistedState;
    await saveState({ ...state, version: STATE_VERSION });
    // Reload so engines and the store re-hydrate cleanly from the restore.
    window.location.reload();
  },
}));

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<type>;base64," prefix.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || "application/octet-stream" });
}

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

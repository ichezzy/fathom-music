import { create } from "zustand";
import type {
  AmbientSound,
  AppSettings,
  Campaign,
  CampaignData,
  EffectPlayback,
  Language,
  MixerState,
  PersistedState,
  Playlist,
  RepeatMode,
  SoundEffect,
  SoundGroup,
  Track,
} from "../types";
import { uid, parseYouTubeId } from "../lib/id";
import { desktop as desktopBridge } from "../lib/desktop";
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

const STATE_VERSION = 3;
const BACKUP_MAGIC = "tavernloops-backup";
const MAX_CAMPAIGNS = 4;
const DEFAULT_CAMPAIGN_NAME = "Standard";

const DEFAULT_MIXER: MixerState = {
  master: 0.9,
  music: 0.8,
  ambient: 0.6,
  soundboard: 0.85,
};

const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  autoOpenLastCampaign: false,
  audioOutputDeviceId: "",
  confirmBeforeDelete: true,
  minimizeToTray: false,
};

const DEFAULT_PLAYBACK: EffectPlayback = { mode: "once" };

const blankStatus: MusicStatus = {
  trackId: null,
  position: 0,
  playing: false,
  durationSec: 0,
  currentSec: 0,
  queue: [],
};

function makeCampaign(
  name: string,
  data?: Partial<CampaignData>,
  isDefault = false,
): Campaign {
  return {
    id: uid("camp"),
    name,
    isDefault,
    tracks: data?.tracks ?? {},
    playlists: data?.playlists ?? [],
    ambient: data?.ambient ?? [],
    soundboard: data?.soundboard ?? [],
    ambientGroups: data?.ambientGroups ?? [],
    soundboardGroups: data?.soundboardGroups ?? [],
  };
}

function normalizeCampaign(c: Partial<Campaign>): Campaign {
  return {
    id: c.id ?? uid("camp"),
    name: c.name ?? DEFAULT_CAMPAIGN_NAME,
    icon: c.icon,
    color: c.color,
    description: c.description,
    tags: c.tags,
    imageFileId: c.imageFileId,
    tracks: c.tracks ?? {},
    playlists: c.playlists ?? [],
    ambient: c.ambient ?? [],
    // Older saves predate per-effect playback; default it to one-shot.
    soundboard: (c.soundboard ?? []).map((e) => ({
      ...e,
      playback: e.playback ?? DEFAULT_PLAYBACK,
    })),
    ambientGroups: c.ambientGroups ?? [],
    soundboardGroups: c.soundboardGroups ?? [],
  };
}

/**
 * Coerce any persisted shape (v3 campaigns, v2 top-level library, or nothing)
 * into a campaign list + active id. Existing single-library saves become one
 * non-deletable "Standard" campaign so upgrading users see no change.
 */
function normalizeToCampaigns(saved: unknown): {
  campaigns: Campaign[];
  activeCampaignId: string;
} {
  const s = saved as Record<string, unknown> | null | undefined;

  if (s && Array.isArray(s.campaigns) && s.campaigns.length > 0) {
    const campaigns = (s.campaigns as Partial<Campaign>[]).map(normalizeCampaign);
    const savedActive = s.activeCampaignId as string | undefined;
    const activeCampaignId =
      savedActive && campaigns.some((c) => c.id === savedActive)
        ? savedActive
        : campaigns[0].id;
    return { campaigns, activeCampaignId };
  }

  // Upgrade a pre-campaigns single-library save into one campaign.
  if (s && (s.tracks || s.playlists || s.ambient || s.soundboard)) {
    const def = normalizeCampaign({
      name: DEFAULT_CAMPAIGN_NAME,
      tracks: s.tracks as CampaignData["tracks"],
      playlists: s.playlists as CampaignData["playlists"],
      ambient: s.ambient as CampaignData["ambient"],
      soundboard: s.soundboard as CampaignData["soundboard"],
    });
    return { campaigns: [def], activeCampaignId: def.id };
  }

  // Clean install: start with no campaigns — the user creates one from the menu.
  return { campaigns: [], activeCampaignId: "" };
}

interface StoreState {
  // Global persisted
  mixer: MixerState;
  settings: AppSettings;

  // Campaign registry. The active campaign's library is mirrored into the
  // top-level tracks/playlists/ambient/soundboard fields below so the existing
  // components keep working unchanged; the array is reconciled on persist and
  // on switch via foldActive().
  campaigns: Campaign[];
  activeCampaignId: string;

  // Active campaign's library (mirror of campaigns[activeCampaignId]).
  tracks: Record<string, Track>;
  playlists: Playlist[];
  ambient: AmbientSound[];
  soundboard: SoundEffect[];
  ambientGroups: SoundGroup[];
  soundboardGroups: SoundGroup[];

  // Runtime / non-persisted
  ready: boolean;
  music: MusicEngine | null;
  ambientEngine: AmbientEngine | null;
  soundboard_engine: SoundboardEngine | null;
  status: MusicStatus;
  activePlaylistId: string | null;
  ambientActiveIds: string[];
  soundboardLoopingIds: string[];
  /** Pending in-app confirmation (see src/lib/confirm.ts). */
  confirmRequest: { message: string; detail: string | null } | null;

  // Lifecycle
  hydrate: () => Promise<void>;
  initEngines: (host: HTMLElement) => void;

  // Navigation
  view: "menu" | "campaign";
  miniPlayer: boolean;
  setView: (view: "menu" | "campaign") => void;
  openCampaign: (id: string) => void;
  setMiniPlayer: (on: boolean) => void;
  // Cinematic transition between menu and campaign. "dive" plays over the menu
  // when opening a campaign (sink down into it); "surface" plays over the
  // campaign when leaving it (rise back up to the menu). transitionCampaignId
  // is the campaign whose artwork the overlay shows.
  transitionMode: "dive" | "surface" | null;
  transitionCampaignId: string | null;
  playerRevealing: boolean;
  beginCampaignTransition: (id: string) => void;
  endCampaignTransition: () => void;
  beginExitTransition: () => void;
  enterMenuBehind: () => void;
  endExitTransition: () => void;
  clearPlayerRevealing: () => void;

  // Campaigns
  createCampaign: (name: string, icon?: string, color?: string) => string | null;
  renameCampaign: (id: string, name: string) => void;
  updateCampaignMeta: (
    id: string,
    patch: Partial<
      Pick<
        Campaign,
        "name" | "description" | "tags" | "icon" | "color" | "imageFileId"
      >
    >,
  ) => void;
  deleteCampaign: (id: string) => Promise<void>;
  setActiveCampaign: (id: string) => void;

  // Track / library
  addLocalTracks: (files: FileList | File[]) => Promise<string[]>;
  addYouTubeTrack: (url: string, title?: string) => string | null;
  renameTrack: (trackId: string, title: string) => void;
  deleteTrack: (trackId: string) => Promise<void>;

  // Playlists
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  movePlaylist: (from: number, to: number) => void;
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

  // Play queue
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  /** Runtime-only: ambient / soundboard panels tucked away for a bigger
   * music view. Restore buttons live in the transport bar. */
  ambientMinimized: boolean;
  soundboardMinimized: boolean;
  setAmbientMinimized: (on: boolean) => void;
  setSoundboardMinimized: (on: boolean) => void;
  enqueueTrack: (trackId: string) => void;
  playTrackNext: (trackId: string) => void;
  removeFromQueue: (orderIndex: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpToQueueIndex: (orderIndex: number) => void;
  clearQueue: () => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleCrossfade: () => void;
  setCrossfadeSeconds: (sec: number) => void;
  toggleShuffle: () => void;

  // Ambient
  addAmbientLocal: (file: File, name: string, icon: string) => Promise<void>;
  addAmbientYouTube: (url: string, name: string, icon: string) => boolean;
  renameAmbient: (id: string, name: string) => void;
  deleteAmbient: (id: string) => Promise<void>;
  moveAmbient: (from: number, to: number) => void;
  toggleAmbient: (id: string) => void;
  setAmbientVolume: (id: string, volume: number) => void;
  // Ambient groups
  createAmbientGroup: (name: string) => string;
  renameAmbientGroup: (id: string, name: string) => void;
  deleteAmbientGroup: (id: string) => void;
  moveAmbientGroup: (from: number, to: number) => void;
  setAmbientGroup: (soundId: string, groupId: string | undefined) => void;

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
  moveEffect: (from: number, to: number) => void;
  setEffectVolume: (id: string, volume: number) => void;
  playEffect: (id: string) => void;
  // Soundboard groups
  createSoundboardGroup: (name: string) => string;
  renameSoundboardGroup: (id: string, name: string) => void;
  deleteSoundboardGroup: (id: string) => void;
  moveSoundboardGroup: (from: number, to: number) => void;
  setEffectGroup: (effectId: string, groupId: string | undefined) => void;

  // Mixer
  setMixer: (patch: Partial<MixerState>) => void;

  // Settings & backup
  setLanguage: (language: Language) => void;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setAudioOutputDevice: (deviceId: string) => Promise<void>;
  setHotkey: (action: string, code: string) => void;
  resetHotkeys: () => void;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<void>;
}

/** Immutable array move (out-of-range is a no-op). */
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** Campaign list with the active campaign refreshed from the live mirror. */
function foldActive(s: StoreState): Campaign[] {
  return s.campaigns.map((c) =>
    c.id === s.activeCampaignId
      ? {
          ...c,
          tracks: s.tracks,
          playlists: s.playlists,
          ambient: s.ambient,
          soundboard: s.soundboard,
          ambientGroups: s.ambientGroups,
          soundboardGroups: s.soundboardGroups,
        }
      : c,
  );
}

function snapshotOf(s: StoreState): PersistedState {
  return {
    version: STATE_VERSION,
    campaigns: foldActive(s),
    activeCampaignId: s.activeCampaignId,
    mixer: s.mixer,
    settings: s.settings,
  };
}

let saveTimer: number | undefined;
function schedulePersist(get: () => StoreState): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void saveState(snapshotOf(get()));
  }, 400);
}

/** Files referenced by ANY campaign — so pruning never deletes another
 * campaign's audio. */
function referencedFileIds(s: StoreState): Set<string> {
  const ids = new Set<string>();
  for (const c of foldActive(s)) {
    for (const t of Object.values(c.tracks)) {
      if (t.source.kind === "local") ids.add(t.source.fileId);
    }
    for (const a of c.ambient) {
      if (a.source.kind === "local") ids.add(a.source.fileId);
    }
    for (const e of c.soundboard) ids.add(e.fileId);
    if (c.imageFileId) ids.add(c.imageFileId);
  }
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
  mixer: DEFAULT_MIXER,
  settings: DEFAULT_SETTINGS,
  campaigns: [],
  activeCampaignId: "",
  tracks: {},
  playlists: [],
  ambient: [],
  soundboard: [],
  ambientGroups: [],
  soundboardGroups: [],

  ready: false,
  music: null,
  ambientEngine: null,
  soundboard_engine: null,
  status: blankStatus,
  activePlaylistId: null,
  ambientActiveIds: [],
  soundboardLoopingIds: [],
  confirmRequest: null,
  view: "menu",
  miniPlayer: false,
  transitionMode: null,
  transitionCampaignId: null,
  playerRevealing: false,
  queueOpen: false,
  ambientMinimized: false,
  soundboardMinimized: false,

  setView: (view) => set({ view }),
  openCampaign: (id) => {
    get().setActiveCampaign(id);
    set({ view: "campaign" });
  },
  beginCampaignTransition: (id) =>
    set({ transitionCampaignId: id, transitionMode: "dive" }),
  endCampaignTransition: () => {
    const id = get().transitionCampaignId;
    if (id) get().setActiveCampaign(id);
    set({
      view: "campaign",
      transitionCampaignId: null,
      transitionMode: null,
      playerRevealing: true,
    });
  },
  // Leaving a campaign: the view stays on the player while the overlay fades
  // in over it, then rises back up to the menu.
  beginExitTransition: () =>
    set({
      transitionCampaignId: get().activeCampaignId,
      transitionMode: "surface",
    }),
  // Swap the player out for the menu while the overlay is fully opaque, so the
  // switch is hidden and the menu is already in place when the overlay clears.
  enterMenuBehind: () => set({ view: "menu" }),
  endExitTransition: () =>
    set({ transitionCampaignId: null, transitionMode: null }),
  clearPlayerRevealing: () => set({ playerRevealing: false }),
  setMiniPlayer: (on) => {
    set({ miniPlayer: on });
    void desktopBridge?.setMiniPlayer(on);
  },

  hydrate: async () => {
    // On desktop, copy any IndexedDB library from earlier versions into the
    // filesystem store on first launch. No-op on web or after the first run.
    await ensureMigrated();
    const saved = await loadState();
    const { campaigns, activeCampaignId } = normalizeToCampaigns(saved);
    // May be null on a clean install (no campaigns yet).
    const active =
      campaigns.find((c) => c.id === activeCampaignId) ?? campaigns[0] ?? null;
    const savedRaw = saved as Partial<PersistedState> | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...(savedRaw?.settings ?? {}) };
    set({
      campaigns,
      activeCampaignId: active?.id ?? "",
      tracks: active?.tracks ?? {},
      playlists: active?.playlists ?? [],
      ambient: active?.ambient ?? [],
      soundboard: active?.soundboard ?? [],
      ambientGroups: active?.ambientGroups ?? [],
      soundboardGroups: active?.soundboardGroups ?? [],
      mixer: { ...DEFAULT_MIXER, ...(savedRaw?.mixer ?? {}) },
      settings,
      // Skip the menu and go straight back into the last campaign, if asked —
      // but never when there is no campaign to open.
      view: active && settings.autoOpenLastCampaign ? "campaign" : "menu",
      ready: true,
    });
    // Sync runtime-only flags into the main process (tray, etc.).
    void desktopBridge?.setTrayEnabled(settings.minimizeToTray);
    // If we just upgraded an older single-library save, write the v3 shape now
    // so the Standard campaign keeps a stable id from here on.
    const wasV3 = Array.isArray((saved as Partial<PersistedState>)?.campaigns);
    if (!wasV3) void saveState(snapshotOf(get()));
  },

  createCampaign: (name, icon, color) => {
    const s = get();
    if (s.campaigns.length >= MAX_CAMPAIGNS) return null;
    const campaign: Campaign = {
      ...makeCampaign(name.trim() || DEFAULT_CAMPAIGN_NAME),
      icon,
      color,
    };
    // Add without switching — the menu decides when to enter it.
    set({ campaigns: [...foldActive(s), campaign] });
    schedulePersist(get);
    return campaign.id;
  },

  renameCampaign: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, name: trimmed } : c,
      ),
    }));
    schedulePersist(get);
  },

  updateCampaignMeta: (id, patch) => {
    // An empty name would leave the card unlabeled; fall back to the old one.
    const name = patch.name?.trim();
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, ...patch, name: name || c.name } : c,
      ),
    }));
    schedulePersist(get);
  },

  deleteCampaign: async (id) => {
    const s = get();
    const target = s.campaigns.find((c) => c.id === id);
    if (!target) return;
    const remaining = foldActive(s).filter((c) => c.id !== id);

    if (id === s.activeCampaignId) {
      // Fall back to any remaining campaign, or to "no campaign" (menu) when
      // the last one is deleted.
      const fallback = remaining[0] ?? null;
      s.music?.stop();
      s.ambientEngine?.stopAll();
      s.soundboard_engine?.stopAllLoops();
      set({
        campaigns: remaining,
        activeCampaignId: fallback?.id ?? "",
        tracks: fallback?.tracks ?? {},
        playlists: fallback?.playlists ?? [],
        ambient: fallback?.ambient ?? [],
        soundboard: fallback?.soundboard ?? [],
        ambientGroups: fallback?.ambientGroups ?? [],
        soundboardGroups: fallback?.soundboardGroups ?? [],
        activePlaylistId: null,
        status: blankStatus,
        ambientActiveIds: [],
        soundboardLoopingIds: [],
      });
    } else {
      set({ campaigns: remaining });
    }
    schedulePersist(get);
    // Drop any audio files the deleted campaign exclusively referenced.
    await pruneOrphanFiles(referencedFileIds(get()));
  },

  setActiveCampaign: (id) => {
    const s = get();
    if (id === s.activeCampaignId) return;
    const campaigns = foldActive(s);
    const target = campaigns.find((c) => c.id === id);
    if (!target) return;
    s.music?.stop();
    s.ambientEngine?.stopAll();
    s.soundboard_engine?.stopAllLoops();
    set({
      campaigns,
      activeCampaignId: id,
      tracks: target.tracks,
      playlists: target.playlists,
      ambient: target.ambient,
      soundboard: target.soundboard,
      ambientGroups: target.ambientGroups,
      soundboardGroups: target.soundboardGroups,
      activePlaylistId: null,
      status: blankStatus,
      ambientActiveIds: [],
      soundboardLoopingIds: [],
    });
    schedulePersist(get);
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
    // Restore the saved audio output device, if any.
    const sink = get().settings.audioOutputDeviceId;
    if (sink) {
      void music.setSinkId(sink);
      void ambientEngine.setSinkId(sink);
      void soundboard_engine.setSinkId(sink);
    }
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

  movePlaylist: (from, to) => {
    set((s) => ({ playlists: arrayMove(s.playlists, from, to) }));
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

  setQueueOpen: (open) => set({ queueOpen: open }),
  setAmbientMinimized: (on) => set({ ambientMinimized: on }),
  setSoundboardMinimized: (on) => set({ soundboardMinimized: on }),
  enqueueTrack: (trackId) => {
    const track = get().tracks[trackId];
    const music = get().music;
    if (!track || !music) return;
    void get().soundboard_engine?.unlock();
    const wasEmpty = get().status.queue.length === 0;
    music.enqueue(track);
    if (wasEmpty) void music.playPosition(0);
  },
  playTrackNext: (trackId) => {
    const track = get().tracks[trackId];
    const music = get().music;
    if (!track || !music) return;
    void get().soundboard_engine?.unlock();
    const wasEmpty = get().status.queue.length === 0;
    music.enqueueNext(track);
    if (wasEmpty) void music.playPosition(0);
  },
  removeFromQueue: (orderIndex) => get().music?.removeFromQueue(orderIndex),
  moveInQueue: (from, to) => get().music?.moveInQueue(from, to),
  jumpToQueueIndex: (orderIndex) => void get().music?.playPosition(orderIndex),
  clearQueue: () => get().music?.clearUpcoming(),

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

  moveAmbient: (from, to) => {
    set((s) => ({ ambient: arrayMove(s.ambient, from, to) }));
    schedulePersist(get);
  },

  createAmbientGroup: (name) => {
    const group: SoundGroup = { id: uid("agrp"), name: name.trim() || "Gruppe" };
    set((s) => ({ ambientGroups: [...s.ambientGroups, group] }));
    schedulePersist(get);
    return group.id;
  },
  renameAmbientGroup: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      ambientGroups: s.ambientGroups.map((g) =>
        g.id === id ? { ...g, name: trimmed } : g,
      ),
    }));
    schedulePersist(get);
  },
  deleteAmbientGroup: (id) => {
    set((s) => ({
      ambientGroups: s.ambientGroups.filter((g) => g.id !== id),
      // Its sounds fall back to ungrouped.
      ambient: s.ambient.map((a) =>
        a.groupId === id ? { ...a, groupId: undefined } : a,
      ),
    }));
    schedulePersist(get);
  },
  moveAmbientGroup: (from, to) => {
    set((s) => ({ ambientGroups: arrayMove(s.ambientGroups, from, to) }));
    schedulePersist(get);
  },
  setAmbientGroup: (soundId, groupId) => {
    set((s) => ({
      ambient: s.ambient.map((a) =>
        a.id === soundId ? { ...a, groupId } : a,
      ),
    }));
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

  moveEffect: (from, to) => {
    set((s) => ({ soundboard: arrayMove(s.soundboard, from, to) }));
    schedulePersist(get);
  },

  createSoundboardGroup: (name) => {
    const group: SoundGroup = { id: uid("sgrp"), name: name.trim() || "Gruppe" };
    set((s) => ({ soundboardGroups: [...s.soundboardGroups, group] }));
    schedulePersist(get);
    return group.id;
  },
  renameSoundboardGroup: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      soundboardGroups: s.soundboardGroups.map((g) =>
        g.id === id ? { ...g, name: trimmed } : g,
      ),
    }));
    schedulePersist(get);
  },
  deleteSoundboardGroup: (id) => {
    set((s) => ({
      soundboardGroups: s.soundboardGroups.filter((g) => g.id !== id),
      soundboard: s.soundboard.map((e) =>
        e.groupId === id ? { ...e, groupId: undefined } : e,
      ),
    }));
    schedulePersist(get);
  },
  moveSoundboardGroup: (from, to) => {
    set((s) => ({ soundboardGroups: arrayMove(s.soundboardGroups, from, to) }));
    schedulePersist(get);
  },
  setEffectGroup: (effectId, groupId) => {
    set((s) => ({
      soundboard: s.soundboard.map((e) =>
        e.id === effectId ? { ...e, groupId } : e,
      ),
    }));
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

  setSetting: (key, value) => {
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
    if (key === "minimizeToTray") {
      void desktopBridge?.setTrayEnabled(value as boolean);
    }
    schedulePersist(get);
  },

  setAudioOutputDevice: async (deviceId) => {
    set((s) => ({
      settings: { ...s.settings, audioOutputDeviceId: deviceId },
    }));
    const { music, ambientEngine, soundboard_engine } = get();
    await Promise.all([
      music?.setSinkId(deviceId),
      ambientEngine?.setSinkId(deviceId),
      soundboard_engine?.setSinkId(deviceId),
    ]);
    schedulePersist(get);
  },

  setHotkey: (action, code) => {
    set((s) => ({
      settings: {
        ...s.settings,
        hotkeys: { ...(s.settings.hotkeys ?? {}), [action]: code },
      },
    }));
    schedulePersist(get);
  },

  resetHotkeys: () => {
    set((s) => ({ settings: { ...s.settings, hotkeys: {} } }));
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
      backupVersion: 2,
      exportedAt: new Date().toISOString(),
      state: snapshotOf(s),
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
    // Save the backup's state as-is; hydrate normalizes older shapes (a v1
    // backup with a single top-level library becomes a Standard campaign).
    await saveState(data.state as PersistedState);
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

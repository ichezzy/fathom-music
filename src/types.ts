export type SourceKind = "local" | "youtube";

/** Where the audio for a track / sound comes from. */
export type AudioSource =
  | { kind: "local"; fileId: string; fileName: string }
  | { kind: "youtube"; videoId: string };

export interface Track {
  id: string;
  title: string;
  source: AudioSource;
  /** Optional per-track gain trim in dB-ish 0..1 multiplier. */
  gain?: number;
}

/**
 * Loop behaviour for the current track. Playlists/queues always continue and
 * restart on their own, so there is no "loop the whole playlist" mode.
 *   off  – no track repeat (playlist plays through and auto-restarts)
 *   one  – repeat the current track forever
 *   once – repeat the current track one extra time, then continue
 */
export type RepeatMode = "off" | "one" | "once";

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  /** Loop Mode. */
  repeat: RepeatMode;
  /** Transition Mode: crossfade between tracks. */
  crossfade: boolean;
  crossfadeSeconds: number;
  shuffle: boolean;
}

/** A named section that ambient sounds / soundboard effects can be filed under. */
export interface SoundGroup {
  id: string;
  name: string;
}

/** A long, looping background bed (cave, rain, tavern crowd, ...). */
export interface AmbientSound {
  id: string;
  name: string;
  /** Emoji or short glyph shown on the tile. */
  icon: string;
  source: AudioSource;
  /** Persisted per-channel volume 0..1. */
  volume: number;
  /** Group this sound belongs to; undefined = ungrouped. */
  groupId?: string;
}

/** A short one-shot effect on the soundboard. */
export interface SoundEffect {
  id: string;
  name: string;
  icon: string;
  /** Soundboard effects are always local (short, low-latency). */
  fileId: string;
  fileName: string;
  /** Tile accent color. */
  color: string;
  volume: number;
  /** How the pad behaves when triggered. */
  playback: EffectPlayback;
  /** Group this effect belongs to; undefined = ungrouped. */
  groupId?: string;
}

/**
 * Soundboard trigger behaviour. `once` fires a single shot. `interval` keeps
 * re-firing while armed; with min === max it's a fixed cadence, otherwise a
 * random delay in [minSeconds, maxSeconds] between shots (e.g. a wolf howl
 * every 30–60s).
 */
export type EffectPlayback =
  | { mode: "once" }
  | { mode: "interval"; minSeconds: number; maxSeconds: number };

export type Language = "en" | "de" | "fr" | "es" | "it";

export interface AppSettings {
  language: Language;
  /** On launch, jump straight back into the previously active campaign
   * instead of showing the main menu. */
  autoOpenLastCampaign: boolean;
  /** `MediaDeviceInfo.deviceId` for output; "" means the system default. */
  audioOutputDeviceId: string;
  /** User overrides for hotkey bindings (KeyboardEvent.code per action id).
   * Missing entries use the built-in defaults from src/lib/hotkeys.ts. */
  hotkeys?: Record<string, string>;
  /** Ask for confirmation before deleting tracks/sounds/effects/playlists. */
  confirmBeforeDelete: boolean;
  /** Show a tray icon and hide the window on close instead of quitting. */
  minimizeToTray: boolean;
  /** Skip the cinematic dive/surface animation when entering/leaving a
   * campaign and switch instantly instead. */
  disableTransitionAnimation: boolean;
  /** Allow the same soundboard effect to play multiple times at once. When
   * off (default), a pad is ignored while its effect is still playing. */
  allowEffectLayering: boolean;
}

export interface MixerState {
  master: number;
  music: number;
  ambient: number;
  soundboard: number;
}

/** The per-campaign library: everything that differs between campaigns. */
export interface CampaignData {
  tracks: Record<string, Track>;
  playlists: Playlist[];
  ambient: AmbientSound[];
  soundboard: SoundEffect[];
  /** Optional named sections for the ambient / soundboard grids. */
  ambientGroups: SoundGroup[];
  soundboardGroups: SoundGroup[];
}

/** A named profile (e.g. "Standard", "Curse of Strahd") with its own library. */
export interface Campaign extends CampaignData {
  id: string;
  name: string;
  /** Emoji shown on the campaign card. */
  icon?: string;
  /** Accent color for the campaign card. */
  color?: string;
  /** Short flavor text shown on the campaign card. */
  description?: string;
  /** Atmosphere tags shown as chips on the campaign card. */
  tags?: string[];
  /** Stored file id of an uploaded card background image. */
  imageFileId?: string;
  /** The Standard campaign can't be deleted, so there's always a fallback. */
  isDefault?: boolean;
}

export interface PersistedState {
  version: number;
  campaigns: Campaign[];
  activeCampaignId: string;
  /** Mixer and settings are global — shared across all campaigns. */
  mixer: MixerState;
  settings: AppSettings;
}

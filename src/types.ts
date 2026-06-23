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

export type RepeatMode = "off" | "all" | "one";

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

/** A long, looping background bed (cave, rain, tavern crowd, ...). */
export interface AmbientSound {
  id: string;
  name: string;
  /** Emoji or short glyph shown on the tile. */
  icon: string;
  source: AudioSource;
  /** Persisted per-channel volume 0..1. */
  volume: number;
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
}

/** A named profile (e.g. "Standard", "Curse of Strahd") with its own library. */
export interface Campaign extends CampaignData {
  id: string;
  name: string;
  /** Emoji shown on the campaign card. */
  icon?: string;
  /** Accent color for the campaign card. */
  color?: string;
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

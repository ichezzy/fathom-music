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
}

export interface MixerState {
  master: number;
  music: number;
  ambient: number;
  soundboard: number;
}

export interface PersistedState {
  version: number;
  tracks: Record<string, Track>;
  playlists: Playlist[];
  ambient: AmbientSound[];
  soundboard: SoundEffect[];
  mixer: MixerState;
}

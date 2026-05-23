import type { RepeatMode, Track } from "../types";
import { Deck } from "./Deck";
import { rampValue } from "./ramp";

export interface MusicStatus {
  trackId: string | null;
  position: number;
  playing: boolean;
  durationSec: number;
  currentSec: number;
}

export interface MusicEngineCallbacks {
  onStatus?: (status: MusicStatus) => void;
}

export interface MusicSettings {
  repeat: RepeatMode;
  crossfade: boolean;
  crossfadeSeconds: number;
  shuffle: boolean;
}

const DEFAULT_SETTINGS: MusicSettings = {
  repeat: "off",
  crossfade: true,
  crossfadeSeconds: 4,
  shuffle: false,
};

/** Drives music playback across two decks so tracks can crossfade. */
export class MusicEngine {
  private deckA: Deck;
  private deckB: Deck;
  private active: "a" | "b" = "a";

  private tracks: Track[] = [];
  /** Playback order over `tracks` indices (respects shuffle). */
  private order: number[] = [];
  private position = 0;

  private playing = false;
  private currentSec = 0;
  private durationSec = 0;
  private crossfadeArmed = false;
  private transitioning = false;

  private outputScale = 1;
  private settings: MusicSettings = { ...DEFAULT_SETTINGS };

  constructor(
    host: HTMLElement,
    private cb: MusicEngineCallbacks = {},
  ) {
    this.deckA = new Deck(host, this.deckCallbacks("a"));
    this.deckB = new Deck(host, this.deckCallbacks("b"));
  }

  private deckCallbacks(id: "a" | "b") {
    return {
      onProgress: (cur: number, dur: number) => {
        if (this.active !== id) return;
        this.currentSec = cur;
        this.durationSec = dur || this.durationSec;
        this.maybeArmCrossfade();
        this.emit();
      },
      onLoaded: (dur: number) => {
        if (this.active !== id) return;
        this.durationSec = dur;
        this.emit();
      },
      onEnded: () => {
        if (this.active !== id) return;
        this.handleEnded();
      },
      onPlayingChange: (p: boolean) => {
        if (this.active !== id) return;
        this.playing = p;
        this.emit();
      },
    };
  }

  private get activeDeck(): Deck {
    return this.active === "a" ? this.deckA : this.deckB;
  }
  private get idleDeck(): Deck {
    return this.active === "a" ? this.deckB : this.deckA;
  }

  private currentTrack(): Track | null {
    const idx = this.order[this.position];
    return idx === undefined ? null : (this.tracks[idx] ?? null);
  }

  private emit(): void {
    this.cb.onStatus?.({
      trackId: this.currentTrack()?.id ?? null,
      position: this.position,
      playing: this.playing,
      durationSec: this.durationSec,
      currentSec: this.currentSec,
    });
  }

  setOutputScale(scale: number): void {
    this.outputScale = scale;
    this.deckA.setOutputScale(scale);
    this.deckB.setOutputScale(scale);
  }

  updateSettings(partial: Partial<MusicSettings>): void {
    const prevShuffle = this.settings.shuffle;
    this.settings = { ...this.settings, ...partial };
    if (partial.repeat !== undefined) {
      this.activeDeck.setLoop(this.settings.repeat === "one");
    }
    if (partial.shuffle !== undefined && partial.shuffle !== prevShuffle) {
      this.rebuildOrder(true);
    }
  }

  getSettings(): MusicSettings {
    return { ...this.settings };
  }

  /** Load a queue of tracks and the playback settings for it. */
  setQueue(tracks: Track[], settings: MusicSettings): void {
    const prevTrackId = this.currentTrack()?.id ?? null;
    this.tracks = tracks;
    this.settings = { ...settings };
    this.rebuildOrder(false);
    // Keep the pointer on the currently playing track if it survived the edit.
    this.position = 0;
    if (prevTrackId) {
      const queueIndex = this.tracks.findIndex((t) => t.id === prevTrackId);
      if (queueIndex >= 0) {
        const pos = this.order.indexOf(queueIndex);
        if (pos >= 0) this.position = pos;
      }
    }
    this.emit();
  }

  private rebuildOrder(keepCurrent: boolean): void {
    const currentQueueIndex = keepCurrent ? this.order[this.position] : undefined;
    const indices = this.tracks.map((_, i) => i);
    if (this.settings.shuffle) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }
    this.order = indices;
    if (currentQueueIndex !== undefined) {
      const newPos = this.order.indexOf(currentQueueIndex);
      if (newPos >= 0) this.position = newPos;
    }
  }

  /** Start playing a specific position in the current order (hard cut). */
  async playPosition(position: number): Promise<void> {
    if (position < 0 || position >= this.order.length) return;
    const wasPlaying = this.playing && this.activeDeck.currentMode !== "idle";
    await this.transitionTo(
      position,
      wasPlaying && this.settings.crossfade
        ? this.settings.crossfadeSeconds * 1000
        : 0,
    );
  }

  private async transitionTo(position: number, fadeMs: number): Promise<void> {
    const idx = this.order[position];
    const track = this.tracks[idx];
    if (!track) return;

    this.transitioning = true;
    const incoming = this.idleDeck;
    const outgoing = this.activeDeck;

    await incoming.load(track.source, {
      loop: this.settings.repeat === "one",
    });
    incoming.setOutputScale(this.outputScale);
    incoming.setFade(fadeMs > 0 ? 0 : 1);
    incoming.play();

    // Swap active immediately so progress/UI follows the incoming track.
    this.active = this.active === "a" ? "b" : "a";
    this.position = position;
    this.currentSec = 0;
    this.durationSec = incoming.getDuration();
    this.crossfadeArmed = false;
    this.playing = true;
    this.emit();

    if (fadeMs > 0) {
      const startFade = outgoing.getFade();
      rampValue({
        from: 0,
        to: 1,
        durationMs: fadeMs,
        onUpdate: (v) => incoming.setFade(v),
      });
      rampValue({
        from: startFade,
        to: 0,
        durationMs: fadeMs,
        onUpdate: (v) => outgoing.setFade(v),
        onDone: () => {
          outgoing.stop();
          this.transitioning = false;
        },
      });
    } else {
      outgoing.stop();
      this.transitioning = false;
    }
  }

  private maybeArmCrossfade(): void {
    if (!this.settings.crossfade || this.crossfadeArmed || this.transitioning) {
      return;
    }
    if (this.settings.repeat === "one") return;
    if (this.durationSec <= 0) return;

    const remaining = this.durationSec - this.currentSec;
    const cf = this.settings.crossfadeSeconds;
    if (remaining > 0 && remaining <= cf) {
      const nextPos = this.naturalNextPosition();
      if (nextPos !== null) {
        this.crossfadeArmed = true;
        void this.transitionTo(nextPos, Math.min(cf, remaining) * 1000);
      }
    }
  }

  private handleEnded(): void {
    if (this.transitioning) return;
    const nextPos = this.naturalNextPosition();
    if (nextPos === null) {
      this.playing = false;
      this.activeDeck.stop();
      this.emit();
      return;
    }
    void this.transitionTo(nextPos, 0);
  }

  private naturalNextPosition(): number | null {
    const n = this.order.length;
    if (n === 0) return null;
    if (this.position < n - 1) return this.position + 1;
    return this.settings.repeat === "all" ? 0 : null;
  }

  async next(): Promise<void> {
    const n = this.order.length;
    if (n === 0) return;
    const nextPos = this.position < n - 1 ? this.position + 1 : 0;
    await this.playPosition(nextPos);
  }

  async previous(): Promise<void> {
    const n = this.order.length;
    if (n === 0) return;
    // Restart current track if we are more than 3s in.
    if (this.currentSec > 3) {
      this.activeDeck.seek(0);
      return;
    }
    const prevPos = this.position > 0 ? this.position - 1 : n - 1;
    await this.playPosition(prevPos);
  }

  async togglePlay(): Promise<void> {
    if (this.activeDeck.currentMode === "idle") {
      if (this.order.length > 0) await this.playPosition(this.position);
      return;
    }
    if (this.playing) {
      this.activeDeck.pause();
    } else {
      this.activeDeck.play();
    }
  }

  pause(): void {
    if (this.playing) this.activeDeck.pause();
  }

  stop(): void {
    this.deckA.stop();
    this.deckB.stop();
    this.playing = false;
    this.currentSec = 0;
    this.emit();
  }

  seek(seconds: number): void {
    this.activeDeck.seek(seconds);
    this.currentSec = seconds;
    this.emit();
  }

  destroy(): void {
    this.deckA.destroy();
    this.deckB.destroy();
  }
}

import type { AudioSource } from "../types";
import { getFileUrl } from "../lib/db";
import { loadYouTubeApi } from "../lib/youtube";

type Mode = "idle" | "audio" | "youtube";

export interface DeckCallbacks {
  onEnded?: () => void;
  onProgress?: (currentSec: number, durationSec: number) => void;
  onLoaded?: (durationSec: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

/**
 * A single playback channel. It owns one <audio> element and one (lazily
 * created) YouTube player, and exposes a unified control surface so the
 * music engine can crossfade between any two sources regardless of type.
 *
 * `fade` (0..1) is the crossfade gain set by the engine; `outputScale`
 * is the mixer (layer * master) multiplier. The real element volume is the
 * product of the two.
 */
export class Deck {
  private mode: Mode = "idle";
  private audio: HTMLAudioElement;
  private ytHost: HTMLDivElement;
  private yt: YT.Player | null = null;
  private ytReady = false;
  private ytPollTimer: number | null = null;
  private loop = false;

  private fade = 0;
  private outputScale = 1;

  constructor(
    private hostContainer: HTMLElement,
    private cb: DeckCallbacks = {},
  ) {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.crossOrigin = "anonymous";
    this.audio.addEventListener("ended", () => {
      if (this.mode === "audio" && !this.loop) this.cb.onEnded?.();
    });
    this.audio.addEventListener("timeupdate", () => {
      if (this.mode === "audio") {
        this.cb.onProgress?.(this.audio.currentTime, this.audio.duration || 0);
      }
    });
    this.audio.addEventListener("loadedmetadata", () => {
      if (this.mode === "audio") this.cb.onLoaded?.(this.audio.duration || 0);
    });
    this.audio.addEventListener("play", () => {
      if (this.mode === "audio") this.cb.onPlayingChange?.(true);
    });
    this.audio.addEventListener("pause", () => {
      if (this.mode === "audio") this.cb.onPlayingChange?.(false);
    });

    this.ytHost = document.createElement("div");
    this.ytHost.style.display = "none";
    this.hostContainer.appendChild(this.ytHost);
  }

  get currentMode(): Mode {
    return this.mode;
  }

  setFade(value: number): void {
    this.fade = clamp01(value);
    this.applyVolume();
  }

  getFade(): number {
    return this.fade;
  }

  setOutputScale(value: number): void {
    this.outputScale = clamp01(value);
    this.applyVolume();
  }

  /**
   * Route the deck's local audio element to a specific output device
   * (`""` = system default). The YouTube iframe is a cross-origin frame we
   * can't reach, so its audio keeps going to the OS default — that's a
   * platform limitation, not a bug in this method.
   */
  async setSinkId(deviceId: string): Promise<void> {
    const audio = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof audio.setSinkId === "function") {
      try {
        await audio.setSinkId(deviceId);
      } catch {
        // unsupported device id or permission denied — fall back silently
      }
    }
  }

  private applyVolume(): void {
    const v = clamp01(this.fade * this.outputScale);
    if (this.mode === "audio") {
      this.audio.volume = v;
    } else if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.setVolume(Math.round(v * 100));
      } catch {
        /* player not ready yet */
      }
    }
  }

  async load(source: AudioSource, opts: { loop: boolean }): Promise<void> {
    this.loop = opts.loop;
    this.stopPolling();

    if (source.kind === "local") {
      this.teardownYouTubePlayback();
      const url = await getFileUrl(source.fileId);
      this.mode = "audio";
      this.audio.loop = opts.loop;
      this.audio.src = url ?? "";
      this.audio.currentTime = 0;
      this.applyVolume();
      return;
    }

    // YouTube
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.mode = "youtube";
    await this.ensureYouTubePlayer();
    this.ytReady = false;
    // loadVideoById both cues and starts playback; combined with the
    // app-level autoplay-policy switch this fires reliably even after the
    // original user gesture has been consumed by async loading.
    this.yt?.loadVideoById(source.videoId);
    this.applyVolume();
  }

  private async ensureYouTubePlayer(): Promise<void> {
    if (this.yt) return;
    const api = await loadYouTubeApi();
    await new Promise<void>((resolve) => {
      this.yt = new api.Player(this.ytHost, {
        height: "180",
        width: "320",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          // Pin the postMessage origin so the IFrame API handshake works
          // reliably inside the packaged app (served from http://127.0.0.1).
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.applyVolume();
            resolve();
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (this.mode !== "youtube") return;
            if (e.data === api.PlayerState.PLAYING) {
              this.ytReady = true;
              this.applyVolume();
              this.cb.onPlayingChange?.(true);
              this.startPolling();
            } else if (e.data === api.PlayerState.PAUSED) {
              this.cb.onPlayingChange?.(false);
            } else if (e.data === api.PlayerState.ENDED) {
              if (this.loop) {
                this.yt?.seekTo(0, true);
                this.yt?.playVideo();
              } else {
                this.cb.onPlayingChange?.(false);
                this.cb.onEnded?.();
              }
            }
          },
        },
      });
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.ytPollTimer = window.setInterval(() => {
      if (this.mode !== "youtube" || !this.yt) return;
      try {
        const cur = this.yt.getCurrentTime();
        const dur = this.yt.getDuration();
        this.cb.onProgress?.(cur, dur);
      } catch {
        /* ignore */
      }
    }, 250);
  }

  private stopPolling(): void {
    if (this.ytPollTimer !== null) {
      window.clearInterval(this.ytPollTimer);
      this.ytPollTimer = null;
    }
  }

  private teardownYouTubePlayback(): void {
    this.stopPolling();
    if (this.yt && this.ytReady) {
      try {
        this.yt.stopVideo();
      } catch {
        /* ignore */
      }
    }
  }

  play(): void {
    if (this.mode === "audio") {
      void this.audio.play().catch(() => {});
    } else if (this.mode === "youtube" && this.yt) {
      try {
        this.yt.playVideo();
      } catch {
        /* ignore */
      }
    }
  }

  pause(): void {
    if (this.mode === "audio") {
      this.audio.pause();
    } else if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.pauseVideo();
      } catch {
        /* ignore */
      }
    }
  }

  stop(): void {
    this.stopPolling();
    if (this.mode === "audio") {
      this.audio.pause();
      this.audio.currentTime = 0;
    } else if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.stopVideo();
      } catch {
        /* ignore */
      }
    }
    this.cb.onPlayingChange?.(false);
  }

  seek(seconds: number): void {
    if (this.mode === "audio") {
      this.audio.currentTime = seconds;
    } else if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.seekTo(seconds, true);
      } catch {
        /* ignore */
      }
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.mode === "audio") this.audio.loop = loop;
  }

  getDuration(): number {
    if (this.mode === "audio") return this.audio.duration || 0;
    if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        return this.yt.getDuration();
      } catch {
        return 0;
      }
    }
    return 0;
  }

  getCurrentTime(): number {
    if (this.mode === "audio") return this.audio.currentTime;
    if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        return this.yt.getCurrentTime();
      } catch {
        return 0;
      }
    }
    return 0;
  }

  isPlaying(): boolean {
    if (this.mode === "audio") return !this.audio.paused;
    if (this.mode === "youtube" && this.yt && this.ytReady) {
      try {
        return this.yt.getPlayerState() === 1; // PLAYING
      } catch {
        return false;
      }
    }
    return false;
  }

  destroy(): void {
    this.stopPolling();
    this.audio.pause();
    this.audio.removeAttribute("src");
    if (this.yt) {
      try {
        this.yt.destroy();
      } catch {
        /* ignore */
      }
      this.yt = null;
    }
    this.ytHost.remove();
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

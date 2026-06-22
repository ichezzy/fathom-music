import { getFileBlob } from "../lib/db";

/**
 * Low-latency one-shot player for soundboard effects. Files are decoded once
 * into AudioBuffers and replayed through the Web Audio graph, so repeated /
 * overlapping triggers stay tight.
 *
 * It can also re-fire an effect on a fixed or random interval (e.g. a wolf
 * howl every 30–60s) until stopped.
 */
export class SoundboardEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private outputScale = 1;
  private sinkId = "";

  /** Active interval loops, keyed by effect id. */
  private loops = new Map<string, number>();

  constructor(private onLoopingChange: (ids: string[]) => void = () => {}) {}

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.outputScale;
      this.master.connect(this.ctx.destination);
      if (this.sinkId) void this.applySinkIdToContext();
    }
    return this.ctx;
  }

  private async applySinkIdToContext(): Promise<void> {
    const ctx = this.ctx as
      | (AudioContext & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!ctx || typeof ctx.setSinkId !== "function") return;
    try {
      await ctx.setSinkId(this.sinkId);
    } catch {
      // older Chromium without AudioContext.setSinkId, or invalid id
    }
  }

  async setSinkId(deviceId: string): Promise<void> {
    this.sinkId = deviceId;
    await this.applySinkIdToContext();
  }

  setOutputScale(scale: number): void {
    this.outputScale = scale;
    if (this.master) this.master.gain.value = scale;
  }

  /** Resume the context after a user gesture (browser autoplay policy). */
  async unlock(): Promise<void> {
    const ctx = this.context();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private async getBuffer(fileId: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(fileId);
    if (cached) return cached;
    const inflight = this.pending.get(fileId);
    if (inflight) return inflight;

    const promise = (async () => {
      const blob = await getFileBlob(fileId);
      if (!blob) return null;
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await this.context().decodeAudioData(arrayBuffer);
      this.buffers.set(fileId, buffer);
      this.pending.delete(fileId);
      return buffer;
    })();
    this.pending.set(fileId, promise);
    return promise;
  }

  async play(fileId: string, volume = 1): Promise<void> {
    const ctx = this.context();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await this.getBuffer(fileId);
    if (!buffer || !this.master) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain).connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  loopingIds(): string[] {
    return [...this.loops.keys()];
  }

  isLooping(effectId: string): boolean {
    return this.loops.has(effectId);
  }

  /**
   * Start re-firing `fileId` on an interval until `stopLoop(effectId)`.
   * Fires once immediately, then waits a fixed (min === max) or random delay
   * in [minSeconds, maxSeconds] between shots.
   */
  startLoop(
    effectId: string,
    fileId: string,
    volume: number,
    minSeconds: number,
    maxSeconds: number,
  ): void {
    this.stopLoop(effectId);
    const lo = Math.max(0.1, Math.min(minSeconds, maxSeconds));
    const hi = Math.max(lo, Math.max(minSeconds, maxSeconds));
    const tick = () => {
      void this.play(fileId, volume);
      const delay = (lo + Math.random() * (hi - lo)) * 1000;
      this.loops.set(effectId, window.setTimeout(tick, delay));
      this.onLoopingChange(this.loopingIds());
    };
    tick();
  }

  stopLoop(effectId: string): void {
    const timer = this.loops.get(effectId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.loops.delete(effectId);
      this.onLoopingChange(this.loopingIds());
    }
  }

  stopAllLoops(): void {
    for (const timer of this.loops.values()) window.clearTimeout(timer);
    this.loops.clear();
    this.onLoopingChange(this.loopingIds());
  }

  /** Drop a decoded buffer (e.g. when its file is deleted). */
  forget(fileId: string): void {
    this.buffers.delete(fileId);
    this.pending.delete(fileId);
  }

  destroy(): void {
    this.stopAllLoops();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.pending.clear();
  }
}

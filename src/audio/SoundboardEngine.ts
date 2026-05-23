import { getFileBlob } from "../lib/db";

/**
 * Low-latency one-shot player for soundboard effects. Files are decoded once
 * into AudioBuffers and replayed through the Web Audio graph, so repeated /
 * overlapping triggers stay tight.
 */
export class SoundboardEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private outputScale = 1;

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.outputScale;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
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

  /** Drop a decoded buffer (e.g. when its file is deleted). */
  forget(fileId: string): void {
    this.buffers.delete(fileId);
    this.pending.delete(fileId);
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.pending.clear();
  }
}

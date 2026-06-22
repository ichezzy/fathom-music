import type { AmbientSound } from "../types";
import { Deck } from "./Deck";

interface Channel {
  deck: Deck;
  volume: number;
}

/** Plays any number of looping ambience beds simultaneously. */
export class AmbientEngine {
  private channels = new Map<string, Channel>();
  private outputScale = 1;
  private sinkId = "";

  constructor(
    private host: HTMLElement,
    private onChange: (activeIds: string[]) => void = () => {},
  ) {}

  isPlaying(id: string): boolean {
    return this.channels.has(id);
  }

  activeIds(): string[] {
    return [...this.channels.keys()];
  }

  async toggle(sound: AmbientSound): Promise<void> {
    if (this.channels.has(sound.id)) {
      this.stop(sound.id);
    } else {
      await this.start(sound);
    }
  }

  async start(sound: AmbientSound): Promise<void> {
    if (this.channels.has(sound.id)) return;
    const deck = new Deck(this.host);
    const channel: Channel = { deck, volume: sound.volume };
    this.channels.set(sound.id, channel);
    deck.setOutputScale(this.outputScale);
    if (this.sinkId) void deck.setSinkId(this.sinkId);
    deck.setFade(sound.volume);
    await deck.load(sound.source, { loop: true });
    deck.setLoop(true);
    deck.play();
    this.onChange(this.activeIds());
  }

  stop(id: string): void {
    const channel = this.channels.get(id);
    if (!channel) return;
    channel.deck.destroy();
    this.channels.delete(id);
    this.onChange(this.activeIds());
  }

  setChannelVolume(id: string, volume: number): void {
    const channel = this.channels.get(id);
    if (channel) {
      channel.volume = volume;
      channel.deck.setFade(volume);
    }
  }

  setOutputScale(scale: number): void {
    this.outputScale = scale;
    for (const channel of this.channels.values()) {
      channel.deck.setOutputScale(scale);
    }
  }

  async setSinkId(deviceId: string): Promise<void> {
    this.sinkId = deviceId;
    await Promise.all(
      [...this.channels.values()].map((c) => c.deck.setSinkId(deviceId)),
    );
  }

  stopAll(): void {
    for (const channel of this.channels.values()) channel.deck.destroy();
    this.channels.clear();
    this.onChange(this.activeIds());
  }

  destroy(): void {
    this.stopAll();
  }
}

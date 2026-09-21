import { PPQ } from "./timing";

export type TransportConfig = {
  bpm: number;
  numerator: number;
  denominator: number;
};

export type TransportSnapshot = TransportConfig & {
  type: "transport";
  playing: boolean;
  positionFrame: number;
  positionTick: number;
  contextFrame: number;
};

export const TRANSPORT_METERS = [
  { numerator: 3, denominator: 4, label: "3/4" },
  { numerator: 4, denominator: 4, label: "4/4" },
  { numerator: 6, denominator: 8, label: "6/8" },
  { numerator: 7, denominator: 8, label: "7/8" },
] as const;

export function isTransportConfig(value: unknown): value is TransportConfig {
  if (typeof value !== "object" || value === null) return false;
  if (!("bpm" in value) || !("numerator" in value) || !("denominator" in value)) return false;
  return typeof value.bpm === "number" && Number.isInteger(value.bpm) && value.bpm >= 40 && value.bpm <= 240
    && TRANSPORT_METERS.some((meter) => meter.numerator === value.numerator && meter.denominator === value.denominator);
}

export function isTransportSnapshot(value: unknown): value is TransportSnapshot {
  if (!isTransportConfig(value) || !("type" in value) || value.type !== "transport") return false;
  if (!("playing" in value) || !("positionFrame" in value) || !("positionTick" in value) || !("contextFrame" in value)) return false;
  return typeof value.playing === "boolean"
    && typeof value.positionFrame === "number" && Number.isSafeInteger(value.positionFrame) && value.positionFrame >= 0
    && typeof value.positionTick === "number" && Number.isFinite(value.positionTick) && value.positionTick >= 0
    && typeof value.contextFrame === "number" && Number.isSafeInteger(value.contextFrame) && value.contextFrame >= 0;
}

/** This clock advances only when the audio processor renders frames. */
export class AudioFrameClock {
  private config: TransportConfig = { bpm: 120, numerator: 4, denominator: 4 };
  private frame = 0;
  private anchorFrame = 0;
  private anchorTick = 0;
  private running = false;

  constructor(private readonly sampleRate: number) {}

  get playing(): boolean {
    return this.running;
  }

  get positionTick(): number {
    return this.anchorTick + (this.frame - this.anchorFrame) * PPQ * this.config.bpm / (60 * this.sampleRate);
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.running = false;
    this.frame = 0;
    this.anchorFrame = 0;
    this.anchorTick = 0;
  }

  configure(config: TransportConfig): void {
    this.anchorTick = this.positionTick;
    this.anchorFrame = this.frame;
    this.config = config;
  }

  advance(renderedFrames: number): void {
    if (this.running) this.frame += renderedFrames;
  }

  snapshot(contextFrame: number): TransportSnapshot {
    return {
      type: "transport",
      playing: this.running,
      positionFrame: this.frame,
      positionTick: this.positionTick,
      contextFrame,
      ...this.config,
    };
  }
}

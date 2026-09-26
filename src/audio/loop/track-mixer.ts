import { TRACK_COUNT } from "./station-protocol";

export const MIN_TRACK_DB = -60;
export const MAX_TRACK_DB = 6;
export const DEFAULT_MASTER_DB = -6.020599913279624; // 20 * log10(0.5); preserves the previous output gain.
export type MasterMix = Readonly<{ gainDb: number; mute: boolean }>;
export type TrackMix = Readonly<{ gainDb: number; mute: boolean; solo: boolean; pan: number }>;
export type LegacyTrackMix = Omit<TrackMix, "pan">;
export type StationMix = readonly TrackMix[];

export function defaultStationMix(): StationMix {
  return Array.from({ length: TRACK_COUNT }, () => ({ gainDb: 0, mute: false, solo: false, pan: 0 }));
}
export function defaultMasterMix(): MasterMix { return { gainDb: DEFAULT_MASTER_DB, mute: false }; }
export function isMasterMix(value: unknown): value is MasterMix {
  return typeof value === "object" && value !== null
    && "gainDb" in value && typeof value.gainDb === "number" && Number.isFinite(value.gainDb)
    && value.gainDb >= MIN_TRACK_DB && value.gainDb <= MAX_TRACK_DB
    && "mute" in value && typeof value.mute === "boolean";
}
export function isLegacyTrackMix(value: unknown): value is LegacyTrackMix {
  return isMasterMix(value) && "solo" in value && typeof value.solo === "boolean";
}
export function isTrackMix(value: unknown): value is TrackMix {
  return isLegacyTrackMix(value) && "pan" in value && typeof value.pan === "number"
    && Number.isFinite(value.pan) && value.pan >= -1 && value.pan <= 1;
}
export function isStationMix(value: unknown): value is StationMix {
  return Array.isArray(value) && value.length === TRACK_COUNT && Array.from(value).every(isTrackMix);
}
export function trackIsAudible(track: TrackMix, anySolo: boolean): boolean {
  return !track.mute && (!anySolo || track.solo);
}

/** Fixed storage; ramps advance on audio frames, including while a track is muted. */
export class TrackMixer {
  private readonly gains = new Float64Array(TRACK_COUNT * 2 + 1).fill(1);
  private readonly targets = new Float64Array(TRACK_COUNT * 2 + 1).fill(1);
  private readonly steps = new Float64Array(TRACK_COUNT * 2 + 1);
  private readonly remaining = new Uint32Array(TRACK_COUNT * 2 + 1);
  private readonly rampFrames: number;

  constructor(sampleRate: number) {
    this.rampFrames = Math.max(1, Math.round(sampleRate * 0.01));
    this.gains[TRACK_COUNT * 2] = this.targets[TRACK_COUNT * 2] = 0.5;
  }

  configure(mix: StationMix, master: MasterMix): void {
    const anySolo = mix.some((track) => track.solo);
    for (let index = 0; index < TRACK_COUNT; index += 1) {
      const track = mix[index];
      const gain = trackIsAudible(track, anySolo) ? 10 ** (track.gainDb / 20) : 0;
      // Constant power, normalized to unity at center to preserve existing mono mixes.
      const angle = (track.pan + 1) * Math.PI / 4;
      const left = track.pan === 0 ? 1 : track.pan === 1 ? 0 : Math.SQRT2 * Math.cos(angle);
      const right = track.pan === 0 ? 1 : track.pan === -1 ? 0 : Math.SQRT2 * Math.sin(angle);
      this.target(index * 2, gain * left);
      this.target(index * 2 + 1, gain * right);
    }
    this.target(TRACK_COUNT * 2, master.mute ? 0 : 10 ** (master.gainDb / 20));
  }

  private target(index: number, value: number): void {
    if (value === this.targets[index]) return;
    this.targets[index] = value;
    this.steps[index] = (value - this.gains[index]) / this.rampFrames;
    this.remaining[index] = this.rampFrames;
  }

  nextGain(index: number): number {
    if (this.remaining[index] > 0) {
      this.remaining[index] -= 1;
      this.gains[index] = this.remaining[index] === 0 ? this.targets[index] : this.gains[index] + this.steps[index];
    }
    return this.gains[index];
  }
}

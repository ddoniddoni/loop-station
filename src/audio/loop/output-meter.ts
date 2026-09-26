import { TRACK_COUNT } from "./station-protocol";

export type LevelReading = Readonly<{ peak: number; rms: number; hold: number; clipped: boolean }>;
export type OutputMeterSnapshot = Readonly<{
  type: "station-meter"; sequence: number; revision: number;
  tracks: readonly LevelReading[]; left: LevelReading; right: LevelReading;
}>;
function isLevel(value: unknown): value is LevelReading {
  if (typeof value !== "object" || value === null) return false;
  return "peak" in value && typeof value.peak === "number" && Number.isFinite(value.peak) && value.peak >= 0
    && "rms" in value && typeof value.rms === "number" && Number.isFinite(value.rms) && value.rms >= 0
    && "hold" in value && typeof value.hold === "number" && Number.isFinite(value.hold) && value.hold >= 0
    && "clipped" in value && typeof value.clipped === "boolean";
}
export function isOutputMeterSnapshot(value: unknown): value is OutputMeterSnapshot {
  return typeof value === "object" && value !== null && "type" in value && value.type === "station-meter"
    && "sequence" in value && Number.isSafeInteger(value.sequence)
    && "revision" in value && Number.isSafeInteger(value.revision)
    && "tracks" in value && Array.isArray(value.tracks) && value.tracks.length === TRACK_COUNT && Array.from(value.tracks).every(isLevel)
    && "left" in value && isLevel(value.left) && "right" in value && isLevel(value.right);
}

/** Scalar PCM measurements; hold and overload latch until explicitly reset. */
export class OutputLevelMeter {
  private peak = 0;
  private squares = 0;
  private frames = 0;
  private hold = 0;
  private clipped = false;

  add(left: number, right = left, overloaded = false): void {
    const peak = Math.max(Math.abs(left), Math.abs(right));
    this.peak = Math.max(this.peak, peak);
    this.hold = Math.max(this.hold, peak);
    this.squares += (left * left + right * right) / 2;
    this.frames += 1;
    if (overloaded || peak >= 1) this.clipped = true;
  }
  reset(): void { this.peak = this.squares = this.frames = this.hold = 0; this.clipped = false; }
  snapshot(): LevelReading {
    const reading = { peak: this.peak, rms: this.frames > 0 ? Math.sqrt(this.squares / this.frames) : 0,
      hold: this.hold, clipped: this.clipped };
    this.peak = this.squares = this.frames = 0;
    return reading;
  }
}

/** Keep meter updates out of the project store and its save/PCM subscribers. */
export class OutputMeterStore {
  private snapshot: OutputMeterSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): OutputMeterSnapshot | null => this.snapshot;
  readonly getServerSnapshot = (): null => null;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  set(snapshot: OutputMeterSnapshot | null): void {
    if (snapshot === this.snapshot) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

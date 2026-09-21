export type InputMeterSnapshot = {
  type: "input-meter";
  revision: number;
  receiving: boolean;
  peak: number;
  rms: number;
  clipped: boolean;
};

export function isInputMeterSnapshot(value: unknown): value is InputMeterSnapshot {
  if (typeof value !== "object" || value === null) return false;
  return "type" in value && value.type === "input-meter"
    && "revision" in value && Number.isSafeInteger(value.revision)
    && "receiving" in value && typeof value.receiving === "boolean"
    && "peak" in value && typeof value.peak === "number" && Number.isFinite(value.peak) && value.peak >= 0
    && "rms" in value && typeof value.rms === "number" && Number.isFinite(value.rms) && value.rms >= 0
    && "clipped" in value && typeof value.clipped === "boolean";
}

// Scalar accumulators only: no PCM allocation, copies, or retained audio blocks.
export class InputLevelMeter {
  private peak = 0;
  private sumSquares = 0;
  private samples = 0;
  private clipped = false;

  add(sample: number): void {
    const magnitude = Math.abs(sample);
    this.peak = Math.max(this.peak, magnitude);
    this.sumSquares += sample * sample;
    this.samples += 1;
    if (magnitude >= 1) this.clipped = true;
  }

  reset(): void {
    this.peak = 0;
    this.sumSquares = 0;
    this.samples = 0;
    this.clipped = false;
  }

  clearClip(): void {
    this.clipped = false;
  }

  snapshot(revision: number): InputMeterSnapshot {
    const snapshot: InputMeterSnapshot = {
      type: "input-meter",
      revision,
      receiving: this.samples > 0,
      peak: this.peak,
      rms: this.samples > 0 ? Math.sqrt(this.sumSquares / this.samples) : 0,
      clipped: this.clipped,
    };
    this.peak = 0;
    this.sumSquares = 0;
    this.samples = 0;
    return snapshot;
  }
}

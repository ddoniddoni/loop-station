export type InputMonitorMode = "off" | "on" | "auto";
export type InputMonitorApplied = {
  type: "input-monitor-applied"; revision: number; sequence: number; mode: InputMonitorMode;
};

export function isInputMonitorMode(value: unknown): value is InputMonitorMode {
  return value === "off" || value === "on" || value === "auto";
}

export function isInputMonitorApplied(value: unknown): value is InputMonitorApplied {
  return typeof value === "object" && value !== null
    && "type" in value && value.type === "input-monitor-applied"
    && "revision" in value && typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision > 0
    && "sequence" in value && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence > 0
    && "mode" in value && isInputMonitorMode(value.mode);
}

/** Worklet-owned gate. No timers, React state, allocations or PCM mutation per sample. */
export class InputMonitorGate {
  private mode: InputMonitorMode = "off";
  private revision = 0;
  private sequence = 0;
  private active = false;

  route(revision: number, active: boolean): boolean {
    if (!Number.isSafeInteger(revision) || revision <= this.revision) return false;
    this.revision = revision;
    this.sequence = 0;
    this.active = active;
    this.mode = "off";
    return true;
  }

  configure(value: unknown): InputMonitorApplied | null {
    if (typeof value !== "object" || value === null || !("type" in value) || value.type !== "input-monitor"
      || !("revision" in value) || value.revision !== this.revision
      || !("sequence" in value) || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || value.sequence <= this.sequence
      || !("mode" in value) || !isInputMonitorMode(value.mode) || (!this.active && value.mode !== "off")) return null;
    this.mode = value.mode;
    this.sequence = value.sequence;
    return { type: "input-monitor-applied", revision: this.revision, sequence: this.sequence, mode: this.mode };
  }

  nextSample(input: number, captured: boolean): number {
    if (!this.active || this.mode === "off" || (this.mode === "auto" && !captured) || !Number.isFinite(input)) return 0;
    return Math.max(-1, Math.min(1, input));
  }
}

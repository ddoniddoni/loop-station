export type TapTempoResult = {
  status: "idle" | "waiting" | "ready" | "too-fast" | "restarted" | "invalid";
  bpm: number | null;
  intervals: number;
};

const MIN_INTERVAL_MS = 250; // 240 quarter-note beats per minute.
const MAX_INTERVAL_MS = 1500; // 40 BPM; a longer pause begins a new sequence.
const MAX_INTERVALS = 4;

/** Input timing only. The audio frame clock remains responsible for playback. */
export class TapTempo {
  private lastTap: number | null = null;
  private intervals: number[] = [];

  reset(): TapTempoResult {
    this.lastTap = null;
    this.intervals = [];
    return this.result("idle");
  }

  tap(timestampMs: number): TapTempoResult {
    if (!Number.isFinite(timestampMs) || timestampMs < 0 || (this.lastTap !== null && timestampMs <= this.lastTap)) {
      return this.result("invalid");
    }
    if (this.lastTap === null) {
      this.lastTap = timestampMs;
      return this.result("waiting");
    }
    const interval = timestampMs - this.lastTap;
    if (interval < MIN_INTERVAL_MS) return this.result("too-fast");
    this.lastTap = timestampMs;
    if (interval > MAX_INTERVAL_MS) {
      this.intervals = [];
      return this.result("restarted");
    }
    this.intervals.push(interval);
    if (this.intervals.length > MAX_INTERVALS) this.intervals.shift();
    return this.result("ready");
  }

  private result(status: TapTempoResult["status"]): TapTempoResult {
    const count = this.intervals.length;
    const total = this.intervals.reduce((sum, interval) => sum + interval, 0);
    return { status, bpm: count ? Math.round(60_000 * count / total) : null, intervals: count };
  }
}

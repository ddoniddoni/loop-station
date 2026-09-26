import type { AudioFrameClock } from "../transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "../transport/timing";

export const PLAYBACK_TIMINGS = ["immediate", "beat", "bar"] as const;
export type PlaybackTiming = typeof PLAYBACK_TIMINGS[number];
export type PlaybackAction = "play" | "stop";
export type PendingPlayback = {
  action: PlaybackAction;
  timing: PlaybackTiming;
  sequence: number;
  frame: number;
  tick: number;
};

export function isPlaybackTiming(value: unknown): value is PlaybackTiming {
  return value === "immediate" || value === "beat" || value === "bar";
}

export function isPendingPlayback(value: unknown): value is PendingPlayback | null {
  if (value === null) return true;
  return typeof value === "object" && value !== null
    && "action" in value && (value.action === "play" || value.action === "stop")
    && "timing" in value && isPlaybackTiming(value.timing)
    && "sequence" in value && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence >= 0
    && "frame" in value && typeof value.frame === "number" && Number.isSafeInteger(value.frame) && value.frame >= 0
    && "tick" in value && typeof value.tick === "number" && Number.isFinite(value.tick) && value.tick >= 0;
}

// Resolve on the audio thread when the command arrives. The beat follows the
// meter denominator; BPM and ticks retain their quarter-note meaning.
export function playbackBoundary(clock: AudioFrameClock, timing: PlaybackTiming, blockFrames: number): { frame: number; tick: number } {
  if (timing === "immediate") return { frame: clock.positionFrame, tick: clock.positionTick };
  const grid = timing === "beat" ? PPQ * 4 / clock.meter.denominator : ticksPerBar(clock.meter.numerator, clock.meter.denominator);
  let tick = Math.ceil(clock.positionTick / grid) * grid;
  const earliest = clock.positionFrame + blockFrames * 2;
  while (clock.frameAtTick(tick) < earliest) tick += grid;
  return { frame: clock.frameAtTick(tick), tick };
}

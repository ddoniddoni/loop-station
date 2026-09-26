import { isTransportConfig, type TransportConfig } from "../transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "../transport/timing";

export const RECORD_BARS = 4;
export const RECORD_LENGTHS = [1, 2, 4, 8] as const;
export type RecordBars = typeof RECORD_LENGTHS[number];
export const MAX_RECORD_SECONDS = 60;
export const LOOP_MEMORY_BYTES = 32 * 1024 * 1024;
export type CaptureMode = "record" | "overdub";
export type LoopPhase = "empty" | "preparing" | "armed" | "recording" | "overdubbing" | "playing" | "stopped" | "incomplete";
export type LoopMetadata = TransportConfig & { sampleRate: number; frames: number; ticks: number; complete: boolean };
export type LoopStatus = {
  type: "loop-status";
  sequence: number;
  phase: LoopPhase;
  recordedFrames: number;
  totalFrames: number;
  position: number;
  pendingPlay: boolean;
  captureMode: CaptureMode | null;
  issue: string | null;
};

export function isRecordBars(value: unknown): value is RecordBars {
  return value === 1 || value === 2 || value === 4 || value === 8;
}

export function loopBars(metadata: LoopMetadata): number {
  return metadata.ticks / ticksPerBar(metadata.numerator, metadata.denominator);
}

export function recordingCapacity(sampleRate: number, config: TransportConfig, bars: number = RECORD_BARS): number {
  if (!isTransportConfig(config)) throw new RangeError("invalid-recording-tempo");
  if (!isRecordBars(bars)) throw new RangeError("invalid-recording-length");
  const seconds = ticksPerBar(config.numerator, config.denominator) * bars / PPQ * 60 / config.bpm;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || seconds > MAX_RECORD_SECONDS) throw new RangeError("recording-limit");
  return Math.ceil(seconds * sampleRate) + 1;
}

export function isLoopMetadata(value: unknown): value is LoopMetadata {
  if (!isTransportConfig(value)) return false;
  return "sampleRate" in value && typeof value.sampleRate === "number" && Number.isInteger(value.sampleRate) && value.sampleRate > 0
    && "frames" in value && typeof value.frames === "number" && Number.isSafeInteger(value.frames) && value.frames > 0 && value.frames <= value.sampleRate * MAX_RECORD_SECONDS
    && "ticks" in value && typeof value.ticks === "number" && Number.isSafeInteger(value.ticks) && value.ticks > 0
    && "complete" in value && typeof value.complete === "boolean";
}

export function isLoopStatus(value: unknown): value is LoopStatus {
  if (typeof value !== "object" || value === null) return false;
  return "type" in value && value.type === "loop-status"
    && "sequence" in value && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence >= 0
    && "phase" in value && ["empty", "armed", "recording", "overdubbing", "playing", "stopped", "incomplete"].includes(String(value.phase))
    && "recordedFrames" in value && typeof value.recordedFrames === "number" && Number.isSafeInteger(value.recordedFrames) && value.recordedFrames >= 0
    && "totalFrames" in value && typeof value.totalFrames === "number" && Number.isSafeInteger(value.totalFrames) && value.totalFrames >= value.recordedFrames
    && "position" in value && typeof value.position === "number" && Number.isFinite(value.position) && value.position >= 0 && value.position <= 1
    && "pendingPlay" in value && typeof value.pendingPlay === "boolean"
    && "captureMode" in value && (value.captureMode === null || value.captureMode === "record" || value.captureMode === "overdub")
    && "issue" in value && (value.issue === null || typeof value.issue === "string");
}

import type { TransportConfig } from "../transport/audio-frame-clock";

export const TRACK_COUNT = 8;
export const STATION_MEMORY_BYTES = 134_217_728; // 128 MiB; main-thread project budget.
export function isTrackId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < TRACK_COUNT;
}
export function sameTempo(a: TransportConfig, b: TransportConfig): boolean {
  return a.bpm === b.bpm && a.numerator === b.numerator && a.denominator === b.denominator;
}

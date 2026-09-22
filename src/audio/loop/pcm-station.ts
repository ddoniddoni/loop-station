import { isLoopMetadata } from "./loop-protocol";
import { PcmLoop } from "./pcm-loop";
import { isTrackId, sameTempo, TRACK_COUNT } from "./station-protocol";
import type { AudioFrameClock } from "../transport/audio-frame-clock";

/** Shared audio-frame clock; no per-sample allocations or PCM copies. */
export class PcmStation {
  private readonly tracks: PcmLoop[];
  constructor(private readonly clock: AudioFrameClock, rate: number,
    port: { postMessage(message: unknown, transfer?: Transferable[]): void }) {
    this.tracks = Array.from({ length: TRACK_COUNT }, (_, trackId) => new PcmLoop(clock, rate, {
      postMessage(message, transfer) {
        if (typeof message === "object" && message !== null) port.postMessage({ ...message, trackId }, transfer);
      },
    }));
  }
  get locked(): boolean { return this.tracks.some((track) => track.locked || track.capturing); }
  handle(value: unknown, blockFrames: number, inputActive: boolean): void {
    if (typeof value !== "object" || value === null || !("trackId" in value) || !isTrackId(value.trackId)
      || !("type" in value) || !("sequence" in value) || typeof value.sequence !== "number") return;
    const track = this.tracks[value.trackId];
    if ((value.type === "loop-record" || value.type === "loop-overdub")
      && this.tracks.some((other) => other !== track && other.capturing)) {
      track.reject(value.sequence, "다른 트랙의 녹음이 끝난 뒤 시작하세요.");
      return;
    }
    if (value.type === "loop-restore" && "metadata" in value && isLoopMetadata(value.metadata)
      && this.locked && !sameTempo(this.clock.meter, value.metadata)) {
      track.reject(value.sequence, "다른 트랙과 박자 설정이 다릅니다. 원본은 보관 중입니다.");
      return;
    }
    track.handle(value, blockFrames, inputActive);
  }
  nextSample(input: number | undefined, frame: number): number {
    let sum = 0;
    for (let index = 0; index < this.tracks.length; index += 1) sum += this.tracks[index].nextSample(input, frame);
    // Bound the summed output only; captured PCM and overdub histories stay intact.
    return Math.max(-1, Math.min(1, sum));
  }
  play(blockFrames: number): void { this.tracks.forEach((track) => track.play(blockFrames)); }
  stop(): void { this.tracks.forEach((track) => track.stop()); }
  interrupt(): void { this.tracks.forEach((track) => track.interrupt()); }
  publish(force: boolean): void { this.tracks.forEach((track) => track.publish(force)); }
}

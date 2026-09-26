import { isLoopMetadata } from "./loop-protocol";
import { PcmLoop } from "./pcm-loop";
import { isTrackId, sameTempo, TRACK_COUNT } from "./station-protocol";
import type { AudioFrameClock } from "../transport/audio-frame-clock";
import { isMasterMix, isStationMix, TrackMixer } from "./track-mixer";
import { OutputLevelMeter } from "./output-meter";

/** Shared audio-frame clock; no per-sample allocations or PCM copies. */
export class PcmStation {
  private readonly tracks: PcmLoop[];
  private readonly mixer: TrackMixer;
  private mixerSequence = 0;
  private readonly trackMeters = Array.from({ length: TRACK_COUNT }, () => new OutputLevelMeter());
  private readonly leftMeter = new OutputLevelMeter();
  private readonly rightMeter = new OutputLevelMeter();
  private meterRevision = 0;
  private meterFrames = 0;
  private readonly meterInterval: number;
  /** Current stereo frame; reused instead of allocating a pair per sample. */
  left = 0;
  right = 0;
  countingIn = false;
  constructor(private readonly clock: AudioFrameClock, rate: number,
    private readonly port: { postMessage(message: unknown, transfer?: Transferable[]): void }) {
    this.mixer = new TrackMixer(rate);
    this.meterInterval = Math.max(1, Math.round(rate / 10));
    this.tracks = Array.from({ length: TRACK_COUNT }, (_, trackId) => new PcmLoop(clock, rate, {
      postMessage(message, transfer) {
        if (typeof message === "object" && message !== null) port.postMessage({ ...message, trackId }, transfer);
      },
    }));
  }
  get locked(): boolean { return this.tracks.some((track) => track.locked || track.capturing); }
  handle(value: unknown, blockFrames: number, inputActive: boolean): void {
    if (typeof value === "object" && value !== null && "type" in value && value.type === "station-meter-reset") {
      if (!("revision" in value) || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision)
        || value.revision <= this.meterRevision) return;
      this.meterRevision = value.revision;
      this.trackMeters.forEach((meter) => meter.reset());
      this.leftMeter.reset(); this.rightMeter.reset(); this.meterFrames = 0;
      return;
    }
    if (typeof value === "object" && value !== null && "type" in value && value.type === "station-mixer") {
      if (!("sequence" in value) || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence)
        || value.sequence <= this.mixerSequence || !("mix" in value) || !isStationMix(value.mix)
        || !("master" in value) || !isMasterMix(value.master)) return;
      this.mixer.configure(value.mix, value.master);
      this.mixerSequence = value.sequence;
      this.port.postMessage({ type: "station-mixer-applied", sequence: value.sequence });
      return;
    }
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
    let left = 0;
    let right = 0;
    this.countingIn = false;
    for (let index = 0; index < this.tracks.length; index += 1) {
      // Always advance PCM/capture state; mute and solo affect playback gain only.
      const sample = this.tracks[index].nextSample(input, frame);
      if (this.tracks[index].countingIn) this.countingIn = true;
      const trackLeft = sample * this.mixer.nextGain(index * 2);
      const trackRight = sample * this.mixer.nextGain(index * 2 + 1);
      left += trackLeft;
      right += trackRight;
      this.trackMeters[index].add(trackLeft, trackRight);
    }
    const master = this.mixer.nextGain(TRACK_COUNT * 2);
    left *= master; right *= master;
    // Apply master attenuation BEFORE final hard clipping; this is not a lookahead limiter.
    this.left = Math.fround(Math.max(-1, Math.min(1, left)));
    this.right = Math.fround(Math.max(-1, Math.min(1, right)));
    this.leftMeter.add(this.left, this.left, Math.abs(left) > 1);
    this.rightMeter.add(this.right, this.right, Math.abs(right) > 1);
    this.meterFrames += 1;
    return this.left;
  }
  play(blockFrames: number): void { this.tracks.forEach((track) => track.play(blockFrames)); }
  stop(): void { this.tracks.forEach((track) => track.stop()); }
  interrupt(): void { this.tracks.forEach((track) => track.interrupt()); }
  publish(force: boolean): void {
    this.tracks.forEach((track) => track.publish(force));
    // Runs even with a stopped transport, so silent output replaces stale peaks.
    if (this.meterFrames < this.meterInterval) return;
    this.port.postMessage({ type: "station-meter", sequence: this.mixerSequence, revision: this.meterRevision,
      tracks: this.trackMeters.map((meter) => meter.snapshot()), left: this.leftMeter.snapshot(), right: this.rightMeter.snapshot() });
    this.meterFrames = 0;
  }
}

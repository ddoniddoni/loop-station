import { AudioFrameClock, isTransportConfig } from "../transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "../transport/timing";
import { sameTempo } from "./station-protocol";
import { isLoopMetadata, LOOP_MEMORY_BYTES, RECORD_BARS, recordingCapacity, type LoopMetadata, type LoopPhase } from "./loop-protocol";

type OverdubPass = {
  pcm: Float32Array<ArrayBuffer>; archive: Float32Array<ArrayBuffer>;
  startFrame: number; endFrame: number; written: number; sequence: number;
};
type PendingRevision = { pcm: Float32Array; metadata: LoopMetadata; frame: number; sequence: number };

/** One bounded PCM track. All large buffers arrive before capture, outside process(). */
export class PcmLoop {
  private pcm: Float32Array | null = null;
  private archive: Float32Array<ArrayBuffer> | null = null;
  private metadata: LoopMetadata | null = null;
  private phase: LoopPhase = "empty";
  private sequence = 0;
  private captureSequence = 0;
  private startFrame = 0;
  private startTick = 0;
  private countInTick: number | null = null;
  private countInRemaining = 0;
  private written = 0;
  private playTick = 0;
  private cycle = 0;
  private cycleStart = 0;
  private cycleEnd = 0;
  private position = 0;
  private pendingPlay = false;
  private issue: string | null = null;
  private dirty = true;
  private overdub: OverdubPass | null = null;
  private revision: PendingRevision | null = null;

  constructor(private readonly clock: AudioFrameClock, private readonly rate: number,
    private readonly port: { postMessage(message: unknown, transfer?: Transferable[]): void }) {}

  get locked(): boolean { return this.pcm !== null; }
  get capturing(): boolean { return this.overdub !== null || this.phase === "armed" || this.phase === "count-in" || this.phase === "recording"; }
  get countingIn(): boolean { return this.phase === "count-in"; }

  reject(sequence: number, issue: string): void {
    if (!Number.isSafeInteger(sequence) || sequence <= this.sequence) return;
    this.sequence = sequence;
    this.issue = issue;
    this.dirty = true;
  }

  handle(value: unknown, blockFrames: number, inputActive: boolean): void {
    if (typeof value !== "object" || value === null || !("type" in value) || typeof value.type !== "string" || !value.type.startsWith("loop-")) return;
    if (!("sequence" in value) || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || value.sequence <= this.sequence) return;
    this.sequence = value.sequence;
    this.issue = null;
    this.dirty = true;
    switch (value.type) {
      case "loop-record": this.prepare(value, blockFrames, inputActive); break;
      case "loop-overdub": this.prepareOverdub(value, blockFrames, inputActive); break;
      case "loop-play": this.play(blockFrames); break;
      case "loop-stop": this.stop(); break;
      case "loop-cancel":
        if ("captureMode" in value && value.captureMode === "overdub") this.abortOverdub(null);
        else this.clear();
        break;
      case "loop-clear": this.clear(); break;
      case "loop-restore": this.restore(value); break;
      case "loop-interrupt": this.interrupt(); break;
      case "loop-revision": this.scheduleRevision(value, blockFrames); break;
      case "loop-cancel-revision": this.cancelRevision(); break;
    }
  }

  private prepare(value: object, blockFrames: number, inputActive: boolean): void {
    if (this.locked || this.revision || blockFrames <= 0 || !inputActive || ("countIn" in value && typeof value.countIn !== "boolean") || !("config" in value) || !isTransportConfig(value.config)
      || !("pcm" in value) || !(value.pcm instanceof ArrayBuffer) || !("archive" in value) || !(value.archive instanceof ArrayBuffer)) {
      this.issue = "녹음을 시작할 수 없습니다. 오디오와 마이크 연결을 확인하세요.";
      return;
    }
    const config = value.config;
    const current = this.clock.meter;
    const bytes = recordingCapacity(this.rate, config) * 4;
    if (config.bpm !== current.bpm || config.numerator !== current.numerator || config.denominator !== current.denominator
      || value.pcm.byteLength !== bytes || value.archive.byteLength !== bytes || value.pcm === value.archive || bytes * 2 > LOOP_MEMORY_BYTES) {
      this.issue = "녹음 준비 중 박자 설정이 바뀌었거나 버퍼가 부족합니다. 다시 시도하세요.";
      return;
    }
    this.clock.start();
    this.captureSequence = this.sequence;
    this.startTick = this.nextBar(blockFrames);
    this.countInTick = "countIn" in value && value.countIn === true ? this.startTick : null;
    this.countInRemaining = 0;
    if (this.countInTick !== null) this.startTick += ticksPerBar(config.numerator, config.denominator);
    this.startFrame = this.clock.frameAtTick(this.startTick);
    const ticks = ticksPerBar(config.numerator, config.denominator) * RECORD_BARS;
    const frames = this.clock.frameAtTick(this.startTick + ticks) - this.startFrame;
    this.metadata = { ...config, sampleRate: this.rate, frames, ticks, complete: false };
    this.pcm = new Float32Array(value.pcm);
    this.archive = new Float32Array(value.archive);
    this.written = 0;
    this.position = 0;
    this.phase = "armed";
  }

  private nextBar(blockFrames: number): number {
    const barTicks = ticksPerBar(this.clock.meter.numerator, this.clock.meter.denominator);
    let tick = Math.ceil(this.clock.positionTick / barTicks) * barTicks;
    const earliest = this.clock.positionFrame + blockFrames * 2;
    while (this.clock.frameAtTick(tick) < earliest) tick += barTicks;
    return tick;
  }

  play(blockFrames: number): void {
    if (!this.metadata?.complete || this.phase !== "stopped") return;
    this.clock.start();
    this.playTick = this.nextBar(blockFrames);
    this.cycle = 0;
    this.setCycle();
    this.phase = "playing";
    this.pendingPlay = true;
    this.dirty = true;
    this.position = 0;
  }

  stop(): void {
    if (this.capturing) this.interrupt();
    this.applyRevision();
    if (this.phase === "playing") {
      this.phase = "stopped";
      this.pendingPlay = false;
      this.position = 0;
      this.dirty = true;
    }
  }

  interrupt(): void {
    if (this.overdub) {
      this.abortOverdub("오버더빙이 중단되어 이번 입력을 취소했습니다. 기존 루프는 유지됩니다.");
      return;
    }
    if (!this.capturing) return;
    this.issue = "녹음이 중단되었습니다. 완성되지 않은 구간은 반복 재생하지 않습니다.";
    if (this.written > 0 && this.metadata) {
      this.metadata = { ...this.metadata, frames: this.written, complete: false };
      this.phase = "incomplete";
      this.sendArchive();
    } else {
      this.clear();
    }
    this.dirty = true;
  }

  private restore(value: object): void {
    if (!("metadata" in value) || !isLoopMetadata(value.metadata) || !("pcm" in value) || !(value.pcm instanceof ArrayBuffer)) return;
    const meta = value.metadata;
    if (this.capturing || this.revision || meta.sampleRate !== this.rate || value.pcm.byteLength > LOOP_MEMORY_BYTES / 2 || value.pcm.byteLength < meta.frames * 4) return;
    this.pcm = new Float32Array(value.pcm);
    this.metadata = meta;
    this.archive = null;
    this.written = meta.frames;
    this.position = 0;
    this.phase = meta.complete ? "stopped" : "incomplete";
    if (!sameTempo(this.clock.meter, meta)) this.clock.configure(meta);
  }

  private clear(): void {
    this.abortOverdub(null);
    this.cancelRevision();
    this.pcm = null;
    this.archive = null;
    this.metadata = null;
    this.written = 0;
    this.phase = "empty";
    this.countInTick = null;
    this.countInRemaining = 0;
    this.pendingPlay = false;
    this.position = 0;
  }

  private setCycle(): void {
    if (!this.metadata) return;
    this.cycleStart = this.clock.frameAtTick(this.playTick + this.cycle * this.metadata.ticks);
    this.cycleEnd = this.clock.frameAtTick(this.playTick + (this.cycle + 1) * this.metadata.ticks);
  }

  nextSample(input: number | undefined, frame: number): number {
    if (this.revision && frame >= this.revision.frame) this.applyRevision();
    if (!this.clock.playing || !this.pcm || !this.metadata) return 0;
    if (!this.overdub && this.capturing && (input === undefined || !Number.isFinite(input))) { this.interrupt(); return 0; }
    this.advanceCountIn(frame);
    if (!this.overdub && this.capturing && frame >= this.startFrame) {
      if (input === undefined) return 0;
      if (this.phase !== "recording") { this.phase = "recording"; this.countInRemaining = 0; this.dirty = true; }
      this.pcm[this.written] = input;
      if (this.archive) this.archive[this.written] = input;
      this.written += 1;
      this.position = this.written / this.metadata.frames;
      if (this.written === this.metadata.frames) {
        this.metadata.complete = true;
        this.phase = "playing";
        this.playTick = this.startTick + this.metadata.ticks;
        this.cycle = 0;
        this.setCycle();
        this.sendArchive();
        this.dirty = true;
      }
      return 0;
    }
    if (this.phase !== "playing" || frame < this.cycleStart) return 0;
    if (this.pendingPlay) { this.pendingPlay = false; this.dirty = true; }
    if (frame >= this.cycleEnd) { this.cycle += 1; this.setCycle(); }
    this.position = (frame - this.cycleStart) / (this.cycleEnd - this.cycleStart);
    const source = this.position * this.metadata.frames;
    const index = Math.floor(source);
    const fraction = source - index;
    const a = this.pcm[index] ?? 0;
    const b = this.pcm[(index + 1) % this.metadata.frames] ?? 0;
    const previous = a + (b - a) * fraction;
    this.writeOverdub(input, frame, previous);
    // The current input is heard only through the separate monitor path.
    return previous;
  }

  private advanceCountIn(frame: number): void {
    if (this.countInTick === null || frame >= this.startFrame || (this.phase !== "armed" && this.phase !== "count-in")) return;
    if (frame < this.clock.frameAtTick(this.countInTick)) return;
    if (this.phase === "armed") {
      this.phase = "count-in";
      this.countInRemaining = this.clock.meter.numerator;
      this.dirty = true;
    }
    const beatTicks = PPQ * 4 / this.clock.meter.denominator;
    while (this.countInRemaining > 1 && frame >= this.clock.frameAtTick(this.countInTick + (this.clock.meter.numerator - this.countInRemaining + 1) * beatTicks)) {
      this.countInRemaining -= 1;
      this.dirty = true;
    }
  }

  private nextLoopTick(blockFrames: number): number {
    const ticks = this.metadata?.ticks ?? 1;
    let cycle = Math.max(0, Math.ceil((this.clock.positionTick - this.playTick) / ticks));
    let frame = this.clock.frameAtTick(this.playTick + cycle * ticks);
    while (frame < this.clock.positionFrame + blockFrames * 2) {
      cycle += 1;
      frame = this.clock.frameAtTick(this.playTick + cycle * ticks);
    }
    return this.playTick + cycle * ticks;
  }

  private prepareOverdub(value: object, blockFrames: number, inputActive: boolean): void {
    if (!this.metadata?.complete || this.phase !== "playing" || this.pendingPlay || this.capturing || this.revision || !inputActive || blockFrames <= 0
      || !("pcm" in value) || !(value.pcm instanceof ArrayBuffer) || !("archive" in value) || !(value.archive instanceof ArrayBuffer)) {
      this.issue = "반복 재생과 마이크 연결을 확인한 뒤 오버더빙을 시작하세요.";
      return;
    }
    const bytes = recordingCapacity(this.rate, this.metadata) * 4;
    if (value.pcm.byteLength !== bytes || value.archive.byteLength !== bytes || value.pcm === value.archive
      || bytes * 2 + (this.pcm?.byteLength ?? 0) > LOOP_MEMORY_BYTES) {
      this.issue = "오버더빙 버퍼가 부족합니다. 기존 루프는 유지됩니다.";
      return;
    }
    const startTick = this.nextLoopTick(blockFrames);
    const startFrame = this.clock.frameAtTick(startTick);
    const endFrame = this.clock.frameAtTick(startTick + this.metadata.ticks);
    if (endFrame <= startFrame || (endFrame - startFrame) * 4 > bytes) {
      this.issue = "루프 길이에 맞는 오버더빙 버퍼를 확보하지 못했습니다.";
      return;
    }
    this.overdub = { pcm: new Float32Array(value.pcm), archive: new Float32Array(value.archive),
      startFrame, endFrame, written: 0, sequence: this.sequence };
  }

  private writeOverdub(input: number | undefined, frame: number, previous: number): void {
    const pass = this.overdub;
    if (!pass || frame < pass.startFrame || !this.metadata) return;
    if (frame !== pass.startFrame + pass.written || pass.written >= pass.pcm.length) {
      this.abortOverdub("오디오 프레임이 불연속으로 처리되어 이번 오버더빙을 취소했습니다.");
      return;
    }
    if (input === undefined || !Number.isFinite(input)) {
      this.abortOverdub("입력 연결이 끊겨 이번 오버더빙을 취소했습니다. 기존 루프는 유지됩니다.");
      return;
    }
    const sample = Math.fround(previous + input);
    if (!Number.isFinite(sample)) { this.abortOverdub("입력 레벨이 너무 커 오버더빙을 취소했습니다."); return; }
    if (pass.written === 0) this.dirty = true;
    pass.pcm[pass.written] = sample;
    pass.archive[pass.written] = sample;
    pass.written += 1;
    if (frame + 1 === pass.endFrame) {
      this.pcm = pass.pcm;
      this.metadata = { ...this.metadata, frames: pass.written };
      this.written = pass.written;
      this.overdub = null;
      const buffer = pass.archive.buffer;
      this.port.postMessage({ type: "loop-captured", captureMode: "overdub", sequence: pass.sequence, metadata: this.metadata, pcm: buffer }, [buffer]);
      this.dirty = true;
    }
  }

  private abortOverdub(issue: string | null): void {
    if (!this.overdub) return;
    const sequence = this.overdub.sequence;
    this.overdub = null;
    this.issue = issue;
    this.dirty = true;
    this.port.postMessage({ type: "loop-capture-aborted", sequence, issue });
  }

  private scheduleRevision(value: object, blockFrames: number): void {
    if (this.capturing || this.revision || !this.metadata?.complete
      || !("metadata" in value) || !isLoopMetadata(value.metadata) || !value.metadata.complete
      || !("pcm" in value) || !(value.pcm instanceof ArrayBuffer)) { this.rejectRevision(); return; }
    const meta = value.metadata;
    if (meta.sampleRate !== this.rate || meta.ticks !== this.metadata.ticks || meta.bpm !== this.metadata.bpm
      || meta.numerator !== this.metadata.numerator || meta.denominator !== this.metadata.denominator
      || value.pcm.byteLength % 4 !== 0 || value.pcm.byteLength < meta.frames * 4
      || value.pcm.byteLength + (this.pcm?.byteLength ?? 0) > LOOP_MEMORY_BYTES) { this.rejectRevision(); return; }
    this.revision = { pcm: new Float32Array(value.pcm), metadata: meta, sequence: this.sequence,
      frame: this.phase === "playing" ? this.clock.frameAtTick(this.nextLoopTick(blockFrames)) : this.clock.positionFrame };
    if (this.phase !== "playing" || !this.clock.playing) this.applyRevision();
  }

  private rejectRevision(): void {
    this.issue = "이력을 적용하지 못했습니다. 현재 루프는 유지됩니다.";
    this.port.postMessage({ type: "loop-revision-rejected", sequence: this.sequence });
  }

  private applyRevision(): void {
    if (!this.revision) return;
    const { pcm, metadata, sequence } = this.revision;
    this.pcm = pcm;
    this.metadata = metadata;
    this.written = metadata.frames;
    this.revision = null;
    this.dirty = true;
    this.port.postMessage({ type: "loop-revision-applied", sequence });
  }

  private cancelRevision(): void {
    if (!this.revision) return;
    const sequence = this.revision.sequence;
    this.revision = null;
    this.dirty = true;
    this.port.postMessage({ type: "loop-revision-cancelled", sequence });
  }

  private sendArchive(): void {
    if (!this.archive || !this.metadata) return;
    const buffer = this.archive.buffer;
    this.archive = null;
    // This buffer was filled alongside playback PCM; never transfer the playback buffer.
    this.port.postMessage({ type: "loop-captured", captureMode: "record", sequence: this.captureSequence, metadata: this.metadata, pcm: buffer }, [buffer]);
  }

  publish(force = false): void {
    if (!this.dirty && !force) return;
    const pass = this.overdub;
    this.port.postMessage({ type: "loop-status", sequence: this.sequence,
      phase: pass ? (pass.written > 0 ? "overdubbing" : "armed") : this.phase,
      captureMode: pass ? "overdub" : this.capturing ? "record" : null,
      countInRemaining: this.countingIn ? this.countInRemaining : null,
      recordedFrames: pass?.written ?? this.written, totalFrames: pass ? pass.endFrame - pass.startFrame : this.metadata?.frames ?? 0,
      position: this.position, pendingPlay: this.pendingPlay, issue: this.issue });
    this.dirty = false;
  }
}

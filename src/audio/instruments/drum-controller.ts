import provenance from "../../../public/audio/drums/freepats-20220718/provenance.json";
import { DRUM_ASSET_PATH, DRUM_KIT, DRUM_MEMORY_BYTES, type DrumId } from "./drum-kit";

type DrumSnapshot = { phase: "idle" | "loading" | "ready" | "error"; running: boolean; issue: string | null };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; hat: boolean };
const initial: DrumSnapshot = { phase: "idle", running: false, issue: null };

/** Bounded one-shot sampler. Buffers never enter React or project JSON. */
export class DrumController {
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private silence: ConstantSourceNode | null = null;
  private buffers = new Map<DrumId, AudioBuffer>();
  private voices = new Set<Voice>();
  private request: AbortController | null = null;
  private enabled = false;
  readonly getSnapshot = () => this.snapshot;
  readonly getServerSnapshot = () => initial;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.detach();
    this.context = context;
    this.bus = context.createGain();
    this.bus.gain.value = 0.5;
    this.bus.channelCount = 1;
    this.bus.channelCountMode = "explicit";
    this.bus.connect(node, 0, 1);
    // Keep an actual zero-valued input between hits: silence is valid recording data.
    this.silence = context.createConstantSource();
    this.silence.offset.value = 0;
    this.silence.connect(this.bus);
    this.silence.start();
    this.setRunning(context.state === "running");
  }

  async load(): Promise<void> {
    const context = this.context;
    if (!context || this.request || this.snapshot.phase === "ready") return;
    const request = new AbortController();
    this.request = request;
    this.update({ phase: "loading", issue: null });
    let rejectAbort!: (error: Error) => void;
    const cancelled = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(new Error("음원 준비가 취소되었습니다."));
    request.signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => request.abort(), 15_000);
    try {
      if (context.sampleRate > 192_000) throw new Error("내장 드럼은 192kHz 이하 오디오에서 사용할 수 있습니다.");
      // Exactly eight known assets: <650KiB encoded and <4MiB decoded at 192kHz.
      // Hash verification precedes decode; the 8MiB reserve includes transient copies.
      const loading = Promise.all(DRUM_KIT.map(async (pad) => {
        const metadata = provenance.samples.find((sample) => sample.file === pad.file);
        const response = await fetch(DRUM_ASSET_PATH + pad.file, { signal: request.signal });
        if (!response.ok) throw new Error("드럼 음원을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.");
        const encoded = await response.arrayBuffer();
        if (!metadata || encoded.byteLength !== metadata.bytes) throw new Error("드럼 음원 파일이 올바르지 않습니다. 다시 시도하세요.");
        const digest = await crypto.subtle.digest("SHA-256", encoded);
        const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        if (hash !== metadata.sha256) throw new Error("드럼 음원의 무결성을 확인하지 못했습니다. 다시 시도하세요.");
        if (request.signal.aborted) throw new Error("음원 준비가 취소되었습니다.");
        const buffer = await context.decodeAudioData(encoded);
        if (request.signal.aborted || this.context !== context) throw new Error("음원 준비가 취소되었습니다.");
        if (buffer.numberOfChannels !== 1 || buffer.duration > 3) throw new Error("지원하지 않는 드럼 음원 형식입니다.");
        return [pad.id, buffer] as const;
      }));
      const entries = await Promise.race([loading, cancelled]);
      if (this.request !== request) return;
      const bytes = entries.reduce((sum, [, buffer]) => sum + buffer.length * 4, 0);
      if (bytes > DRUM_MEMORY_BYTES / 2) throw new Error("드럼 음원 메모리 크기가 허용 범위를 넘었습니다.");
      this.buffers = new Map(entries);
      this.update({ phase: "ready", issue: null });
    } catch (error) {
      if (this.request === request) this.update({ phase: "error", issue: request.signal.aborted ? "음원 준비 시간이 초과되었습니다. 다시 시도하세요." : error instanceof Error ? error.message : "드럼 음원 준비에 실패했습니다." });
    } finally {
      request.signal.removeEventListener("abort", onAbort);
      request.abort();
      clearTimeout(timeout);
      if (this.request === request) this.request = null;
    }
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.stopAll(); }
  setRunning(running: boolean): void { if (!running) this.stopAll(); this.update({ running }); }

  trigger(id: DrumId): boolean {
    const pad = DRUM_KIT.find((item) => item.id === id);
    const buffer = this.buffers.get(id);
    const context = this.context;
    if (!pad || !buffer || !context || !this.bus || !this.enabled || !this.snapshot.running || context.state !== "running") return false;
    if (pad.hat) for (const voice of this.voices) if (voice.hat) this.stopVoice(voice);
    if (this.voices.size >= 16) { const oldest = this.voices.values().next().value; if (oldest) this.stopVoice(oldest); }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const voice = { source, gain, hat: pad.hat };
    source.buffer = buffer;
    gain.gain.value = pad.gain;
    source.connect(gain);
    gain.connect(this.bus);
    source.onended = () => this.releaseVoice(voice);
    this.voices.add(voice);
    source.start(context.currentTime);
    return true;
  }

  stopAll(): void { for (const voice of this.voices) this.stopVoice(voice); }
  private stopVoice(voice: Voice): void { voice.source.stop(); this.releaseVoice(voice); }
  private releaseVoice(voice: Voice): void {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
  detach(): void {
    this.request?.abort(); this.request = null;
    this.stopAll();
    this.silence?.stop(); this.silence?.disconnect(); this.silence = null;
    this.bus?.disconnect(); this.bus = null;
    this.context = null; this.enabled = false; this.buffers.clear();
    this.update(initial);
  }
  private update(patch: Partial<DrumSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}

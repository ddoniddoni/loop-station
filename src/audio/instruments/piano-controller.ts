import { pianoBank, PIANO_ASSET_PATH, PIANO_MEMORY_BYTES, PIANO_RELEASE, type PianoOctave } from "./piano-bank";

type Snapshot = { phase: "idle" | "loading" | "ready" | "error"; running: boolean; octave: PianoOctave; sustain: boolean; notes: number[]; issue: string | null };
type Voice = { token: string; note: number; source: AudioBufferSourceNode; gain: GainNode; held: boolean; releasing: boolean };
const initial: Snapshot = { phase: "idle", running: false, octave: 4, sustain: false, notes: [], issue: null };

/** One bank, bounded polyphony, and audio-clock envelopes; no PCM in React. */
export class PianoController {
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private silence: ConstantSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<Voice>();
  private request: AbortController | null = null;
  private pendingDecode: Promise<AudioBuffer> | null = null;
  private enabled = false;
  private captureLocked = false;
  readonly getSnapshot = () => this.snapshot;
  readonly getServerSnapshot = () => initial;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  attach(context: AudioContext, node: AudioWorkletNode): void {
    this.detach(); this.context = context;
    this.bus = context.createGain(); this.bus.gain.value = 0.25;
    this.bus.channelCount = 1; this.bus.channelCountMode = "explicit";
    this.bus.connect(node, 0, 2);
    this.silence = context.createConstantSource(); this.silence.offset.value = 0;
    this.silence.connect(this.bus); this.silence.start();
    this.setRunning(context.state === "running");
  }
  setCaptureLocked(locked: boolean): void { this.captureLocked = locked; }
  async setOctave(octave: PianoOctave): Promise<void> {
    if (this.captureLocked || ![3, 4, 5].includes(octave) || octave === this.snapshot.octave) return;
    this.cancelLoad(); this.stopAll(); this.buffers.clear();
    this.update({ octave, phase: "idle", issue: null });
    await this.load();
  }
  cancelLoad(): void {
    const request = this.request; this.request = null; request?.abort();
    if (this.snapshot.phase === "loading") this.update({ phase: "idle", issue: null });
  }
  async load(): Promise<void> {
    const context = this.context;
    if (!context || this.request || this.snapshot.phase === "ready" || this.captureLocked) return;
    const request = new AbortController(); this.request = request;
    const bank = pianoBank(this.snapshot.octave);
    this.update({ phase: "loading", issue: null });
    let rejectAbort!: (reason: Error) => void;
    const cancelled = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(new Error("피아노 준비 시간이 초과되었습니다. 다시 시도하세요."));
    request.signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => request.abort(), 15_000);
    const current = () => !request.signal.aborted && this.request === request && this.context === context;
    try {
      if (context.sampleRate > 192_000) throw new Error("피아노는 192kHz 이하 오디오에서 사용할 수 있습니다.");
      const loading = async () => {
        // A cancelled browser decoder cannot be aborted. Wait before starting another bank.
        if (this.pendingDecode) await this.pendingDecode.catch(() => undefined);
        const entries = new Map<string, AudioBuffer>();
        let bytes = 0;
        // Serial decoding bounds transient memory even across cancellation and retry.
        for (const metadata of bank) {
          if (!current()) throw new Error("취소됨");
          const response = await fetch(PIANO_ASSET_PATH + encodeURIComponent(metadata.file), { signal: request.signal });
          if (!response.ok) throw new Error("피아노 음원을 불러오지 못했습니다. 다시 시도하세요.");
          const encoded = await response.arrayBuffer();
          if (encoded.byteLength !== metadata.bytes) throw new Error("피아노 음원 파일 크기가 올바르지 않습니다.");
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)), (byte) => byte.toString(16).padStart(2, "0")).join("");
          if (hash !== metadata.sha256) throw new Error("피아노 음원의 무결성을 확인하지 못했습니다.");
          if (!current()) throw new Error("취소됨");
          const decoding = context.decodeAudioData(encoded); this.pendingDecode = decoding;
          let buffer: AudioBuffer;
          try { buffer = await decoding; } finally { if (this.pendingDecode === decoding) this.pendingDecode = null; }
          if (!current()) throw new Error("취소됨");
          if (buffer.numberOfChannels !== 1 || Math.abs(buffer.duration - metadata.frames / metadata.sampleRate) > 0.01) throw new Error("지원하지 않는 피아노 음원 형식입니다.");
          bytes += buffer.length * 4;
          if (bytes > PIANO_MEMORY_BYTES / 2) throw new Error("피아노 음원이 메모리 한도를 넘었습니다.");
          entries.set(metadata.file, buffer);
        }
        return entries;
      };
      const entries = await Promise.race([loading(), cancelled]);
      if (!current()) return;
      this.buffers = entries; this.update({ phase: "ready", issue: null });
    } catch (error) {
      if (this.request === request) this.update({ phase: "error", issue: error instanceof Error ? error.message : "피아노 준비에 실패했습니다." });
    } finally {
      request.signal.removeEventListener("abort", onAbort); request.abort(); clearTimeout(timeout);
      if (this.request === request) this.request = null;
    }
  }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.stopAll(); }
  setRunning(running: boolean): void { if (!running) this.stopAll(); if (this.snapshot.running !== running) this.update({ running }); }

  noteOn(note: number, token: string, velocity = 0.8): boolean {
    const context = this.context;
    const low = (this.snapshot.octave + 1) * 12;
    if (!context || !this.bus || !this.enabled || !this.snapshot.running || context.state !== "running" || this.snapshot.phase !== "ready"
      || !Number.isInteger(note) || note < low || note > low + 12 || !Number.isFinite(velocity) || velocity <= 0) return false;
    if ([...this.voices].some((voice) => voice.token === token && voice.held)) return false;
    const metadata = pianoBank(this.snapshot.octave).find((sample) => sample.low <= note && sample.high >= note);
    const buffer = metadata && this.buffers.get(metadata.file);
    if (!metadata || !buffer) return false;
    if (this.voices.size >= 16) { const oldest = this.voices.values().next().value; if (oldest) this.stopVoice(oldest); }
    const source = context.createBufferSource(); const gain = context.createGain();
    source.buffer = buffer; source.playbackRate.value = 2 ** ((note - metadata.root) / 12);
    if (metadata.loopStart !== null && metadata.loopEnd !== null) {
      source.loop = true; source.loopStart = metadata.loopStart / metadata.sampleRate;
      source.loopEnd = (metadata.loopEnd + 1) / metadata.sampleRate; // SFZ end is inclusive.
    }
    gain.gain.value = Math.min(1, velocity);
    const voice: Voice = { token, note, source, gain, held: true, releasing: false };
    source.connect(gain); gain.connect(this.bus);
    source.onended = () => { this.releaseVoice(voice); this.publishNotes(); };
    this.voices.add(voice); source.start(context.currentTime); this.publishNotes(); return true;
  }
  noteOff(token: string): void {
    for (const voice of this.voices) if (voice.token === token && voice.held) {
      voice.held = false; if (!this.snapshot.sustain) this.releaseNote(voice);
    }
    this.publishNotes();
  }
  setSustain(sustain: boolean): void {
    if (!this.enabled || sustain === this.snapshot.sustain) return;
    this.update({ sustain });
    if (!sustain) for (const voice of this.voices) if (!voice.held) this.releaseNote(voice);
  }
  private releaseNote(voice: Voice): void {
    if (!this.context || voice.releasing) return;
    voice.releasing = true;
    const now = this.context.currentTime;
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + PIANO_RELEASE);
    voice.source.stop(now + PIANO_RELEASE);
  }
  stopAll(): void {
    for (const voice of this.voices) this.stopVoice(voice);
    if (this.snapshot.sustain || this.snapshot.notes.length) this.update({ sustain: false, notes: [] });
  }
  private stopVoice(voice: Voice): void { voice.source.stop(); this.releaseVoice(voice); }
  private releaseVoice(voice: Voice): void {
    voice.source.onended = null; voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(voice);
  }
  private publishNotes(): void {
    const notes = [...new Set([...this.voices].filter((voice) => voice.held).map((voice) => voice.note))];
    if (notes.join() !== this.snapshot.notes.join()) this.update({ notes });
  }
  detach(): void {
    this.cancelLoad(); this.stopAll();
    this.silence?.stop(); this.silence?.disconnect(); this.silence = null;
    this.bus?.disconnect(); this.bus = null; this.context = null; this.enabled = false;
    this.captureLocked = false; this.buffers.clear(); this.update(initial);
  }
  private update(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener();
  }
}

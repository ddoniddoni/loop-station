import { melodicBank, melodicBase, MELODIC_INSTRUMENTS, MELODIC_MEMORY_BYTES, type MelodicInstrument, type SampleRegion } from "./melodic-bank";
import { GUITAR_CHORD_BANK, GUITAR_CHORD_SAMPLE_RATE, guitarChordNotes, STRUM_SPACING, type GuitarChord, type GuitarMode, type StrumDirection, type StrumSpeed } from "./guitar-chords";

type Snapshot = { phase: "idle" | "loading" | "ready" | "error"; running: boolean; instrument: MelodicInstrument; octave: number; guitarMode: GuitarMode; chord: GuitarChord | null; sustain: boolean; notes: number[]; issue: string | null };
type Voice = { token: string; note: number; source: AudioBufferSourceNode; gain: GainNode; held: boolean; releasing: boolean };
const initial: Snapshot = { phase: "idle", running: false, instrument: "piano", octave: 4, guitarMode: "notes", chord: null, sustain: false, notes: [], issue: null };

/** One bank, bounded polyphony, and audio-clock envelopes; no PCM in React. */
export class MelodicController {
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
  selectInstrument(instrument: MelodicInstrument): void {
    if (this.captureLocked || instrument === this.snapshot.instrument) return;
    this.unload();
    this.update({ instrument, octave: MELODIC_INSTRUMENTS[instrument].defaultOctave, guitarMode: "notes" });
  }
  unload(): void {
    this.cancelLoad(); this.stopAll(); this.enabled = false; this.buffers.clear();
    this.update({ phase: "idle", issue: null });
  }
  setCaptureLocked(locked: boolean): void { this.captureLocked = locked; }
  async setGuitarMode(guitarMode: GuitarMode): Promise<void> {
    if (this.captureLocked || this.snapshot.instrument !== "guitar" || guitarMode === this.snapshot.guitarMode || !["notes", "chords"].includes(guitarMode)) return;
    this.unload(); this.update({ guitarMode }); await this.load();
  }
  async setOctave(octave: number): Promise<void> {
    if (this.captureLocked || this.snapshot.guitarMode === "chords" || !MELODIC_INSTRUMENTS[this.snapshot.instrument].octaves.some((value) => value === octave) || octave === this.snapshot.octave) return;
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
    const config = MELODIC_INSTRUMENTS[this.snapshot.instrument];
    const chords = this.snapshot.instrument === "guitar" && this.snapshot.guitarMode === "chords";
    const bank = chords ? GUITAR_CHORD_BANK : melodicBank(this.snapshot.instrument, this.snapshot.octave);
    this.update({ phase: "loading", issue: null });
    let rejectAbort!: (reason: Error) => void;
    const cancelled = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(new Error(`${config.label} 준비 시간이 초과되었습니다. 다시 시도하세요.`));
    request.signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => request.abort(), 15_000);
    const current = () => !request.signal.aborted && this.request === request && this.context === context;
    try {
      if (context.sampleRate > 192_000) throw new Error(`${config.label}: 192kHz 이하 오디오에서 사용할 수 있습니다.`);
      const loading = async () => {
        // A cancelled browser decoder cannot be aborted. Wait before starting another bank.
        if (this.pendingDecode) await this.pendingDecode.catch(() => undefined);
        if (!current()) throw new Error("취소됨");
        // Keep the 19-sample chord bank at its original rate (~12.5MiB), even on
        // 192kHz hardware. BufferSource resamples when playing into the live context.
        const decoder = chords ? new OfflineAudioContext(1, 1, GUITAR_CHORD_SAMPLE_RATE) : context;
        const entries = new Map<string, AudioBuffer>();
        let bytes = 0;
        // Serial decoding bounds transient memory even across cancellation and retry.
        for (const metadata of bank) {
          if (!current()) throw new Error("취소됨");
          const response = await fetch(config.assetPath + encodeURIComponent(metadata.file), { signal: request.signal });
          if (!response.ok) throw new Error("음원을 불러오지 못했습니다. 다시 시도하세요.");
          const encoded = await response.arrayBuffer();
          if (encoded.byteLength !== metadata.bytes) throw new Error("음원 파일 크기가 올바르지 않습니다.");
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)), (byte) => byte.toString(16).padStart(2, "0")).join("");
          if (hash !== metadata.sha256) throw new Error("음원의 무결성을 확인하지 못했습니다.");
          if (!current()) throw new Error("취소됨");
          const decoding = decoder.decodeAudioData(encoded); this.pendingDecode = decoding;
          let buffer: AudioBuffer;
          try { buffer = await decoding; } finally { if (this.pendingDecode === decoding) this.pendingDecode = null; }
          if (!current()) throw new Error("취소됨");
          if (buffer.numberOfChannels !== 1 || Math.abs(buffer.duration - metadata.frames / metadata.sampleRate) > 0.01) throw new Error("지원하지 않는 악기 음원 형식입니다.");
          bytes += buffer.length * 4;
          if (bytes > MELODIC_MEMORY_BYTES / 2) throw new Error("악기 음원이 메모리 한도를 넘었습니다.");
          entries.set(metadata.file, buffer);
        }
        return entries;
      };
      const entries = await Promise.race([loading(), cancelled]);
      if (!current()) return;
      this.buffers = entries; this.update({ phase: "ready", issue: null });
    } catch (error) {
      if (this.request === request) this.update({ phase: "error", issue: error instanceof Error ? error.message : "악기 준비에 실패했습니다." });
    } finally {
      request.signal.removeEventListener("abort", onAbort); request.abort(); clearTimeout(timeout);
      if (this.request === request) this.request = null;
    }
  }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.stopAll(); }
  setRunning(running: boolean): void { if (!running) this.stopAll(); if (this.snapshot.running !== running) this.update({ running }); }

  noteOn(note: number, token: string, velocity = 0.8): boolean {
    const context = this.context;
    const low = melodicBase(this.snapshot.instrument, this.snapshot.octave);
    if (!context || !this.bus || !this.enabled || !this.snapshot.running || context.state !== "running" || this.snapshot.phase !== "ready"
      || this.snapshot.guitarMode === "chords" || !Number.isInteger(note) || note < low || note > low + 12 || !Number.isFinite(velocity) || velocity <= 0) return false;
    if ([...this.voices].some((voice) => voice.token === token && voice.held)) return false;
    const metadata = melodicBank(this.snapshot.instrument, this.snapshot.octave).find((sample) => sample.low <= note && sample.high >= note);
    const buffer = metadata && this.buffers.get(metadata.file);
    if (!metadata || !buffer) return false;
    this.startVoice(note, token, velocity, context.currentTime, metadata, buffer, true);
    this.publishNotes(); return true;
  }
  strum(chord: GuitarChord, direction: StrumDirection, speed: StrumSpeed): boolean {
    const context = this.context;
    if (!context || !this.bus || !this.enabled || !this.snapshot.running || context.state !== "running" || this.snapshot.phase !== "ready"
      || this.snapshot.instrument !== "guitar" || this.snapshot.guitarMode !== "chords" || !["down", "up"].includes(direction)
      || !Object.hasOwn(STRUM_SPACING, speed)) return false;
    const notes = guitarChordNotes(chord);
    if (!notes.length) return false;
    if (direction === "up") notes.reverse();
    const voices: { note: number; metadata: SampleRegion; buffer: AudioBuffer }[] = [];
    for (const note of notes) {
      const metadata = GUITAR_CHORD_BANK.find((sample) => sample.low <= note && note <= sample.high);
      const buffer = metadata && this.buffers.get(metadata.file);
      if (!metadata || !buffer) return false; // Never play a partially loaded chord.
      voices.push({ note, metadata, buffer });
    }
    this.stopAll(); // Includes sources scheduled in the future by the previous stroke.
    const start = context.currentTime + 0.005;
    voices.forEach(({ note, metadata, buffer }, index) => {
      this.startVoice(note, `chord:${index}`, 0.55, start + index * STRUM_SPACING[speed], metadata, buffer, false);
    });
    this.update({ chord }); return true;
  }
  private startVoice(note: number, token: string, velocity: number, start: number, metadata: SampleRegion, buffer: AudioBuffer, held: boolean): void {
    const context = this.context;
    if (!context || !this.bus) return;
    if (this.voices.size >= 16) { const oldest = this.voices.values().next().value; if (oldest) this.stopVoice(oldest); }
    const source = context.createBufferSource(); const gain = context.createGain();
    source.buffer = buffer; source.playbackRate.value = 2 ** ((note - metadata.root) / 12);
    if (metadata.loopStart !== null && metadata.loopEnd !== null) {
      source.loop = true; source.loopStart = metadata.loopStart / metadata.sampleRate;
      source.loopEnd = (metadata.loopEnd + 1) / metadata.sampleRate; // SFZ end is inclusive.
    }
    gain.gain.value = Math.min(1, velocity);
    const voice: Voice = { token, note, source, gain, held, releasing: false };
    source.connect(gain); gain.connect(this.bus);
    source.onended = () => {
      this.releaseVoice(voice); this.publishNotes();
      if (!this.voices.size && this.snapshot.chord) this.update({ chord: null });
    };
    this.voices.add(voice); source.start(start);
  }
  noteOff(token: string): void {
    for (const voice of this.voices) if (voice.token === token && voice.held) {
      voice.held = false; if (!this.snapshot.sustain) this.releaseNote(voice);
    }
    this.publishNotes();
  }
  setSustain(sustain: boolean): void {
    if (!this.enabled || !MELODIC_INSTRUMENTS[this.snapshot.instrument].sustain || sustain === this.snapshot.sustain) return;
    this.update({ sustain });
    if (!sustain) for (const voice of this.voices) if (!voice.held) this.releaseNote(voice);
  }
  private releaseNote(voice: Voice): void {
    if (!this.context || voice.releasing) return;
    voice.releasing = true;
    const now = this.context.currentTime;
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + MELODIC_INSTRUMENTS[this.snapshot.instrument].release);
    voice.source.stop(now + MELODIC_INSTRUMENTS[this.snapshot.instrument].release);
  }
  stopAll(): void {
    for (const voice of this.voices) this.stopVoice(voice);
    if (this.snapshot.sustain || this.snapshot.notes.length || this.snapshot.chord) this.update({ sustain: false, notes: [], chord: null });
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

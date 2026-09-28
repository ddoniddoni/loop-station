import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MelodicController } from "../../src/audio/instruments/melodic-controller";
import pianoSamples from "../../public/audio/piano/freepats-20190703/provenance.json";
import guitarSamples from "../../public/audio/guitar/freepats-20190618/provenance.json";
import { melodicBank, MELODIC_MEMORY_BYTES } from "../../src/audio/instruments/melodic-bank";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { RecordingInputController } from "../../src/audio/input/recording-input-controller";

function fixture() {
  function source() { return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
    buffer: null, playbackRate: { value: 1 }, loop: false, loopStart: 0, loopEnd: 0 }; }
  function gain() { return { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
  const voices: ReturnType<typeof source>[] = []; const gains: ReturnType<typeof gain>[] = [];
  const context = {
    state: "running", currentTime: 2, sampleRate: 48000,
    createGain: () => { const item = gain(); gains.push(item); return item; },
    createConstantSource: () => ({ ...source(), offset: { value: 0 } }),
    createBufferSource: () => { const item = source(); voices.push(item); return item; },
    decodeAudioData: vi.fn(async (encoded: ArrayBuffer) => {
      const sample = [...guitarSamples.samples, ...pianoSamples.samples].find((sample) => sample.bytes === encoded.byteLength)!;
      return { numberOfChannels: 1, duration: sample.frames / sample.sampleRate, length: Math.round(sample.frames * 48000 / sample.sampleRate) };
    }),
  };
  const fetcher = vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => {
    const bytes = await readFile(resolve("public", decodeURIComponent(url.slice(1))));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } }));
  vi.stubGlobal("fetch", fetcher);
  const piano = new MelodicController(); piano.attach(context as unknown as AudioContext, {} as AudioWorkletNode);
  return { piano, context, voices, gains, fetcher };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("guitar sampler and shared instrument memory", () => {
  it("preserves the source's pitch mapping, natural decay and 1.5-second note release", async () => {
    const f = fixture(); f.piano.selectInstrument("guitar"); await f.piano.setOctave(2); f.piano.setEnabled(true);
    expect(f.fetcher).toHaveBeenCalledTimes(8);
    expect(f.piano.noteOn(42, "f-sharp")).toBe(true);
    expect(f.voices[0].playbackRate.value).toBeCloseTo(2 ** (-1 / 12)); // F#2 uses original G2 region.
    expect(f.voices[0].loop).toBe(false);
    f.piano.noteOff("f-sharp"); expect(f.voices[0].stop).toHaveBeenCalledWith(3.5);
    expect(f.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 3.5);
    f.piano.setSustain(true); expect(f.piano.getSnapshot().sustain).toBe(false);
    expect(f.piano.noteOn(39, "below-range")).toBe(false); f.piano.detach();
  });
  it("supports chords, removes naturally ended notes, and bounds ringing voices", async () => {
    const f = fixture(); f.piano.selectInstrument("guitar"); await f.piano.load(); f.piano.setEnabled(true);
    for (const note of [52, 55, 59]) f.piano.noteOn(note, `note-${note}`);
    expect(f.piano.getSnapshot().notes).toEqual([52, 55, 59]);
    f.voices[1].onended?.(); expect(f.piano.getSnapshot().notes).toEqual([52, 59]);
    expect(f.voices[1].disconnect).toHaveBeenCalled();
    for (let i = 0; i < 20; i++) { f.piano.noteOn(52, `pluck-${i}`); f.piano.noteOff(`pluck-${i}`); }
    expect(f.voices.filter((voice) => !voice.disconnect.mock.calls.length)).toHaveLength(16);
    f.piano.setRunning(false); expect(f.voices.every((voice) => voice.disconnect.mock.calls.length)).toBe(true); f.piano.detach();
  });
  it("unloads the previous instrument, locks changes during capture and reloads on return", async () => {
    const f = fixture(); await f.piano.load(); f.piano.setEnabled(true); f.piano.noteOn(60, "piano"); f.piano.setSustain(true);
    f.piano.setCaptureLocked(true); f.piano.selectInstrument("guitar");
    expect(f.piano.getSnapshot().instrument).toBe("piano");
    f.piano.setCaptureLocked(false); f.piano.selectInstrument("guitar");
    expect(f.piano.getSnapshot()).toMatchObject({ instrument: "guitar", phase: "idle", octave: 3, notes: [], sustain: false });
    expect(f.voices[0].disconnect).toHaveBeenCalled(); expect(f.piano.noteOn(60, "unready")).toBe(false);
    await f.piano.load(); expect(f.fetcher).toHaveBeenCalledTimes(18);
    f.piano.selectInstrument("piano"); expect(f.piano.getSnapshot().phase).toBe("idle");
    await f.piano.load(); expect(f.fetcher).toHaveBeenCalledTimes(23); f.piano.detach();
  });
  it("discards a piano decode that arrives after selecting guitar and loads only the current bank", async () => {
    const f = fixture();
    let finish!: (buffer: { numberOfChannels: number; duration: number; length: number }) => void;
    let started!: () => void; const decoding = new Promise<void>((yes) => { started = yes; });
    f.context.decodeAudioData.mockImplementationOnce(() => { started(); return new Promise((yes) => { finish = yes; }); });
    const old = f.piano.load(); await decoding; f.piano.selectInstrument("guitar");
    const current = f.piano.load(); await old; await Promise.resolve(); expect(f.fetcher).toHaveBeenCalledTimes(1);
    finish({ numberOfChannels: 1, duration: 1, length: 48000 }); await current;
    expect(f.piano.getSnapshot()).toMatchObject({ instrument: "guitar", phase: "ready" });
    expect(f.fetcher).toHaveBeenCalledTimes(14); f.piano.detach();
  });
  it("keeps each octave covered and within the decoded memory reserve at 192kHz", () => {
    for (const octave of [2, 3, 4]) {
      const bank = melodicBank("guitar", octave); const low = (octave + 1) * 12 + 4;
      for (let note = low; note <= low + 12; note++) expect(bank.filter((sample) => sample.low <= note && sample.high >= note)).toHaveLength(1);
      expect(bank.reduce((sum, sample) => sum + Math.ceil(sample.frames * 192000 / sample.sampleRate) * 4, 0)).toBeLessThan(MELODIC_MEMORY_BYTES / 2);
    }
  });
  it("only enables guitar capture after its current route acknowledgement and holds the source while recording", async () => {
    const f = fixture(); const recording = new RecordingInputController(new MicrophoneController());
    const messages: { type: string; revision: number; source: string; active: boolean }[] = [];
    recording.attach(f.context as unknown as AudioContext, { port: { postMessage: (message: typeof messages[number]) => messages.push(message) } } as unknown as AudioWorkletNode);
    recording.select("guitar"); const oldRevision = messages.at(-1)!.revision;
    await recording.melodic.load();
    recording.accept({ type: "capture-route-applied", revision: oldRevision }); expect(recording.getSnapshot().routed).toBe(false);
    recording.accept({ type: "capture-route-applied", revision: messages.at(-1)!.revision });
    expect(recording.getSnapshot()).toMatchObject({ source: "guitar", routed: true });
    recording.setCaptureLocked(true); recording.select("microphone"); await recording.melodic.setOctave(2);
    expect(recording.getSnapshot().source).toBe("guitar"); expect(recording.melodic.getSnapshot().octave).toBe(3);
    recording.setCaptureLocked(false); recording.select("drums"); expect(recording.melodic.getSnapshot().phase).toBe("idle");
    recording.detach(); f.piano.detach();
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PianoController } from "../../src/audio/instruments/piano-controller";
import provenance from "../../public/audio/piano/freepats-20190703/provenance.json";

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
      const sample = provenance.samples.find((sample) => sample.bytes === encoded.byteLength)!;
      return { numberOfChannels: 1, duration: sample.frames / sample.sampleRate, length: Math.round(sample.frames * 48000 / sample.sampleRate) };
    }),
  };
  const fetcher = vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => {
    const bytes = await readFile(resolve("public", decodeURIComponent(url.slice(1))));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } }));
  vi.stubGlobal("fetch", fetcher);
  const piano = new PianoController(); piano.attach(context as unknown as AudioContext, {} as AudioWorkletNode);
  return { piano, context, voices, gains, fetcher };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("sampled piano performance", () => {
  it("loads five verified samples on demand and maps semitone pitch and inclusive SFZ loop points", async () => {
    const f = fixture(); expect(f.fetcher).not.toHaveBeenCalled();
    await f.piano.load(); await f.piano.load(); expect(f.fetcher).toHaveBeenCalledTimes(5);
    expect(f.fetcher.mock.calls.some(([url]) => url.includes("D%234"))).toBe(true);
    f.piano.setEnabled(true); expect(f.piano.noteOn(61, "c-sharp")).toBe(true);
    const metadata = provenance.samples.find((sample) => sample.root === 60)!;
    expect(f.voices[0].playbackRate.value).toBeCloseTo(2 ** (1 / 12));
    expect(f.voices[0].loopStart).toBe(metadata.loopStart! / 44100);
    expect(f.voices[0].loopEnd).toBe((metadata.loopEnd! + 1) / 44100);
    expect(f.piano.noteOn(48, "outside")).toBe(false); f.piano.detach();
  });
  it("plays independent chord voices, ignores held repeats and releases on the audio clock", async () => {
    const f = fixture(); await f.piano.load(); f.piano.setEnabled(true);
    f.piano.noteOn(60, "a"); f.piano.noteOn(64, "d"); f.piano.noteOn(67, "g");
    expect(f.piano.noteOn(60, "a")).toBe(false);
    expect(f.piano.getSnapshot().notes).toEqual([60, 64, 67]);
    f.piano.noteOff("d"); expect(f.voices[1].stop).toHaveBeenCalledWith(2.6);
    expect(f.gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.6);
    expect(f.voices[0].stop).not.toHaveBeenCalled();
    f.piano.noteOff("d"); expect(f.voices[1].stop).toHaveBeenCalledOnce();
    f.piano.detach();
  });
  it("holds released notes under sustain, releases the pedal and bounds voices at sixteen", async () => {
    const f = fixture(); await f.piano.load(); f.piano.setEnabled(true); f.piano.setSustain(true);
    for (let i = 0; i < 20; i++) { f.piano.noteOn(60, `note-${i}`); f.piano.noteOff(`note-${i}`); }
    expect(f.voices.filter((voice) => voice.stop.mock.calls.length)).toHaveLength(4);
    expect(f.piano.getSnapshot().notes).toEqual([]);
    f.piano.setSustain(false);
    expect(f.voices.slice(4).every((voice) => voice.stop.mock.calls[0]?.[0] === 2.6)).toBe(true);
    f.piano.stopAll(); expect(f.voices.every((voice) => voice.disconnect.mock.calls.length)).toBe(true); f.piano.detach();
  });
  it("locks the bank during capture and clears voices on octave changes, suspension and teardown", async () => {
    const f = fixture(); await f.piano.load(); f.piano.setEnabled(true); f.piano.noteOn(60, "held");
    f.piano.setCaptureLocked(true); await f.piano.setOctave(3);
    expect(f.piano.getSnapshot().octave).toBe(4); expect(f.voices[0].stop).not.toHaveBeenCalled();
    f.piano.setCaptureLocked(false); await f.piano.setOctave(3);
    expect(f.voices[0].disconnect).toHaveBeenCalled(); expect(f.fetcher).toHaveBeenCalledTimes(10);
    f.piano.noteOn(48, "low"); f.piano.setSustain(true); f.piano.setRunning(false);
    expect(f.piano.getSnapshot()).toMatchObject({ notes: [], sustain: false });
    expect(f.piano.noteOn(48, "suspended")).toBe(false); f.piano.detach();
    expect(f.piano.getSnapshot()).toMatchObject({ phase: "idle", octave: 4, running: false });
  });
  it("rejects altered samples before decoding and allows retry", async () => {
    const f = fixture(); const fetcher = f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementationOnce(async (url) => ({ ok: true, arrayBuffer: async () => {
      const response = await fetcher(url); const data = await response.arrayBuffer(); new Uint8Array(data)[data.byteLength - 1] ^= 1; return data;
    } }));
    await f.piano.load(); expect(f.piano.getSnapshot().phase).toBe("error"); expect(f.context.decodeAudioData).not.toHaveBeenCalled();
    await f.piano.load(); expect(f.piano.getSnapshot().phase).toBe("ready"); f.piano.detach();
  });
  it("discards a late decode after instrument switching without requesting the rest of the bank", async () => {
    const f = fixture();
    let finish!: (buffer: { numberOfChannels: number; duration: number; length: number }) => void;
    let started!: () => void; const decoding = new Promise<void>((yes) => { started = yes; });
    f.context.decodeAudioData.mockImplementationOnce(() => { started(); return new Promise((yes) => { finish = yes; }); });
    const loading = f.piano.load(); await decoding; f.piano.cancelLoad(); await loading;
    finish({ numberOfChannels: 1, duration: 1, length: 48000 }); await Promise.resolve(); await Promise.resolve();
    expect(f.piano.getSnapshot().phase).toBe("idle"); expect(f.fetcher).toHaveBeenCalledTimes(1); f.piano.detach();
  });
  it("reports a stalled decode timeout and keeps retry from overlapping that decoder", async () => {
    const f = fixture();
    let finish!: (buffer: { numberOfChannels: number; duration: number; length: number }) => void;
    let started!: () => void; const decoding = new Promise<void>((yes) => { started = yes; });
    f.context.decodeAudioData.mockImplementationOnce(() => { started(); return new Promise((yes) => { finish = yes; }); });
    vi.useFakeTimers(); const loading = f.piano.load(); await decoding;
    await vi.advanceTimersByTimeAsync(15_000); await loading;
    expect(f.piano.getSnapshot()).toMatchObject({ phase: "error", issue: expect.stringContaining("초과") });
    const retry = f.piano.load(); await Promise.resolve(); expect(f.fetcher).toHaveBeenCalledTimes(1);
    finish({ numberOfChannels: 1, duration: 1, length: 48000 }); await retry;
    expect(f.piano.getSnapshot().phase).toBe("ready"); f.piano.detach();
  });
});

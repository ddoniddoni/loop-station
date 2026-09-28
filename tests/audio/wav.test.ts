import { describe, expect, it } from "vitest";
import { checkWavMemory, encodeWav, wavFilename, wavSize } from "../../src/audio/export/wav";
import { STATION_MEMORY_BYTES } from "../../src/audio/loop/station-protocol";

function take(frames = 8000) {
  const pcm = new Float32Array(8001);
  pcm.set([-2, -1, -0.5, 0, 0.5, 1, 2]); pcm[8000] = 0.25;
  return { pcm: pcm.buffer, metadata: { bpm: 240, numerator: 4, denominator: 4, sampleRate: 8000, frames, ticks: 3840, complete: true } };
}
describe("mono PCM24 WAV", () => {
  it("writes a consistent extensible RIFF header and exact signed samples without changing the source", () => {
    const source = take(); const before = source.pcm.slice(0);
    const { wav, clipped } = encodeWav(source); const view = new DataView(wav);
    const text = (start: number, length: number) => new TextDecoder().decode(new Uint8Array(wav, start, length));
    expect(text(0, 4)).toBe("RIFF"); expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(text(12, 4)).toBe("fmt "); expect(view.getUint32(16, true)).toBe(40);
    expect(view.getUint16(20, true)).toBe(0xfffe); expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000); expect(view.getUint32(28, true)).toBe(24000);
    expect(view.getUint16(32, true)).toBe(3); expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint16(36, true)).toBe(22); expect(view.getUint16(38, true)).toBe(24);
    expect(view.getUint32(40, true)).toBe(4);
    expect(Array.from(new Uint8Array(wav, 44, 16))).toEqual([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113]);
    expect(text(60, 4)).toBe("data"); expect(view.getUint32(64, true)).toBe(24000);
    expect(wav.byteLength).toBe(24068);
    const samples = Array.from({ length: 7 }, (_, i) => {
      const offset = 68 + i * 3;
      return (view.getUint8(offset) | view.getUint8(offset + 1) << 8 | view.getInt8(offset + 2) << 16);
    });
    expect(samples).toEqual([-8388608, -8388608, -4194304, 0, 4194304, 8388607, 8388607]);
    expect(clipped).toBe(2); expect(source.pcm).toEqual(before);
  });
  it("pads an odd data length without counting padding as a sample", () => {
    const { wav } = encodeWav(take(8001)); const view = new DataView(wav);
    expect(view.getUint32(64, true)).toBe(24003); expect(wav.byteLength).toBe(24072);
    expect(view.getUint8(wav.byteLength - 1)).toBe(0);
  });
  it("rejects incomplete, truncated, and nonfinite input", () => {
    const source = take(); source.metadata.complete = false;
    expect(() => wavSize(source)).toThrow(); source.metadata.complete = true;
    expect(() => wavSize({ ...source, pcm: new ArrayBuffer(4) })).toThrow();
    new Float32Array(source.pcm)[3] = NaN; expect(() => encodeWav(source)).toThrow();
  });
  it("rejects export memory pressure before allocating a worker copy", () => {
    const source = take(); expect(checkWavMemory(source, source.pcm.byteLength)).toBe(24068);
    expect(() => checkWavMemory(source, STATION_MEMORY_BYTES / 2)).toThrow();
  });
  it("sanitizes filenames and preserves whole unicode characters", () => {
    expect(wavFilename('../song:test? ', 0, 48000)).toBe('_song_test_-track-01-48000Hz-24bit.wav');
    expect(wavFilename('🎹'.repeat(50), 7, 8000)).toBe(`${'🎹'.repeat(40)}-track-08-8000Hz-24bit.wav`);
    expect(wavFilename('...', 0, 8000)).toBe('LoopStation-track-01-8000Hz-24bit.wav');
  });
});

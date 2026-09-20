import { describe, expect, it } from "vitest";
import { frameAtTick, PPQ, ticksPerBar, type TempoAnchor } from "../../src/audio/transport/timing";

const anchor: TempoAnchor = { bpm: 120, sampleRate: 48_000, startTick: 0, startFrame: 0 };

describe("musical time to audio frames", () => {
  it("resolves four bars at 48kHz / 120 BPM to 384,000 frames (AUDIO-01 calculation only)", () => {
    expect(frameAtTick(4 * ticksPerBar(4, 4), anchor)).toBe(384_000);
  });

  it.each([[3, 4, 2_880], [4, 4, 3_840], [6, 8, 2_880], [7, 8, 3_360]])(
    "uses quarter-note BPM for %i/%i", (numerator, denominator, ticks) => {
      expect(ticksPerBar(numerator, denominator)).toBe(ticks);
    },
  );

  it("preserves the absolute frame anchor across tempo changes", () => {
    const next = { ...anchor, bpm: 90, startTick: 4 * PPQ, startFrame: 96_000 };
    expect(frameAtTick(next.startTick, next)).toBe(96_000);
    expect(frameAtTick(next.startTick + PPQ, next)).toBe(128_000);
    expect(frameAtTick(next.startTick - PPQ, next)).toBe(64_000);
  });

  it.each([44_100, 48_000])("does not accumulate rounded-bar drift at %i Hz", (sampleRate) => {
    const fractionalTempo = { ...anchor, bpm: 123.45, sampleRate };
    const bars = 320; // More than ten minutes, pure calculation; not playback.
    const expected = Math.round((bars * 4 * 60 * sampleRate) / 123.45);
    expect(frameAtTick(bars * ticksPerBar(4, 4), fractionalTempo)).toBe(expected);
    const roundedBar = frameAtTick(ticksPerBar(4, 4), fractionalTempo);
    expect(Math.abs(roundedBar * bars - expected)).toBeGreaterThan(1);
  });

  it.each([0, -120, NaN, Infinity])("rejects invalid BPM %s", (bpm) => {
    expect(() => frameAtTick(PPQ, { ...anchor, bpm })).toThrow(RangeError);
  });

  it.each([0, -48_000, 44_100.5, Infinity])("rejects invalid sample rate %s", (sampleRate) => {
    expect(() => frameAtTick(PPQ, { ...anchor, sampleRate })).toThrow(RangeError);
  });

  it.each([[0, 4], [4, 0], [4, 3], [1.5, 4]])("rejects invalid meter %s/%s", (n, d) => {
    expect(() => ticksPerBar(n, d)).toThrow(RangeError);
  });

  it("rejects unsafe positions instead of silently losing frame precision", () => {
    expect(() => frameAtTick(0.5, anchor)).toThrow(RangeError);
    expect(() => frameAtTick(Number.MAX_SAFE_INTEGER, anchor)).toThrow(RangeError);
    expect(() => frameAtTick(PPQ, { ...anchor, startFrame: NaN })).toThrow(RangeError);
  });
});

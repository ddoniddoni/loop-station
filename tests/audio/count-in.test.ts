import { describe, expect, it } from "vitest";
import { AudioFrameClock, type TransportConfig } from "../../src/audio/transport/audio-frame-clock";
import { PPQ, ticksPerBar } from "../../src/audio/transport/timing";
import { PcmLoop } from "../../src/audio/loop/pcm-loop";
import { isLoopMetadata, isLoopStatus, recordingCapacity } from "../../src/audio/loop/loop-protocol";

function fixture(rate = 48000, config: TransportConfig = { bpm: 120, numerator: 4, denominator: 4 }) {
  const clock = new AudioFrameClock(rate);
  clock.configure(config);
  const messages: unknown[] = [];
  const loop = new PcmLoop(clock, rate, { postMessage(value, transfer = []) { messages.push(structuredClone(value, { transfer })); } });
  const bar = ticksPerBar(config.numerator, config.denominator);
  function record(countIn: unknown) {
    const bytes = recordingCapacity(rate, config) * 4;
    loop.handle({ type: "loop-record", sequence: 1, config, countIn, pcm: new ArrayBuffer(bytes), archive: new ArrayBuffer(bytes) }, 192, true);
    loop.publish();
  }
  function render(until: number, input: (frame: number) => number | undefined = () => 0.25) {
    let index = 0;
    let last = 0;
    const blocks = [64, 192, 127, 256];
    while (clock.positionFrame < until) {
      const start = clock.positionFrame;
      const size = Math.min(blocks[index++ % blocks.length], until - start);
      for (let offset = 0; offset < size; offset += 1) last = loop.nextSample(input(start + offset), start + offset);
      clock.advance(size); loop.publish();
    }
    return last;
  }
  function captured() {
    const take = messages.find((value) => typeof value === "object" && value !== null && "type" in value && value.type === "loop-captured");
    if (typeof take !== "object" || take === null || !("metadata" in take) || !isLoopMetadata(take.metadata) || !("pcm" in take) || !(take.pcm instanceof ArrayBuffer)) throw new Error("No captured PCM");
    return { metadata: take.metadata, pcm: new Float32Array(take.pcm) };
  }
  return { clock, loop, messages, bar, record, render, captured };
}

const cases = [44100, 48000].flatMap((rate) => [
  { bpm: 120, numerator: 3, denominator: 4 },
  { bpm: 240, numerator: 4, denominator: 4 },
  { bpm: 40, numerator: 6, denominator: 8 },
  { bpm: 127, numerator: 7, denominator: 8 },
].map((config) => ({ rate, config })));

describe("one-bar count-in on absolute audio-frame boundaries", () => {
  it.each(cases)("excludes preparation from PCM at $rate Hz / $config", ({ rate, config }) => {
    for (const enabled of [true, false]) {
      const f = fixture(rate, config);
      const startTick = f.bar * (enabled ? 2 : 1);
      const start = f.clock.frameAtTick(startTick);
      const end = f.clock.frameAtTick(startTick + f.bar * 4);
      f.record(enabled);
      f.render(start, () => 0.875);
      expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ recordedFrames: 0 });
      f.render(end, (frame) => frame === start ? 0.5 : frame === end - 1 ? -0.25 : 0);
      const take = f.captured();
      expect(take.metadata).toMatchObject({ frames: end - start, ticks: f.bar * 4, complete: true });
      expect(take.pcm[0]).toBe(0.5);
      expect(take.pcm[take.metadata.frames - 1]).toBe(-0.25);
      expect(take.pcm.subarray(1, take.metadata.frames - 1).every((sample) => sample === 0)).toBe(true);
      expect(f.render(end + 1)).toBe(0.5);
      const remaining = f.messages.filter(isLoopStatus).filter((value) => value.phase === "count-in").map((value) => value.countInRemaining);
      expect(remaining).toEqual(enabled ? Array.from({ length: config.numerator }, (_, i) => config.numerator - i) : []);
    }
  });

  it("places countdown beat transitions at absolute rounded frames", () => {
    const f = fixture(44100, { bpm: 127, numerator: 7, denominator: 8 });
    f.record(true);
    for (let beat = 0; beat < 7; beat += 1) {
      const boundary = f.clock.frameAtTick(f.bar + beat * PPQ / 2);
      f.render(boundary);
      const before = f.messages.filter(isLoopStatus).at(-1)!;
      expect(before.countInRemaining).toBe(beat === 0 ? null : 8 - beat);
      f.render(boundary + 1);
      expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ phase: "count-in", countInRemaining: 7 - beat, recordedFrames: 0 });
    }
    f.render(f.clock.frameAtTick(f.bar * 2) + 1);
    expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ phase: "recording", countInRemaining: null, recordedFrames: 1 });
  });

  it("skips a too-close bar before reserving the full preparation bar", () => {
    const f = fixture();
    f.clock.start(); f.clock.advance(f.clock.frameAtTick(f.bar) - 100);
    f.record(true);
    f.render(f.clock.frameAtTick(f.bar * 2));
    expect(f.messages.filter(isLoopStatus).at(-1)?.phase).toBe("armed");
    f.render(f.clock.frameAtTick(f.bar * 3));
    expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ phase: "count-in", recordedFrames: 0 });
    f.render(f.clock.frameAtTick(f.bar * 3) + 1);
    expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ phase: "recording", recordedFrames: 1 });
  });

  it.each(["cancel", "stop", "interrupt", "missing-input"])("releases an unfinished preparation on %s without publishing a take", (action) => {
    const f = fixture();
    f.record(true); f.render(f.clock.frameAtTick(f.bar) + 1);
    expect(f.loop.countingIn).toBe(true);
    if (action === "missing-input") f.render(f.clock.positionFrame + 1, () => undefined);
    else f.loop.handle({ type: `loop-${action}`, sequence: 2, captureMode: "record" }, 192, true);
    f.render(f.clock.frameAtTick(f.bar * 6) + 1);
    expect(f.loop.locked).toBe(false);
    expect(f.loop.capturing).toBe(false);
    expect(f.loop.countingIn).toBe(false);
    expect(() => f.captured()).toThrow("No captured PCM");
    expect(f.messages.filter(isLoopStatus).at(-1)).toMatchObject({ phase: "empty", countInRemaining: null });
  });

  it("rejects malformed preparation commands before reserving PCM", () => {
    const f = fixture(); f.record("true");
    expect(f.loop.locked).toBe(false);
    expect(f.messages.filter(isLoopStatus).at(-1)?.issue).toBeTruthy();
  });
});

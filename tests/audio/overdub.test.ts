import { describe, expect, it } from "vitest";
import { AudioFrameClock, type TransportConfig } from "../../src/audio/transport/audio-frame-clock";
import { ticksPerBar } from "../../src/audio/transport/timing";
import { PcmLoop } from "../../src/audio/loop/pcm-loop";
import { isLoopMetadata, recordingCapacity, type LoopMetadata } from "../../src/audio/loop/loop-protocol";

const standard: TransportConfig = { bpm: 120, numerator: 4, denominator: 4 };
type Take = { metadata: LoopMetadata; pcm: ArrayBuffer };

function fixture(rate = 48000, config = standard, bars = 4) {
  const messages: unknown[] = [];
  const takes: Take[] = [];
  const clock = new AudioFrameClock(rate);
  clock.configure(config);
  const loop = new PcmLoop(clock, rate, {
    postMessage(message, transfer = []) {
      const value: unknown = structuredClone(message, { transfer });
      messages.push(value);
      if (typeof value === "object" && value !== null && "type" in value && value.type === "loop-captured"
        && "metadata" in value && isLoopMetadata(value.metadata) && "pcm" in value && value.pcm instanceof ArrayBuffer) {
        takes.push({ metadata: value.metadata, pcm: value.pcm });
      }
    },
  });
  let sequence = 0;
  function command(type: string, payload: object = {}) {
    loop.handle({ ...payload, type, sequence: ++sequence }, 192, true);
    loop.publish();
    return sequence;
  }
  function buffers() {
    const bytes = recordingCapacity(rate, config, bars) * 4;
    return { pcm: new ArrayBuffer(bytes), archive: new ArrayBuffer(bytes) };
  }
  function render(until: number, input: number | undefined = 0.125) {
    const sizes = [192, 64, 127, 256];
    let block = 0;
    let last = 0;
    while (clock.positionFrame < until) {
      const count = Math.min(sizes[block++ % sizes.length], until - clock.positionFrame);
      for (let offset = 0; offset < count; offset += 1) last = loop.nextSample(input, clock.positionFrame + offset);
      clock.advance(count);
      loop.publish();
    }
    return last;
  }
  const bar = ticksPerBar(config.numerator, config.denominator);
  command("loop-record", { config, bars, ...buffers() });
  render(clock.frameAtTick(bar * (1 + bars)), 0.25);
  render(clock.positionFrame + 1, 0);
  const boundary = (cycle: number) => clock.frameAtTick(bar * (1 + bars) + cycle * bar * bars);
  const overdub = () => command("loop-overdub", buffers());
  const revision = (take: Take) => command("loop-revision", { metadata: take.metadata, pcm: take.pcm.slice(0) });
  return { loop, clock, messages, takes, command, render, boundary, overdub, revision };
}

describe("one-cycle overdub and revision boundaries", () => {
  it.each([1, 2, 8])("overdubs and undoes a %i-bar loop without changing its duration", (bars) => {
    const f = fixture(48000, standard, bars);
    f.overdub();
    expect(f.render(f.boundary(2))).toBe(0.25);
    expect(f.takes[1].metadata).toMatchObject({ ticks: bars * 3840, frames: bars * 96000 });
    expect(f.render(f.boundary(2) + 1)).toBe(0.375);
    expect(new Float32Array(f.takes[0].pcm)[0]).toBe(0.25);
    f.revision(f.takes[0]);
    expect(f.render(f.boundary(3))).toBe(0.375);
    expect(f.render(f.boundary(3) + 1)).toBe(0.25);
  });

  it("plays A during capture, commits float32 A+B once, and leaves A immutable", () => {
    const f = fixture();
    const original = new Float32Array(f.takes[0].pcm);
    f.overdub();
    expect(f.render(f.boundary(1))).toBe(0.25);
    expect(f.render(f.boundary(2))).toBe(0.25);
    expect(f.takes).toHaveLength(2);
    expect(original[0]).toBe(0.25);
    expect(original[f.takes[0].metadata.frames - 1]).toBe(0.25);
    const mixed = new Float32Array(f.takes[1].pcm);
    expect(mixed.slice(0, f.takes[1].metadata.frames).every((sample) => sample === 0.375)).toBe(true);
    expect(f.render(f.boundary(2) + 1)).toBe(0.375);
    expect(f.render(f.boundary(4) + 1, 0.5)).toBe(0.375);
    expect(f.takes).toHaveLength(2);
  });

  it.each(["armed", "capturing"])("discards a cancelled %s overdub and keeps playing A", (stage) => {
    const f = fixture();
    const sequence = f.overdub();
    if (stage === "capturing") f.render(f.boundary(1) + 317);
    f.command("loop-cancel", { captureMode: "overdub" });
    expect(f.render(f.boundary(2) + 1)).toBe(0.25);
    expect(f.takes).toHaveLength(1);
    expect(f.messages).toContainEqual({ type: "loop-capture-aborted", sequence, issue: null });
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])("aborts on missing/non-finite input %s without changing A", (input) => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(1) + 11);
    // Pass directly: a default render parameter would replace undefined.
    expect(f.loop.nextSample(input, f.clock.positionFrame)).toBe(0.25);
    f.clock.advance(1);
    expect(f.render(f.boundary(2) + 1)).toBe(0.25);
    expect(f.takes).toHaveLength(1);
  });

  it("stops a partial overdub and restarts the original loop", () => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(1) + 317);
    f.command("loop-stop");
    expect(f.render(f.clock.positionFrame + 192)).toBe(0);
    f.command("loop-play");
    expect(f.render(f.boundary(2) + 1)).toBe(0.25);
    expect(f.takes).toHaveLength(1);
  });

  it("switches Undo and Redo only at the next loop boundary", () => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(2) + 1);
    const undo = f.revision(f.takes[0]);
    expect(f.render(f.boundary(3))).toBe(0.375);
    expect(f.messages).not.toContainEqual({ type: "loop-revision-applied", sequence: undo });
    expect(f.render(f.boundary(3) + 1)).toBe(0.25);
    expect(f.messages).toContainEqual({ type: "loop-revision-applied", sequence: undo });
    const redo = f.revision(f.takes[1]);
    expect(f.render(f.boundary(4))).toBe(0.25);
    expect(f.render(f.boundary(4) + 1)).toBe(0.375);
    expect(f.messages).toContainEqual({ type: "loop-revision-applied", sequence: redo });
  });

  it("cancels a queued Undo without changing the active loop", () => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(2) + 1);
    const undo = f.revision(f.takes[0]);
    f.command("loop-cancel-revision");
    expect(f.render(f.boundary(3) + 1)).toBe(0.375);
    expect(f.messages).toContainEqual({ type: "loop-revision-cancelled", sequence: undo });
  });

  it("settles a pending Undo when playback stops and applies stopped Redo immediately", () => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(2) + 1);
    const undo = f.revision(f.takes[0]);
    f.command("loop-stop");
    expect(f.messages).toContainEqual({ type: "loop-revision-applied", sequence: undo });
    const redo = f.revision(f.takes[1]);
    expect(f.messages).toContainEqual({ type: "loop-revision-applied", sequence: redo });
    f.command("loop-play");
    expect(f.render(f.boundary(3) + 1)).toBe(0.375);
  });

  it("does not undo an already committed take on a late capture cancellation", () => {
    const f = fixture();
    f.overdub();
    f.render(f.boundary(2));
    f.command("loop-cancel", { captureMode: "overdub" });
    expect(f.render(f.boundary(2) + 1)).toBe(0.375);
    expect(f.takes).toHaveLength(2);
  });

  it("fits fractional loop durations to absolute ticks without accumulating drift", () => {
    const f = fixture(44100, { bpm: 127, numerator: 7, denominator: 8 });
    f.overdub();
    f.render(f.boundary(2));
    expect(f.takes[1].metadata.frames).toBe(f.boundary(2) - f.boundary(1));
    for (let cycle = 2; cycle < 8; cycle += 1) {
      expect(f.render(f.boundary(cycle) + 1)).toBe(0.375);
    }
    f.revision(f.takes[0]);
    expect(f.render(f.boundary(8) + 1)).toBe(0.25);
  });
});

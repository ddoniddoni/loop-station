import { describe, expect, it } from "vitest";
import { AudioFrameClock, type TransportConfig } from "../../src/audio/transport/audio-frame-clock";
import { ticksPerBar } from "../../src/audio/transport/timing";
import { PcmLoop } from "../../src/audio/loop/pcm-loop";
import { isLoopMetadata, isLoopStatus, recordingCapacity } from "../../src/audio/loop/loop-protocol";

const standard: TransportConfig = { bpm: 120, numerator: 4, denominator: 4 };

function fixture(rate = 48000, config = standard) {
  const messages: unknown[] = [];
  const clock = new AudioFrameClock(rate);
  clock.configure(config);
  const loop = new PcmLoop(clock, rate, {
    postMessage(message, transfer = []) { messages.push(structuredClone(message, { transfer })); },
  });
  const frames = recordingCapacity(rate, config);
  const command = { type: "loop-record", sequence: 1, config, pcm: new ArrayBuffer(frames * 4), archive: new ArrayBuffer(frames * 4) };
  const bar = ticksPerBar(config.numerator, config.denominator);
  const start = clock.frameAtTick(bar);
  const end = clock.frameAtTick(bar * 5);
  function render(until: number, input: (frame: number) => number | undefined = () => 0.25) {
    const sizes = [64, 192, 127, 256];
    let block = 0;
    let last = 0;
    while (clock.positionFrame < until) {
      const count = Math.min(sizes[block++ % sizes.length], until - clock.positionFrame);
      const position = clock.positionFrame;
      for (let offset = 0; offset < count; offset += 1) last = loop.nextSample(input(position + offset), position + offset);
      clock.advance(count);
      loop.publish();
    }
    return last;
  }
  function captured() {
    for (const value of messages) {
      if (typeof value === "object" && value !== null && "type" in value && value.type === "loop-captured"
        && "metadata" in value && isLoopMetadata(value.metadata) && "pcm" in value && value.pcm instanceof ArrayBuffer) {
        return { metadata: value.metadata, pcm: value.pcm, sequence: "sequence" in value ? value.sequence : null };
      }
    }
    throw new Error("No captured PCM");
  }
  return { loop, clock, command, messages, start, end, render, captured };
}

describe("one-track PCM capture and audio-frame looping", () => {
  it.each([44100, 48000])("captures the exact four-bar interval at %i Hz with variable blocks", (rate) => {
    const f = fixture(rate);
    f.loop.handle(f.command, 192, true);
    expect(f.render(f.start)).toBe(0);
    f.render(f.end, (frame) => frame === f.start ? 0.75 : frame === f.end - 1 ? -0.5 : 0);
    const take = f.captured();
    expect(take.metadata.frames).toBe(rate * 8);
    expect(take.metadata.complete).toBe(true);
    const pcm = new Float32Array(take.pcm);
    expect(pcm[0]).toBe(0.75);
    expect(pcm[take.metadata.frames - 1]).toBe(-0.5);
    // The archive was transferred and detached; playback must use its own buffer.
    expect(f.render(f.end + 1, () => 0)).toBe(0.75);
  });

  it("accepts real silence as a complete capture", () => {
    const f = fixture();
    f.loop.handle(f.command, 64, true);
    f.render(f.end, () => 0);
    expect(f.captured().metadata.complete).toBe(true);
    expect(new Float32Array(f.captured().pcm).every((value) => value === 0)).toBe(true);
  });

  it("keeps fractional-duration loops aligned to absolute musical boundaries", () => {
    const f = fixture(44100, { bpm: 127, numerator: 7, denominator: 8 });
    f.loop.handle(f.command, 256, true);
    f.render(f.end, (frame) => frame === f.start ? 0.75 : 0);
    const ticks = ticksPerBar(7, 8) * 4;
    const playbackTick = ticksPerBar(7, 8) * 5;
    for (let cycle = 0; cycle < 12; cycle += 1) {
      const boundary = f.clock.frameAtTick(playbackTick + cycle * ticks);
      f.render(boundary);
      expect(f.render(boundary + 1)).toBe(0.75);
    }
  });

  it("cancels an armed take without leaving a clip or a locked buffer", () => {
    const f = fixture();
    f.loop.handle(f.command, 192, true);
    f.loop.handle({ type: "loop-cancel", sequence: 2 }, 192, true);
    f.render(f.end + 1);
    expect(f.loop.locked).toBe(false);
    expect(() => f.captured()).toThrow("No captured PCM");
  });

  it("preserves only valid samples after input loss and does not loop the incomplete take", () => {
    const f = fixture();
    f.loop.handle(f.command, 192, true);
    f.render(f.start + 317);
    expect(f.render(f.end + 1, () => undefined)).toBe(0);
    expect(f.captured().metadata).toMatchObject({ frames: 317, complete: false });
    expect(f.messages.filter(isLoopStatus).at(-1)?.phase).toBe("incomplete");
  });

  it("uses the take identity when a stop command interrupts capture", () => {
    const f = fixture();
    f.loop.handle(f.command, 192, true);
    f.render(f.start + 11);
    f.loop.handle({ type: "loop-stop", sequence: 2 }, 192, true);
    expect(f.captured()).toMatchObject({ sequence: 1, metadata: { frames: 11, complete: false } });
  });

  it("rejects undersized preallocated buffers before starting capture", () => {
    const f = fixture();
    f.loop.handle({ ...f.command, pcm: new ArrayBuffer(4) }, 192, true);
    f.loop.publish();
    expect(f.loop.locked).toBe(false);
    expect(f.messages.filter(isLoopStatus).at(-1)?.issue).toBeTruthy();
  });

  it("deduplicates commands and restores cleared PCM without recording again", () => {
    const f = fixture();
    f.loop.handle(f.command, 192, true);
    f.render(f.end);
    const take = f.captured();
    f.loop.handle({ type: "loop-clear", sequence: 2 }, 192, true);
    f.loop.handle({ type: "loop-restore", sequence: 3, metadata: take.metadata, pcm: take.pcm.slice(0) }, 192, false);
    f.loop.handle({ type: "loop-clear", sequence: 2 }, 192, false);
    f.loop.publish();
    expect(f.loop.locked).toBe(true);
    expect(f.messages.filter(isLoopStatus).at(-1)?.phase).toBe("stopped");
  });
});

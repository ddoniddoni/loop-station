import { describe, expect, it } from "vitest";
import { PcmStation } from "../../src/audio/loop/pcm-station";
import { isLoopMetadata, isLoopStatus, recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { AudioFrameClock } from "../../src/audio/transport/audio-frame-clock";

const config = { bpm: 120, numerator: 4, denominator: 4 };
const rate = 8000;
const capacity = recordingCapacity(rate, config);
const metadata = { ...config, sampleRate: rate, frames: capacity - 1, ticks: 15360, complete: true };
function fixture() {
  const messages: unknown[] = [];
  const clock = new AudioFrameClock(rate);
  const station = new PcmStation(clock, rate, {
    postMessage(message, transfer = []) { messages.push(structuredClone(message, { transfer })); },
  });
  function restore(trackId: number, value: number) {
    station.handle({ type: "loop-restore", trackId, sequence: 1, metadata, pcm: new Float32Array(capacity).fill(value).buffer }, 64, true);
  }
  function record(trackId: number) {
    station.handle({ type: "loop-record", trackId, sequence: 1, config, pcm: new ArrayBuffer(capacity * 4), archive: new ArrayBuffer(capacity * 4) }, 64, true);
  }
  function render(until: number, input = 0.125) {
    let last = 0;
    let block = 0;
    const blocks = [64, 192, 127, 256];
    while (clock.positionFrame < until) {
      const size = Math.min(blocks[block++ % blocks.length], until - clock.positionFrame);
      const start = clock.positionFrame;
      for (let frame = 0; frame < size; frame += 1) last = station.nextSample(input, start + frame);
      clock.advance(size);
      station.publish(false);
    }
    return last;
  }
  return { station, clock, messages, restore, record, render };
}

describe("eight tracks on one audio frame clock", () => {
  it("sums two tracks at the same boundary and stops only the addressed track", () => {
    const f = fixture();
    f.restore(0, 0.25);
    f.restore(7, 0.125);
    f.station.play(64);
    expect(f.render(16000)).toBe(0);
    expect(f.render(16001)).toBe(0.375);
    f.station.handle({ type: "loop-stop", trackId: 0, sequence: 2 }, 64, true);
    expect(f.render(16002)).toBe(0.125);
    f.station.stop();
    expect(f.render(16003)).toBe(0);
  });
  it("keeps the existing loop audible while another track captures and tags the PCM result", () => {
    const f = fixture();
    f.restore(0, 0.25);
    f.station.play(64);
    f.record(1);
    expect(f.render(16001)).toBe(0.25);
    expect(f.render(80000)).toBe(0.25);
    expect(f.render(80001)).toBe(0.375);
    const captured = f.messages.find((message) => typeof message === "object" && message !== null && "type" in message && message.type === "loop-captured");
    expect(captured).toMatchObject({ trackId: 1, sequence: 1, captureMode: "record", metadata });
    if (typeof captured !== "object" || captured === null || !("pcm" in captured) || !(captured.pcm instanceof ArrayBuffer)) throw new Error("Missing PCM");
    expect(new Float32Array(captured.pcm)[0]).toBe(0.125);
  });
  it("rejects simultaneous captures without cancelling the first track", () => {
    const f = fixture();
    f.record(0);
    f.record(1);
    f.station.publish(true);
    expect(f.messages.filter(isLoopStatus)).toEqual(expect.arrayContaining([
      expect.objectContaining({ trackId: 0, phase: "armed" }),
      expect.objectContaining({ trackId: 1, phase: "empty", issue: expect.any(String) }),
    ]));
    f.station.handle({ type: "loop-cancel", trackId: 0, sequence: 2, captureMode: "record" }, 64, true);
    expect(f.station.locked).toBe(false);
  });
  it("bounds the mix without changing captured PCM and rejects a conflicting restored tempo", () => {
    const f = fixture();
    f.restore(0, 0.75);
    f.restore(1, 0.75);
    f.station.handle({ type: "loop-restore", trackId: 2, sequence: 1, metadata: { ...metadata, bpm: 100 }, pcm: new ArrayBuffer(capacity * 4) }, 64, true);
    expect(f.clock.meter.bpm).toBe(120);
    f.station.play(64);
    expect(f.render(16001)).toBe(1);
    f.station.publish(true);
    expect(f.messages.filter(isLoopStatus)).toContainEqual(expect.objectContaining({ trackId: 2, phase: "empty", issue: expect.any(String) }));
    expect(isLoopMetadata(metadata)).toBe(true);
  });
});

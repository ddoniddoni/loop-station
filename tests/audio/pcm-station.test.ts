import { describe, expect, it } from "vitest";
import { PcmStation } from "../../src/audio/loop/pcm-station";
import { isLoopMetadata, isLoopStatus, recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { AudioFrameClock } from "../../src/audio/transport/audio-frame-clock";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { isOutputMeterSnapshot } from "../../src/audio/loop/output-meter";

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
    expect(f.render(16001)).toBe(0.1875);
    f.station.handle({ type: "loop-stop", trackId: 0, sequence: 2 }, 64, true);
    expect(f.render(16002)).toBe(0.0625);
    f.station.stop();
    expect(f.render(16003)).toBe(0);
  });
  it("keeps the existing loop audible while another track captures and tags the PCM result", () => {
    const f = fixture();
    f.restore(0, 0.25);
    f.station.play(64);
    f.record(1);
    expect(f.render(16001)).toBe(0.125);
    expect(f.render(80000)).toBe(0.125);
    expect(f.render(80001)).toBe(0.1875);
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
    f.restore(0, 1.5);
    f.restore(1, 1.5);
    f.station.handle({ type: "loop-restore", trackId: 2, sequence: 1, metadata: { ...metadata, bpm: 100 }, pcm: new ArrayBuffer(capacity * 4) }, 64, true);
    expect(f.clock.meter.bpm).toBe(120);
    f.station.play(64);
    expect(f.render(16001)).toBe(1);
    f.station.publish(true);
    expect(f.messages.filter(isLoopStatus)).toContainEqual(expect.objectContaining({ trackId: 2, phase: "empty", issue: expect.any(String) }));
    expect(isLoopMetadata(metadata)).toBe(true);
  });
});

describe("stereo master and PCM meters", () => {
  it("pans to either channel with a smooth transition and preserves center amplitude", () => {
    const f = fixture();
    f.restore(0, 0.25); f.station.play(64);
    expect(f.render(16001)).toBe(0.125);
    expect(f.station.right).toBe(0.125);
    const mix = defaultStationMix().map((track) => ({ ...track, pan: -1 }));
    f.station.handle({ type: "station-mixer", sequence: 1, mix, master: defaultMasterMix() }, 64, true);
    f.render(16002);
    expect(f.station.right).toBeGreaterThan(0);
    f.render(16081);
    expect(f.station.left).toBeCloseTo(0.125 * Math.SQRT2, 6);
    expect(f.station.right).toBe(0);
    f.station.handle({ type: "station-mixer", sequence: 2, mix: mix.map((track) => ({ ...track, pan: 1 })), master: defaultMasterMix() }, 64, true);
    f.render(16161);
    expect(f.station.left).toBe(0);
    expect(f.station.right).toBeCloseTo(0.125 * Math.SQRT2, 6);
  });
  it("attenuates before clipping, meters final stereo samples, and clears peak history", () => {
    const f = fixture();
    f.restore(0, 1.5); f.restore(1, 1.5); f.station.play(64);
    f.render(18000);
    const overloaded = f.messages.filter(isOutputMeterSnapshot).at(-1)!;
    expect(overloaded.left).toMatchObject({ peak: 1, clipped: true, hold: 1 });
    expect(overloaded.tracks[0]).toMatchObject({ peak: 1.5, clipped: true });
    f.station.handle({ type: "station-mixer", sequence: 1, mix: defaultStationMix(), master: { gainDb: -20, mute: false } }, 64, true);
    expect(f.render(20000)).toBeCloseTo(0.3, 6);
    f.station.handle({ type: "station-meter-reset", revision: 1 }, 64, true);
    f.render(22000);
    const attenuated = f.messages.filter(isOutputMeterSnapshot).at(-1)!;
    expect(attenuated.revision).toBe(1);
    expect(attenuated.left.clipped).toBe(false);
    expect(attenuated.left.peak).toBeCloseTo(0.3, 6);
    expect(attenuated.left.rms).toBeCloseTo(0.3, 6);
    f.station.handle({ type: "station-mixer", sequence: 2, mix: defaultStationMix(), master: { gainDb: -20, mute: true } }, 64, true);
    f.render(24000);
    expect(f.station.left).toBe(0); expect(f.station.right).toBe(0);
    expect(f.messages.filter(isOutputMeterSnapshot).at(-1)!.left.peak).toBe(0);
    f.station.handle({ type: "station-mixer", sequence: 3, mix: defaultStationMix(), master: { gainDb: -20, mute: false } }, 64, true);
    expect(f.render(26000)).toBeCloseTo(0.3, 6);
  });
  it("publishes silence with a stopped audio clock and retains hold until reset", () => {
    const f = fixture();
    f.restore(0, 0.25); f.station.play(64); f.render(18000);
    f.station.stop(); f.clock.stop();
    // Worklet frames continue even though the transport no longer advances.
    for (let block = 0; block < 20; block += 1) {
      for (let frame = 0; frame < 127; frame += 1) f.station.nextSample(0, f.clock.positionFrame + frame);
      f.station.publish(false);
    }
    const meter = f.messages.filter(isOutputMeterSnapshot).at(-1)!;
    expect(meter.left).toMatchObject({ peak: 0, rms: 0, hold: 0.125, clipped: false });
  });
});

describe("track mixing on the PCM path", () => {
  it("ramps gain, combines multiple solos, and lets mute override solo", () => {
    const f = fixture();
    f.restore(0, 0.25);
    f.restore(1, 0.125);
    f.restore(2, 0.0625);
    f.station.play(64);
    expect(f.render(16001)).toBe(0.21875);
    const mix = defaultStationMix().map((track, index) => ({ ...track, solo: index < 2,
      gainDb: index === 0 ? 20 * Math.log10(0.5) : 0 }));
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 1, mix }, 64, true);
    const firstRampSample = f.render(16002);
    expect(firstRampSample).toBeGreaterThan(0.125);
    expect(firstRampSample).toBeLessThan(0.21875);
    expect(f.render(16081)).toBeCloseTo(0.125, 8);
    mix[0] = { ...mix[0], mute: true };
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 2, mix }, 64, true);
    expect(f.render(16161)).toBeCloseTo(0.0625, 8);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 3, mix: defaultStationMix() }, 64, true);
    expect(f.render(16241)).toBeCloseTo(0.21875, 8);
    expect(f.messages).toContainEqual({ type: "station-mixer-applied", sequence: 3 });
  });
  it("keeps muted playback in phase instead of pausing or restarting the loop", () => {
    const f = fixture();
    const pcm = Float32Array.from({ length: capacity }, (_, index) => index / capacity);
    f.station.handle({ type: "loop-restore", trackId: 0, sequence: 1, metadata, pcm: pcm.buffer }, 64, true);
    f.station.play(64);
    f.render(16101);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 1,
      mix: defaultStationMix().map((track) => ({ ...track, mute: true })) }, 64, true);
    expect(f.render(17000)).toBe(0);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 2, mix: defaultStationMix() }, 64, true);
    expect(f.render(18001)).toBeCloseTo(1000 / capacity, 6);
  });
  it("captures original PCM when the recording track is muted and attenuated", () => {
    const f = fixture();
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 1,
      mix: defaultStationMix().map((track) => ({ ...track, mute: true, gainDb: -60 })) }, 64, true);
    f.record(0);
    expect(f.render(80001, 0.25)).toBe(0);
    const message = f.messages.find((value) => typeof value === "object" && value !== null && "type" in value && value.type === "loop-captured");
    if (typeof message !== "object" || message === null || !("pcm" in message) || !(message.pcm instanceof ArrayBuffer)) throw new Error("Missing capture");
    expect(new Float32Array(message.pcm)[0]).toBe(0.25);
    expect(new Float32Array(message.pcm)[metadata.frames - 1]).toBe(0.25);
  });
  it("rejects malformed and stale commands without changing sound or acknowledging them", () => {
    const f = fixture();
    f.restore(0, 0.25);
    f.station.play(64);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 2, mix: defaultStationMix() }, 64, true);
    const count = f.messages.length;
    const muted = defaultStationMix().map((track) => ({ ...track, mute: true }));
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 1, mix: muted }, 64, true);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 3, mix: muted.slice(1) }, 64, true);
    f.station.handle({ type: "station-mixer", master: defaultMasterMix(), sequence: 4, mix: muted.map((track) => ({ ...track, gainDb: NaN })) }, 64, true);
    expect(f.messages).toHaveLength(count);
    expect(f.render(16001)).toBe(0.125);
  });
});

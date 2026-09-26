import { describe, expect, it } from "vitest";
import { InputMonitorGate, isInputMonitorApplied } from "../../src/audio/input/input-monitor";
import { PcmStation } from "../../src/audio/loop/pcm-station";
import { isLoopMetadata, recordingCapacity, type LoopMetadata } from "../../src/audio/loop/loop-protocol";
import { AudioFrameClock } from "../../src/audio/transport/audio-frame-clock";
import { ticksPerBar } from "../../src/audio/transport/timing";
import { defaultStationMix } from "../../src/audio/loop/track-mixer";

describe("Worklet monitor command guard", () => {
  it("defaults OFF, distinguishes ON/AUTO, clamps only the monitor and resets on route change", () => {
    const gate = new InputMonitorGate();
    expect(gate.nextSample(0.5, true)).toBe(0);
    gate.route(1, true);
    expect(gate.nextSample(0.5, true)).toBe(0);
    const applied = gate.configure({ type: "input-monitor", revision: 1, sequence: 1, mode: "auto" });
    expect(isInputMonitorApplied(applied)).toBe(true);
    expect(gate.nextSample(1.25, false)).toBe(0);
    expect(gate.nextSample(1.25, true)).toBe(1);
    gate.configure({ type: "input-monitor", revision: 1, sequence: 2, mode: "on" });
    expect(gate.nextSample(-1.25, false)).toBe(-1);
    expect(gate.nextSample(NaN, true)).toBe(0);
    gate.route(2, true);
    expect(gate.nextSample(0.5, true)).toBe(0);
    gate.route(3, false);
    expect(gate.configure({ type: "input-monitor", revision: 3, sequence: 1, mode: "on" })).toBeNull();
    expect(gate.nextSample(0.5, true)).toBe(0);
  });

  it.each([
    { revision: 1, sequence: 4, mode: "on" },
    { revision: 2, sequence: 2, mode: "on" },
    { revision: 2, sequence: NaN, mode: "on" },
    { revision: 2, sequence: 3, mode: "other" },
  ])("rejects stale or invalid mode commands %j", (value) => {
    const gate = new InputMonitorGate();
    gate.route(2, true);
    gate.configure({ type: "input-monitor", revision: 2, sequence: 2, mode: "off" });
    expect(gate.configure({ type: "input-monitor", ...value })).toBeNull();
    expect(gate.nextSample(0.5, true)).toBe(0);
    expect(gate.route(1, true)).toBe(false);
  });
});

function fixture(rate = 8000, config = { bpm: 240, numerator: 4, denominator: 4 }) {
  const clock = new AudioFrameClock(rate); clock.configure(config);
  const takes: { metadata: LoopMetadata; pcm: ArrayBuffer; trackId: number }[] = [];
  const station = new PcmStation(clock, rate, { postMessage(message, transfer = []) {
    const data: unknown = structuredClone(message, { transfer });
    if (typeof data === "object" && data !== null && "type" in data && data.type === "loop-captured"
      && "metadata" in data && isLoopMetadata(data.metadata) && "pcm" in data && data.pcm instanceof ArrayBuffer
      && "trackId" in data && typeof data.trackId === "number") {
      takes.push({ metadata: data.metadata, pcm: data.pcm, trackId: data.trackId });
    }
  } });
  const gate = new InputMonitorGate(); gate.route(1, true);
  gate.configure({ type: "input-monitor", revision: 1, sequence: 1, mode: "auto" });
  let sequence = 0;
  function command(type: string, payload: object = {}, trackId = 0) {
    station.handle({ type, sequence: ++sequence, trackId, ...payload }, 192, true);
  }
  function buffers() {
    const bytes = recordingCapacity(rate, config, 1) * 4;
    return { pcm: new ArrayBuffer(bytes), archive: new ArrayBuffer(bytes) };
  }
  function render(until: number, input = 0.25) {
    let audible = 0;
    let last = 0;
    let block = 0;
    const sizes = [64, 192, 127, 256];
    while (clock.positionFrame < until) {
      const size = Math.min(sizes[block++ % sizes.length], until - clock.positionFrame);
      for (let offset = 0; offset < size; offset += 1) {
        station.nextSample(input, clock.positionFrame + offset);
        last = gate.nextSample(input, station.inputCaptured);
        if (last !== 0) audible += 1;
      }
      clock.advance(size);
    }
    return { audible, last };
  }
  const boundary = (bar: number) => clock.frameAtTick(bar * ticksPerBar(config.numerator, config.denominator));
  function record(trackId = 0) { command("loop-record", { config, bars: 1, ...buffers() }, trackId); }
  return { clock, station, gate, takes, command, buffers, render, boundary, record };
}

describe("AUTO follows the exact frames written by PCM capture", () => {
  it.each([8000, 44100, 48000])("includes first/last sample and excludes armed/playback frames at %i Hz", (rate) => {
    const f = fixture(rate, { bpm: 127, numerator: 7, denominator: 8 });
    f.record();
    expect(f.render(f.boundary(1))).toEqual({ audible: 0, last: 0 });
    expect(f.render(f.boundary(1) + 1, 1.25)).toEqual({ audible: 1, last: 1 });
    const middle = f.render(f.boundary(2), 1.25);
    expect(middle.audible).toBe(f.boundary(2) - f.boundary(1) - 1);
    expect(middle.last).toBe(1);
    expect(f.render(f.boundary(2) + 1)).toEqual({ audible: 0, last: 0 });
    const take = f.takes[0];
    expect(take.metadata.frames).toBe(f.boundary(2) - f.boundary(1));
    const pcm = new Float32Array(take.pcm, 0, take.metadata.frames);
    expect(pcm.every((sample) => sample === 1.25)).toBe(true);
  });

  it("opens once for an overdub, monitors B only, and captures A+B", () => {
    const f = fixture(); f.record(); f.render(f.boundary(2) + 1);
    f.command("loop-overdub", f.buffers());
    expect(f.render(f.boundary(3), 0.125).audible).toBe(0);
    expect(f.render(f.boundary(4), 0.125)).toEqual({ audible: 8000, last: 0.125 });
    expect(f.render(f.boundary(4) + 1).audible).toBe(0);
    expect(new Float32Array(f.takes[0].pcm)[0]).toBe(0.25);
    expect(new Float32Array(f.takes[1].pcm)[0]).toBe(0.375);
  });

  it.each(["record", "overdub"] as const)("stays closed for cancelled armed %s", (captureMode) => {
    const f = fixture(); f.record();
    if (captureMode === "overdub") { f.render(f.boundary(2) + 1); f.command("loop-overdub", f.buffers()); }
    f.command("loop-cancel", { captureMode });
    expect(f.render(f.clock.positionFrame + 9000).audible).toBe(0);
    expect(f.takes).toHaveLength(captureMode === "record" ? 0 : 1);
  });

  it.each(["cancel", "stop", "disconnect"])("closes immediately on %s during an overdub and keeps A", (action) => {
    const f = fixture(); f.record(); f.render(f.boundary(2) + 1);
    f.command("loop-overdub", f.buffers()); f.render(f.boundary(3) + 317);
    if (action === "cancel") f.command("loop-cancel", { captureMode: "overdub" });
    else if (action === "stop") f.station.stop();
    else f.station.interrupt();
    expect(f.render(f.boundary(4) + 1).audible).toBe(0);
    expect(f.takes).toHaveLength(1);
    expect(new Float32Array(f.takes[0].pcm)[0]).toBe(0.25);
  });

  it.each([undefined, NaN, Infinity])("does not monitor an invalid capture sample %s", (input) => {
    const f = fixture(); f.record(); f.render(f.boundary(1) + 1);
    f.station.nextSample(input, f.clock.positionFrame);
    expect(f.station.inputCaptured).toBe(false);
    expect(f.gate.nextSample(0.5, f.station.inputCaptured)).toBe(0);
  });

  it("monitor mode changes never stop capture or change recorded PCM", () => {
    const f = fixture(); f.record(); f.render(f.boundary(1));
    f.gate.configure({ type: "input-monitor", revision: 1, sequence: 2, mode: "off" });
    expect(f.render(f.boundary(1) + 4000).audible).toBe(0);
    f.gate.configure({ type: "input-monitor", revision: 1, sequence: 3, mode: "on" });
    expect(f.render(f.boundary(2)).audible).toBe(4000);
    expect(new Float32Array(f.takes[0].pcm, 0, 8000).every((sample) => sample === 0.25)).toBe(true);
    expect(f.render(f.boundary(2) + 1).last).toBe(0.25);
  });

  it("track/master mute and multiple playing tracks do not change the shared AUTO input", () => {
    const f = fixture(); f.record(); f.render(f.boundary(2) + 1);
    f.command("loop-restore", { metadata: f.takes[0].metadata, pcm: f.takes[0].pcm.slice(0) }, 1);
    f.station.play(192);
    f.station.handle({ type: "station-mixer", sequence: 1, mix: defaultStationMix().map((track) => ({ ...track, mute: true })),
      master: { gainDb: 0, mute: true } }, 192, true);
    f.record(7);
    expect(f.render(f.boundary(3)).audible).toBe(0);
    expect(f.render(f.boundary(4))).toEqual({ audible: 8000, last: 0.25 });
    expect(f.station.left).toBe(0);
    expect(f.takes[1].trackId).toBe(7);
  });
});

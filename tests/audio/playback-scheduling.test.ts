import { describe, expect, it } from "vitest";
import { AudioFrameClock, type TransportConfig } from "../../src/audio/transport/audio-frame-clock";
import { PcmLoop } from "../../src/audio/loop/pcm-loop";
import { PcmStation } from "../../src/audio/loop/pcm-station";
import { isLoopStatus, type LoopMetadata } from "../../src/audio/loop/loop-protocol";
import { isPendingPlayback, playbackBoundary } from "../../src/audio/loop/playback-scheduling";

const standard = { bpm: 120, numerator: 4, denominator: 4 };
function metadata(rate: number, config: TransportConfig, bars = 1): LoopMetadata {
  const ticks = config.numerator * 4 / config.denominator * 960 * bars;
  return { ...config, sampleRate: rate, ticks, frames: Math.round(ticks / 960 * 60 / config.bpm * rate), complete: true };
}

function fixture(rate = 8000, config = standard, bars = 1) {
  const clock = new AudioFrameClock(rate); clock.configure(config);
  const messages: unknown[] = [];
  const loop = new PcmLoop(clock, rate, { postMessage: (message) => messages.push(structuredClone(message)) });
  const meta = metadata(rate, config, bars);
  const pcm = new Float32Array(meta.frames).fill(0.25);
  let sequence = 0;
  function command(type: string, payload: object = {}, block = 127) {
    loop.handle({ type, sequence: ++sequence, ...payload }, block, false);
    loop.publish(true);
    return sequence;
  }
  function status() {
    const result = messages.filter(isLoopStatus).at(-1);
    if (!result) throw new Error("Missing loop status");
    return result;
  }
  function render(until: number) {
    let last = 0;
    const blocks = [64, 192, 127, 256]; let block = 0;
    while (clock.positionFrame < until) {
      const start = clock.positionFrame;
      const count = Math.min(blocks[block++ % blocks.length], until - start);
      for (let i = 0; i < count; i += 1) last = loop.nextSample(undefined, start + i);
      clock.advance(count); loop.publish();
    }
    return last;
  }
  command("loop-restore", { metadata: meta, pcm: pcm.buffer });
  clock.start();
  return { clock, loop, messages, meta, pcm, command, status, render };
}

describe("playback grid on the common audio clock", () => {
  it.each([
    ["immediate", 4, 4, 1000], ["beat", 4, 4, 4000], ["bar", 4, 4, 16000],
    ["beat", 3, 4, 4000], ["bar", 3, 4, 12000],
    ["beat", 6, 8, 2000], ["bar", 6, 8, 12000],
    ["beat", 7, 8, 2000], ["bar", 7, 8, 14000],
  ] as const)("resolves %s in %i/%i without confusing beat and quarter-note BPM", (timing, numerator, denominator, expected) => {
    const clock = new AudioFrameClock(8000); clock.configure({ bpm: 120, numerator, denominator });
    clock.start(); clock.advance(1000);
    expect(playbackBoundary(clock, timing, 127).frame).toBe(expected);
  });

  it("skips a too-close boundary, accepts one with two blocks of lead, and never backdates a late command", () => {
    const clock = new AudioFrameClock(8000); clock.start(); clock.advance(3746);
    expect(playbackBoundary(clock, "beat", 127).frame).toBe(4000);
    clock.advance(1);
    expect(playbackBoundary(clock, "beat", 127).frame).toBe(8000);
    clock.advance(4254);
    expect(playbackBoundary(clock, "beat", 192).frame).toBe(12000);
    expect(playbackBoundary(clock, "immediate", 192).frame).toBe(8001);
  });
});

describe("sample-exact playback and stop reservations", () => {
  it.each([8000, 44100, 48000])("starts and stops at the announced frame at %i Hz with fractional 7/8 boundaries", (rate) => {
    const f = fixture(rate, { bpm: 127, numerator: 7, denominator: 8 });
    f.clock.advance(123);
    f.command("loop-play", { timing: "beat" });
    const start = Math.round(rate * 60 / 127 / 2);
    expect(f.status()).toMatchObject({ phase: "stopped", pendingPlay: true, pendingPlayback: { action: "play", frame: start } });
    expect(f.render(start)).toBe(0);
    expect(f.render(start + 1)).toBe(0.25);
    expect(f.status()).toMatchObject({ phase: "playing", pendingPlayback: null });
    f.command("loop-stop", { timing: "bar" });
    const stop = Math.round(rate * 60 / 127 * 3.5);
    expect(f.status()).toMatchObject({ phase: "playing", pendingPlayback: { action: "stop", frame: stop } });
    expect(f.render(stop)).toBe(0.25);
    expect(f.render(stop + 1)).toBe(0);
    expect(f.status()).toMatchObject({ phase: "stopped", pendingPlayback: null });
    expect(f.pcm.every((value) => value === 0.25)).toBe(true);
  });

  it("executes immediate commands at the next rendered frame without quantized lead", () => {
    const f = fixture(); f.clock.advance(111);
    f.command("loop-play", { timing: "immediate" });
    expect(f.status().phase).toBe("stopped");
    expect(f.render(112)).toBe(0.25);
    f.command("loop-stop", { timing: "immediate" });
    expect(f.render(113)).toBe(0);
    expect(f.status().pendingPlayback).toBeNull();
  });

  it("cancels play and stop independently of the current phase and keeps original PCM", () => {
    const f = fixture();
    const play = f.command("loop-play", { timing: "bar" });
    f.command("loop-cancel-playback", { targetSequence: play });
    expect(f.render(16001)).toBe(0);
    expect(f.status().phase).toBe("stopped");
    f.command("loop-play", { timing: "immediate" }); f.render(16002);
    const stop = f.command("loop-stop", { timing: "bar" });
    f.command("loop-cancel-playback", { targetSequence: stop });
    expect(f.render(32001)).toBe(0.25);
    expect(f.status()).toMatchObject({ phase: "playing", pendingPlayback: null });
    expect(f.pcm.every((value) => value === 0.25)).toBe(true);
  });

  it("ignores duplicate/older commands and does not cancel a different reservation", () => {
    const f = fixture();
    const play = f.command("loop-play", { timing: "beat" });
    const target = f.status().pendingPlayback;
    f.loop.handle({ type: "loop-stop", sequence: play, timing: "immediate" }, 127, false);
    f.loop.publish(true); expect(f.status().pendingPlayback).toEqual(target);
    f.command("loop-cancel-playback", { targetSequence: play + 100 });
    expect(f.status().pendingPlayback).toEqual(target);
    f.command("loop-play", { timing: "bar" });
    expect(f.status().pendingPlayback).toEqual(target);
    f.command("loop-cancel-playback", { targetSequence: play });
    expect(f.status().pendingPlayback).toBeNull();
  });

  it("a late cancellation cannot undo an already executed play or stop", () => {
    const f = fixture();
    const play = f.command("loop-play", { timing: "beat" }); f.render(4001);
    f.command("loop-cancel-playback", { targetSequence: play });
    expect(f.render(4002)).toBe(0.25);
    const stop = f.command("loop-stop", { timing: "beat" }); f.render(8001);
    f.command("loop-cancel-playback", { targetSequence: stop });
    expect(f.render(8002)).toBe(0);
    expect(f.status().phase).toBe("stopped");
  });

  it.each(["play", "stop"] as const)("immediate global stop removes a pending %s and restart needs a new command", (action) => {
    const f = fixture();
    if (action === "stop") { f.command("loop-play", { timing: "immediate" }); f.render(1); }
    f.command(`loop-${action}`, { timing: "bar" });
    f.loop.stop(); f.clock.stop(); f.loop.publish(true);
    expect(f.status()).toMatchObject({ phase: "stopped", pendingPlayback: null });
    f.clock.start(); expect(f.render(16001)).toBe(0);
  });

  it("rejects invalid timing and prevents revision/overdub conflicts without losing reservations", () => {
    const f = fixture();
    f.command("loop-play", { timing: "invalid" });
    expect(f.status().pendingPlayback).toBeNull(); expect(f.status().issue).not.toBeNull();
    f.command("loop-play", { timing: "beat" });
    const pending = f.status().pendingPlayback;
    f.command("loop-revision", { metadata: f.meta, pcm: f.pcm.slice().buffer });
    expect(f.messages).toContainEqual(expect.objectContaining({ type: "loop-revision-rejected" }));
    expect(f.status().pendingPlayback).toEqual(pending);
    f.render(4001);
    f.command("loop-stop", { timing: "bar" });
    f.command("loop-overdub");
    expect(f.status()).toMatchObject({ phase: "playing", pendingPlayback: { action: "stop" } });
    expect(f.render(16001)).toBe(0);
  });

  it("keeps playback reservations independent of microphone disconnection", () => {
    const f = fixture(); f.command("loop-play", { timing: "beat" });
    f.loop.interrupt();
    expect(f.render(4001)).toBe(0.25);
  });

  it("clear and restore discard old reservations without applying them to replacement PCM", () => {
    const f = fixture(); f.command("loop-play", { timing: "bar" });
    f.command("loop-clear");
    f.command("loop-restore", { metadata: f.meta, pcm: new Float32Array(f.meta.frames).fill(0.5).buffer });
    expect(f.render(16001)).toBe(0);
    f.command("loop-play", { timing: "immediate" });
    expect(f.render(16002)).toBe(0.5);
  });

  it("stops one of two mixed-length tracks while the other continues on the common grid", () => {
    const clock = new AudioFrameClock(8000); clock.start();
    const messages: unknown[] = [];
    const station = new PcmStation(clock, 8000, { postMessage: (message) => messages.push(structuredClone(message)) });
    for (const [trackId, bars] of [[0, 1], [7, 8]]) {
      const meta = metadata(8000, standard, bars);
      station.handle({ type: "loop-restore", trackId, sequence: 1, metadata: meta, pcm: new Float32Array(meta.frames).fill(0.25).buffer }, 127, false);
      station.handle({ type: "loop-play", trackId, sequence: 2, timing: "immediate" }, 127, false);
    }
    expect(station.nextSample(undefined, 0)).toBeCloseTo(0.25, 6); clock.advance(1);
    station.handle({ type: "loop-stop", trackId: 0, sequence: 3, timing: "beat" }, 127, false);
    for (let frame = 1; frame < 4000; frame += 1) { station.nextSample(undefined, frame); clock.advance(1); }
    expect(station.nextSample(undefined, 4000)).toBeCloseTo(0.125, 6);
    station.publish(true);
    expect(messages.filter(isLoopStatus)).toEqual(expect.arrayContaining([
      expect.objectContaining({ trackId: 0, phase: "stopped" }), expect.objectContaining({ trackId: 7, phase: "playing" }),
    ]));
  });
});

describe("pending playback protocol validation", () => {
  it("rejects malformed targets and inconsistent phase/sequence flags", () => {
    const f = fixture(); f.command("loop-play", { timing: "bar" });
    const status = f.status();
    expect(isLoopStatus(status)).toBe(true);
    expect(isLoopStatus({ ...status, pendingPlay: false })).toBe(false);
    expect(isLoopStatus({ ...status, phase: "playing" })).toBe(false);
    expect(isLoopStatus({ ...status, pendingPlayback: { ...status.pendingPlayback, sequence: status.sequence + 1 } })).toBe(false);
    expect(isPendingPlayback({ action: "play", timing: "bar", sequence: 1, frame: NaN, tick: 0 })).toBe(false);
    expect(isPendingPlayback(undefined)).toBe(false);
  });
});

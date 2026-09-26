import { describe, expect, it } from "vitest";
import { TapTempo } from "../../src/audio/transport/tap-tempo";

describe("quarter-note Tap Tempo input", () => {
  it.each([40, 60, 96, 120, 127, 180, 240])("suggests %i BPM after two taps, including both supported limits", (bpm) => {
    const tempo = new TapTempo();
    expect(tempo.tap(0)).toEqual({ status: "waiting", bpm: null, intervals: 0 });
    expect(tempo.tap(60_000 / bpm)).toEqual({ status: "ready", bpm, intervals: 1 });
  });

  it("averages intervals before rounding the BPM", () => {
    const tempo = new TapTempo();
    for (const time of [0, 500, 990, 1500]) tempo.tap(time);
    expect(tempo.tap(2020)).toEqual({ status: "ready", bpm: 119, intervals: 4 });
  });

  it("uses only the latest four intervals and keeps the window bounded", () => {
    const tempo = new TapTempo();
    for (const time of [0, 1000, 2000, 3000, 4000, 4500, 5000, 5500]) tempo.tap(time);
    expect(tempo.tap(6000)).toEqual({ status: "ready", bpm: 120, intervals: 4 });
    for (let time = 6500; time <= 60_000; time += 500) {
      expect(tempo.tap(time)).toEqual({ status: "ready", bpm: 120, intervals: 4 });
    }
  });

  it("ignores fast double taps without moving the last accepted timestamp", () => {
    const tempo = new TapTempo();
    tempo.tap(0);
    expect(tempo.tap(249)).toEqual({ status: "too-fast", bpm: null, intervals: 0 });
    expect(tempo.tap(500)).toEqual({ status: "ready", bpm: 120, intervals: 1 });
    expect(tempo.tap(600)).toEqual({ status: "too-fast", bpm: 120, intervals: 1 });
    expect(tempo.tap(1000)).toEqual({ status: "ready", bpm: 120, intervals: 2 });
  });

  it("starts a new sequence after a pause longer than the 40 BPM interval", () => {
    const tempo = new TapTempo();
    tempo.tap(0); tempo.tap(500);
    expect(tempo.tap(2001)).toEqual({ status: "restarted", bpm: null, intervals: 0 });
    expect(tempo.tap(2751)).toEqual({ status: "ready", bpm: 80, intervals: 1 });
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 500])("ignores invalid or non-monotonic timestamp %s without corrupting history", (timestamp) => {
    const tempo = new TapTempo();
    tempo.tap(0); tempo.tap(500);
    expect(tempo.tap(timestamp)).toEqual({ status: "invalid", bpm: 120, intervals: 1 });
    expect(tempo.tap(1000)).toEqual({ status: "ready", bpm: 120, intervals: 2 });
  });

  it("clears the proposal and interval history on explicit reset", () => {
    const tempo = new TapTempo();
    tempo.tap(0); tempo.tap(500);
    expect(tempo.reset()).toEqual({ status: "idle", bpm: null, intervals: 0 });
    expect(tempo.tap(1000)).toEqual({ status: "waiting", bpm: null, intervals: 0 });
    expect(tempo.tap(2000)).toEqual({ status: "ready", bpm: 60, intervals: 1 });
  });
});

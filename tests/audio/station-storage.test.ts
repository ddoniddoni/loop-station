import { describe, expect, it } from "vitest";
import type { CachedLoop } from "../../src/audio/loop/loop-history";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { createLoopSession } from "../../src/audio/storage/loop-session";
import { createStationSession, decodeStationSession, emptyStationHistory } from "../../src/audio/storage/station-session";

function take(value = 0.125, bpm = 120): CachedLoop {
  const config = { bpm, numerator: 4, denominator: 4 };
  const capacity = recordingCapacity(8000, config);
  return { pcm: new Float32Array(capacity).fill(value).buffer,
    metadata: { ...config, sampleRate: 8000, frames: capacity - 1, ticks: 15360, complete: true } };
}

describe("versioned eight-track project", () => {
  it("migrates a v1 take and its Undo into track 01 without changing the old revision or PCM", async () => {
    const legacy = await createLoopSession({ current: take(0.25), undo: take(), redo: null, cleared: null });
    const migrated = await decodeStationSession(legacy);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.history).toHaveLength(8);
    expect(migrated.history[0]).toEqual(legacy.history);
    expect(migrated.history.slice(1).every((track) => track.current === null)).toBe(true);
    expect(legacy.schemaVersion).toBe(1);
    const saved = await createStationSession(migrated.history);
    expect(saved.revision).not.toBe(legacy.revision);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(migrated.history);
  });
  it("round trips separate takes, Undo, and cleared history in all eight slots", async () => {
    const history = emptyStationHistory();
    history.forEach((track, index) => { track.current = take((index + 1) / 16); });
    history[2].undo = take();
    history[7] = { current: null, undo: null, redo: null, cleared: { current: take(0.75), undo: take(0.5), redo: null } };
    const saved = await createStationSession(history);
    expect((await decodeStationSession(structuredClone(saved))).history).toEqual(history);
  });
  it("detects cross-track swaps and corrupted PCM", async () => {
    const history = emptyStationHistory();
    history[0].current = take(0.25);
    history[1].current = take(0.5);
    const saved = await createStationSession(history);
    const swapped = structuredClone(saved);
    [swapped.history[0], swapped.history[1]] = [swapped.history[1], swapped.history[0]];
    await expect(decodeStationSession(swapped)).rejects.toMatchObject({ code: "corrupt" });
    new Float32Array(saved.history[1].current!.pcm)[0] = 0;
    await expect(decodeStationSession(saved)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("rejects incompatible tempos, missing tracks, and future formats", async () => {
    const history = emptyStationHistory();
    history[0].current = take();
    history[1].current = take(0.25, 100);
    await expect(createStationSession(history)).rejects.toMatchObject({ code: "corrupt" });
    await expect(createStationSession(history.slice(1))).rejects.toMatchObject({ code: "corrupt" });
    await expect(createStationSession(new Array<never>(8))).rejects.toMatchObject({ code: "corrupt" });
    await expect(decodeStationSession({ schemaVersion: 3 })).rejects.toMatchObject({ code: "version" });
  });
});

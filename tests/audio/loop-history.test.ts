import { describe, expect, it } from "vitest";
import { LoopHistory, type CachedLoop } from "../../src/audio/loop/loop-history";

function take(value: number, complete = true): CachedLoop {
  return { pcm: new Float32Array([value, value]).buffer,
    metadata: { bpm: 120, numerator: 4, denominator: 4, sampleRate: 48000, frames: 2, ticks: 3840, complete } };
}

describe("bounded one-step loop history", () => {
  it("keeps immutable A and A+B for Undo and Redo", () => {
    const history = new LoopHistory();
    const a = take(0.25);
    const ab = take(0.375);
    history.commit(a, "record");
    history.commit(ab, "overdub");
    expect(history.apply("undo", a)).toBe(true);
    expect(history.current).toBe(a);
    expect(history.canUndo).toBe(false);
    expect(history.apply("redo", ab)).toBe(true);
    expect(history.current).toBe(ab);
    expect(new Float32Array(a.pcm)[0]).toBe(0.25);
    expect(history.retainedBytes).toBe(a.pcm.byteLength + ab.pcm.byteLength);
  });

  it("replaces Redo only when a new complete overdub commits", () => {
    const history = new LoopHistory();
    const a = take(0.25);
    const ab = take(0.375);
    history.commit(a, "record");
    history.commit(ab, "overdub");
    history.apply("undo", a);
    history.commit(take(0.5, false), "overdub");
    expect(history.target("redo")).toBe(ab);
    const ac = take(0.625);
    history.commit(ac, "overdub");
    expect(history.canRedo).toBe(false);
    expect(history.target("undo")).toBe(a);
    expect(history.apply("redo", ab)).toBe(false);
    expect(history.current).toBe(ac);
  });

  it("restores the cleared clip together with its Undo/Redo history", () => {
    const history = new LoopHistory();
    const a = take(0.25);
    const ab = take(0.375);
    history.commit(a, "record");
    history.commit(ab, "overdub");
    history.clear();
    expect(history.current).toBeNull();
    expect(history.dirty).toBe(true);
    expect(history.retainedBytes).toBe(16);
    expect(history.restore()).toBe(true);
    expect(history.current).toBe(ab);
    expect(history.apply("undo", a)).toBe(true);
  });

  it("preserves a cleared complete loop through an incomplete replacement", () => {
    const history = new LoopHistory();
    const a = take(0.25);
    history.commit(a, "record");
    history.clear();
    history.commit(take(0.5, false), "record");
    history.clear();
    history.restore();
    expect(history.current).toBe(a);
    history.clear();
    history.commit(take(0.75), "record");
    expect(history.canRestore).toBe(false);
  });
});

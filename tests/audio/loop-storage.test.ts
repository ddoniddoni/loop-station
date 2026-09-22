import { describe, expect, it, vi } from "vitest";
import { LoopHistory, type CachedLoop, type LoopHistoryState } from "../../src/audio/loop/loop-history";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";
import { createLoopSession, decodeLoopSession, LoopStorageError, type LoopRepository } from "../../src/audio/storage/loop-session";
import { LoopPersistence } from "../../src/audio/storage/loop-persistence";
import { LoopController } from "../../src/audio/loop/loop-controller";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";

function take(value = 0.25): CachedLoop {
  const config = { bpm: 120, numerator: 4, denominator: 4 };
  return { pcm: new Float32Array(recordingCapacity(8000, config)).fill(value).buffer,
    metadata: { ...config, sampleRate: 8000, frames: 64000, ticks: 15360, complete: true } };
}
function history(): LoopHistoryState {
  return { current: take(), undo: null, redo: null, cleared: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("saved PCM session validation", () => {
  it("round trips actual PCM, tempo, Undo and cleared recovery without mutating buffers", async () => {
    const original = take();
    const mixed = take(0.375);
    const edits = new LoopHistory();
    edits.commit(original, "record");
    edits.commit(mixed, "overdub");
    edits.clear();
    const stored = await createLoopSession(edits.snapshot());
    const loaded = await decodeLoopSession(structuredClone(stored));
    const restored = new LoopHistory();
    restored.hydrate(loaded.history);
    expect(restored.current).toBeNull();
    expect(restored.restore()).toBe(true);
    expect(new Float32Array(restored.current!.pcm)[0]).toBe(0.375);
    expect(restored.current!.metadata).toEqual(mixed.metadata);
    expect(restored.target("undo")!.pcm).toEqual(original.pcm);
    expect(original.pcm.byteLength).toBeGreaterThan(0);
  });
  it("rejects PCM and metadata corruption without returning a playable session", async () => {
    const stored = await createLoopSession(history());
    const pcmChanged = structuredClone(stored);
    new Float32Array(pcmChanged.history.current!.pcm)[20] = 0.5;
    await expect(decodeLoopSession(pcmChanged)).rejects.toMatchObject({ code: "corrupt" });
    const metadataChanged = structuredClone(stored);
    metadataChanged.history.current!.metadata.complete = false;
    await expect(decodeLoopSession(metadataChanged)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("rejects a future schema and invalid musical length", async () => {
    const stored = await createLoopSession(history());
    await expect(decodeLoopSession({ ...stored, schemaVersion: 2 })).rejects.toMatchObject({ code: "version" });
    stored.history.current!.metadata.frames = 12;
    await expect(decodeLoopSession(stored)).rejects.toMatchObject({ code: "corrupt" });
  });
  it("rejects non-finite audio before preparing a saved session", async () => {
    const state = history();
    new Float32Array(state.current!.pcm)[0] = Number.NaN;
    await expect(createLoopSession(state)).rejects.toMatchObject({ code: "corrupt" });
  });
});

describe("local persistence outcomes", () => {
  it("blocks editing until loading finishes and initializes only once", async () => {
    const saved = await createLoopSession(history());
    const read = deferred<typeof saved>();
    const repository: LoopRepository = { load: vi.fn(() => read.promise), save: vi.fn() };
    const hydrate = vi.fn();
    const persistence = new LoopPersistence(repository, hydrate, vi.fn());
    const first = persistence.initialize();
    const second = persistence.initialize();
    expect(persistence.snapshot.editLocked).toBe(true);
    read.resolve(saved);
    await Promise.all([first, second]);
    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledExactlyOnceWith(saved.history);
    expect(persistence.snapshot).toMatchObject({ phase: "saved", editLocked: false, savedAt: saved.updatedAt });
    expect(persistence.dirty).toBe(false);
  });
  it("does not announce saved or clear the unload warning before the write finishes", async () => {
    const state = history();
    const saved = await createLoopSession(state);
    const write = deferred<typeof saved>();
    const repository: LoopRepository = { load: async () => null, save: vi.fn(() => write.promise) };
    const persistence = new LoopPersistence(repository, vi.fn(), vi.fn());
    await persistence.initialize();
    persistence.changed(state);
    expect(persistence.snapshot).toMatchObject({ phase: "saving", editLocked: true, savedAt: null });
    expect(persistence.dirty).toBe(true);
    write.resolve(saved);
    await persistence.retry();
    expect(persistence.snapshot.phase).toBe("saved");
    expect(persistence.dirty).toBe(false);
    expect(repository.save).toHaveBeenCalledExactlyOnceWith(state, null);
  });
  it("keeps the base revision after failure and retries the unsaved edit", async () => {
    const base = await createLoopSession(history());
    const save = vi.fn<LoopRepository["save"]>();
    save.mockRejectedValueOnce(new DOMException("full", "QuotaExceededError"));
    save.mockImplementationOnce(async (state) => createLoopSession(state));
    const persistence = new LoopPersistence({ load: async () => base, save }, vi.fn(), vi.fn());
    await persistence.initialize();
    persistence.changed({ ...history(), current: take(0.375) });
    await persistence.retry();
    expect(persistence.snapshot).toMatchObject({ phase: "error", savedAt: base.updatedAt, canRetry: true });
    expect(persistence.dirty).toBe(true);
    await persistence.retry();
    expect(save.mock.calls[1][1]).toBe(base.revision);
    expect(persistence.snapshot.phase).toBe("saved");
  });
  it("never writes over an unreadable saved session, including session-only playback", async () => {
    const repository: LoopRepository = { load: async () => { throw new LoopStorageError("corrupt", "bad saved data"); }, save: vi.fn() };
    const persistence = new LoopPersistence(repository, vi.fn(), vi.fn());
    await persistence.initialize();
    expect(persistence.snapshot.editLocked).toBe(true);
    persistence.useSessionOnly();
    persistence.changed(history());
    await persistence.retry();
    expect(repository.save).not.toHaveBeenCalled();
    expect(persistence.snapshot.phase).toBe("session");
    expect(persistence.dirty).toBe(true);
  });
  it("blocks overwriting another tab's revision and retains the local edit", async () => {
    const repository: LoopRepository = { load: async () => null, save: vi.fn(async () => { throw new LoopStorageError("conflict", "other tab"); }) };
    const persistence = new LoopPersistence(repository, vi.fn(), vi.fn());
    await persistence.initialize();
    persistence.changed(history());
    await persistence.retry();
    expect(persistence.snapshot).toMatchObject({ phase: "conflict", editLocked: true, canRetry: false });
    await persistence.retry();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(persistence.dirty).toBe(true);
  });
  it("loads a stopped loop before AudioContext exists and sends restored tempo on attachment", async () => {
    const saved = await createLoopSession(history());
    const controller = new LoopController(new MicrophoneController(), { load: async () => saved, save: vi.fn() });
    await controller.initializeStorage();
    expect(controller.getSnapshot()).toMatchObject({ phase: "stopped", hasClip: true, connected: false, metadata: saved.history.current!.metadata });
    expect(controller.dirty).toBe(false);
    const postMessage = vi.fn();
    controller.attach({ sampleRate: 8000, state: "running" } as AudioContext, { port: { postMessage } } as unknown as AudioWorkletNode);
    expect(postMessage.mock.calls[0][0]).toMatchObject({ type: "loop-restore", metadata: saved.history.current!.metadata });
    expect(controller.getSnapshot().phase).toBe("stopped");
  });
});

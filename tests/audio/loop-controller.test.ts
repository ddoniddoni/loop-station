import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { LoopController } from "../../src/audio/loop/loop-controller";
import { recordingCapacity, type CaptureMode, type LoopMetadata } from "../../src/audio/loop/loop-protocol";
import type { LoopRepository } from "../../src/audio/storage/loop-session";

function fixture(bpm = 120, repository: LoopRepository | null = null) {
  const input = new MicrophoneController();
  const inputState = { ...input.getSnapshot(), phase: "active" as const, routed: true };
  vi.spyOn(input, "getSnapshot").mockReturnValue(inputState);
  const controller = new LoopController(input, repository);
  const messages: { type: string; sequence: number; bars?: number; pcm?: ArrayBuffer }[] = [];
  const port = { postMessage(value: typeof messages[number], transfer: Transferable[] = []) {
    messages.push(structuredClone(value, { transfer }));
  } };
  controller.attach({ sampleRate: 48000, state: "running" } as AudioContext, { port } as unknown as AudioWorkletNode);
  const config = { bpm, numerator: 4, denominator: 4 };
  controller.acceptTransport({ type: "transport", ...config, playing: true, positionFrame: 0, positionTick: 0, contextFrame: 0 });
  const metadata: LoopMetadata = { ...config, sampleRate: 48000, frames: 48000 * 16 * 60 / bpm, ticks: 15360, complete: true };
  function status(sequence: number, phase: "empty" | "playing") {
    controller.accept({ type: "loop-status", sequence, phase, captureMode: null, recordedFrames: phase === "empty" ? 0 : metadata.frames,
      totalFrames: phase === "empty" ? 0 : metadata.frames, position: 0, pendingPlay: false, pendingPlayback: null, issue: null });
  }
  function captured(sequence: number, mode: CaptureMode) {
    const bars = controller.getSnapshot().recordBars;
    const pcm = new ArrayBuffer(recordingCapacity(48000, config, bars) * 4);
    controller.accept({ type: "loop-captured", sequence, captureMode: mode, pcm,
      metadata: { ...metadata, ticks: bars * 3840, frames: metadata.frames / 4 * bars } });
  }
  async function complete(mode: CaptureMode) {
    await (mode === "record" ? controller.record() : controller.overdub());
    const command = messages.at(-1);
    if (!command || command.type !== (mode === "record" ? "loop-record" : "loop-overdub")) throw new Error("No capture command");
    captured(command.sequence, mode);
    status(command.sequence, "playing");
  }
  return { controller, messages, status, captured, complete };
}

function storage() {
  vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) } });
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("loop command acknowledgements and preflight", () => {
  it("freezes the chosen length across async preflight and unlocks it after cancellation", async () => {
    let resolve!: (value: StorageEstimate) => void;
    vi.stubGlobal("navigator", { storage: { estimate: () => new Promise<StorageEstimate>((yes) => { resolve = yes; }) } });
    const f = fixture(120, { load: async () => null, save: vi.fn() });
    await f.controller.initializeStorage();
    f.controller.setRecordBars(2);
    f.controller.setRecordBars(3);
    const pending = f.controller.record();
    f.controller.setRecordBars(8);
    expect(f.controller.getSnapshot().recordBars).toBe(2);
    resolve({ quota: 1024 ** 3, usage: 0 });
    await pending;
    expect(f.messages.at(-1)).toMatchObject({ type: "loop-record", bars: 2 });
    expect(f.messages.at(-1)?.pcm?.byteLength).toBe(recordingCapacity(48000, { bpm: 120, numerator: 4, denominator: 4 }, 2) * 4);
    f.controller.cancel();
    f.controller.setRecordBars(8);
    expect(f.controller.getSnapshot().recordBars).toBe(8);
  });

  it.each([1, 8])("allocates overdub from the captured %i-bar length and restores it after Clear", async (bars) => {
    const f = fixture();
    f.controller.setRecordBars(bars);
    await f.complete("record");
    f.controller.setRecordBars(2);
    expect(f.controller.getSnapshot().recordBars).toBe(bars);
    await f.complete("overdub");
    const command = f.messages.at(-1)!;
    expect(command).toMatchObject({ type: "loop-overdub", bars });
    expect(command.pcm?.byteLength).toBe(f.controller.historyState.current?.pcm.byteLength);
    f.controller.clear();
    f.controller.setRecordBars(2);
    f.controller.restore();
    expect(f.controller.getSnapshot()).toMatchObject({ recordBars: bars, canUndo: true, phase: "stopped" });
  });

  it("rejects an eight-bar take above the memory budget while preserving cleared PCM", async () => {
    const f = fixture(40);
    await f.complete("record");
    f.controller.clear();
    const original = f.controller.historyState.cleared;
    f.controller.setRecordBars(8);
    const count = f.messages.length;
    await f.controller.record();
    expect(f.messages).toHaveLength(count);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "empty", recordBars: 8, canRestore: true });
    expect(f.controller.getSnapshot().issue).toContain("32MiB");
    expect(f.controller.historyState.cleared).toEqual(original);
  });

  it("keeps capture locked across stale status messages and cancels an unresolved preflight", async () => {
    let resolveEstimate: (estimate: StorageEstimate) => void = () => { throw new Error("No pending estimate"); };
    vi.stubGlobal("navigator", { storage: { estimate: () => new Promise<StorageEstimate>((resolve) => { resolveEstimate = resolve; }) } });
    const f = fixture(120, { load: async () => null, save: async () => { throw new Error("Unexpected save"); } });
    await f.controller.initializeStorage();
    const pending = f.controller.record();
    f.status(0, "empty");
    expect(f.controller.getSnapshot().phase).toBe("preparing");
    expect(f.controller.locked).toBe(true);
    f.controller.cancel();
    resolveEstimate({ quota: 1024 ** 3, usage: 0 });
    await pending;
    expect(f.messages).toHaveLength(0);
    expect(f.controller.getSnapshot().phase).toBe("empty");
    expect(f.controller.locked).toBe(false);
  });

  it("accepts a finished overdub even if cancellation was requested before its acknowledgement arrived", async () => {
    storage();
    const f = fixture();
    await f.complete("record");
    await f.controller.overdub();
    const captureSequence = f.messages.at(-1)!.sequence;
    f.controller.cancel();
    f.captured(captureSequence, "overdub");
    f.status(f.messages.at(-1)!.sequence, "playing");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "playing", canUndo: true, captureMode: null });
  });

  it("keeps history unchanged when a queued Undo is cancelled", async () => {
    storage();
    const f = fixture();
    await f.complete("record");
    await f.complete("overdub");
    f.controller.changeHistory("undo");
    const sequence = f.messages.at(-1)!.sequence;
    f.controller.cancelHistory();
    f.controller.accept({ type: "loop-revision-cancelled", sequence });
    expect(f.controller.getSnapshot()).toMatchObject({ canUndo: true, canRedo: false, historyPending: null });
  });

  it("honors an already applied Undo despite a later cancel command", async () => {
    storage();
    const f = fixture();
    await f.complete("record");
    await f.complete("overdub");
    f.controller.changeHistory("undo");
    const sequence = f.messages.at(-1)!.sequence;
    f.controller.cancelHistory();
    f.controller.accept({ type: "loop-revision-applied", sequence });
    expect(f.controller.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true, historyPending: null });
    f.controller.changeHistory("redo");
    f.controller.accept({ type: "loop-revision-applied", sequence: f.messages.at(-1)!.sequence });
    expect(f.controller.getSnapshot()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("rejects another overdub before allocation when guaranteed history exceeds the byte budget", async () => {
    storage();
    const f = fixture(40);
    await f.complete("record");
    await f.complete("overdub");
    const count = f.messages.length;
    await f.controller.overdub();
    expect(f.messages).toHaveLength(count);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "playing", hasClip: true, canUndo: true, captureMode: null });
    expect(f.controller.getSnapshot().issue).toContain("32MiB");
  });
});

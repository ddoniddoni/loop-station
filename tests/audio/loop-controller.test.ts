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
  const messages: { type: string; sequence: number }[] = [];
  const port = { postMessage(value: { type: string; sequence: number }, transfer: Transferable[] = []) {
    messages.push(structuredClone(value, { transfer }));
  } };
  controller.attach({ sampleRate: 48000, state: "running" } as AudioContext, { port } as unknown as AudioWorkletNode);
  const config = { bpm, numerator: 4, denominator: 4 };
  controller.acceptTransport({ type: "transport", ...config, playing: true, positionFrame: 0, positionTick: 0, contextFrame: 0 });
  const metadata: LoopMetadata = { ...config, sampleRate: 48000, frames: 48000 * 16 * 60 / bpm, ticks: 15360, complete: true };
  function status(sequence: number, phase: "empty" | "playing") {
    controller.accept({ type: "loop-status", sequence, phase, captureMode: null, countInRemaining: null, recordedFrames: phase === "empty" ? 0 : metadata.frames,
      totalFrames: phase === "empty" ? 0 : metadata.frames, position: 0, pendingPlay: false, issue: null });
  }
  function captured(sequence: number, mode: CaptureMode) {
    const pcm = new ArrayBuffer(recordingCapacity(48000, config) * 4);
    controller.accept({ type: "loop-captured", sequence, captureMode: mode, pcm, metadata });
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
  it.each([true, false])("freezes count-in=%s in the prepared record command", async (countIn) => {
    const f = fixture();
    await f.controller.record(countIn);
    await f.controller.record(!countIn);
    expect(f.messages).toHaveLength(1);
    expect(f.messages[0]).toMatchObject({ type: "loop-record", countIn });
    expect(f.controller.getSnapshot()).toMatchObject({ countIn, phase: "armed" });
  });

  it("keeps countdown locked and clears its progress on cancel", async () => {
    const f = fixture(); await f.controller.record();
    f.controller.accept({ type: "loop-status", sequence: f.messages[0].sequence, phase: "count-in", captureMode: "record",
      countInRemaining: 3, recordedFrames: 0, totalFrames: 384000, position: 0, pendingPlay: false, issue: null });
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "count-in", countInRemaining: 3, hasClip: false });
    expect(f.controller.locked).toBe(true);
    f.controller.cancel();
    expect(f.messages.at(-1)).toMatchObject({ type: "loop-cancel", captureMode: "record" });
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "empty", countInRemaining: null, hasClip: false });
  });

  it("does not add a count-in to an overdub", async () => {
    const f = fixture(); await f.complete("record"); await f.controller.overdub();
    expect(f.messages.at(-1)).toMatchObject({ type: "loop-overdub", countIn: false });
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

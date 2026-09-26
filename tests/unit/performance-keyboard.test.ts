import { describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { LoopController } from "../../src/audio/loop/loop-controller";
import { StationController } from "../../src/audio/loop/station-controller";
import { executePerformanceAction, performanceCommand, performanceDecision } from "../../src/lib/keyboard/performance-commands";

const key = (value: string, patch: Partial<Parameters<typeof performanceCommand>[0]> = {}) => ({
  key: value, keyCode: 0, repeat: false, isComposing: false, defaultPrevented: false,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...patch,
});
function state() {
  const controller = new LoopController(new MicrophoneController(), null);
  const snapshot = controller.getSnapshot();
  return { track: { ...snapshot, connected: true, save: { ...snapshot.save, editLocked: false } },
    audioReady: true, inputReady: true, transportPlaying: false, projectBusy: false };
}
const metadata = { bpm: 120, numerator: 4, denominator: 4, sampleRate: 48000, frames: 96000, ticks: 3840, complete: true };

describe("performance key matching", () => {
  it("maps track digits and only the supported performance keys", () => {
    for (let digit = 1; digit <= 8; digit += 1) expect(performanceCommand(key(String(digit)))).toEqual({ trackId: digit - 1 });
    expect([" ", "r", "R", "s", "Escape"].map((value) => performanceCommand(key(value)))).toEqual(["transport", "primary", "primary", "stop", "cancel"]);
    for (const value of ["0", "9", "m", "Enter", "ㄱ", "Process", "Dead"]) expect(performanceCommand(key(value))).toBeNull();
  });
  it.each(["ctrlKey", "metaKey"] as const)("maps %s Undo/Redo without hijacking save, reload, or track shortcuts", (modifier) => {
    expect(performanceCommand(key("z", { [modifier]: true }))).toBe("undo");
    expect(performanceCommand(key("Z", { [modifier]: true, shiftKey: true }))).toBe("redo");
    for (const value of ["r", "s", "1", " "]) expect(performanceCommand(key(value, { [modifier]: true }))).toBeNull();
  });
  it.each([{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }, { altKey: true },
    { shiftKey: true }, { ctrlKey: true, metaKey: true }, { ctrlKey: true, altKey: true }])("ignores repeated, composed, handled, and reserved input %j", (patch) => {
    expect(performanceCommand(key("r", patch))).toBeNull();
    expect(performanceCommand(key(" ", patch))).toBeNull();
  });
});

describe("state-dependent command permissions", () => {
  it("uses REC, PLAY, OVERDUB for the selected track without creating audio or microphone access", () => {
    const s = state();
    expect(performanceDecision("primary", s).action).toBe("record");
    s.inputReady = false;
    expect(performanceDecision("primary", s).action).toBeNull();
    s.track = { ...s.track, hasClip: true, metadata, phase: "stopped" };
    expect(performanceDecision("primary", s).action).toBe("play");
    s.track.phase = "playing";
    expect(performanceDecision("primary", s).action).toBeNull();
    s.inputReady = true;
    expect(performanceDecision("primary", s).action).toBe("overdub");
    s.track.metadata = { ...metadata, complete: false };
    expect(performanceDecision("primary", s).action).toBeNull();
  });
  it("blocks unavailable audio, pending playback, storage, recovery, foreign capture, and edits", () => {
    const baseline = state();
    const cases = [
      { ...baseline, audioReady: false }, { ...baseline, projectBusy: true },
      ...[{ connected: false }, { pendingPlay: true }, { blockedByTrack: 7 }, { workspaceIssue: "sample rate mismatch" },
        { save: { ...baseline.track.save, editLocked: true } }, { historyPending: "undo" as const }].map((patch) => ({ ...baseline, track: { ...baseline.track, ...patch } })),
    ];
    for (const s of cases) expect(performanceDecision("primary", s)).toMatchObject({ action: null, reason: expect.any(String) });
  });
  it.each(["preparing", "armed", "recording", "overdubbing"] as const)("allows cancellation but no extra R/S action during %s", (phase) => {
    const s = state(); s.track.phase = phase; s.projectBusy = true;
    expect(performanceDecision("primary", s).action).toBeNull();
    expect(performanceDecision("stop", s).action).toBeNull();
    expect(performanceDecision("cancel", s).action).toBe("cancel");
  });
  it("cancels only pending actions and permits a stop while other work locks editing", () => {
    const s = state();
    expect(performanceDecision("cancel", s).action).toBeNull();
    s.track.pendingPlay = true;
    expect(performanceDecision("cancel", s).action).toBe("stop");
    expect(performanceDecision("stop", s).action).toBe("stop");
    s.track.historyPending = "undo";
    expect(performanceDecision("cancel", s).action).toBe("cancel-history");
    s.transportPlaying = true; s.projectBusy = true; s.track.save.editLocked = true;
    expect(performanceDecision("transport", s).action).toBe("transport-stop");
    s.transportPlaying = false;
    expect(performanceDecision("transport", s).action).toBeNull();
  });
  it("requires matching Undo/Redo history and rejects another edit until completion", () => {
    const s = state();
    expect(performanceDecision("undo", s).action).toBeNull();
    expect(performanceDecision("redo", s).action).toBeNull();
    s.track.canUndo = true;
    expect(performanceDecision("undo", s).action).toBe("undo");
    s.track.canRedo = true;
    expect(performanceDecision("redo", s).action).toBe("redo");
    s.track.historyPending = "undo";
    expect(performanceDecision("redo", s).action).toBeNull();
  });
  it("routes to the selected real controller and respects its synchronous capture lock", async () => {
    const input = new MicrophoneController();
    const inputState = vi.spyOn(input, "getSnapshot").mockReturnValue({ ...input.getSnapshot(), phase: "active", routed: true });
    const station = new StationController(input, null);
    const messages: { type: string; trackId?: number }[] = [];
    const port = { postMessage(message: { type: string; trackId?: number }) { messages.push(message); } };
    station.attach({ sampleRate: 8000, state: "running" } as AudioContext, { port } as unknown as AudioWorkletNode);
    station.acceptTransport({ type: "transport", bpm: 120, numerator: 4, denominator: 4, playing: false, positionFrame: 0, positionTick: 0, contextFrame: 0 });
    const transport = { startTransport: vi.fn(), stopTransport: vi.fn() };
    function pressR(trackId: number) {
      const controller = station.tracks[trackId];
      const decision = performanceDecision("primary", { ...state(), track: controller.getSnapshot(), projectBusy: station.getSnapshot().performing });
      if (decision.action) executePerformanceAction(decision.action, controller, transport);
    }
    pressR(7); pressR(7); pressR(0);
    await Promise.resolve();
    expect(messages.filter((message) => message.type === "loop-record")).toEqual([expect.objectContaining({ trackId: 7 })]);
    expect(station.tracks[0].getSnapshot().phase).toBe("empty");
    executePerformanceAction("cancel", station.tracks[7], transport);
    expect(messages.filter((message) => message.type === "loop-cancel")).toEqual([expect.objectContaining({ trackId: 7 })]);
    expect(station.getSnapshot().performing).toBe(false);
    pressR(0); await Promise.resolve();
    expect(messages.filter((message) => message.type === "loop-record").map((message) => message.trackId)).toEqual([7, 0]);
    expect(transport.startTransport).not.toHaveBeenCalled();
    inputState.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { LoopController } from "../../src/audio/loop/loop-controller";
import type { LoopStatus } from "../../src/audio/loop/loop-protocol";
import type { PendingPlayback } from "../../src/audio/loop/playback-scheduling";

const metadata = { bpm: 120, numerator: 4, denominator: 4, sampleRate: 8000, frames: 16000, ticks: 3840, complete: true };
function fixture() {
  const input = new MicrophoneController();
  const controller = new LoopController(input, null);
  const pcm = new Float32Array(16000).fill(0.25).buffer;
  controller.hydrate({ current: { metadata, pcm }, undo: null, redo: null, cleared: null });
  const messages: { type: string; sequence: number; timing?: string; targetSequence?: number }[] = [];
  const node = { port: { postMessage: (message: typeof messages[number]) => messages.push(message) } } as unknown as AudioWorkletNode;
  const context = { state: "running", sampleRate: 8000 } as AudioContext;
  controller.attach(context, node);
  function status(phase: "playing" | "stopped", pendingPlayback: PendingPlayback | null = null, sequence = messages.at(-1)!.sequence) {
    const value: LoopStatus = { type: "loop-status", sequence, phase, pendingPlayback, pendingPlay: pendingPlayback?.action === "play",
      recordedFrames: 16000, totalFrames: 16000, position: 0, captureMode: null, issue: null };
    controller.accept(value);
  }
  return { controller, input, messages, node, context, status, pcm };
}

describe("playback commands and authoritative audio state", () => {
  it("uses local timing choices without permissions, persistence, or optimistic phase changes", () => {
    const f = fixture(); const history = f.controller.historyState;
    expect(f.controller.getSnapshot()).toMatchObject({ playTiming: "bar", stopTiming: "immediate" });
    f.controller.setPlaybackTiming("play", "beat"); f.controller.setPlaybackTiming("stop", "bar");
    f.controller.play();
    const command = f.messages.at(-1)!;
    expect(command).toMatchObject({ type: "loop-play", timing: "beat" });
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "stopped", playbackSending: true, pendingPlayback: null });
    f.controller.play(); f.controller.clear(); f.controller.setPlaybackTiming("play", "immediate");
    expect(f.messages.at(-1)).toBe(command);
    expect(f.controller.getSnapshot().playTiming).toBe("beat");
    const pending: PendingPlayback = { action: "play", timing: "beat", sequence: command.sequence, tick: 960, frame: 4000 };
    f.status("stopped", pending);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "stopped", playbackSending: false, pendingPlayback: pending });
    f.status("playing");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "playing", pendingPlayback: null });
    expect(f.controller.historyState).toEqual(history); expect(f.controller.dirty).toBe(false);
    expect(f.input.getSnapshot().phase).toBe("idle");
  });

  it("targets cancellation at the pending ID and ignores a stale acknowledgement", () => {
    const f = fixture(); f.controller.play(); const play = f.messages.at(-1)!.sequence;
    f.status("stopped", { action: "play", timing: "bar", sequence: play, frame: 16000, tick: 3840 });
    f.controller.cancelPlayback(); const cancel = f.messages.at(-1)!;
    expect(cancel).toMatchObject({ type: "loop-cancel-playback", targetSequence: play });
    f.status("playing", null, play);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "stopped", playbackSending: true });
    f.status("stopped");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "stopped", pendingPlayback: null, playbackSending: false });
    expect(new Float32Array(f.controller.historyState.current!.pcm)[0]).toBe(0.25);
  });

  it("accepts an executed result if cancellation arrives after the scheduled frame", () => {
    const f = fixture(); f.controller.play(); const play = f.messages.at(-1)!.sequence;
    f.status("stopped", { action: "play", timing: "bar", sequence: play, frame: 16000, tick: 3840 });
    f.controller.cancelPlayback(); f.status("playing");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "playing", pendingPlayback: null, playbackSending: false });
  });

  it("keeps playing while stop is scheduled and prevents edits until cancellation is confirmed", async () => {
    const f = fixture(); f.status("playing"); f.controller.setPlaybackTiming("stop", "bar");
    f.controller.stopPlayback(); const stop = f.messages.at(-1)!;
    expect(stop).toMatchObject({ type: "loop-stop", timing: "bar" });
    f.status("playing", { action: "stop", timing: "bar", sequence: stop.sequence, frame: 16000, tick: 3840 });
    f.controller.clear(); await f.controller.overdub(); f.controller.stopPlayback();
    expect(f.messages.at(-1)).toBe(stop);
    f.controller.cancelPlayback(); f.status("playing");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "playing", pendingPlayback: null });
    f.controller.stop(); expect(f.messages.at(-1)).toMatchObject({ type: "loop-stop", timing: "immediate" });
  });

  it("clears pending state on suspension and does not resume playback automatically", () => {
    const f = fixture(); f.controller.play(); const play = f.messages.at(-1)!.sequence;
    f.status("stopped", { action: "play", timing: "bar", sequence: play, frame: 16000, tick: 3840 });
    f.controller.setRunning(false);
    expect(f.messages.at(-1)?.type).toBe("loop-stop");
    expect(f.controller.getSnapshot()).toMatchObject({ connected: false, phase: "stopped", pendingPlayback: null, playbackSending: false });
    f.status("playing", null, play);
    expect(f.controller.getSnapshot().phase).toBe("stopped");
    f.controller.setRunning(true);
    expect(f.messages.at(-1)?.type).toBe("loop-stop");
  });

  it("detaches pending commands, preserves history, and restores silently on a new engine", () => {
    const f = fixture(); f.controller.play(); const history = f.controller.historyState;
    f.controller.detach(); f.status("playing");
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "stopped", pendingPlayback: null, playbackSending: false, connected: false });
    f.controller.attach(f.context, f.node);
    expect(f.messages.at(-1)?.type).toBe("loop-restore");
    expect(f.controller.historyState).toEqual(history);
  });
});

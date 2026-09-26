import { afterEach, describe, expect, it, vi } from "vitest";
import { TestToneEngine } from "../../src/audio/engine/test-tone-engine";
import { AUDIO_STARTUP_TIMEOUT_MS, WORKLET_PROTOCOL_VERSION } from "../../src/audio/engine/worklet-protocol";
import type { MicrophoneController } from "../../src/audio/input/microphone-controller";
import type { StationController } from "../../src/audio/loop/station-controller";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }

function fixture() {
  const moduleLoad = deferred();
  const closing = deferred();
  const nodes: Node[] = [];
  const contexts: Context[] = [];
  class Context extends EventTarget {
    state: AudioContextState = "running";
    sampleRate = 48000;
    currentTime = 0;
    destination = {};
    audioWorklet = { addModule: vi.fn(() => moduleLoad.promise) };
    resume = vi.fn(async () => { this.state = "running"; });
    close = vi.fn(async () => { await closing.promise; this.state = "closed"; });
    createGain = vi.fn(() => ({ gain: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }));
    constructor() { super(); contexts.push(this); }
  }
  class Node {
    port = { onmessage: null as ((event: MessageEvent<unknown>) => void) | null, postMessage: vi.fn(), close: vi.fn() };
    onprocessorerror: (() => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    constructor() { nodes.push(this); }
    send(data: unknown) { this.port.onmessage?.({ data } as MessageEvent<unknown>); }
  }
  vi.stubGlobal("window", { isSecureContext: true, AudioContext: Context, AudioWorkletNode: Node });
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("AudioWorkletNode", Node);
  const callbacks = { onContextStateChange: vi.fn(), onToneStateChange: vi.fn(), onTransportStateChange: vi.fn(), onMetronomeStateChange: vi.fn(), onProcessorError: vi.fn() };
  const input = { attachAudio: vi.fn(), detachAudio: vi.fn(), setAudioRunning: vi.fn(), acceptMeter: vi.fn() };
  const loop = { attach: vi.fn(), detach: vi.fn(), setRunning: vi.fn(), accept: vi.fn(), acceptTransport: vi.fn(), stop: vi.fn(), locked: false };
  const engine = new TestToneEngine(callbacks, input as unknown as MicrophoneController, loop as unknown as StationController);
  const ready = () => nodes[0].send({ type: "worklet-ready", version: WORKLET_PROTOCOL_VERSION, sampleRate: 48000, blockFrames: 192 });
  return { engine, callbacks, input, loop, nodes, contexts, moduleLoad, closing, ready };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("audio engine startup and resource ownership", () => {
  it("initializes once and becomes ready only after the first compatible processed block", async () => {
    const f = fixture();
    const start = f.engine.initialize();
    expect(f.engine.initialize()).toBe(start);
    f.moduleLoad.resolve(); await flush();
    expect(f.contexts).toHaveLength(1);
    expect(f.nodes).toHaveLength(1);
    expect(f.engine.isReady).toBe(false);
    expect(f.input.attachAudio).not.toHaveBeenCalled();
    f.engine.startTone();
    expect(f.nodes[0].port.postMessage).not.toHaveBeenCalledWith({ type: "start" });
    f.ready(); await start;
    expect(f.engine.isReady).toBe(true);
    expect(f.input.attachAudio).toHaveBeenCalledOnce();
    expect(f.loop.attach).toHaveBeenCalledOnce();
    f.engine.startTone();
    expect(f.nodes[0].port.postMessage).toHaveBeenCalledWith({ type: "start" });
    f.closing.resolve(); await f.engine.dispose();
  });

  it.each(["module", "render"])("times out stalled %s startup and closes its resources", async (stage) => {
    vi.useFakeTimers();
    const f = fixture();
    f.closing.resolve();
    const failed = expect(f.engine.initialize()).rejects.toMatchObject({ code: "startup-timeout" });
    if (stage === "render") f.moduleLoad.resolve();
    await vi.advanceTimersByTimeAsync(AUDIO_STARTUP_TIMEOUT_MS);
    await failed;
    expect(f.contexts[0].close).toHaveBeenCalledOnce();
    expect(f.engine.isReady).toBe(false);
    expect(f.input.attachAudio).not.toHaveBeenCalled();
  });

  it.each([
    { version: 1, sampleRate: 48000, blockFrames: 192 },
    { version: 2, sampleRate: 48000, blockFrames: 192 },
    { version: 3, sampleRate: 48000, blockFrames: 192 },
    { version: WORKLET_PROTOCOL_VERSION + 1, sampleRate: 48000, blockFrames: 192 },
    { version: WORKLET_PROTOCOL_VERSION, sampleRate: 44100, blockFrames: 192 },
    { version: WORKLET_PROTOCOL_VERSION, sampleRate: 48000, blockFrames: 0 },
  ])("rejects incompatible processor readiness %j", async (fields) => {
    const f = fixture();
    f.closing.resolve();
    const failed = expect(f.engine.initialize()).rejects.toMatchObject({ code: "worklet-protocol-mismatch" });
    f.moduleLoad.resolve(); await flush();
    f.nodes[0].send({ type: "worklet-ready", ...fields });
    await failed;
    expect(f.nodes[0].port.close).toHaveBeenCalledOnce();
  });

  it("cancels a pending module load and ignores its late completion", async () => {
    const f = fixture();
    const failed = expect(f.engine.initialize()).rejects.toMatchObject({ code: "disposed" });
    await flush();
    const ending = f.engine.dispose();
    expect(f.engine.dispose()).toBe(ending);
    f.moduleLoad.resolve(); await flush();
    expect(f.nodes).toHaveLength(0);
    f.closing.resolve();
    await ending; await failed;
    expect(f.contexts[0].close).toHaveBeenCalledOnce();
    expect(f.input.detachAudio).toHaveBeenCalledOnce();
  });

  it("rejects processor failure during startup instead of reporting ready", async () => {
    const f = fixture();
    f.closing.resolve();
    const failed = expect(f.engine.initialize()).rejects.toMatchObject({ code: "processor-failed" });
    f.moduleLoad.resolve(); await flush();
    f.nodes[0].onprocessorerror?.();
    await failed;
    expect(f.engine.isReady).toBe(false);
    expect(f.callbacks.onProcessorError).not.toHaveBeenCalled();
  });

  it("cleans up a failed module load and preserves its error", async () => {
    const f = fixture();
    f.closing.resolve();
    const failed = expect(f.engine.initialize()).rejects.toMatchObject({ code: "worklet-load-failed" });
    await flush(); f.moduleLoad.reject(new Error("network unavailable"));
    await failed;
    expect(f.nodes).toHaveLength(0);
    expect(f.contexts[0].close).toHaveBeenCalledOnce();
  });

  it("can retry a failed context close without detaching shared controllers again", async () => {
    const f = fixture();
    const start = f.engine.initialize();
    f.moduleLoad.resolve(); await flush(); f.ready(); await start;
    f.contexts[0].close.mockRejectedValueOnce(new Error("close failed"));
    await expect(f.engine.dispose()).rejects.toThrow("close failed");
    expect(f.engine.isReady).toBe(false);
    f.closing.resolve(); await f.engine.dispose();
    expect(f.contexts[0].state).toBe("closed");
    expect(f.contexts[0].close).toHaveBeenCalledTimes(2);
    expect(f.loop.detach).toHaveBeenCalledOnce();
    expect(f.input.detachAudio).toHaveBeenCalledOnce();
  });

  it("shares pending disposal and suppresses late messages after shutdown", async () => {
    const f = fixture();
    const start = f.engine.initialize();
    f.moduleLoad.resolve(); await flush(); f.ready(); await start;
    const lateMessage = f.nodes[0].port.onmessage;
    const ending = f.engine.dispose();
    expect(f.engine.dispose()).toBe(ending);
    lateMessage?.({ data: { type: "playing" } } as MessageEvent<unknown>);
    expect(f.callbacks.onToneStateChange).not.toHaveBeenCalled();
    expect(f.loop.detach).toHaveBeenCalledOnce();
    expect(f.nodes[0].disconnect).toHaveBeenCalledOnce();
    f.closing.resolve(); await ending;
    expect(f.engine.isReady).toBe(false);
  });
});

import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrumController } from "../../src/audio/instruments/drum-controller";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { RecordingInputController } from "../../src/audio/input/recording-input-controller";

function sampler() {
  const sources: ReturnType<typeof source>[] = [];
  function source() { return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null, buffer: null }; }
  const context = {
    state: "running", currentTime: 1, sampleRate: 48000,
    createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
    createConstantSource: () => ({ ...source(), offset: { value: 1 } }),
    createBufferSource: () => { const item = source(); sources.push(item); return item; },
    decodeAudioData: vi.fn(async () => ({ numberOfChannels: 1, length: 4800, duration: 0.1 })),
  };
  const controller = new DrumController();
  controller.attach(context as unknown as AudioContext, {} as AudioWorkletNode);
  const fetcher = vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => {
    const bytes = await readFile(resolvePath("public", url.slice(1)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } }));
  vi.stubGlobal("fetch", fetcher);
  return { controller, context, sources, fetcher };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded drum sampler", () => {
  it("loads only on request, reuses decoded buffers and bounds simultaneous voices", async () => {
    const f = sampler();
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.controller.trigger("kick")).toBe(false);
    await f.controller.load();
    await f.controller.load();
    expect(f.fetcher).toHaveBeenCalledTimes(8);
    f.controller.setEnabled(true);
    for (let i = 0; i < 20; i++) f.controller.trigger("kick");
    expect(f.sources.filter((voice) => voice.stop.mock.calls.length)).toHaveLength(4);
    f.controller.detach();
    expect(f.sources.every((voice) => voice.disconnect.mock.calls.length > 0)).toBe(true);
    expect(f.controller.trigger("kick")).toBe(false);
  });
  it("chokes hats, releases all voices on suspension and requires readiness after teardown", async () => {
    const f = sampler(); await f.controller.load(); f.controller.setEnabled(true);
    f.controller.trigger("open-hat"); f.controller.trigger("closed-hat");
    expect(f.sources[0].stop).toHaveBeenCalledOnce();
    f.controller.setRunning(false);
    expect(f.sources[1].stop).toHaveBeenCalledOnce();
    expect(f.controller.trigger("kick")).toBe(false);
    f.controller.detach(); expect(f.controller.getSnapshot().phase).toBe("idle");
  });
  it("keeps a partially loaded kit unavailable and permits retry after a failed asset", async () => {
    const f = sampler(); f.fetcher.mockRejectedValueOnce(new Error("offline"));
    await f.controller.load();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "error", issue: "offline" });
    f.controller.setEnabled(true); expect(f.controller.trigger("kick")).toBe(false);
    await f.controller.load(); expect(f.controller.getSnapshot().phase).toBe("ready");
    f.controller.detach();
  });
  it("ignores a decode completing after audio teardown", async () => {
    const f = sampler();
    let complete!: (buffer: { numberOfChannels: number; length: number; duration: number }) => void;
    let started!: () => void;
    const decoding = new Promise<void>((yes) => { started = yes; });
    f.context.decodeAudioData.mockImplementationOnce(() => { started(); return new Promise((yes) => { complete = yes; }); });
    const pending = f.controller.load();
    await decoding;
    f.controller.detach(); complete({ numberOfChannels: 1, length: 4800, duration: 0.1 }); await pending;
    expect(f.controller.getSnapshot()).toEqual({ phase: "idle", running: false, issue: null });
    expect(f.fetcher).toHaveBeenCalledTimes(8);
  });
  it("exposes timeout even when browser decode is still pending", async () => {
    const f = sampler();
    let complete!: (buffer: { numberOfChannels: number; length: number; duration: number }) => void;
    let started!: () => void;
    const decoding = new Promise<void>((yes) => { started = yes; });
    f.context.decodeAudioData.mockImplementationOnce(() => { started(); return new Promise((yes) => { complete = yes; }); });
    vi.useFakeTimers();
    const pending = f.controller.load(); await decoding;
    await vi.advanceTimersByTimeAsync(15_000); await pending;
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "error", issue: expect.stringContaining("초과") });
    complete({ numberOfChannels: 1, length: 4800, duration: 0.1 });
    await Promise.resolve();
    expect(f.controller.getSnapshot().phase).toBe("error");
    f.controller.detach();
  });
  it("rejects altered sample bytes before decoding", async () => {
    const f = sampler();
    f.fetcher.mockImplementation(async (url: string) => ({ ok: true, arrayBuffer: async () => {
      const bytes = await readFile(resolvePath("public", url.slice(1)));
      bytes[bytes.length - 1] ^= 1;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    } }));
    await f.controller.load();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "error", issue: expect.stringContaining("무결성") });
    expect(f.context.decodeAudioData).not.toHaveBeenCalled();
    f.controller.detach();
  });
  it("rejects unsupported decoded channels", async () => {
    const f = sampler(); f.context.decodeAudioData.mockResolvedValueOnce({ numberOfChannels: 2, length: 4800, duration: 0.1 });
    await f.controller.load(); expect(f.controller.getSnapshot().phase).toBe("error");
    f.controller.detach();
  });
});

function routing() {
  const microphone = new MicrophoneController();
  const controller = new RecordingInputController(microphone);
  const mic = { ...microphone.getSnapshot(), phase: "active" as const, routed: true, audioReady: true };
  vi.spyOn(microphone, "getSnapshot").mockImplementation(() => mic);
  vi.spyOn(controller.drums, "attach").mockImplementation(() => undefined);
  vi.spyOn(controller.melodic, "attach").mockImplementation(() => undefined);
  const drumState = { phase: "ready" as const, running: true, issue: null };
  vi.spyOn(controller.drums, "getSnapshot").mockImplementation(() => drumState);
  const messages: { type: string; revision: number; source: string; active: boolean }[] = [];
  const node = { port: { postMessage: (message: typeof messages[number]) => messages.push(message) } };
  controller.attach({} as AudioContext, node as unknown as AudioWorkletNode);
  const ack = () => controller.accept({ type: "capture-route-applied", revision: messages.at(-1)?.revision });
  return { controller, microphone, mic, drumState, messages, ack };
}

describe("recording source ownership", () => {
  it("waits for the selected Worklet route acknowledgement and ignores stale replies", () => {
    const f = routing(); const old = f.messages.at(-1)!.revision;
    expect(f.controller.getSnapshot().routed).toBe(false);
    f.controller.select("drums");
    f.controller.accept({ type: "capture-route-applied", revision: old });
    expect(f.controller.getSnapshot().routed).toBe(false);
    f.ack(); expect(f.controller.getSnapshot()).toMatchObject({ source: "drums", routed: true, phase: "active" });
    f.controller.detach();
  });
  it("locks source selection during capture and ignores unrelated microphone disconnection", () => {
    const f = routing(); f.controller.select("drums"); f.ack();
    f.controller.setCaptureLocked(true); f.controller.select("microphone");
    f.mic.routed = false; f.microphone.setCaptureLocked(false);
    expect(f.controller.getSnapshot()).toMatchObject({ source: "drums", routed: true, captureLocked: true });
    f.controller.setCaptureLocked(false); f.controller.select("microphone"); f.ack();
    expect(f.controller.getSnapshot()).toMatchObject({ source: "microphone", routed: false });
    f.controller.detach();
  });
  it("disables recording on selected source loss and resets to microphone after teardown", () => {
    const f = routing(); f.ack(); expect(f.controller.getSnapshot().routed).toBe(true);
    f.mic.routed = false; f.microphone.setCaptureLocked(true);
    expect(f.controller.getSnapshot().routed).toBe(false);
    f.controller.detach(); f.ack();
    expect(f.controller.getSnapshot()).toMatchObject({ source: "microphone", phase: "idle", captureLocked: false });
  });
});

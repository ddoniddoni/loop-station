import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { MUSIC_INPUT_PROCESSING, processingMatches, processingSupport, processingValue } from "../../src/audio/input/input-processing";
import { StationController } from "../../src/audio/loop/station-controller";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakeTrack() {
  let settings: MediaTrackSettings = { deviceId: "mic", channelCount: 1, ...MUSIC_INPUT_PROCESSING };
  let constraints: MediaTrackConstraints = { deviceId: { exact: "mic" }, ...MUSIC_INPUT_PROCESSING };
  const ended = new Set<() => void>();
  const track = {
    readyState: "live", label: "Test microphone",
    getSettings: vi.fn(() => ({ ...settings })),
    getCapabilities: vi.fn((): MediaTrackCapabilities => ({ echoCancellation: [false, true], noiseSuppression: [false, true], autoGainControl: [false, true] })),
    getConstraints: vi.fn(() => ({ ...constraints })),
    applyConstraints: vi.fn(async (next: MediaTrackConstraints) => {
      constraints = next;
      for (const key of ["echoCancellation", "noiseSuppression", "autoGainControl"] as const) {
        const value = next[key];
        if (typeof value === "boolean") settings[key] = value;
        else if (value && typeof value.exact === "boolean") settings[key] = value.exact;
      }
    }),
    stop: vi.fn(() => { track.readyState = "ended"; }),
    addEventListener: vi.fn((_type: string, listener: () => void) => ended.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => ended.delete(listener)),
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  return { track, stream, setSettings: (next: MediaTrackSettings) => { settings = next; },
    disconnect: () => { track.readyState = "ended"; for (const listener of ended) listener(); } };
}

function fixture() {
  const microphone = fakeTrack();
  const media = {
    getUserMedia: vi.fn(async () => microphone.stream as unknown as MediaStream),
    getSupportedConstraints: vi.fn((): MediaTrackSupportedConstraints => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })),
    enumerateDevices: vi.fn(async () => []), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: media });
  const gains: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "running", sampleRate: 8000, currentTime: 1, destination: {},
    createMediaStreamSource: vi.fn(() => source),
    createGain: () => {
      const gain = { gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain); return gain;
    },
  };
  const node = { connect: vi.fn(), disconnect: vi.fn(), port: { postMessage: vi.fn() } };
  const controller = new MicrophoneController();
  controller.attachAudio(context as unknown as AudioContext, node as unknown as AudioWorkletNode);
  return { ...microphone, media, gains, source, context, node, controller };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("input processing support and reported values", () => {
  it.each([
    [true, [false, true], true, "available"], [true, [true], true, "fixed-on"],
    [true, [false], true, "fixed-off"], [false, [false, true], true, "unsupported"],
    [true, [false, true], false, "unsupported"], [undefined, [false, true], true, "unknown"],
    [true, undefined, true, "unknown"], [true, [], true, "unknown"], [true, ["all"], true, "unknown"],
  ])("distinguishes support %j / capability %j / API %j", (supported, capability, canApply, expected) => {
    expect(processingSupport(supported, capability, canApply as boolean)).toBe(expected);
  });

  it("never infers an applied value from a request or a missing field", () => {
    expect(processingMatches(undefined, false)).toBeNull();
    expect(processingMatches(true, false)).toBe(false);
    expect(processingMatches(false, false)).toBe(true);
    expect(processingMatches("remote-only", true)).toBe(true);
    expect(processingValue("all")).toBe("all");
    expect(processingValue("false")).toBeNull();
  });
});

describe("processing on a live microphone", () => {
  it("does not request permission implicitly and retains music defaults on explicit connection", async () => {
    const f = fixture();
    await f.controller.setProcessing("echoCancellation", true);
    f.controller.refreshProcessing();
    expect(f.media.getUserMedia).not.toHaveBeenCalled();
    await f.controller.request("mic");
    expect(f.media.getUserMedia).toHaveBeenCalledWith({ audio: { ...MUSIC_INPUT_PROCESSING, deviceId: { exact: "mic" } }, video: false });
    expect(f.controller.getSnapshot().monitorEnabled).toBe(false);
  });

  it("applies exact values on the same stream, preserves other constraints and leaves monitoring off", async () => {
    const f = fixture(); await f.controller.request("mic");
    f.controller.setGain(6); f.controller.setMonitor(true);
    const gate = deferred();
    f.track.applyConstraints.mockImplementationOnce(async () => { await gate.promise; f.setSettings({ echoCancellation: true }); });
    const pending = f.controller.setProcessing("echoCancellation", true);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "applying", monitorEnabled: false, processingPending: { key: "echoCancellation", requested: true } });
    expect(f.gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
    expect(f.node.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "input-route", active: false }));
    await f.controller.request("another"); f.controller.cancelRequest(); f.controller.retryRouting(); f.controller.setMonitor(true);
    await f.controller.setProcessing("noiseSuppression", true);
    expect(f.track.applyConstraints).toHaveBeenCalledTimes(1);
    expect(f.media.getUserMedia).toHaveBeenCalledTimes(1);
    gate.resolve(); await pending;
    expect(f.track.applyConstraints).toHaveBeenCalledWith({ deviceId: { exact: "mic" }, echoCancellation: { exact: true }, noiseSuppression: false, autoGainControl: false });
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "active", routed: true, gainDb: 6, monitorEnabled: false,
      processingRequested: { echoCancellation: true }, info: { settings: { echoCancellation: true } } });
    expect(f.context.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(f.track.stop).not.toHaveBeenCalled();
    expect(f.source.disconnect).not.toHaveBeenCalled();
    expect(f.node.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "input-route", active: true }));
  });

  it("keeps all previous choices when applying another option", async () => {
    const f = fixture(); await f.controller.request("mic");
    await f.controller.setProcessing("echoCancellation", true);
    await f.controller.setProcessing("noiseSuppression", true);
    expect(f.track.applyConstraints).toHaveBeenLastCalledWith({ deviceId: { exact: "mic" }, echoCancellation: { exact: true }, noiseSuppression: { exact: true }, autoGainControl: false });
    expect(f.controller.getSnapshot().info?.settings).toMatchObject({ echoCancellation: true, noiseSuppression: true, autoGainControl: false });
  });

  it.each(["OverconstrainedError", "NotReadableError"])("preserves input on %s and rereads actual settings", async (name) => {
    const f = fixture(); await f.controller.request(); f.controller.setMonitor(true);
    f.track.applyConstraints.mockRejectedValueOnce(new DOMException("Rejected", name));
    await f.controller.setProcessing("autoGainControl", true);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "active", routed: true, monitorEnabled: false,
      processingRequested: MUSIC_INPUT_PROCESSING, processingError: { key: "autoGainControl", requested: true, code: name === "OverconstrainedError" ? "constraints-unmet" : "device-unreadable" } });
    expect(f.track.getSettings).toHaveBeenCalledTimes(2);
    expect(f.track.stop).not.toHaveBeenCalled(); expect(f.source.disconnect).not.toHaveBeenCalled();
    await f.controller.setProcessing("autoGainControl", true);
    expect(f.controller.getSnapshot().processingError).toBeNull();
    expect(f.controller.getSnapshot().info?.settings.autoGainControl).toBe(true);
  });

  it("reports mismatches and unknown settings even when the API resolves", async () => {
    const f = fixture(); await f.controller.request();
    f.track.applyConstraints.mockResolvedValueOnce(undefined);
    await f.controller.setProcessing("echoCancellation", true);
    expect(f.controller.getSnapshot().processingRequested.echoCancellation).toBe(true);
    expect(f.controller.getSnapshot().info?.settings.echoCancellation).toBe(false);
    f.track.getSettings.mockImplementationOnce(() => { throw new Error("Unavailable"); });
    f.controller.refreshProcessing();
    expect(f.controller.getSnapshot().info?.settings).toEqual({});
    expect(f.media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("disables unsupported, fixed and unreported capabilities without trying constraints", async () => {
    const f = fixture();
    f.media.getSupportedConstraints.mockReturnValue({ echoCancellation: true, noiseSuppression: true });
    f.track.getCapabilities.mockReturnValue({ echoCancellation: [true] });
    await f.controller.request();
    expect(f.controller.getSnapshot().info?.processing).toEqual({ echoCancellation: "fixed-on", noiseSuppression: "unknown", autoGainControl: "unsupported" });
    for (const key of ["echoCancellation", "noiseSuppression", "autoGainControl"] as const) await f.controller.setProcessing(key, true);
    expect(f.track.applyConstraints).not.toHaveBeenCalled();
    f.track.getCapabilities.mockImplementation(() => { throw new Error("Unavailable"); });
    f.controller.refreshProcessing();
    expect(f.controller.getSnapshot().info?.processing.echoCancellation).toBe("unknown");
  });

  it("blocks changes during capture and blocks capture during a pending change", async () => {
    const f = fixture(); await f.controller.request();
    const station = new StationController(f.controller, null);
    station.attach(f.context as unknown as AudioContext, f.node as unknown as AudioWorkletNode);
    const mix = f.node.port.postMessage.mock.calls.at(-1)![0] as { sequence: number };
    station.accept({ type: "station-mixer-applied", sequence: mix.sequence });
    station.acceptTransport({ type: "transport", bpm: 120, numerator: 4, denominator: 4, playing: true, positionFrame: 0, positionTick: 0, contextFrame: 0 });
    await station.tracks[0].record();
    expect(f.controller.getSnapshot().captureLocked).toBe(true);
    await f.controller.setProcessing("echoCancellation", true);
    expect(f.track.applyConstraints).not.toHaveBeenCalled();
    station.tracks[0].cancel();
    const gate = deferred(); f.track.applyConstraints.mockReturnValueOnce(gate.promise);
    const pending = f.controller.setProcessing("echoCancellation", true);
    f.node.port.postMessage.mockClear();
    await station.tracks[1].record();
    expect(f.node.port.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "loop-record" }), expect.anything());
    expect(station.tracks[1].getSnapshot().phase).toBe("empty");
    gate.resolve(); await pending;
    station.detach();
  });

  it.each(["release", "disconnect", "dispose"] as const)("ignores a late result after %s", async (action) => {
    const f = fixture(); await f.controller.request();
    const gate = deferred(); f.track.applyConstraints.mockReturnValueOnce(gate.promise);
    const pending = f.controller.setProcessing("noiseSuppression", true);
    if (action === "disconnect") f.disconnect(); else f.controller[action]();
    const snapshot = f.controller.getSnapshot();
    gate.resolve(); await pending;
    expect(f.controller.getSnapshot()).toBe(snapshot);
    expect(snapshot.info).toBeNull(); expect(snapshot.processingPending).toBeNull(); expect(snapshot.monitorEnabled).toBe(false);
  });

  it("does not treat a silently ended track as successfully applied", async () => {
    const f = fixture(); await f.controller.request();
    const gate = deferred(); f.track.applyConstraints.mockReturnValueOnce(gate.promise);
    const pending = f.controller.setProcessing("echoCancellation", true);
    f.track.readyState = "ended"; gate.resolve(); await pending;
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "disconnected", info: null, monitorEnabled: false });
  });

  it("keeps the route and monitoring closed through audio suspension and later resumption", async () => {
    const f = fixture(); await f.controller.request();
    const gate = deferred(); f.track.applyConstraints.mockReturnValueOnce(gate.promise);
    const pending = f.controller.setProcessing("echoCancellation", true);
    f.controller.setAudioRunning(false); gate.resolve(); await pending;
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "active", audioReady: false, monitorEnabled: false });
    expect(f.node.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
    f.controller.setAudioRunning(true);
    expect(f.controller.getSnapshot().monitorEnabled).toBe(false);
  });

  it("preserves preferences on a failed device switch, resets them on a new device, and ignores an old response", async () => {
    const f = fixture(); await f.controller.request();
    await f.controller.setProcessing("echoCancellation", true);
    f.media.getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await f.controller.request("missing");
    expect(f.controller.getSnapshot().processingRequested.echoCancellation).toBe(true);
    const gate = deferred(); f.track.applyConstraints.mockReturnValueOnce(gate.promise);
    const pending = f.controller.setProcessing("noiseSuppression", true);
    f.controller.release();
    const next = fakeTrack(); f.media.getUserMedia.mockResolvedValueOnce(next.stream as unknown as MediaStream);
    await f.controller.request("next"); const snapshot = f.controller.getSnapshot();
    gate.reject(new DOMException("Old request", "AbortError")); await pending;
    expect(f.controller.getSnapshot()).toBe(snapshot);
    expect(snapshot.processingRequested).toEqual(MUSIC_INPUT_PROCESSING);
    expect(snapshot.processingError).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { isInputChannelAvailable } from "../../src/audio/input/input-channel";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import { MicrophoneInputBus } from "../../src/audio/input/microphone-input-bus";

class GraphNode {
  edges: { target: GraphNode; output: number }[] = [];
  fail = false;
  gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime(value: number) { this.value = value; },
    linearRampToValueAtTime(value: number) { this.value = value; },
  };
  connect(target: GraphNode, output = 0) {
    if (this.fail) throw new Error("routing failure");
    this.edges.push({ target, output });
  }
  disconnect() { this.edges = []; }
}

function graph() {
  const gains: GraphNode[] = [];
  const sources: GraphNode[] = [];
  const splitter = new GraphNode();
  const node = Object.assign(new GraphNode(), { port: { postMessage: vi.fn() } });
  const context = {
    currentTime: 0, state: "running", destination: new GraphNode(),
    createGain() { const gain = new GraphNode(); gains.push(gain); return gain; },
    createChannelSplitter: vi.fn(() => splitter),
    createMediaStreamSource() { const source = new GraphNode(); sources.push(source); return source; },
  };
  return { gains, sources, splitter, node, context,
    audioContext: context as unknown as AudioContext, worklet: node as unknown as AudioWorkletNode };
}

function stream(channelCount?: number) {
  const track = Object.assign(new EventTarget(), {
    readyState: "live", label: "Test input", getSettings: () => ({ channelCount }),
    stop: vi.fn(function () { track.readyState = "ended"; }),
  });
  return { track, media: { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream };
}

async function fixture(channelCount?: number) {
  const g = graph();
  const source = stream(channelCount);
  const devices = Object.assign(new EventTarget(), {
    getUserMedia: vi.fn(async () => source.media), enumerateDevices: vi.fn(async () => []),
  });
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: devices });
  const controller = new MicrophoneController();
  controller.attachAudio(g.audioContext, g.worklet);
  await controller.request();
  const revision = () => {
    const message = g.node.port.postMessage.mock.lastCall?.[0] as { revision: number };
    return message.revision;
  };
  return { ...g, source, devices, controller, revision };
}

afterEach(() => vi.unstubAllGlobals());

describe("input channel availability", () => {
  it.each([undefined, 0, -1, 1.5, NaN, Infinity])("allows only downmix for unknown or invalid channel count %s", (count) => {
    expect(isInputChannelAvailable("mono", count)).toBe(true);
    expect(isInputChannelAvailable("left", count)).toBe(false);
    expect(isInputChannelAvailable("right", count)).toBe(false);
  });
  it("restricts discrete choices to channels reported by the track", () => {
    expect(isInputChannelAvailable("left", 1)).toBe(true);
    expect(isInputChannelAvailable("right", 1)).toBe(false);
    expect(isInputChannelAvailable("right", 2)).toBe(true);
    expect(isInputChannelAvailable("right", 6)).toBe(true);
    expect(isInputChannelAvailable("stereo", 2)).toBe(false);
    expect(isInputChannelAvailable("other", 2)).toBe(false);
  });
});

describe("shared mono routing graph", () => {
  it("selects one discrete channel before the shared gain, without leaving duplicate paths", () => {
    const g = graph();
    const bus = new MicrophoneInputBus(g.audioContext, g.worklet);
    bus.connect(stream(2).media);
    expect(g.context.createChannelSplitter).toHaveBeenCalledWith(2);
    expect(g.sources[0].edges).toEqual([{ target: g.gains[0], output: 0 }]);
    bus.setMonitor(0.5, true);
    bus.setChannel("right");
    expect(g.gains[1].gain.value).toBe(0);
    expect(g.sources[0].edges).toEqual([{ target: g.splitter, output: 0 }]);
    expect(g.splitter.edges).toEqual([{ target: g.gains[0], output: 1 }]);
    bus.setChannel("left");
    expect(g.splitter.edges).toEqual([{ target: g.gains[0], output: 0 }]);
    bus.setChannel("mono");
    expect(g.splitter.edges).toEqual([]);
    expect(g.sources[0].edges).toEqual([{ target: g.gains[0], output: 0 }]);
    expect(g.gains[0].edges).toEqual([{ target: g.node, output: 0 }]);
    bus.dispose();
    expect(g.sources[0].edges).toEqual([]);
    expect(g.gains.every((gain) => gain.edges.length === 0)).toBe(true);
  });
});

describe("microphone channel lifecycle", () => {
  it("clears clip/meter history, rejects late meter messages and switches monitoring OFF", async () => {
    const f = await fixture(2);
    const oldRevision = f.revision();
    const meter = { type: "input-meter", revision: oldRevision, receiving: true, peak: 1, rms: 0.5, clipped: true };
    f.controller.acceptMeter(meter);
    f.controller.setMonitor(true);
    f.controller.setChannel("right");
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "right", routed: true, monitorEnabled: false, meter: null });
    expect(f.revision()).toBeGreaterThan(oldRevision);
    f.controller.acceptMeter(meter);
    expect(f.controller.getSnapshot().meter).toBeNull();
    f.controller.acceptMeter({ ...meter, revision: f.revision(), clipped: false });
    expect(f.controller.getSnapshot().meter?.clipped).toBe(false);
    const revision = f.revision();
    f.controller.setMonitor(true);
    f.controller.setChannel("right");
    expect(f.revision()).toBe(revision);
    expect(f.controller.getSnapshot().monitorEnabled).toBe(true);
    f.controller.dispose();
  });

  it.each([undefined, 1])("rejects unavailable CH2 without interrupting the input (%s channels)", async (count) => {
    const f = await fixture(count);
    const revision = f.revision();
    f.controller.setMonitor(true);
    f.controller.setChannel("right");
    expect(f.revision()).toBe(revision);
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: true, monitorEnabled: true });
    f.controller.dispose();
  });

  it("blocks route changes and retries during capture locks and audio interruption", async () => {
    const f = await fixture(2);
    f.controller.setCaptureLocked(true);
    const revision = f.revision();
    f.controller.setChannel("left");
    f.controller.retryRouting();
    expect(f.revision()).toBe(revision);
    expect(f.controller.getSnapshot().channel).toBe("mono");
    f.controller.setCaptureLocked(false);
    f.controller.setChannel("left");
    f.controller.setAudioRunning(false);
    const suspendedRevision = f.revision();
    f.controller.setChannel("right");
    f.controller.retryRouting();
    expect(f.revision()).toBe(suspendedRevision);
    f.controller.setAudioRunning(true);
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "left", monitorEnabled: false });
    f.controller.dispose();
  });

  it("resets selection on successful device change, release and restart", async () => {
    const f = await fixture(2);
    f.controller.setChannel("right");
    const next = stream(1);
    f.devices.getUserMedia.mockResolvedValueOnce(next.media);
    await f.controller.request("next-device");
    expect(f.source.track.stop).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: true, monitorEnabled: false });
    expect(f.sources[0].edges).toEqual([]);
    expect(f.splitter.edges).toEqual([]);
    f.controller.setChannel("left");
    f.controller.detachAudio();
    expect(next.track.stop).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: false, audioReady: false });
    f.controller.attachAudio(f.audioContext, f.worklet);
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: false, monitorEnabled: false });
    f.controller.dispose();
  });

  it("preserves the old route on failed or cancelled device switches and discards late streams", async () => {
    const f = await fixture(2);
    f.controller.setChannel("right");
    const revision = f.revision();
    f.devices.getUserMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    await f.controller.request("denied-device");
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "right", routed: true, phase: "active", monitorEnabled: false });
    let resolve!: (value: MediaStream) => void;
    f.devices.getUserMedia.mockReturnValueOnce(new Promise((yes) => { resolve = yes; }));
    const request = f.controller.request("late-device");
    f.controller.setChannel("left");
    f.controller.retryRouting();
    expect(f.revision()).toBe(revision);
    f.controller.cancelRequest();
    const late = stream(1);
    resolve(late.media);
    await request;
    expect(late.track.stop).toHaveBeenCalledOnce();
    expect(f.source.track.stop).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "right", routed: true, phase: "active" });
    f.controller.dispose();
  });

  it("disconnects on routing failure and retries with safe default downmix", async () => {
    const f = await fixture(2);
    f.splitter.fail = true;
    f.controller.setChannel("right");
    expect(f.sources[0].edges).toEqual([]);
    expect(f.splitter.edges).toEqual([]);
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: false, monitorEnabled: false, issue: "routing-failed" });
    expect(f.node.port.postMessage).toHaveBeenLastCalledWith({ type: "input-route", revision: f.revision(), active: false });
    f.controller.retryRouting();
    expect(f.controller.getSnapshot()).toMatchObject({ channel: "mono", routed: true, issue: null });
    f.controller.dispose();
  });

  it("releases the selected route on device disconnection", async () => {
    const f = await fixture(2);
    f.controller.setChannel("right");
    f.source.track.readyState = "ended";
    f.source.track.dispatchEvent(new Event("ended"));
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "disconnected", channel: "mono", routed: false, meter: null });
    expect(f.sources[0].edges).toEqual([]);
    expect(f.splitter.edges).toEqual([]);
    f.controller.dispose();
  });
});

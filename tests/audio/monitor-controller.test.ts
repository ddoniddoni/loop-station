import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneController } from "../../src/audio/input/microphone-controller";
import type { InputMonitorMode } from "../../src/audio/input/input-monitor";

type Command = { type: string; mode?: InputMonitorMode; revision?: number; sequence?: number };
function gain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: {
    value: 1, cancelScheduledValues: vi.fn(),
    setValueAtTime(value: number) { this.value = value; },
    linearRampToValueAtTime(value: number) { this.value = value; },
  } };
}
async function fixture() {
  const track = Object.assign(new EventTarget(), { readyState: "live", label: "Synthetic microphone",
    getSettings: () => ({ channelCount: 1 }), stop: vi.fn(() => { track.readyState = "ended"; }) });
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  const mediaDevices = Object.assign(new EventTarget(), {
    getUserMedia: vi.fn(async () => stream), enumerateDevices: vi.fn(async () => []),
  });
  vi.stubGlobal("window", { isSecureContext: true }); vi.stubGlobal("navigator", { mediaDevices });
  const gains: ReturnType<typeof gain>[] = [];
  const context = { currentTime: 0, state: "running", destination: {},
    createGain: () => { const node = gain(); gains.push(node); return node; },
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
  } as unknown as AudioContext;
  const messages: Command[] = [];
  const node = { connect: vi.fn(), disconnect: vi.fn(), port: { postMessage: (message: Command) => messages.push(message) } } as unknown as AudioWorkletNode;
  const controller = new MicrophoneController(); controller.attachAudio(context, node); await controller.request();
  function ack() {
    const command = messages.filter((message) => message.type === "input-monitor").at(-1);
    return { ...command, type: "input-monitor-applied" };
  }
  return { controller, track, mediaDevices, gains, messages, context, node, ack, volume: () => gains[1].gain.value };
}
afterEach(() => vi.unstubAllGlobals());

describe("monitor mode application and microphone lifecycle", () => {
  it("keeps physical output closed until the exact Worklet acknowledgement, then uses the latest volume", async () => {
    const f = await fixture();
    expect(f.controller.getSnapshot()).toMatchObject({ monitorMode: "off", monitorPending: null });
    f.controller.setMonitorMode("auto");
    const ack = f.ack();
    expect(f.volume()).toBe(0);
    expect(f.controller.getSnapshot()).toMatchObject({ monitorMode: "off", monitorPending: "auto" });
    f.controller.setMonitorVolume(60);
    f.controller.acceptMonitor({ ...ack, sequence: -1 });
    f.controller.acceptMonitor({ ...ack, revision: 999 });
    f.controller.acceptMonitor({ ...ack, mode: "on" });
    expect(f.volume()).toBe(0);
    f.controller.acceptMonitor(ack);
    expect(f.volume()).toBe(0.6);
    expect(f.controller.getSnapshot()).toMatchObject({ monitorMode: "auto", monitorPending: null });
    f.controller.setMonitorVolume(35);
    expect(f.volume()).toBe(0.35);
    expect(f.gains[0].gain.value).toBe(1);
    f.controller.dispose();
  });

  it("ignores reordered mode replies and OFF closes output without waiting for a reply", async () => {
    const f = await fixture();
    f.controller.setMonitorMode("on"); const first = f.ack();
    f.controller.setMonitorMode("auto"); const second = f.ack();
    f.controller.acceptMonitor(first); expect(f.volume()).toBe(0);
    f.controller.acceptMonitor(second); expect(f.volume()).toBe(0.2);
    f.controller.setMonitorMode("off");
    f.controller.acceptMonitor(second);
    expect(f.volume()).toBe(0);
    expect(f.controller.getSnapshot()).toMatchObject({ monitorMode: "off", monitorPending: null });
    f.controller.dispose();
  });

  it.each(["suspend", "release", "disconnect", "restart"])("rejects a late enable acknowledgement after %s", async (action) => {
    const f = await fixture();
    f.controller.setMonitorMode("auto"); const ack = f.ack();
    if (action === "suspend") { f.controller.setAudioRunning(false); f.controller.setAudioRunning(true); }
    else if (action === "release") f.controller.release();
    else if (action === "disconnect") { f.track.readyState = "ended"; f.track.dispatchEvent(new Event("ended")); }
    else { f.controller.detachAudio(); f.controller.attachAudio(f.context, f.node); }
    f.controller.acceptMonitor(ack);
    expect(f.volume()).toBe(0);
    expect(f.controller.getSnapshot()).toMatchObject({ monitorMode: "off", monitorPending: null });
    f.controller.dispose();
  });

  it("keeps OFF after a failed device switch and never enables while switching", async () => {
    const f = await fixture();
    f.controller.setMonitorMode("auto"); const ack = f.ack(); f.controller.acceptMonitor(ack);
    f.mediaDevices.getUserMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    const request = f.controller.request("other");
    f.controller.setMonitorMode("on"); f.controller.acceptMonitor(ack);
    expect(f.volume()).toBe(0);
    await request;
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "active", routed: true, monitorMode: "off", monitorPending: null });
    f.controller.dispose();
  });

  it("allows monitoring changes during capture without rerouting or interrupting recording", async () => {
    const f = await fixture();
    f.controller.setCaptureLocked(true);
    const before = f.messages.filter((message) => message.type === "input-route");
    f.controller.setMonitorMode("auto"); f.controller.acceptMonitor(f.ack());
    f.controller.setMonitorMode("off");
    expect(f.messages.filter((message) => message.type === "input-route")).toEqual(before);
    expect(f.controller.getSnapshot().captureLocked).toBe(true);
    expect(f.volume()).toBe(0);
    f.controller.dispose();
  });

  it("does not request microphone access or enable modes without a prepared input", () => {
    const controller = new MicrophoneController();
    controller.setMonitorMode("auto"); controller.setMonitorMode("on");
    expect(controller.getSnapshot()).toMatchObject({ phase: "idle", monitorMode: "off", monitorPending: null });
    controller.dispose();
  });
});

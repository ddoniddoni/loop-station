import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoopMetadata, isLoopStatus, recordingCapacity } from "../../src/audio/loop/loop-protocol";

const defaultConfig = { bpm: 120, numerator: 4, denominator: 4 };
class Port {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  messages: unknown[] = [];
  postMessage(message: unknown, transfer: Transferable[] = []) { this.messages.push(structuredClone(message, { transfer })); }
}
type Processor = { port: Port; process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean };

// Execute the production processor with synthetic render blocks, not a replacement DSP.
async function fixture(metronome = false, countIn = true, withExistingLoop = false, rate = 8000, config = defaultConfig) {
  const capacity = recordingCapacity(rate, config);
  vi.resetModules();
  const registered: (new () => Processor)[] = [];
  vi.stubGlobal("sampleRate", rate);
  vi.stubGlobal("currentFrame", 0);
  vi.stubGlobal("AudioWorkletProcessor", class { readonly port = new Port(); });
  vi.stubGlobal("registerProcessor", (_name: string, constructor: new () => Processor) => { registered.push(constructor); });
  await import("../../src/audio/worklets/test-tone-processor");
  const processor = new registered[0]();
  function send(data: unknown) { processor.port.onmessage?.({ data } as MessageEvent<unknown>); }
  const outputs = (size: number) => [[new Float32Array(size)], [new Float32Array(size)], [new Float32Array(size)], [new Float32Array(size), new Float32Array(size)]];
  processor.process([], outputs(64));
  let contextFrame = 64;
  let position = 0;
  send({ type: "input-route", revision: 1, active: true });
  send({ type: "metronome-enable", enabled: metronome });
  if (withExistingLoop) {
    send({ type: "loop-restore", trackId: 0, sequence: 1,
      metadata: { ...config, frames: 64000, ticks: 15360, sampleRate: rate, complete: true }, pcm: new Float32Array(capacity).fill(0.25).buffer });
    send({ type: "transport-start" });
  }
  const trackId = withExistingLoop ? 1 : 0;
  send({ type: "loop-record", trackId, sequence: 1, config, countIn, pcm: new ArrayBuffer(capacity * 4), archive: new ArrayBuffer(capacity * 4) });
  function render(until: number, input = 0) {
    let clickPeak = 0;
    let loopPeak = 0;
    let block = 0;
    const sizes = [64, 192, 127, 256];
    while (position < until) {
      const size = Math.min(sizes[block++ % sizes.length], until - position);
      const output = outputs(size);
      vi.stubGlobal("currentFrame", contextFrame);
      processor.process([[new Float32Array(size).fill(input)]], output);
      for (const sample of output[1][0]) clickPeak = Math.max(clickPeak, Math.abs(sample));
      for (const sample of output[3][0]) loopPeak = Math.max(loopPeak, Math.abs(sample));
      position += size; contextFrame += size;
    }
    return { clickPeak, loopPeak };
  }
  function captured() {
    const result = processor.port.messages.find((value) => typeof value === "object" && value !== null && "type" in value && value.type === "loop-captured");
    if (typeof result !== "object" || result === null || !("metadata" in result) || !isLoopMetadata(result.metadata) || !("pcm" in result) || !(result.pcm instanceof ArrayBuffer)) throw new Error("No captured PCM");
    return { metadata: result.metadata, pcm: new Float32Array(result.pcm) };
  }
  return { processor, render, send, captured, trackId };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe("production Worklet count-in routing", () => {
  it("plays preparation clicks with metronome OFF and excludes clicks and another loop from the captured PCM", async () => {
    const f = await fixture(false, true, true);
    expect(f.render(16000)).toEqual({ clickPeak: 0, loopPeak: 0 });
    const preparation = f.render(32000);
    expect(preparation.clickPeak).toBeGreaterThan(0.1);
    expect(preparation.loopPeak).toBeCloseTo(0.125, 7);
    const recording = f.render(96000);
    expect(recording.clickPeak).toBe(0);
    expect(recording.loopPeak).toBeCloseTo(0.125, 7);
    const take = f.captured();
    expect(take.metadata).toMatchObject({ frames: 64000, ticks: 15360, complete: true });
    expect(take.pcm.every((sample) => sample === 0)).toBe(true);
    const remaining = f.processor.port.messages.filter(isLoopStatus).filter((status) => status.phase === "count-in").map((status) => status.countInRemaining);
    expect([...new Set(remaining)]).toEqual([4, 3, 2, 1]);
  });

  it("does not skip a rounded beat at the first frame of a render block", async () => {
    const f = await fixture(false, true, false, 44100, { bpm: 127, numerator: 4, denominator: 4 });
    const start = Math.round(44100 * 4 * 60 / 127);
    expect(f.render(start).clickPeak).toBe(0);
    expect(f.render(start + 100).clickPeak).toBeGreaterThan(0.1);
  });

  it("keeps the regular metronome running after the preparation bar", async () => {
    const f = await fixture(true);
    expect(f.render(16000).clickPeak).toBeGreaterThan(0.1);
    expect(f.render(32000).clickPeak).toBeGreaterThan(0.1);
    expect(f.render(96000).clickPeak).toBeGreaterThan(0.1);
    expect(f.captured().pcm.every((sample) => sample === 0)).toBe(true);
  });

  it("starts at the next bar and emits no preparation clicks when count-in is OFF", async () => {
    const f = await fixture(false, false);
    expect(f.render(80000, 0.125).clickPeak).toBe(0);
    expect(f.processor.port.messages.filter(isLoopStatus).some((status) => status.phase === "count-in")).toBe(false);
    const take = f.captured();
    expect(take.metadata.frames).toBe(64000);
    expect(take.pcm[0]).toBe(0.125);
    expect(take.pcm[63999]).toBe(0.125);
  });

  it.each(["cancel", "input-disconnect"])("stops preparation clicks on %s and leaves the other loop playing", async (action) => {
    const f = await fixture(false, true, true);
    expect(f.render(16100).clickPeak).toBeGreaterThan(0.1);
    if (action === "cancel") f.send({ type: "loop-cancel", trackId: f.trackId, sequence: 2, captureMode: "record" });
    else f.send({ type: "input-route", revision: 2, active: false });
    f.render(16500); // Allow the existing click envelope to decay smoothly.
    expect(f.render(100000)).toEqual({ clickPeak: 0, loopPeak: 0.125 });
    expect(() => f.captured()).toThrow("No captured PCM");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingCapacity } from "../../src/audio/loop/loop-protocol";

type Processor = { port: { onmessage: ((event: { data: unknown }) => void) | null }; process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function fixture() {
  let Constructor!: new () => Processor;
  const messages: unknown[] = [];
  vi.stubGlobal("sampleRate", 8000); vi.stubGlobal("currentFrame", 0);
  vi.stubGlobal("AudioWorkletProcessor", class { port = { onmessage: null, postMessage: (data: unknown) => messages.push(data) }; });
  vi.stubGlobal("registerProcessor", (_name: string, value: new () => Processor) => { Constructor = value; });
  await import("../../src/audio/worklets/test-tone-processor");
  const processor = new Constructor();
  const send = (data: unknown) => processor.port.onmessage?.({ data });
  let frame = 0;
  const render = (size: number, mic = 0.75, drum = 0.25) => {
    vi.stubGlobal("currentFrame", frame);
    const outputs = [1, 1, 1, 2, 1].map((channels) => Array.from({ length: channels }, () => new Float32Array(size)));
    processor.process([[new Float32Array(size).fill(mic)], [new Float32Array(size).fill(drum)]], outputs);
    frame += size;
    return outputs;
  };
  return { messages, send, render };
}

describe("actual processor instrument routing", () => {
  it("captures only drum PCM, excludes the microphone and click, and survives microphone disconnection", async () => {
    const f = await fixture();
    f.send({ type: "input-route", revision: 1, active: true });
    f.send({ type: "capture-route", revision: 1, source: "drums", active: true });
    f.send({ type: "metronome-enable", enabled: true });
    const config = { bpm: 120, numerator: 4, denominator: 4 };
    const bytes = recordingCapacity(8000, config, 1) * 4;
    f.render(192);
    f.send({ type: "loop-record", trackId: 0, sequence: 1, config, bars: 1, pcm: new ArrayBuffer(bytes), archive: new ArrayBuffer(bytes) });
    for (let block = 0; block < 300; block++) {
      if (block === 20) f.send({ type: "input-route", revision: 2, active: false });
      f.render(block % 2 === 0 ? 127 : 192);
    }
    const captured = f.messages.find((data) => typeof data === "object" && data !== null && "type" in data && data.type === "loop-captured");
    expect(captured).toMatchObject({ captureMode: "record", metadata: { complete: true, frames: 16000 } });
    if (!captured || typeof captured !== "object" || !("pcm" in captured) || !(captured.pcm instanceof ArrayBuffer)) throw new Error("No captured PCM");
    expect(Array.from(new Float32Array(captured.pcm).slice(0, 16000)).every((value) => value === 0.25)).toBe(true);
  });
  it("mutes drum audition when microphone is selected and keeps microphone monitoring separate", async () => {
    const f = await fixture(); f.send({ type: "input-route", revision: 1, active: true });
    f.send({ type: "capture-route", revision: 1, source: "drums", active: true });
    expect(f.render(64)[4][0][0]).toBe(0.25);
    f.send({ type: "capture-route", revision: 2, source: "microphone", active: true });
    const output = f.render(192);
    expect(output[4][0].every((sample) => sample === 0)).toBe(true);
    expect(output[2][0][0]).toBe(0.75);
    expect(f.messages).toContainEqual({ type: "capture-route-applied", revision: 2 });
  });
});

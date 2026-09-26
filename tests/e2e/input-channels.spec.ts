import { expect, test } from "@playwright/test";
import { build } from "esbuild";

// Production input bus + production Worklet, driven by stereo synthetic PCM.
// This does not replace real microphone, device switching or listening checks.
test("selected input feeds the same mono PCM to recording, meter and monitor output", async ({ page }) => {
  const bundle = await build({
    entryPoints: ["src/audio/input/microphone-input-bus.ts"], bundle: true, write: false,
    format: "esm", platform: "browser", target: "es2022",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  const result = await page.evaluate(async (source) => {
    const context = new AudioContext({ sampleRate: 8000 });
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
    const probeUrl = URL.createObjectURL(new Blob([`
      class InputProbe extends AudioWorkletProcessor {
        constructor() { super(); this.frames = 0; this.sum = 0; }
        process(inputs) {
          const input = inputs[0]?.[0];
          if (!input) return true;
          for (let i = 0; i < input.length; i++) this.sum += input[i];
          this.frames += input.length;
          if (this.frames >= sampleRate / 10) {
            this.port.postMessage({ type: 'probe', mean: this.sum / this.frames });
            this.frames = 0; this.sum = 0;
          }
          return true;
        }
      }
      registerProcessor('input-probe', InputProbe);
    `], { type: "application/javascript" }));
    let bus: import("../../src/audio/input/microphone-input-bus").MicrophoneInputBus | undefined;
    let producer: AudioBufferSourceNode | undefined;
    let bridge: MediaStreamAudioDestinationNode | undefined;
    const nodes: AudioNode[] = [];
    const ports: MessagePort[] = [];
    try {
      await context.resume();
      const inputModule: typeof import("../../src/audio/input/microphone-input-bus") = await import(moduleUrl);
      await context.audioWorklet.addModule("/audio/test-tone-processor.js");
      await context.audioWorklet.addModule(probeUrl);
      const station = new AudioWorkletNode(context, "loop-station-test-tone", {
        numberOfInputs: 1, numberOfOutputs: 4, outputChannelCount: [1, 1, 1, 2], channelCount: 1, channelCountMode: "explicit",
      });
      const probe = new AudioWorkletNode(context, "input-probe", { channelCount: 1, channelCountMode: "explicit" });
      const silent = context.createGain(); silent.gain.value = 0;
      station.connect(probe, 2); probe.connect(silent); silent.connect(context.destination);
      nodes.push(station, probe, silent); ports.push(station.port, probe.port);
      bus = new inputModule.MicrophoneInputBus(context, station);
      bridge = context.createMediaStreamDestination();
      bridge.channelCount = 2; bridge.channelCountMode = "explicit";
      producer = context.createBufferSource();
      producer.buffer = context.createBuffer(2, 1024, context.sampleRate);
      producer.buffer.getChannelData(0).fill(0.2);
      producer.buffer.getChannelData(1).fill(0.6);
      producer.loop = true;
      producer.connect(bridge); producer.start();
      bus.connect(bridge.stream);
      bus.setGain(20 * Math.log10(0.5));
      type Sample = { type: string; revision?: number; peak?: number; rms?: number; mean?: number;
        trackId?: number; metadata?: { frames: number; complete: boolean }; pcm?: ArrayBuffer };
      function waitFor(port: MessagePort, predicate: (data: Sample) => boolean): Promise<Sample> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            port.removeEventListener("message", receive);
            reject(new Error("Expected input PCM was not received"));
          }, 8000);
          function receive(event: MessageEvent<Sample>) {
            if (!predicate(event.data)) return;
            clearTimeout(timer); port.removeEventListener("message", receive); resolve(event.data);
          }
          port.addEventListener("message", receive); port.start();
        });
      }
      const config = { bpm: 240, numerator: 4, denominator: 4 };
      station.port.postMessage({ type: "transport-configure", config });
      const results = [];
      const channels = ["mono", "left", "right"] as const;
      const expected = [0.2, 0.1, 0.3];
      for (const [index, channel] of channels.entries()) {
        bus.setChannel(channel);
        const revision = index + 1;
        station.port.postMessage({ type: "input-route", revision, active: true });
        const [meter, monitor] = await Promise.all([
          waitFor(station.port, (data) => data.type === "input-meter" && data.revision === revision
            && Math.abs((data.rms ?? 0) - expected[index]) < 0.00001),
          waitFor(probe.port, (data) => Math.abs((data.mean ?? 0) - expected[index]) < 0.00001),
        ]);
        const captured = waitFor(station.port, (data) => data.type === "loop-captured" && data.trackId === index);
        const pcm = new Float32Array(context.sampleRate + 1).buffer;
        const archive = new Float32Array(context.sampleRate + 1).buffer;
        station.port.postMessage({ type: "loop-record", trackId: index, sequence: 1, config, bars: 1, pcm, archive }, [pcm, archive]);
        const take = await captured;
        if (!take.pcm || !take.metadata) throw new Error("Missing captured PCM");
        const samples = new Float32Array(take.pcm, 0, take.metadata.frames);
        let maximumError = 0;
        for (const sample of samples) maximumError = Math.max(maximumError, Math.abs(sample - expected[index]));
        results.push({ channel, peak: meter.peak, rms: meter.rms, monitor: monitor.mean,
          maximumError, frames: take.metadata.frames, complete: take.metadata.complete });
      }
      return { results, sampleRate: context.sampleRate };
    } finally {
      bus?.dispose(); producer?.stop(); producer?.disconnect(); bridge?.disconnect();
      bridge?.stream.getTracks().forEach((track) => track.stop());
      nodes.forEach((node) => node.disconnect()); ports.forEach((port) => port.close());
      URL.revokeObjectURL(moduleUrl); URL.revokeObjectURL(probeUrl);
      await context.close();
    }
  }, bundle.outputFiles[0].text);
  const expected = [0.2, 0.1, 0.3];
  for (const [index, value] of result.results.entries()) {
    expect(value.peak).toBeCloseTo(expected[index], 5);
    expect(value.rms).toBeCloseTo(expected[index], 5);
    expect(value.monitor).toBeCloseTo(expected[index], 5);
    expect(value.maximumError).toBeLessThan(0.00001);
    expect(value.frames).toBe(result.sampleRate);
    expect(value.complete).toBe(true);
  }
});

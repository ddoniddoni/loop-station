import { expect, test } from "@playwright/test";

// Real Chromium AudioWorklet graph with synthetic PCM; not a hardware/listening test.
test("Worklet output 3 carries independent left/right PCM and master mute", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  const result = await page.evaluate(async () => {
    const context = new AudioContext({ sampleRate: 8000 });
    const probeUrl = URL.createObjectURL(new Blob([`
      class StereoProbe extends AudioWorkletProcessor {
        constructor() { super(); this.frames = 0; this.left = 0; this.right = 0; }
        process(inputs) {
          const left = inputs[0]?.[0]; const right = inputs[0]?.[1];
          if (!left || !right) return true;
          for (let i = 0; i < left.length; i++) {
            this.left = Math.max(this.left, Math.abs(left[i]));
            this.right = Math.max(this.right, Math.abs(right[i]));
          }
          this.frames += left.length;
          if (this.frames >= sampleRate / 10) {
            this.port.postMessage({ left: this.left, right: this.right });
            this.frames = 0; this.left = 0; this.right = 0;
          }
          return true;
        }
      }
      registerProcessor('stereo-probe', StereoProbe);
    `], { type: "application/javascript" }));
    try {
      await context.resume();
      await context.audioWorklet.addModule("/audio/test-tone-processor.js");
      await context.audioWorklet.addModule(probeUrl);
      const station = new AudioWorkletNode(context, "loop-station-test-tone", {
        numberOfInputs: 1, numberOfOutputs: 4, outputChannelCount: [1, 1, 1, 2], channelCount: 1, channelCountMode: "explicit",
      });
      const probe = new AudioWorkletNode(context, "stereo-probe", { channelCount: 2, channelCountMode: "explicit" });
      const silent = context.createGain(); silent.gain.value = 0;
      station.connect(probe, 3); probe.connect(silent); silent.connect(context.destination);
      type Pair = { left: number; right: number };
      function waitFor(predicate: (value: Pair) => boolean): Promise<Pair> {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("No expected stereo PCM received")), 8000);
          probe.port.onmessage = (event: MessageEvent<Pair>) => {
            if (!predicate(event.data)) return;
            clearTimeout(timeout); probe.port.onmessage = null; resolve(event.data);
          };
        });
      }
      function mix(sequence: number, pan: number, mute = false) {
        station.port.postMessage({ type: "station-mixer", sequence,
          mix: Array.from({ length: 8 }, () => ({ gainDb: 0, pan, mute: false, solo: false })),
          master: { gainDb: 20 * Math.log10(0.5), mute } });
      }
      const frames = context.sampleRate * 8;
      const pcm = new Float32Array(frames + 1).fill(0.25).buffer;
      station.port.postMessage({ type: "loop-restore", trackId: 0, sequence: 1,
        metadata: { bpm: 120, numerator: 4, denominator: 4, sampleRate: context.sampleRate, frames, ticks: 15360, complete: true }, pcm }, [pcm]);
      mix(1, -1);
      station.port.postMessage({ type: "transport-start" });
      const left = await waitFor((pair) => pair.left > 0.1 && pair.right === 0);
      mix(2, 1);
      const right = await waitFor((pair) => pair.right > 0.1 && pair.left === 0);
      mix(3, 1, true);
      const muted = await waitFor((pair) => pair.left === 0 && pair.right === 0);
      station.disconnect(); probe.disconnect(); silent.disconnect();
      station.port.close(); probe.port.close();
      return { left, right, muted };
    } finally {
      URL.revokeObjectURL(probeUrl);
      await context.close();
    }
  });
  expect(result.left.left).toBeCloseTo(0.125 * Math.SQRT2, 6);
  expect(result.right.right).toBeCloseTo(0.125 * Math.SQRT2, 6);
  expect(result.muted).toEqual({ left: 0, right: 0 });
});

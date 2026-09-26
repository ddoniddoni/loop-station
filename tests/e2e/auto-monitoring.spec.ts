import { expect, test } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test("AUTO emits exactly the recorded frames for a take and an overdub through the production Worklet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  const result = await page.evaluate(async () => {
    const context = new AudioContext({ sampleRate: 8000 });
    const url = URL.createObjectURL(new Blob([`
      class MonitorProbe extends AudioWorkletProcessor {
        constructor() { super(); this.frames = 0; this.first = 0; this.last = 0; this.sum = 0; }
        process(inputs) {
          const pcm = inputs[0]?.[0];
          if (!pcm) return true;
          for (let i = 0; i < pcm.length; i++) {
            if (pcm[i] !== 0) {
              if (this.frames === 0) this.first = currentFrame + i;
              this.last = currentFrame + i; this.sum += pcm[i]; this.frames++;
            } else if (this.frames > 0) {
              this.port.postMessage({ type: 'segment', frames: this.frames, first: this.first, last: this.last, mean: this.sum / this.frames });
              this.frames = 0; this.sum = 0;
            }
          }
          return true;
        }
      }
      registerProcessor('monitor-probe', MonitorProbe);
    `], { type: "application/javascript" }));
    const nodes: AudioNode[] = [];
    const ports: MessagePort[] = [];
    let source: ConstantSourceNode | undefined;
    try {
      await context.resume();
      await context.audioWorklet.addModule("/audio/test-tone-processor.js");
      await context.audioWorklet.addModule(url);
      const station = new AudioWorkletNode(context, "loop-station-test-tone", {
        numberOfInputs: 1, numberOfOutputs: 4, outputChannelCount: [1, 1, 1, 2], channelCount: 1, channelCountMode: "explicit",
      });
      const probe = new AudioWorkletNode(context, "monitor-probe", { channelCount: 1, channelCountMode: "explicit" });
      const silent = context.createGain(); silent.gain.value = 0;
      station.connect(probe, 2); probe.connect(silent); silent.connect(context.destination);
      nodes.push(station, probe, silent); ports.push(station.port, probe.port);
      source = context.createConstantSource(); source.offset.value = 0.25; source.connect(station); source.start();
      type Event = { type: string; captureMode?: string; frames?: number; first?: number; last?: number; mean?: number;
        peak?: number; rms?: number; mode?: string; sequence?: number; metadata?: { frames: number; complete: boolean }; pcm?: ArrayBuffer };
      function waitFor(port: MessagePort, predicate: (value: Event) => boolean): Promise<Event> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { port.removeEventListener("message", receive); reject(new Error("Missing monitor/capture event")); }, 8000);
          function receive(event: MessageEvent<Event>) {
            if (!predicate(event.data)) return;
            clearTimeout(timer); port.removeEventListener("message", receive); resolve(event.data);
          }
          port.addEventListener("message", receive); port.start();
        });
      }
      const config = { bpm: 240, numerator: 4, denominator: 4 };
      const applied = waitFor(station.port, (event) => event.type === "input-monitor-applied" && event.mode === "auto");
      station.port.postMessage({ type: "transport-configure", config });
      station.port.postMessage({ type: "input-route", revision: 1, active: true });
      station.port.postMessage({ type: "input-monitor", revision: 1, sequence: 1, mode: "auto" });
      await applied;
      // Waiting for a real meter message also establishes the first rendered block.
      const before = await waitFor(station.port, (event) => event.type === "input-meter" && event.rms === 0.25);
      const takes = [];
      for (const [index, captureMode] of ["record", "overdub"].entries()) {
        const segment = waitFor(probe.port, (event) => event.type === "segment");
        const capture = waitFor(station.port, (event) => event.type === "loop-captured" && event.captureMode === captureMode);
        const meter = waitFor(station.port, (event) => event.type === "input-meter" && event.rms === 0.25);
        const pcm = new Float32Array(context.sampleRate + 1).buffer;
        const archive = new Float32Array(context.sampleRate + 1).buffer;
        station.port.postMessage({ type: `loop-${captureMode}`, trackId: 0, sequence: index + 1,
          config, bars: 1, pcm, archive }, [pcm, archive]);
        const [monitored, captured, level] = await Promise.all([segment, capture, meter]);
        if (!captured.metadata || !captured.pcm) throw new Error("Missing take PCM");
        const samples = new Float32Array(captured.pcm, 0, captured.metadata.frames);
        takes.push({ monitored, metadata: captured.metadata, pcmUnchanged: samples.every((sample) => sample === (index + 1) * 0.25),
          peak: level.peak, rms: level.rms });
      }
      return { takes, before: before.rms, rate: context.sampleRate };
    } finally {
      source?.stop(); source?.disconnect(); nodes.forEach((node) => node.disconnect()); ports.forEach((port) => port.close());
      URL.revokeObjectURL(url); await context.close();
    }
  });
  expect(result.before).toBe(0.25);
  for (const take of result.takes) {
    expect(take.monitored.frames).toBe(result.rate);
    expect(take.monitored.last! - take.monitored.first! + 1).toBe(result.rate);
    expect(take.monitored.mean).toBe(0.25);
    expect(take.metadata).toMatchObject({ frames: result.rate, complete: true });
    expect(take.pcmUnchanged).toBe(true);
    expect(take.peak).toBe(0.25); expect(take.rms).toBe(0.25);
  }
});

test("monitor mode UI defaults OFF, applies AUTO/ON/OFF and resets on microphone release", async ({ page }) => {
  await page.goto("/");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  const mode = page.getByRole("combobox", { name: ko.inputMonitor, exact: true });
  await expect(mode).toBeDisabled(); await expect(mode).toHaveText(ko.inputMonitorModes.off);
  await page.getByRole("button", { name: "입력 설정 닫기" }).click();
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  await page.getByRole("button", { name: "마이크 사용 허용", exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
  const status = page.locator(".station-input-monitor").getByRole("status");
  for (const choice of ["auto", "on", "off", "auto"] as const) {
    await mode.click(); await page.getByRole("option", { name: ko.inputMonitorModes[choice], exact: true }).click();
    await expect(status).toHaveText(ko.inputMonitorModes[choice]);
  }
  await page.getByRole("button", { name: "마이크 해제", exact: true }).click();
  await expect(mode).toBeDisabled(); await expect(status).toHaveText(ko.inputMonitorModes.off);
  await page.getByRole("button", { name: "마이크 사용 허용", exact: true }).click();
  await expect(mode).toBeEnabled(); await expect(status).toHaveText(ko.inputMonitorModes.off);
});

import { expect, test, type Page } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

test("production Worklet emits PCM for exactly the interval between scheduled play and stop", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const context = new AudioContext({ sampleRate: 8000 });
    const url = URL.createObjectURL(new Blob([`
      class PlaybackProbe extends AudioWorkletProcessor {
        constructor() { super(); this.audible = false; }
        process(inputs) {
          const pcm = inputs[0]?.[0];
          if (!pcm) return true;
          for (let i = 0; i < pcm.length; i++) {
            const audible = Math.abs(pcm[i]) > 0.01;
            if (audible !== this.audible) {
              this.audible = audible;
              this.port.postMessage({ type: 'edge', audible, frame: currentFrame + i, value: pcm[i] });
            }
          }
          return true;
        }
      }
      registerProcessor('playback-probe', PlaybackProbe);
    `], { type: "application/javascript" }));
    type Report = { type: string; sequence?: number; trackId?: number; phase?: string;
      pendingPlayback?: { action: string; frame: number } | null; audible?: boolean; frame?: number; value?: number };
    const reports: Report[] = [];
    const listeners = new Set<() => void>();
    function receive(event: MessageEvent<Report>) {
      if (event.data.type !== "loop-status" && event.data.type !== "edge" && event.data.type !== "worklet-ready") return;
      reports.push(event.data);
      for (const listener of listeners) listener();
    }
    function until(predicate: (report: Report) => boolean): Promise<Report> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { listeners.delete(check); reject(new Error("Missing scheduled audio result")); }, 8000);
        function check() {
          const value = reports.find(predicate);
          if (!value) return;
          clearTimeout(timeout); listeners.delete(check); resolve(value);
        }
        listeners.add(check); check();
      });
    }
    try {
      await context.resume();
      await context.audioWorklet.addModule("/audio/test-tone-processor.js");
      await context.audioWorklet.addModule(url);
      const station = new AudioWorkletNode(context, "loop-station-test-tone", {
        numberOfInputs: 1, numberOfOutputs: 4, outputChannelCount: [1, 1, 1, 2], channelCount: 1, channelCountMode: "explicit",
      });
      const probe = new AudioWorkletNode(context, "playback-probe", { channelCount: 2, channelCountMode: "explicit" });
      const silent = context.createGain(); silent.gain.value = 0;
      station.port.onmessage = receive; probe.port.onmessage = receive;
      station.connect(probe, 3); probe.connect(silent); silent.connect(context.destination);
      await until((r) => r.type === "worklet-ready");
      const pcm = new Float32Array(context.sampleRate * 2).fill(0.25).buffer;
      station.port.postMessage({ type: "loop-restore", trackId: 0, sequence: 1,
        metadata: { bpm: 120, numerator: 4, denominator: 4, sampleRate: context.sampleRate, frames: context.sampleRate * 2, ticks: 3840, complete: true }, pcm }, [pcm]);
      station.port.postMessage({ type: "loop-play", trackId: 0, sequence: 2, timing: "beat" });
      const scheduledPlay = await until((r) => r.trackId === 0 && r.sequence === 2 && r.pendingPlayback?.action === "play");
      await until((r) => r.trackId === 0 && r.sequence === 2 && r.phase === "playing" && r.pendingPlayback === null);
      station.port.postMessage({ type: "loop-stop", trackId: 0, sequence: 3, timing: "bar" });
      const scheduledStop = await until((r) => r.trackId === 0 && r.sequence === 3 && r.pendingPlayback?.action === "stop");
      const on = await until((r) => r.type === "edge" && r.audible === true);
      const off = await until((r) => r.type === "edge" && r.audible === false);
      const stopped = await until((r) => r.trackId === 0 && r.sequence === 3 && r.phase === "stopped" && r.pendingPlayback === null);
      station.disconnect(); probe.disconnect(); silent.disconnect(); station.port.close(); probe.port.close();
      return { scheduledPlay, scheduledStop, on, off, stopped, rate: context.sampleRate };
    } finally { URL.revokeObjectURL(url); await context.close(); }
  });
  expect(result.scheduledPlay.phase).toBe("stopped");
  expect(result.scheduledStop.phase).toBe("playing");
  expect(result.scheduledPlay.pendingPlayback?.frame).toBe(result.rate / 2);
  expect(result.scheduledStop.pendingPlayback?.frame).toBe(result.rate * 2);
  expect(result.off.frame! - result.on.frame!).toBe(result.scheduledStop.pendingPlayback!.frame - result.scheduledPlay.pendingPlayback!.frame);
  expect(result.on.value).toBeCloseTo(0.125, 6); expect(result.off.value).toBe(0);
});

test.describe("playback scheduling UI", () => {
  test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
  test.setTimeout(60_000);

  async function tab(page: Page, name: string) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isVisible()) await button.click();
  }

  test("keeps current state visible during stop reservation, cancels it, then stops immediately", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "오디오 연결 설정" }).click();
    await page.getByRole("button", { name: ko.audioStart, exact: true }).click();
    await expect(page.getByRole("button", { name: ko.toneStart })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /템포와 박자 설정/ }).click();
    await page.getByRole("spinbutton", { name: ko.transportTempoLabel, exact: true }).fill("40");
    await page.getByRole("button", { name: ko.transportApply, exact: true }).click();
    await page.keyboard.press("Escape");
    await tab(page, "Settings");
    await page.getByRole("button", { name: "입력 설정", exact: true }).click();
    await page.getByRole("button", { name: ko.microphoneStart, exact: true }).click();
    await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "입력 설정 닫기" }).click();
    await tab(page, "Loops");
    const track = page.locator('[data-track="01"]');
    await track.getByRole("combobox", { name: "1번 트랙 녹음 길이" }).click();
    await page.getByRole("option", { name: "1마디", exact: true }).click();
    await track.getByRole("button", { name: /RECORD 1 BAR/ }).click();
    await expect(track.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 18000 });
    const stopTiming = track.getByRole("combobox", { name: `1번 트랙 ${ko.playbackStopTiming}` });
    await expect(stopTiming).toBeEnabled(); await stopTiming.click();
    await page.getByRole("option", { name: ko.playbackTimings.bar, exact: true }).click();
    await track.getByRole("button", { name: "반복 정지", exact: true }).click();
    await expect(track.getByText(`${ko.playbackTimings.bar} · ${ko.playbackStopQueued}`, { exact: true })).toBeVisible();
    await expect(track.locator(".station-track-state")).toHaveText("PLAYING");
    await expect(stopTiming).toBeDisabled();
    await expect(track.getByRole("button", { name: "비우기", exact: true })).toBeDisabled();
    await track.getByRole("button", { name: ko.playbackCancelStop, exact: true }).click();
    await expect(stopTiming).toBeEnabled();
    await expect(track.locator(".station-track-state")).toHaveText("PLAYING");
    await stopTiming.click(); await page.getByRole("option", { name: ko.playbackTimings.immediate, exact: true }).click();
    await track.getByRole("button", { name: "반복 정지", exact: true }).click();
    await expect(track.locator(".station-track-state")).toHaveText("STOPPED");
    await expect(track.getByRole("button", { name: "반복 재생", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
});

import { expect, test, type Page } from "@playwright/test";

type AudioProbe = {
  contexts: AudioContext[];
  analysers: AnalyserNode[];
  readyMessages: number;
  microphoneRequests: number;
  holdClose: boolean;
  failClose: boolean;
  releaseClose: (() => void) | null;
};
declare global { interface Window { audioLifecycleProbe: AudioProbe } }

// Observe the production engine and PCM. Only failure/delay injection is synthetic.
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = {
      contexts: [], analysers: [], readyMessages: 0, microphoneRequests: 0,
      holdClose: false, failClose: false, releaseClose: null,
    };
    window.audioLifecycleProbe = probe;
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      override async close(): Promise<void> {
        if (probe.failClose) { probe.failClose = false; throw new Error("Injected close failure"); }
        if (probe.holdClose) {
          probe.holdClose = false;
          await new Promise<void>((resolve) => { probe.releaseClose = resolve; });
        }
        await super.close();
      }
    };
    const NativeNode = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends NativeNode {
      constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
        super(context, name, options);
        if (name !== "loop-station-test-tone") return;
        this.port.addEventListener("message", (event: MessageEvent<unknown>) => {
          const data = event.data;
          if (typeof data === "object" && data !== null && "type" in data && data.type === "worklet-ready") probe.readyMessages += 1;
        });
        const analyser = context.createAnalyser();
        const silent = context.createGain(); silent.gain.value = 0;
        this.connect(analyser, 0); analyser.connect(silent); silent.connect(context.destination);
        probe.analysers.push(analyser);
      }
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      probe.microphoneRequests += 1;
      return getUserMedia(constraints);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
}

async function tonePeak(page: Page) {
  return page.evaluate(() => {
    const analyser = window.audioLifecycleProbe.analysers.at(-1);
    if (!analyser) return 0;
    const pcm = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(pcm);
    return pcm.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
  });
}

test("production Worklet acknowledges processing, plays real PCM, and restarts without microphone access", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await observeAudio(page);
  expect(await page.evaluate(() => window.audioLifecycleProbe.contexts.length)).toBe(0);
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기" })).toBeVisible();
  expect(await page.evaluate(() => window.audioLifecycleProbe.readyMessages)).toBe(1);
  await page.getByRole("button", { name: "테스트 신호 켜기" }).click();
  await expect.poll(() => tonePeak(page)).toBeGreaterThan(0.03);
  await page.getByRole("button", { name: "테스트 신호 끄기" }).click();
  await expect.poll(() => tonePeak(page)).toBeLessThan(0.00001);
  await page.getByRole("button", { name: "오디오 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.audioLifecycleProbe.contexts.map((context) => context.state))).toEqual(["closed"]);
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기" })).toBeVisible();
  expect(await page.evaluate(() => ({ states: window.audioLifecycleProbe.contexts.map((context) => context.state), requests: window.audioLifecycleProbe.microphoneRequests })))
    .toEqual({ states: ["closed", "running"], requests: 0 });
  await page.getByRole("button", { name: "오디오 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("cancelling startup keeps ownership until close and ignores a late module failure after restart", async ({ page }) => {
  let releaseModule!: () => void;
  const moduleGate = new Promise<void>((resolve) => { releaseModule = resolve; });
  let moduleRequested!: () => void;
  const requested = new Promise<void>((resolve) => { moduleRequested = resolve; });
  await page.route("**/audio/test-tone-processor.js", async (route) => {
    moduleRequested(); await moduleGate; await route.abort("failed");
  }, { times: 1 });
  await observeAudio(page);
  await page.evaluate(() => { window.audioLifecycleProbe.holdClose = true; });
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await requested;
  await page.getByRole("button", { name: "시작 취소" }).click();
  await expect(page.getByRole("button", { name: "오디오 종료", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => typeof window.audioLifecycleProbe.releaseClose)).toBe("function");
  await page.evaluate(() => window.audioLifecycleProbe.releaseClose?.());
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기" })).toBeVisible();
  releaseModule();
  await expect.poll(() => page.evaluate(() => window.audioLifecycleProbe.contexts.map((context) => context.state))).toEqual(["closed", "running"]);
  await page.getByRole("button", { name: "테스트 신호 켜기" }).click();
  await expect.poll(() => tonePeak(page)).toBeGreaterThan(0.03);
  await page.getByRole("button", { name: "오디오 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
});

test("a failed Worklet load can be retried using the real production file", async ({ page }) => {
  await page.route("**/audio/test-tone-processor.js", (route) => route.abort("failed"), { times: 1 });
  await observeAudio(page);
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "AudioWorklet 파일을 불러오지 못했습니다" }).first()).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기" })).toBeVisible();
  expect(await page.evaluate(() => window.audioLifecycleProbe.contexts.map((context) => context.state))).toEqual(["closed", "running"]);
  await page.getByRole("button", { name: "오디오 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
});

test("a failed close offers teardown retry without creating another context", async ({ page }) => {
  await observeAudio(page);
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기" })).toBeVisible();
  await page.evaluate(() => { window.audioLifecycleProbe.failClose = true; });
  await page.getByRole("button", { name: "오디오 종료", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "오디오 종료 다시 시도", exact: true }).click();
  await expect(page.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.audioLifecycleProbe.contexts.map((context) => context.state))).toEqual(["closed"]);
});

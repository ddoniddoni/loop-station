import { expect, test, type Page } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

declare global { interface Window { countInPhases: string[] } }

// Real production Worklet with Chromium's synthetic microphone; no listening claim.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.setTimeout(60_000);

async function prepare(page: Page) {
  await page.addInitScript(() => {
    window.countInPhases = [];
    const NativeNode = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends NativeNode {
      constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
        super(context, name, options);
        this.port.addEventListener("message", (event: MessageEvent<unknown>) => {
          const data = event.data;
          if (typeof data === "object" && data !== null && "type" in data && data.type === "loop-status"
            && "trackId" in data && data.trackId === 0 && "phase" in data && typeof data.phase === "string") window.countInPhases.push(data.phase);
        });
      }
    };
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 녹음 후 자동 저장/ })).toBeVisible();
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  // A slower preparation bar gives both desktop and mobile assertions time to observe it.
  await page.getByRole("button", { name: "템포와 박자 설정" }).click();
  await page.getByRole("spinbutton", { name: ko.transportTempoLabel }).fill("60");
  await page.getByRole("button", { name: ko.transportApply, exact: true }).click();
  await expect(page.getByText("적용됨 · 60 BPM · 4/4", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  await page.getByRole("button", { name: "마이크 사용 허용", exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "입력 설정 닫기" }).click();
  const loops = page.getByRole("button", { name: "Loops", exact: true });
  if (await loops.isVisible()) await loops.click();
}

test("count-in defaults ON, locks during preparation, cancels cleanly, and can be disabled for the next recording", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: /메트로놈 설정/ }).click();
  await expect(page.getByRole("switch", { name: ko.countInEnabled })).toBeChecked();
  await expect(page.getByRole("switch", { name: ko.metronomeEnabled })).not.toBeChecked();
  await page.keyboard.press("Escape");
  const track = page.locator('[data-track="01"]');
  await track.getByRole("button", { name: /RECORD 4 BARS/ }).click();
  await expect(track.locator(".station-track-state")).toHaveText("COUNT IN", { timeout: 8000 });
  await expect(track.getByRole("status")).toContainText("아직 녹음하지 않습니다");
  await expect(page.locator('[data-track="02"]').getByRole("button", { name: /RECORD 4 BARS/ })).toBeDisabled();
  await page.getByRole("button", { name: /메트로놈 설정/ }).click();
  await expect(page.getByRole("switch", { name: ko.countInEnabled })).toBeDisabled();
  await page.keyboard.press("Escape");
  await track.getByRole("button", { name: /녹음 취소/ }).click();
  await expect(track.locator(".station-track-state")).toHaveText("EMPTY");
  await expect(track.getByRole("button", { name: /RECORD 4 BARS/ })).toBeEnabled();
  await page.getByRole("button", { name: /메트로놈 설정/ }).click();
  await page.getByRole("switch", { name: ko.countInEnabled }).uncheck();
  await page.keyboard.press("Escape");
  await page.evaluate(() => { window.countInPhases = []; });
  await track.getByRole("button", { name: /RECORD 4 BARS/ }).click();
  await expect(track.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 25000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  expect(await page.evaluate(() => window.countInPhases.includes("count-in"))).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: /메트로놈 설정/ }).click();
  await expect(page.getByRole("switch", { name: ko.countInEnabled })).toBeChecked();
});

test("ending audio during count-in leaves no recorded clip and releases the preparation lock", async ({ page }) => {
  await prepare(page);
  const track = page.locator('[data-track="01"]');
  await track.getByRole("button", { name: /RECORD 4 BARS/ }).click();
  await expect(track.locator(".station-track-state")).toHaveText("COUNT IN", { timeout: 8000 });
  await page.getByRole("button", { name: "모든 오디오 종료 (PANIC)" }).click();
  await expect(track.locator(".station-track-state")).toHaveText("EMPTY");
  await expect(track.getByRole("button", { name: "비우기", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 녹음 후 자동 저장/ })).toBeVisible();
  await page.getByRole("button", { name: /메트로놈 설정/ }).click();
  await expect(page.getByRole("switch", { name: ko.countInEnabled })).toBeEnabled();
});

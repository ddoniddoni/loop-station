import { expect, test, type Page } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

async function startAudio(page: Page) {
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: ko.audioStart, exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

async function openTempo(page: Page) {
  await page.getByRole("button", { name: "템포와 박자 설정" }).click();
}

async function tapAt(page: Page, timestamps: number[]) {
  const button = page.getByRole("button", { name: ko.tapTempoButton, exact: true });
  await expect(button).toBeEnabled();
  // Control only UI input timestamps. The production AudioWorklet and clock run unchanged.
  await button.evaluate((element, times) => {
    for (const timestamp of times) {
      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "timeStamp", { value: timestamp });
      element.dispatchEvent(event);
    }
  }, timestamps);
}

test("Tap proposes BPM without applying it, and uses quarter notes in 6/8", async ({ page }) => {
  await page.goto("/");
  await openTempo(page);
  await expect(page.getByRole("button", { name: ko.tapTempoButton })).toBeDisabled();
  await page.keyboard.press("Escape");
  await startAudio(page);
  await openTempo(page);
  await tapAt(page, [1000, 1625, 2250]);
  await expect(page.getByRole("spinbutton", { name: ko.transportTempoLabel })).toHaveValue("96");
  await expect(page.locator("#tap-tempo-status")).toHaveText("제안 · 96 BPM · 최근 2개 간격 · 설정 적용 전");
  await expect(page.getByText("적용됨 · 120 BPM · 4/4", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: ko.transportMeter }).click();
  await page.getByRole("option", { name: "6/8", exact: true }).click();
  await page.getByRole("button", { name: ko.transportApply, exact: true }).click();
  await expect(page.getByText("적용됨 · 96 BPM · 6/8", { exact: true })).toBeVisible();
  await tapAt(page, [3000, 3625]);
  await expect(page.getByRole("spinbutton", { name: ko.transportTempoLabel })).toHaveValue("96");
  await expect(page.locator("#tap-tempo-status")).toContainText("최근 1개 간격");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "템포와 박자 설정" })).toContainText("96.0");
  await page.getByRole("button", { name: ko.transportPlay, exact: true }).click();
  await expect(page.getByRole("button", { name: ko.transportStop, exact: true })).toBeEnabled();
  await openTempo(page);
  await expect(page.getByRole("spinbutton", { name: ko.transportTempoLabel })).toHaveValue("96");
  await expect(page.getByRole("combobox", { name: ko.transportMeter })).toHaveText("6/8");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("manual entry, long pauses, reopening and audio shutdown reset the tap sequence", async ({ page }) => {
  await page.goto("/"); await startAudio(page); await openTempo(page);
  const bpm = page.getByRole("spinbutton", { name: ko.transportTempoLabel });
  await tapAt(page, [1000, 1600, 1650]);
  await expect(bpm).toHaveValue("100");
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoTooFast);
  await tapAt(page, [4000]);
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoRestarted);
  await tapAt(page, [4750]);
  await expect(bpm).toHaveValue("80");
  await bpm.fill("88");
  await tapAt(page, [5000]);
  await expect(bpm).toHaveValue("88");
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoWaiting);
  await page.keyboard.press("Escape"); await openTempo(page);
  await expect(bpm).toHaveValue("120");
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoIdle);
  await tapAt(page, [6000]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "모든 오디오 종료 (PANIC)" }).click();
  await openTempo(page);
  await expect(page.getByRole("button", { name: ko.tapTempoButton })).toBeDisabled();
  await page.keyboard.press("Escape"); await startAudio(page); await openTempo(page);
  await tapAt(page, [6500]);
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoWaiting);
});

test("recording and cleared-loop recovery keep Tap and tempo settings locked", async ({ page }) => {
  await page.goto("/"); await startAudio(page); await openTempo(page);
  await page.getByRole("spinbutton", { name: ko.transportTempoLabel }).fill("240");
  await page.getByRole("button", { name: ko.transportApply, exact: true }).click();
  await expect(page.getByText("적용됨 · 240 BPM · 4/4", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  await page.getByRole("button", { name: "마이크 사용 허용", exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "입력 설정 닫기" }).click();
  const loops = page.getByRole("button", { name: "Loops", exact: true });
  if (await loops.isVisible()) await loops.click();
  const track = page.locator('[data-track="01"]');
  await track.getByRole("button", { name: /RECORD 4 BARS/ }).click();
  await openTempo(page);
  await expect(page.getByRole("button", { name: ko.tapTempoButton })).toBeDisabled();
  await expect(page.getByRole("button", { name: ko.transportApply, exact: true })).toBeDisabled();
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.transportSettingsLocked);
  await page.keyboard.press("Escape");
  await expect(track.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 10_000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  await track.getByRole("button", { name: "비우기", exact: true }).click();
  await expect(track.getByRole("button", { name: "1번 트랙 비운 루프 복구", exact: true })).toBeEnabled();
  await openTempo(page);
  await expect(page.getByRole("button", { name: ko.tapTempoButton })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: ko.transportTempoLabel })).toBeDisabled();
  await expect(page.getByText("적용됨 · 240 BPM · 4/4", { exact: true })).toBeVisible();
});

test("keyboard auto-repeat cannot add extra taps or submit the form", async ({ page }) => {
  await page.goto("/"); await startAudio(page); await openTempo(page);
  await page.getByRole("button", { name: ko.tapTempoButton }).focus();
  await page.keyboard.down("Enter");
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoWaiting);
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.locator("#tap-tempo-status")).toHaveText(ko.tapTempoWaiting);
  await expect(page.getByText("적용됨 · 120 BPM · 4/4", { exact: true })).toBeVisible();
});

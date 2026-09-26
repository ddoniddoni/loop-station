import { expect, test, type Page } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

async function enableKeyboard(page: Page) {
  await page.getByRole("button", { name: "키보드 연주 꺼짐", exact: true }).click();
  await expect(page.getByRole("region", { name: "키보드 연주 영역" })).toBeFocused();
}
async function performanceFocus(page: Page) { await page.getByRole("region", { name: "키보드 연주 영역" }).focus(); }
async function startAudio(page: Page) {
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: ko.audioStart, exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}
async function microphone(page: Page) {
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  await page.getByRole("button", { name: "마이크 사용 허용", exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "입력 설정 닫기" }).click();
}

test("opt-in track shortcuts select the visible mobile bank without starting audio; reload disables them", async ({ page }) => {
  await page.goto("/");
  await performanceFocus(page); await page.keyboard.press("8");
  await expect(page.locator('[data-track="01"]')).toHaveAttribute("data-selected", "true");
  await enableKeyboard(page); await page.keyboard.press("8");
  await expect(page.locator('[data-track="08"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-track="08"]')).toBeVisible();
  await expect(page.locator("#tracks")).toHaveAttribute("data-bank", "1");
  await page.keyboard.press("r");
  await expect(page.locator(".station-keyboard-status")).toContainText("AUDIO");
  await expect(page.getByRole("button", { name: "오디오 연결 설정" })).toHaveAttribute("data-ready", "false");
  await page.getByRole("button", { name: "키보드 연주 켜짐", exact: true }).click();
  await performanceFocus(page); await page.keyboard.press("1");
  await expect(page.locator('[data-track="08"]')).toHaveAttribute("data-selected", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "키보드 연주 꺼짐", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("Space uses the real transport, repeats do not toggle again, and focused buttons keep native Space", async ({ page }) => {
  await page.goto("/"); await startAudio(page); await enableKeyboard(page);
  await page.keyboard.down("Space");
  await expect(page.getByRole("button", { name: ko.transportStop, exact: true })).toBeEnabled();
  await page.keyboard.down("Space"); await page.keyboard.up("Space");
  await expect(page.getByRole("button", { name: ko.transportStop, exact: true })).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: ko.transportPlay, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: ko.transportPlay, exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: ko.transportStop, exact: true })).toBeEnabled();
});

test("settings, text editing, composition, and browser combinations do not trigger performance commands", async ({ page }) => {
  await page.goto("/"); await startAudio(page); await enableKeyboard(page);
  await page.getByRole("button", { name: "템포와 박자 설정" }).click();
  const bpm = page.getByRole("spinbutton", { name: ko.transportTempoLabel });
  await bpm.fill("128");
  await page.keyboard.press("7"); await page.keyboard.press("r");
  await expect(page.locator('[data-track="01"]')).toHaveAttribute("data-selected", "true");
  await page.keyboard.press("Escape");
  await expect(bpm).toBeHidden();
  await performanceFocus(page);
  await page.getByRole("region", { name: "키보드 연주 영역" }).dispatchEvent("compositionstart");
  await page.keyboard.press("8"); await page.keyboard.press("Space");
  await expect(page.locator('[data-track="01"]')).toHaveAttribute("data-selected", "true");
  await expect(page.getByRole("button", { name: ko.transportPlay, exact: true })).toBeEnabled();
  await page.getByRole("region", { name: "키보드 연주 영역" }).dispatchEvent("compositionend");
  await page.keyboard.press("Shift+R"); await page.keyboard.press("Alt+R");
  await page.keyboard.press("8");
  await expect(page.locator('[data-track="08"]')).toHaveAttribute("data-selected", "true");
});

test("R records only the selected track, locks other captures, cancels with Esc, then overdubs and undoes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/"); await startAudio(page); await microphone(page); await enableKeyboard(page);
  await page.keyboard.press("2");
  const first = page.locator('[data-track="01"]');
  const second = page.locator('[data-track="02"]');
  await second.getByRole("combobox", { name: "2번 트랙 녹음 길이" }).click();
  await page.getByRole("option", { name: "8마디", exact: true }).click();
  await performanceFocus(page); await page.keyboard.down("r"); await page.keyboard.down("r"); await page.keyboard.up("r");
  await expect(second.locator(".station-track-state")).toHaveText(/PREPARING|ARMED|RECORDING/);
  await page.getByRole("button", { name: "템포와 박자 설정" }).click();
  await page.keyboard.press("Escape");
  await expect(second.locator(".station-track-state")).toHaveText(/ARMED|RECORDING/);
  await performanceFocus(page);
  await page.keyboard.press("1"); await page.keyboard.press("r");
  await expect(first.locator(".station-track-state")).toHaveText("EMPTY");
  await page.keyboard.press("2"); await page.keyboard.press("Escape");
  await expect(second.locator(".station-track-state")).toHaveText("EMPTY");
  await second.getByRole("combobox", { name: "2번 트랙 녹음 길이" }).click();
  await page.getByRole("option", { name: "1마디", exact: true }).click();
  await performanceFocus(page); await page.keyboard.press("r");
  await expect(second.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 8000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  await page.keyboard.press("r");
  await expect(second.locator(".station-track-state")).toHaveText("OVERDUB", { timeout: 6000 });
  await expect(second.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 6000 });
  await expect(second.getByRole("button", { name: "2번 트랙 오버더빙 되돌리기" })).toBeEnabled();
  await page.keyboard.press("s"); await expect(second.locator(".station-track-state")).toHaveText("STOPPED");
  await page.keyboard.press("Control+z");
  await expect(second.getByRole("button", { name: "2번 트랙 오버더빙 다시 적용" })).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");
  await expect(second.getByRole("button", { name: "2번 트랙 오버더빙 되돌리기" })).toBeEnabled();
  await page.keyboard.press("r");
  await expect(second.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 6000 });
  await expect(first.locator(".station-track-state")).toHaveText("EMPTY");
});

test("editable and custom control focus preserve native Undo and character keys", async ({ page }) => {
  await page.goto("/"); await enableKeyboard(page);
  const prevented = await page.evaluate(() => {
    const root = document.querySelector('.station-keyboard')!;
    const targets = [document.createElement("textarea"), document.createElement("div"), document.createElement("div")];
    targets[1].contentEditable = "true";
    targets[2].setAttribute("role", "slider"); targets[2].tabIndex = 0;
    const results: boolean[] = [];
    for (const target of targets) {
      root.append(target); target.focus();
      for (const init of [{ key: "8" }, { key: "z", ctrlKey: true }, { key: "z", metaKey: true }, { key: "r", isComposing: true }]) {
        const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
        target.dispatchEvent(event); results.push(event.defaultPrevented);
      }
      target.remove();
    }
    return results;
  });
  expect(prevented).toEqual(Array(12).fill(false));
  await expect(page.locator('[data-track="01"]')).toHaveAttribute("data-selected", "true");
});

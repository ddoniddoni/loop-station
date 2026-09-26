import { expect, test, type Page } from "@playwright/test";
import { ko } from "../../src/lib/i18n/ko";

// Real production UI/Worklet and synthetic Chromium microphone. Processing reports
// and failures are injected: these scenarios do not measure physical audio effects.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

type ProcessingProbe = {
  requests: number;
  applications: number;
  mode: "reject" | "mismatch" | "unknown" | "pending";
  settle: (() => void) | null;
};
declare global { interface Window { processingProbe: ProcessingProbe } }

async function prepare(page: Page) {
  await page.addInitScript(() => {
    const probe: ProcessingProbe = { requests: 0, applications: 0, mode: "reject", settle: null };
    window.processingProbe = probe;
    const media = navigator.mediaDevices;
    const request = media.getUserMedia.bind(media);
    media.getSupportedConstraints = () => ({ echoCancellation: true, noiseSuppression: true });
    media.getUserMedia = async (constraints) => {
      probe.requests += 1;
      const stream = await request(constraints);
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings.bind(track);
      let unknown = false;
      track.getCapabilities = () => ({ echoCancellation: [false, true], noiseSuppression: [false] });
      track.getSettings = () => ({ ...settings(), echoCancellation: unknown ? undefined : false, noiseSuppression: false, autoGainControl: undefined });
      track.applyConstraints = async () => {
        probe.applications += 1;
        if (probe.mode === "reject") throw new DOMException("Injected rejection", "OverconstrainedError");
        if (probe.mode === "pending") await new Promise<void>((resolve) => { probe.settle = resolve; });
        unknown = probe.mode === "unknown";
      };
      return stream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart })).toBeVisible();
  await page.keyboard.press("Escape");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if (await settings.isVisible()) await settings.click();
  await page.getByRole("button", { name: "입력 설정", exact: true }).click();
  await expect(page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.processingProbe.requests)).toBe(0);
  await page.getByRole("button", { name: ko.microphoneStart, exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
}

async function selectEcho(page: Page, enabled: boolean) {
  await page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true }).click();
  await page.getByRole("option", { name: enabled ? ko.microphoneSettingOn : ko.microphoneSettingOff, exact: true }).click();
}

test("shows unavailable choices, rejection, mismatch and unreported settings without claiming success", async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole("combobox", { name: ko.microphoneNoiseSuppression, exact: true })).toBeDisabled();
  await expect(page.getByText(ko.inputProcessingSupport["fixed-off"], { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: ko.microphoneAutoGainControl, exact: true })).toBeDisabled();
  await expect(page.getByText(ko.inputProcessingSupport.unsupported, { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: ko.inputMonitor, exact: true }).click();
  await selectEcho(page, true);
  await expect(page.getByRole("alert").filter({ hasText: ko.inputProcessingRejected })).toBeVisible();
  await expect(page.getByRole("switch", { name: ko.inputMonitor, exact: true })).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true })).toHaveText(ko.microphoneSettingOff);
  await page.evaluate(() => { window.processingProbe.mode = "mismatch"; });
  await selectEcho(page, true);
  const result = page.getByRole("status", { name: `${ko.microphoneEchoCancellation} ${ko.inputProcessingResult}` });
  await expect(result).toContainText(`${ko.inputProcessingRequested}: ${ko.microphoneSettingOn}`);
  await expect(result).toContainText(`${ko.inputProcessingReported}: ${ko.microphoneSettingOff}`);
  await expect(result).toContainText(ko.inputProcessingMismatch);
  await page.getByRole("button", { name: `${ko.microphoneEchoCancellation} ${ko.inputProcessingReapply}`, exact: true }).click();
  await expect(page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true })).toBeEnabled();
  await page.evaluate(() => { window.processingProbe.mode = "unknown"; });
  await selectEcho(page, false);
  await expect(result).toContainText(`${ko.inputProcessingReported}: ${ko.microphoneSettingUnknown}`);
  expect(await page.evaluate(() => window.processingProbe.requests)).toBe(1);
  expect(await page.evaluate(() => window.processingProbe.applications)).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("locks controls while applying and ignores completion after microphone release and reconnect", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => { window.processingProbe.mode = "pending"; });
  await selectEcho(page, true);
  await expect(page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true })).toBeDisabled();
  await expect(page.getByRole("switch", { name: ko.inputMonitor, exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: ko.microphoneDevice, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: ko.microphoneRelease, exact: true }).click();
  await page.getByRole("button", { name: ko.microphoneStart, exact: true }).click();
  await expect(page.getByText(ko.microphoneActive, { exact: true })).toBeVisible();
  await page.evaluate(() => window.processingProbe.settle?.());
  await expect(page.getByRole("combobox", { name: ko.microphoneEchoCancellation, exact: true })).toHaveText(ko.microphoneSettingOff);
  await expect(page.getByRole("switch", { name: ko.inputMonitor, exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => window.processingProbe.requests)).toBe(2);
});

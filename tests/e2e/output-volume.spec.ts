import { expect, test } from "@playwright/test";

test("whole-output gain and mute remain controllable before audio and across restart", async ({ page }) => {
  await page.goto("/");
  const volume = page.getByRole("slider", { name: "전체 출력 볼륨", exact: true });
  await expect(volume).toHaveAttribute("aria-valuenow", "200");
  await volume.focus(); await page.keyboard.press("End");
  await expect(volume).toHaveAttribute("aria-valuenow", "400");
  await page.getByRole("button", { name: "전체 음소거", exact: true }).click();
  await expect(page.getByRole("button", { name: "전체 음소거 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "오디오 연결 설정", exact: true }).click();
  await page.locator(".station-audio-popover").getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "모든 오디오 종료 (PANIC)", exact: true }).click();
  await expect(volume).toHaveAttribute("aria-valuenow", "400");
  await page.getByRole("button", { name: "오디오 연결 설정", exact: true }).click();
  await page.locator(".station-audio-popover").getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "테스트 신호 켜기", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "전체 음소거 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "기본 200%", exact: true }).click();
  await expect(volume).toHaveAttribute("aria-valuenow", "200");
  await expect(page.getByRole("button", { name: "전체 음소거", exact: true })).toHaveAttribute("aria-pressed", "false");
});

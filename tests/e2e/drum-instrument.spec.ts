import { expect, test, type Page } from "@playwright/test";
import type { SavedStationSession } from "../../src/audio/storage/station-session";

test.setTimeout(45_000);
async function openInstrument(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      document.documentElement.dataset.micRequested = "true";
      throw new Error("Drum-only flow must not request microphone access");
    } });
  });
  await page.goto("/");
  const tab = page.getByRole("button", { name: "악기", exact: true });
  if (await tab.isVisible()) await tab.click();
  const panel = page.getByRole("complementary", { name: "내장 드럼" });
  await panel.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await panel.getByRole("button", { name: "드럼 준비", exact: true }).click();
  return panel;
}
async function fingerprint(page: Page) {
  return page.evaluate(async () => {
    const saved = await new Promise<SavedStationSession>((resolve, reject) => {
      const open = indexedDB.open("loop-station-local", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result; const tx = db.transaction("sessions", "readonly");
        const request = tx.objectStore("sessions").get("track-01-session");
        tx.oncomplete = () => { db.close(); resolve(request.result as SavedStationSession); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    const take = saved.history.tracks[0].current;
    if (!take) throw new Error("Missing drum loop");
    const pcm = new Float32Array(take.pcm).subarray(0, take.metadata.frames);
    return { hash: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", take.pcm))), frames: take.metadata.frames,
      ticks: take.metadata.ticks, nonzero: pcm.some((value) => Math.abs(value) > 0.001), finite: pcm.every(Number.isFinite) };
  });
}

test("bundled drums record real nonzero PCM without microphone access and restore after reload", async ({ page }) => {
  const panel = await openInstrument(page);
  const kick = panel.getByRole("button", { name: "킥 연주", exact: true });
  await expect(kick).toBeEnabled();
  await panel.getByRole("combobox", { name: "드럼 녹음 길이" }).click();
  await page.getByRole("option", { name: "1마디", exact: true }).click();
  await panel.getByRole("button", { name: "드럼 1마디 녹음", exact: true }).click();
  await expect(panel.getByRole("button", { name: "마이크", exact: true })).toBeDisabled();
  await expect(panel.getByText("패드 연주를 녹음 중입니다. 끝나면 자동 반복합니다.", { exact: true })).toBeVisible();
  await kick.click();
  await kick.press("s");
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible({ timeout: 12_000 });
  const before = await fingerprint(page);
  expect(before).toMatchObject({ ticks: 3840, nonzero: true, finite: true });
  expect(await page.locator("html").getAttribute("data-mic-requested")).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  expect(await fingerprint(page)).toEqual(before);
  await expect(page.locator('[data-track="01"]').getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
});

test("failed sample loading disables all pads and supports retry, switching and PANIC", async ({ page }) => {
  await page.route("**/audio/drums/**/*.wav", (route) => route.abort());
  const panel = await openInstrument(page);
  await expect(panel.getByRole("button", { name: "음원 다시 불러오기", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "킥 연주", exact: true })).toBeDisabled();
  await page.unroute("**/audio/drums/**/*.wav");
  await panel.getByRole("button", { name: "음원 다시 불러오기", exact: true }).click();
  await expect(panel.getByRole("button", { name: "킥 연주", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "마이크", exact: true }).click();
  await expect(panel.getByRole("button", { name: "킥 연주", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "내장 드럼", exact: true }).click();
  await panel.getByRole("button", { name: "열린 하이햇 연주", exact: true }).click();
  await page.getByRole("button", { name: "모든 오디오 종료 (PANIC)", exact: true }).click();
  await expect(panel.getByRole("button", { name: "킥 연주", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "오디오 시작", exact: true })).toBeEnabled();
  expect(await page.locator("html").getAttribute("data-mic-requested")).toBeNull();
});

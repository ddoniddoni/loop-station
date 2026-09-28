import { expect, test, type Page } from "@playwright/test";
import type { SavedStationSession } from "../../src/audio/storage/station-session";

test.setTimeout(45_000);
async function openPiano(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      document.documentElement.dataset.micRequested = "true";
      throw new Error("Piano must not request microphone access");
    } });
  });
  await page.goto("/");
  const tab = page.getByRole("button", { name: "악기", exact: true });
  if (await tab.isVisible()) await tab.click();
  const panel = page.getByRole("complementary", { name: "내장 악기" });
  await panel.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await panel.getByRole("button", { name: "피아노", exact: true }).click();
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
    if (!take) throw new Error("Missing piano loop");
    const pcm = new Float32Array(take.pcm).subarray(0, take.metadata.frames);
    return { hash: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", take.pcm))), frames: take.metadata.frames,
      ticks: take.metadata.ticks, nonzero: pcm.some((value) => Math.abs(value) > 0.001), finite: pcm.every(Number.isFinite) };
  });
}


test("piano chords record real PCM without a microphone and survive reload", async ({ page }) => {
  const panel = await openPiano(page);
  const c = panel.getByRole("button", { name: "도 C4 연주", exact: true });
  await expect(c).toBeEnabled();
  await panel.getByRole("combobox", { name: "피아노 녹음 길이" }).click();
  await page.getByRole("option", { name: "1마디", exact: true }).click();
  await panel.getByRole("button", { name: "피아노 1마디 녹음", exact: true }).click();
  await expect(panel.getByRole("button", { name: "피아노 한 옥타브 낮추기" })).toBeDisabled();
  await expect(panel.getByText("악기 연주를 녹음 중입니다. 끝나면 자동 반복합니다.", { exact: true })).toBeVisible();
  await c.focus(); await page.keyboard.down("a"); await page.keyboard.down("d"); await page.keyboard.down("g");
  await expect(panel.locator('[data-held="true"]')).toHaveCount(3);
  await page.waitForTimeout(350);
  await page.keyboard.up("a"); await page.keyboard.up("d"); await page.keyboard.up("g");
  await expect(panel.locator('[data-held="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible({ timeout: 12_000 });
  const before = await fingerprint(page);
  expect(before).toMatchObject({ ticks: 3840, nonzero: true, finite: true });
  expect(await page.locator("html").getAttribute("data-mic-requested")).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  expect(await fingerprint(page)).toEqual(before);
});

test("piano loading retries, octave changes and focus/PANIC release held notes", async ({ page }) => {
  await page.route("**/audio/piano/**/*.wav", (route) => route.abort());
  const panel = await openPiano(page);
  await expect(panel.getByRole("button", { name: "피아노 음원 다시 불러오기", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "도 C4 연주", exact: true })).toBeDisabled();
  await page.unroute("**/audio/piano/**/*.wav");
  await panel.getByRole("button", { name: "피아노 음원 다시 불러오기", exact: true }).click();
  const c = panel.getByRole("button", { name: "도 C4 연주", exact: true }); await expect(c).toBeEnabled();
  await panel.getByRole("button", { name: "서스테인 OFF", exact: true }).click();
  await c.focus(); await page.keyboard.down("a");
  await panel.getByRole("button", { name: "피아노 한 옥타브 낮추기" }).click(); await page.keyboard.up("a");
  await expect(panel.getByRole("button", { name: "도 C3 연주", exact: true })).toBeEnabled();
  await expect(panel.getByRole("button", { name: "서스테인 OFF", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "도 C3 연주", exact: true }).focus(); await page.keyboard.down("a");
  await panel.getByRole("combobox", { name: "녹음할 트랙", exact: true }).focus();
  await expect(panel.locator('[data-held="true"]')).toHaveCount(0); await page.keyboard.up("a");
  await page.getByRole("button", { name: "모든 오디오 종료 (PANIC)", exact: true }).click();
  await expect(panel.getByRole("button", { name: "오디오 시작", exact: true })).toBeEnabled();
  expect(await page.locator("html").getAttribute("data-mic-requested")).toBeNull();
});

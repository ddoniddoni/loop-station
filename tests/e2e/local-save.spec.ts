import { expect, test, type Page } from "@playwright/test";
import type { SavedStationSession } from "../../src/audio/storage/station-session";
import { ko } from "../../src/lib/i18n/ko";

// Synthetic Chromium microphone input; this does not verify physical devices or listening.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.setTimeout(60_000);

async function recordLoop(page: Page, bars = 4) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 녹음 후 자동 저장/ })).toBeVisible();
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: "오디오 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible();
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
  if (bars !== 4) {
    await track.getByRole("combobox", { name: "1번 트랙 녹음 길이" }).click();
    await page.getByRole("option", { name: `${bars}마디`, exact: true }).click();
  }
  await track.getByRole("button", { name: new RegExp(`RECORD ${bars} BAR`) }).click();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible({ timeout: 20_000 });
}

async function storedFingerprint(page: Page, trackId = 0) {
  return page.evaluate(async (index) => {
    const saved = await new Promise<SavedStationSession>((resolve, reject) => {
      const open = indexedDB.open("loop-station-local", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("sessions", "readonly");
        const read = tx.objectStore("sessions").get("track-01-session");
        tx.oncomplete = () => { db.close(); resolve(read.result as SavedStationSession); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    const take = saved.history.tracks[index].current;
    if (!take) throw new Error("No stored current take");
    const hash = await crypto.subtle.digest("SHA-256", take.pcm);
    return { revision: saved.revision, metadata: take.metadata, hash: Array.from(new Uint8Array(hash)) };
  }, trackId);
}

test("recorded PCM restores after reload without automatically starting audio", async ({ page }) => {
  await recordLoop(page);
  const before = await storedFingerprint(page);
  await page.reload();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
  expect(await storedFingerprint(page)).toEqual(before);
});

test("different recording lengths survive overdub, clear recovery and reload", async ({ page }) => {
  await recordLoop(page, 1);
  const first = page.locator('[data-track="01"]');
  const second = page.locator('[data-track="02"]');
  const length = first.getByRole("combobox", { name: "1번 트랙 녹음 길이" });
  await expect(length).toBeDisabled();
  const original = await storedFingerprint(page);
  expect(original.metadata.ticks).toBe(3840);
  expect(original.metadata.frames).toBe(original.metadata.sampleRate * 2);
  await second.getByRole("combobox", { name: "2번 트랙 녹음 길이" }).click();
  await page.getByRole("option", { name: "8마디", exact: true }).click();
  await second.getByRole("button", { name: /RECORD 8 BARS/ }).click();
  await expect(page.getByRole("combobox", { name: "3번 트랙 녹음 길이" })).toBeDisabled();
  await expect(first.getByRole("button", { name: "반복 정지", exact: true })).toBeEnabled();
  await expect(second.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 22_000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  expect((await storedFingerprint(page, 1)).metadata.ticks).toBe(8 * 3840);
  await first.getByRole("button", { name: "오버더빙 · 1회", exact: true }).click();
  await expect(first.locator(".station-track-state")).toHaveText("OVERDUB", { timeout: 6000 });
  await expect(first.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 6000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  const mixed = await storedFingerprint(page);
  expect(mixed.metadata).toEqual(original.metadata);
  await first.getByRole("button", { name: "비우기", exact: true }).click();
  await expect(length).toBeEnabled();
  await length.click();
  await page.getByRole("option", { name: "2마디", exact: true }).click();
  await expect(first.getByRole("button", { name: /RECORD 2 BARS/ })).toBeEnabled();
  await first.getByRole("button", { name: "1번 트랙 비운 루프 복구", exact: true }).click();
  await expect(length).toHaveText("1마디");
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  expect((await storedFingerprint(page)).hash).toEqual(mixed.hash);
  await page.reload();
  await expect(length).toHaveText("1마디");
  await expect(second.getByRole("combobox", { name: "2번 트랙 녹음 길이" })).toHaveText("8마디");
  await expect(first.getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
  expect((await storedFingerprint(page)).hash).toEqual(mixed.hash);
});

test("failure after the PCM write rolls back the whole transaction and preserves the previous saved loop", async ({ page }) => {
  await recordLoop(page);
  const before = await storedFingerprint(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "heads") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Synthetic storage failure", "QuotaExceededError");
      }
      return original.call(this, value, key);
    };
  });
  await page.locator('[data-track="01"]').getByRole("button", { name: "비우기", exact: true }).click();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 저장 실패/ })).toBeVisible();
  expect(await storedFingerprint(page)).toEqual(before);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
  expect(await storedFingerprint(page)).toEqual(before);
});

test("another track records while the first loops and both PCM takes survive reload", async ({ page }) => {
  await recordLoop(page);
  const first = page.locator('[data-track="01"]');
  const second = page.locator('[data-track="02"]');
  await second.getByRole("button", { name: /RECORD 4 BARS/ }).click();
  await expect(first.getByRole("button", { name: "반복 정지", exact: true })).toBeEnabled();
  await expect(page.locator('[data-track="03"]').getByRole("button", { name: /RECORD 4 BARS/ })).toBeDisabled();
  await expect(second.locator(".station-track-state")).toHaveText("PLAYING", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  const before = await Promise.all([storedFingerprint(page, 0), storedFingerprint(page, 1)]);
  await page.reload();
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  await expect(first.getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
  await expect(second.getByRole("button", { name: "반복 재생", exact: true })).toBeDisabled();
  expect(await Promise.all([storedFingerprint(page, 0), storedFingerprint(page, 1)])).toEqual(before);
});

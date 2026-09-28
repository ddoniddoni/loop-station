import { expect, test, type Page } from "@playwright/test";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { createStationSession, emptyStationHistory, type SavedStationSession } from "../../src/audio/storage/station-session";

async function seed(page: Page) {
  const tracks = emptyStationHistory();
  const samples = new Float32Array(8001); samples.set([-1, -0.5, 0, 0.5, 1]); samples[8000] = 0.75;
  const take = { pcm: samples.buffer, metadata: { bpm: 240, numerator: 4, denominator: 4, sampleRate: 8000, frames: 8000, ticks: 3840, complete: true } };
  tracks[0] = { current: take, undo: take, redo: null, cleared: null };
  const mixer = defaultStationMix().map((track, index) => index === 0 ? { ...track, gainDb: -60, mute: true } : track);
  const saved = await createStationSession({ tracks, mixer, master: defaultMasterMix() });
  const serialized = JSON.stringify(saved, (_key, value: unknown) => value instanceof ArrayBuffer ? { pcm: Array.from(new Uint8Array(value)) } : value);
  await page.goto("/projects"); await expect(page.getByRole("button", { name: "새 프로젝트", exact: true })).toBeEnabled();
  await page.evaluate(async (serialized) => {
    const session = JSON.parse(serialized, (_key, value: unknown) => {
      if (typeof value === "object" && value !== null && "pcm" in value && Array.isArray(value.pcm)) return new Uint8Array(value.pcm).buffer;
      return value;
    }) as SavedStationSession;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("loop-station-local", 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["heads", "sessions"], "readwrite");
      tx.objectStore("heads").put(session.revision, "track-01-session"); tx.objectStore("sessions").put(session, "track-01-session");
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); };
    });
    sessionStorage.setItem("loop-station-active-project", "track-01-session");
  }, serialized);
  await page.goto("/"); await expect(page.getByRole("button", { name: "선택 트랙 WAV 내보내기" })).toBeEnabled();
  return serialized;
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("loop-station-local", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const tx = db.transaction("sessions", "readonly"); const request = tx.objectStore("sessions").get("track-01-session");
        tx.oncomplete = () => resolve(JSON.stringify(request.result, (_key, value: unknown) => value instanceof ArrayBuffer ? { pcm: Array.from(new Uint8Array(value)) } : value));
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}
test("downloads the dry original at its source rate without audio startup or stored PCM changes", async ({ page }) => {
  const before = await seed(page);
  await page.getByRole("button", { name: "선택 트랙 WAV 내보내기" }).click();
  await page.getByRole("button", { name: "WAV 파일 준비", exact: true }).click();
  await expect(page.getByRole("link", { name: "WAV 다운로드" })).toBeVisible();
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("link", { name: "WAV 다운로드" }).click();
  const download = await downloadEvent; expect(download.suggestedFilename()).toMatch(/track-01-8000Hz-24bit.wav$/);
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF"); expect(bytes.readUInt32LE(24)).toBe(8000);
  expect(bytes.readUInt16LE(34)).toBe(24); expect(bytes.readUInt32LE(64)).toBe(24000);
  expect(bytes.length).toBe(24068); expect(bytes.readIntLE(68, 3)).toBe(-8388608); expect(bytes.readIntLE(77, 3)).toBe(4194304);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  expect(await stored(page)).toBe(before);
  await page.reload(); await expect(page.getByRole("button", { name: "선택 트랙 WAV 내보내기" })).toBeEnabled();
});
test("a worker error unlocks editing and closing revokes prepared file URLs", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker { constructor(url: string | URL, options?: WorkerOptions) { super(url, options); this.terminate(); queueMicrotask(() => this.dispatchEvent(new ErrorEvent("error", { message: "Synthetic worker failure" }))); } };
  });
  await page.getByRole("button", { name: "선택 트랙 WAV 내보내기" }).click(); await page.getByRole("button", { name: "WAV 파일 준비", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("WAV 작업을 시작하지 못했습니다");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("button", { name: "선택 트랙 WAV 내보내기" })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "선택 트랙 WAV 내보내기" }).click(); await page.getByRole("button", { name: "WAV 파일 준비", exact: true }).click();
  const link = page.getByRole("link", { name: "WAV 다운로드" }); await expect(link).toBeVisible();
  const url = await link.getAttribute("href"); await page.getByRole("button", { name: "닫기", exact: true }).click();
  expect(await page.evaluate(async (url) => { try { await fetch(url!); return false; } catch { return true; } }, url)).toBe(true);
});

import { expect, test, type Page } from "@playwright/test";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { digest, historyChecksum } from "../../src/audio/storage/loop-session";
import { emptyStationHistory } from "../../src/audio/storage/station-session";

async function createProject(page: Page, name: string, bpm = 120) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "새 프로젝트", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("프로젝트 이름", { exact: true }).fill(name);
  await dialog.getByLabel("BPM", { exact: true }).fill(String(bpm));
  await dialog.getByRole("button", { name: "만들고 스튜디오 열기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".station-project-name")).toHaveText(name);
}

async function storedKeys(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("loop-station-local", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ heads: IDBValidKey[]; sessions: IDBValidKey[] }>((resolve, reject) => {
        const tx = db.transaction(["heads", "sessions"], "readonly");
        const heads = tx.objectStore("heads").getAllKeys();
        const sessions = tx.objectStore("sessions").getAllKeys();
        tx.oncomplete = () => resolve({ heads: heads.result, sessions: sessions.result });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

test("creates two projects, renames one, and restores selection and empty-project tempo", async ({ page }) => {
  await createProject(page, "첫 연습", 90);
  await createProject(page, "둘째 연습", 140);
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const first = page.getByRole("article", { name: "첫 연습", exact: true });
  await first.getByRole("button", { name: "첫 연습 이름 변경" }).click();
  await page.getByRole("dialog").getByLabel("프로젝트 이름").fill("첫 곡");
  await page.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("article", { name: "첫 곡", exact: true }).getByRole("button", { name: "프로젝트 열기", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".station-project-name")).toHaveText("첫 곡");
  await page.reload();
  await expect(page.locator(".station-project-name")).toHaveText("첫 곡");
  await expect(page.getByRole("button", { name: "마이크 연결", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  await expect(page.getByRole("article", { name: "첫 곡", exact: true }).getByText("90 BPM · 4/4", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "둘째 연습", exact: true }).getByText("140 BPM · 4/4", { exact: true })).toBeVisible();
});

test("metadata write failure rolls back project creation without overwriting the active project", async ({ page }) => {
  await createProject(page, "보존할 작업");
  const before = await storedKeys(page);
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "heads" && typeof key === "string" && key.startsWith("project:")) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Synthetic metadata failure", "QuotaExceededError");
      }
      return original.call(this, value, key);
    };
  });
  await page.getByRole("button", { name: "새 프로젝트", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("프로젝트 이름").fill("실패할 작업");
  await dialog.getByRole("button", { name: "만들고 스튜디오 열기" }).click();
  await expect(dialog.getByRole("alert")).toContainText("저장 공간이 부족");
  expect(await storedKeys(page)).toEqual(before);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("article", { name: "보존할 작업", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("registers the v5 legacy project idempotently without rewriting its session or revision", async ({ page }) => {
  const tracks = emptyStationHistory();
  const mixer = defaultStationMix();
  const master = defaultMasterMix();
  const hashes = await Promise.all(tracks.map(historyChecksum));
  const legacy = { schemaVersion: 5, revision: "legacy-keep", updatedAt: 123, history: { tracks, mixer, master },
    checksum: await digest(new TextEncoder().encode(JSON.stringify({ schemaVersion: 5, tracks: hashes, mixer, master })).buffer) };
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "새 프로젝트", exact: true })).toBeEnabled();
  await page.evaluate(async (saved) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("loop-station-local", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["heads", "sessions"], "readwrite");
      tx.objectStore("heads").put(saved.revision, "track-01-session");
      tx.objectStore("sessions").put(saved, "track-01-session");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }, legacy);
  for (let pass = 0; pass < 2; pass += 1) {
    await page.reload();
    await expect(page.getByRole("article", { name: "기존 로컬 프로젝트", exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
  }
  const stored = await page.evaluate(async () => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("loop-station-local", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("sessions", "readonly");
      const read = tx.objectStore("sessions").get("track-01-session");
      tx.oncomplete = () => { db.close(); resolve(read.result as unknown); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  expect(stored).toEqual(legacy);
});

test("a rename in another tab refreshes the list and keeps the current project selected", async ({ page, context }) => {
  await createProject(page, "공유된 로컬 작업");
  const other = await context.newPage();
  await other.goto("/projects");
  await other.getByRole("button", { name: "공유된 로컬 작업 이름 변경", exact: true }).click();
  await other.getByRole("dialog").getByLabel("프로젝트 이름").fill("변경한 이름");
  await other.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(page.locator(".station-project-name")).toHaveText("변경한 이름");
  await expect(page.getByRole("button", { name: /로컬 저장 상태: 이 기기에 저장됨/ })).toBeVisible();
  await other.close();
});

test("stale rename drafts cannot overwrite a newer name from another tab", async ({ page, context }) => {
  await createProject(page, "원래 이름");
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  await page.getByRole("button", { name: "원래 이름 이름 변경", exact: true }).click();
  await page.getByRole("dialog").getByLabel("프로젝트 이름").fill("늦은 이름");
  const other = await context.newPage();
  await other.goto("/projects");
  await other.getByRole("button", { name: "원래 이름 이름 변경", exact: true }).click();
  await other.getByRole("dialog").getByLabel("프로젝트 이름").fill("먼저 저장한 이름");
  await other.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(other.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".station-project-name")).toHaveText("먼저 저장한 이름");
  await page.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("다른 탭에서 프로젝트가 변경");
  await other.reload();
  await expect(other.getByRole("article", { name: "먼저 저장한 이름", exact: true })).toBeVisible();
  await other.close();
});

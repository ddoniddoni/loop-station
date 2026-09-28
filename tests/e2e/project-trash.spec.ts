import { expect, test, type Page } from "@playwright/test";
import { defaultMasterMix, defaultStationMix } from "../../src/audio/loop/track-mixer";
import { createStationSession, emptyStationHistory, type SavedStationSession } from "../../src/audio/storage/station-session";
import { ko } from "../../src/lib/i18n/ko";

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "새 프로젝트", exact: true }).click();
  await page.getByRole("dialog").getByLabel("프로젝트 이름", { exact: true }).fill(name);
  await page.getByRole("button", { name: "만들고 스튜디오 열기" }).click();
  await expect(page.locator(".station-project-name")).toHaveText(name);
  const id = await page.evaluate(() => sessionStorage.getItem("loop-station-active-project")!);
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  return id;
}
async function move(page: Page, name: string) {
  await page.getByRole("button", { name: `${name} 휴지통으로 이동`, exact: true }).click();
  await page.getByRole("button", { name: "휴지통으로 옮기기", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
async function snapshot(page: Page, id: string) {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("loop-station-local", 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ head: string; meta: { title: string; deletedAt?: number; lifecycleRevision?: string }; session: string }>((resolve, reject) => {
        const tx = db.transaction(["heads", "sessions"], "readonly");
        const head = tx.objectStore("heads").get(key);
        const meta = tx.objectStore("heads").get(`project:${key}`);
        const session = tx.objectStore("sessions").get(key);
        tx.oncomplete = () => resolve({ head: head.result, meta: meta.result,
          session: JSON.stringify(session.result, (_key, value: unknown) => value instanceof ArrayBuffer ? { pcm: Array.from(new Uint8Array(value)) } : value) });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, id);
}
async function failNextMetadataWrite(page: Page) {
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "heads" && typeof key === "string" && key.startsWith("project:")) {
        IDBObjectStore.prototype.put = put;
        throw new DOMException("Synthetic metadata failure", "QuotaExceededError");
      }
      return put.call(this, value, key);
    };
  });
}

test("legacy PCM and Undo survive trash, repeated reload, and restoration without session writes", async ({ page }) => {
  const tracks = emptyStationHistory();
  const pcm = Float32Array.from({ length: 8001 }, (_, index) => Math.sin(index * 0.1) * 0.25).buffer;
  const take = { pcm, metadata: { bpm: 240, numerator: 4, denominator: 4, sampleRate: 8000, frames: 8000, ticks: 3840, complete: true } };
  tracks[0] = { current: take, undo: take, redo: null, cleared: null };
  tracks[1].cleared = { current: take, undo: null, redo: null };
  const saved = await createStationSession({ tracks, mixer: defaultStationMix(), master: defaultMasterMix() });
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
      tx.objectStore("heads").put(session.revision, "track-01-session");
      tx.objectStore("sessions").put(session, "track-01-session");
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }, serialized);
  await page.reload(); await expect(page.getByRole("article", { name: "기존 로컬 프로젝트", exact: true })).toBeVisible();
  const before = await snapshot(page, "track-01-session");
  await move(page, "기존 로컬 프로젝트");
  const removed = await snapshot(page, "track-01-session");
  expect(removed.session).toBe(before.session); expect(removed.head).toMatch(/^trash:/);
  expect(removed.meta.deletedAt).toBeGreaterThan(0);
  for (let pass = 0; pass < 2; pass++) {
    await page.reload(); await expect(page.getByText("보관 중인 프로젝트가 없습니다", { exact: true })).toBeVisible();
    expect((await snapshot(page, "track-01-session")).session).toBe(before.session);
  }
  await page.getByRole("tab", { name: /^휴지통/ }).click();
  await page.getByRole("button", { name: "기존 로컬 프로젝트 복구", exact: true }).click();
  await expect(page.getByText("휴지통이 비어 있습니다.", { exact: true })).toBeVisible();
  const restored = await snapshot(page, "track-01-session");
  expect(restored.session).toBe(before.session); expect(restored.head).toBe(before.head);
  expect(restored.meta.deletedAt).toBeUndefined();
  await page.getByRole("tab", { name: /^보관 중/ }).click();
  await page.getByRole("button", { name: "프로젝트 열기", exact: true }).click();
  await expect(page.locator(".station-project-name")).toHaveText("기존 로컬 프로젝트");
});

test("trash and restore transaction failures roll back both metadata and head and allow retry", async ({ page }) => {
  const id = await createProject(page, "실패해도 보존"); const before = await snapshot(page, id);
  await page.getByRole("button", { name: "실패해도 보존 휴지통으로 이동", exact: true }).click();
  await failNextMetadataWrite(page);
  await page.getByRole("button", { name: "휴지통으로 옮기기", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("저장 공간");
  expect(await snapshot(page, id)).toEqual(before);
  await page.getByRole("button", { name: "휴지통으로 옮기기", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("tab", { name: /^휴지통/ }).click(); const removed = await snapshot(page, id);
  await failNextMetadataWrite(page); await page.getByRole("button", { name: "실패해도 보존 복구", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("저장 공간"); expect(await snapshot(page, id)).toEqual(removed);
  await page.getByRole("button", { name: "실패해도 보존 복구", exact: true }).click();
  await expect(page.getByText("휴지통이 비어 있습니다.", { exact: true })).toBeVisible();
  expect((await snapshot(page, id)).session).toBe(before.session);
});

test("stale deletion confirmation cannot remove a project renamed by another tab", async ({ page, context }) => {
  const id = await createProject(page, "처음 이름");
  await page.getByRole("button", { name: "처음 이름 휴지통으로 이동", exact: true }).click();
  const other = await context.newPage(); await other.goto("/projects");
  await other.getByRole("button", { name: "처음 이름 이름 변경", exact: true }).click();
  await other.getByRole("dialog").getByLabel("프로젝트 이름").fill("새 이름");
  await other.getByRole("button", { name: "이름 저장", exact: true }).click();
  await expect(other.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "휴지통으로 옮기기", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("다른 탭");
  const stored = await snapshot(page, id); expect(stored.meta.title).toBe("새 이름"); expect(stored.meta.deletedAt).toBeUndefined();
  await other.close();
});

test("a stale tab cannot save over a deleted-then-restored project even without broadcast delivery", async ({ page, context }) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis, "BroadcastChannel", { value: undefined, configurable: true }); });
  const id = await createProject(page, "다른 탭의 작업");
  const before = await snapshot(page, id);
  const other = await context.newPage(); await other.goto("/projects");
  await move(other, "다른 탭의 작업");
  await other.getByRole("tab", { name: /^휴지통/ }).click();
  await other.getByRole("button", { name: "다른 탭의 작업 복구", exact: true }).click();
  await expect(other.getByText("휴지통이 비어 있습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "작업 이어하기", exact: true }).click();
  await page.getByRole("button", { name: "오디오 연결 설정" }).click();
  await page.getByRole("button", { name: ko.audioStart, exact: true }).click();
  await expect(page.getByRole("button", { name: ko.toneStart, exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "템포와 박자 설정" }).click();
  await page.getByRole("spinbutton", { name: ko.transportTempoLabel }).fill("130");
  await page.getByRole("button", { name: ko.transportApply, exact: true }).click(); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /로컬 저장 상태:.*다른 탭/ })).toBeVisible();
  expect((await snapshot(page, id)).session).toBe(before.session);
  await other.close();
});

test("restoring a same-name project preserves both independent IDs", async ({ page }) => {
  const original = await createProject(page, "같은 곡"); await move(page, "같은 곡");
  const other = await createProject(page, "같은 곡"); expect(other).not.toBe(original);
  const before = await snapshot(page, other);
  await page.getByRole("tab", { name: /^휴지통/ }).click();
  await expect(page.getByText("같은 이름의 프로젝트가 있습니다. 덮어쓰지 않고 별도 프로젝트로 복구합니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "같은 곡 복구", exact: true }).click();
  await page.getByRole("tab", { name: /^보관 중/ }).click();
  await expect(page.getByRole("article", { name: "같은 곡", exact: true })).toHaveCount(2);
  expect(await snapshot(page, other)).toEqual(before);
});

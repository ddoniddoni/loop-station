import { expect, test } from "@playwright/test";

test("Project opens a real page, with a truthful empty state and browser history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "내 프로젝트", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("내 프로젝트");
  await expect(page.getByRole("heading", { name: "아직 저장된 프로젝트가 없습니다" })).toBeVisible();
  await expect(page.getByText(/현재는 자동 저장 프로젝트 1개를 지원합니다/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("내 프로젝트");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "루프 스튜디오", exact: true })).toBeAttached();
});

test("View switches panels without adding a hash, and microphone setup is accessible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "내 프로젝트", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View · 화면 보기 설정" }).click();
  await page.getByRole("menuitemradio", { name: "믹서", exact: true }).click();
  await expect(page.locator("#mixer")).toBeVisible();
  await expect(page.locator("#tracks")).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "트랙", exact: true }).click();
  await expect(page.locator("#tracks")).toBeVisible();
  await expect(page.locator("#mixer")).toBeHidden();
  await page.getByRole("button", { name: "마이크 연결", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "오디오 시작", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "마이크 사용 허용", exact: true })).toBeVisible();
  await expect(dialog.getByText("마이크가 연결되지 않았습니다.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "마이크 연결", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("storage access failure is not presented as an empty project list", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new DOMException("Blocked for test", "SecurityError"); };
  });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "불러오기 실패" })).toBeVisible();
  await expect(page.getByRole("button", { name: "불러오기 재시도", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "아직 저장된 프로젝트가 없습니다" })).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("production home renders in Korean and clearly marks unavailable audio features", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Loop Station");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("루프 스튜디오");
  await expect(page.locator(".radix-themes")).toHaveAttribute("data-accent-color", "jade");
  await expect(page.locator(".rt-Card").first()).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 바로가기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  await page.locator(".station-availability > summary").click();
  await expect(page.getByText("마이크 연결과 녹음은 직접 시작해야 동작합니다. 오디오는 이 브라우저에 저장하며 서버로 전송하지 않습니다. 브라우저 데이터 삭제 시 저장본이 사라질 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "내 프로젝트", exact: true })).toHaveAttribute("href", "/projects");
  await expect(page.getByRole("button", { name: "마이크 연결", exact: true })).toBeVisible();
  // Unsupported controls remain disabled with an explanation, not active-looking menu links.
  const view = page.getByRole("button", { name: "View · 화면 보기 설정" });
  await view.click();
  await page.getByRole("menuitemradio", { name: "입력·트랙 설정" }).click();
  const fx = page.getByRole("button", { name: "+ ADD FX" });
  await expect(fx).toBeDisabled();
  await expect(fx).toHaveAttribute("aria-describedby", "availability");
  await expect(page.getByRole("button", { name: "REV", exact: true })).toBeDisabled();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(pageErrors).toEqual([]);
});

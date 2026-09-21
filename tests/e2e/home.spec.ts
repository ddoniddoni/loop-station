import { expect, test } from "@playwright/test";

test("production home renders in Korean and clearly marks unavailable audio features", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Loop Station");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("제목 없는 세션");
  await expect(page.locator(".radix-themes")).toHaveAttribute("data-accent-color", "jade");
  await expect(page.locator(".rt-Card").first()).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 바로가기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  await page.locator(".station-availability > summary").click();
  await expect(page.getByText("마이크는 직접 허용했을 때만 연결되며, 녹음은 아직 지원하지 않습니다.")).toBeVisible();
  const mobileSettings = page.getByRole("button", { name: "Settings", exact: true });
  if (await mobileSettings.isVisible()) {
    await mobileSettings.click();
  }
  await expect(page.getByRole("button", { name: "새 프로젝트" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "데모로 체험" })).toBeDisabled();
  const newProject = page.getByRole("button", { name: "새 프로젝트" });
  await expect(newProject).toHaveClass(/rt-Button/);
  await expect(newProject).toHaveAttribute("aria-describedby", "availability");
  const buttonBackground = await newProject.evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(buttonBackground).not.toBe("rgba(0, 0, 0, 0)");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(pageErrors).toEqual([]);
});

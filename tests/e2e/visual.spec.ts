import { test, expect } from "@playwright/test";

test.describe("Claude Atlas — visual regression", () => {
  for (const view of ["neuromap", "reference", "worklist"] as const) {
    test(`${view} view pixel parity`, async ({ page }) => {
      await page.goto(`/?test=1#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await page.waitForTimeout(2_500); // physics settles (capped at 200 steps in test mode); mobile needs extra time
      await expect(page).toHaveScreenshot(`${view}.png`, { maxDiffPixelRatio: 0.05 });
    });
  }

  test("palette open visual", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.waitForTimeout(2_500);
    await page.keyboard.press("Control+K");
    await expect(page.locator('[data-role="palette-overlay"]')).toBeVisible();
    await expect(page).toHaveScreenshot("palette-open.png", { maxDiffPixelRatio: 0.05 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Claude Atlas — smoke", () => {
  test("boots without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/?test=1", { waitUntil: "load" });
    await page.waitForFunction(() => document.body.dataset.ready === "true", { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("canvas is present and visible", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const canvas = page.locator("#gpu");
    await expect(canvas).toBeVisible();
    const size = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
    expect(size.w).toBeGreaterThan(100);
    expect(size.h).toBeGreaterThan(100);
  });

  test("three view tabs in top bar", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const tabs = page.locator('[data-role="view-tab"]');
    await expect(tabs).toHaveCount(3);
  });

  test("palette opens on Ctrl+K", async ({ page, browserName }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.keyboard.press("Control+K");
    const overlay = page.locator('[data-role="palette-overlay"]');
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });
});

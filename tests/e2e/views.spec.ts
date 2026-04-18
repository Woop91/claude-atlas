import { test, expect } from "@playwright/test";

test.describe("Claude Atlas — views", () => {
  for (const view of ["neuromap", "reference", "worklist"] as const) {
    test(`${view} view reaches data-ready and renders landmarks`, async ({ page }) => {
      await page.goto(`/?test=1#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await expect(page.locator(`#shell[data-view="${view}"]`)).toBeVisible();
    });
  }

  test("view switches via visible tabs (top on desktop, bottom on mobile)", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    for (const view of ["reference", "worklist", "neuromap"] as const) {
      await page.locator(`[data-view="${view}"]:visible`).first().click();
      await expect(page.locator(`#shell[data-view="${view}"]`)).toBeVisible();
    }
  });

  test("reference view contains domain tabs and entries", async ({ page }) => {
    await page.goto("/?test=1#/reference");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const tabs = page.locator('[data-role="ref-domain-tab"]');
    await expect(tabs).toHaveCount(4);
    const entries = page.locator('[data-role="ref-entry"]');
    expect(await entries.count()).toBeGreaterThan(10);
  });

  test("worklist view contains command list", async ({ page }) => {
    await page.goto("/?test=1#/worklist");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const cmds = page.locator('[data-role="wl-cmd-entry"]');
    expect(await cmds.count()).toBeGreaterThan(10);
  });
});

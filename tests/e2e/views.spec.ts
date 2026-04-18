import { test, expect } from "@playwright/test";

test.describe("Claude Atlas — views", () => {
  for (const view of ["neuromap", "reference", "worklist"] as const) {
    test(`${view} view reaches data-ready and renders landmarks`, async ({ page }) => {
      await page.goto(`/?test=1#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await expect(page.locator(`#shell[data-view="${view}"]`)).toBeVisible();
    });
  }

  test("view switches via top tabs", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.click('[data-role="view-tab"][data-view="reference"]');
    await expect(page.locator('#shell[data-view="reference"]')).toBeVisible();
    await page.click('[data-role="view-tab"][data-view="worklist"]');
    await expect(page.locator('#shell[data-view="worklist"]')).toBeVisible();
    await page.click('[data-role="view-tab"][data-view="neuromap"]');
    await expect(page.locator('#shell[data-view="neuromap"]')).toBeVisible();
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

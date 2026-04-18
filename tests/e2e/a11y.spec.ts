import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Claude Atlas — a11y", () => {
  for (const view of ["neuromap", "reference", "worklist"] as const) {
    test(`${view} view has no critical/serious a11y violations`, async ({ page }) => {
      await page.goto(`/?test=1#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      if (blocking.length) {
        console.log("a11y violations:", JSON.stringify(blocking, null, 2));
      }
      expect(blocking).toEqual([]);
    });
  }

  test("skip link is reachable via keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "mobile device descriptors synthesize touch; Tab keyboard focus is not emulated");
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => document.activeElement?.className);
    expect(active).toContain("skip-link");
  });
});

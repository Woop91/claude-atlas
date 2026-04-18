import { test, expect } from "@playwright/test";

async function collectDomSignature(page) {
  return await page.evaluate(() => {
    const wordmark = document.querySelector('[data-role="wordmark"]')?.textContent;
    const tabs = Array.from(document.querySelectorAll('[data-role="view-tab"]')).map((t) => ({
      view: (t as HTMLElement).dataset.view,
      current: t.getAttribute("aria-current"),
    }));
    const canvasBounds = (() => {
      const c = document.getElementById("gpu") as HTMLCanvasElement | null;
      if (!c) return null;
      return { width: c.width, height: c.height };
    })();
    const ready = document.body.dataset.ready;
    return { wordmark, tabs, canvasBounds, ready };
  });
}

test.describe("Claude Atlas — backend parity", () => {
  test("webgl2 and webgpu produce equivalent DOM signature", async ({ page }) => {
    await page.goto("/?test=1&backend=webgl2");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const webgl2 = await collectDomSignature(page);

    await page.goto("/?test=1&backend=webgpu");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const webgpu = await collectDomSignature(page);

    expect(webgl2.wordmark).toBe(webgpu.wordmark);
    expect(webgl2.tabs).toEqual(webgpu.tabs);
    expect(webgl2.canvasBounds).toEqual(webgpu.canvasBounds);
    expect(webgl2.ready).toBe(webgpu.ready);
  });

  test("webgl2 renders across all three views", async ({ page }) => {
    for (const view of ["neuromap", "reference", "worklist"] as const) {
      await page.goto(`/?test=1&backend=webgl2#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await expect(page.locator(`#shell[data-view="${view}"]`)).toBeVisible();
    }
  });

  test("webgpu renders across all three views", async ({ page }) => {
    for (const view of ["neuromap", "reference", "worklist"] as const) {
      await page.goto(`/?test=1&backend=webgpu#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await expect(page.locator(`#shell[data-view="${view}"]`)).toBeVisible();
    }
  });
});

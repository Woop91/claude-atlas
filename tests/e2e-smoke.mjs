// One-off browser verification for Plan 03. Run via:
//   cd claude-atlas && npx http-server -s -p 4173 &
//   node tests/e2e-smoke.mjs
// Exits 0 on pass, 1 on fail.

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4173";
const OUT = "./tests/e2e-artifacts";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

console.log("1. Navigate to", BASE);
await page.goto(BASE, { waitUntil: "domcontentloaded" });

console.log("2. Wait for data-ready");
await page.waitForFunction(() => document.body.dataset.ready === "true", { timeout: 15000 });

await page.waitForTimeout(1200); // let physics settle a few frames

await page.screenshot({ path: `${OUT}/01-neuromap.png`, fullPage: false });

// Sample the canvas interior — grab pixels from a few representative spots
const pixelStats = await page.evaluate(() => {
  const c = document.getElementById("gpu");
  const gl = c.getContext("webgl2");
  if (!gl) return { error: "no gl context" };
  const w = c.width, h = c.height;
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // background (from shader) is ~ rgb(7..13, 7..13, 15..25) at various noise values
  // graph nodes are brighter via hslToRgb + halo; edges add white-ish lines
  let brightCount = 0, maxR = 0, maxG = 0, maxB = 0;
  const N = pixels.length / 4;
  for (let i = 0; i < N; i++) {
    const r = pixels[4 * i], g = pixels[4 * i + 1], b = pixels[4 * i + 2];
    if (r > maxR) maxR = r;
    if (g > maxG) maxG = g;
    if (b > maxB) maxB = b;
    if (r > 80 || g > 80 || b > 80) brightCount++;
  }
  return { w, h, brightCount, brightPct: (brightCount / N * 100).toFixed(3), maxR, maxG, maxB };
});

console.log("3. Canvas pixel stats:", JSON.stringify(pixelStats));

// Check store state is exposed
const storeReady = await page.evaluate(() => {
  return typeof window !== "undefined" && !!document.querySelector("#shell");
});
console.log("4. Store/shell accessible:", storeReady);

// View switching
console.log("5. Click #/reference tab");
await page.click('[data-role="view-tab"][data-view="reference"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-reference.png`, fullPage: false });
const refView = await page.$eval("#shell", (el) => el.dataset.view);
console.log("   shell.dataset.view =", refView);

console.log("6. Click #/worklist tab");
await page.click('[data-role="view-tab"][data-view="worklist"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-worklist.png`, fullPage: false });
const wlView = await page.$eval("#shell", (el) => el.dataset.view);
console.log("   shell.dataset.view =", wlView);

console.log("7. Back to #/neuromap");
await page.click('[data-role="view-tab"][data-view="neuromap"]');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/04-neuromap-again.png`, fullPage: false });

// Sample pixels again after returning
const pixelStats2 = await page.evaluate(() => {
  const c = document.getElementById("gpu");
  const gl = c.getContext("webgl2");
  if (!gl) return { error: "no gl context" };
  const w = c.width, h = c.height;
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let brightCount = 0;
  const N = pixels.length / 4;
  for (let i = 0; i < N; i++) {
    const r = pixels[4 * i], g = pixels[4 * i + 1], b = pixels[4 * i + 2];
    if (r > 80 || g > 80 || b > 80) brightCount++;
  }
  return { brightPct: (brightCount / N * 100).toFixed(3) };
});
console.log("8. Neuromap pixel stats after switch-back:", JSON.stringify(pixelStats2));

console.log("");
console.log("=== CONSOLE LOGS ===");
for (const l of logs) console.log(l);

await browser.close();

// Exit code: fail if bright pixel % is near zero (means graph didn't render)
const pct = parseFloat(pixelStats.brightPct || "0");
if (pct < 0.01) {
  console.log("\n❌ FAIL: graph appears invisible (brightPct < 0.01%) — view matrix likely broken");
  process.exit(1);
}
console.log(`\n✅ PASS: graph rendered (brightPct ${pct}%)`);
process.exit(0);

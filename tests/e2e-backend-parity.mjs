// Playwright backend-parity smoke. Requires dev server running on :4173.
// Launches headless Chromium with WebGPU flags; takes screenshots of both backends.
// Exits 0 if both renders look non-blank (>50KB PNG) and no page errors fired.
import { chromium } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
mkdirSync("./tests/e2e-artifacts", { recursive: true });

const launchArgs = ["--enable-unsafe-webgpu", "--enable-features=Vulkan"];
const browser = await chromium.launch({ headless: true, args: launchArgs });

async function snap(urlSuffix, outName) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`http://localhost:4173${urlSuffix}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.dataset.ready === "true", { timeout: 20000 });
  await page.waitForTimeout(2500); // physics settle
  await page.screenshot({ path: `./tests/e2e-artifacts/${outName}` });
  const active = await page.evaluate(() => document.body.dataset.ready);
  await page.close();
  return { errs, active };
}

const webgl2 = await snap("/?backend=webgl2", "parity-webgl2.png");
const webgpu = await snap("/?backend=webgpu", "parity-webgpu.png");
await browser.close();

const w2Size = statSync("./tests/e2e-artifacts/parity-webgl2.png").size;
const wgSize = statSync("./tests/e2e-artifacts/parity-webgpu.png").size;
console.log(`webgl2: ${w2Size} bytes, errs=${webgl2.errs.length}, ready=${webgl2.active}`);
console.log(`webgpu: ${wgSize} bytes, errs=${webgpu.errs.length}, ready=${webgpu.active}`);

let fail = false;
if (webgl2.errs.length) { console.error("webgl2 errors:", webgl2.errs); fail = true; }
if (webgpu.errs.length) { console.error("webgpu errors:", webgpu.errs); fail = true; }
if (w2Size < 50000) { console.error("webgl2 screenshot too small — likely blank"); fail = true; }
if (wgSize < 50000) { console.error("webgpu screenshot too small — likely blank"); fail = true; }

process.exit(fail ? 1 : 0);

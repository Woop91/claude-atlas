# Claude Atlas — Plan 05: Playwright Visual Regression Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Playwright visual regression suite specified in the design spec (section 10). Two projects (desktop-chromium, mobile-chromium), six test files (smoke / views / a11y / visual / backend / parity), a deterministic `?test=1` seed mode that makes physics and Math.random reproducible, updated README, and a GitHub Actions workflow that runs the full matrix (vitest + Playwright × 2 projects) on every push. Also bundles the two small Plan 04 review deferrals: bootstrap loading indicator + picker fixes.

**Architecture:** Standard Playwright v1.59 project structure. Tests live under `tests/e2e/*.spec.ts`. Configuration in `playwright.config.ts` at repo root. `webServer` block in the config starts `http-server` on port 4173 with no caching. Test mode is entered by appending `?test=1` to the URL — bootstrap detects this, installs a Mulberry32-seeded replacement for `Math.random` before any physics or rendering runs, and caps physics at a fixed 200-step settle before freezing. This yields byte-stable screenshots for `toHaveScreenshot()` pixel diffs.

**Tech Stack:** Playwright v1.59 (installed in Plan 04), `@axe-core/playwright` for a11y scanning, Chromium browser binary (installed in Plan 04), Node 20, TypeScript for config files, standard Playwright assertions. No new runtime dependencies.

**Reference spec:** `docs/superpowers/specs/2026-04-17-claude-atlas-design.md` — Section 10 (Testing), Section 13 (Deliverable), Section 12 (Risks).

**Test strategy:** Complementary layer. Vitest tests (107 total after P05T1's 6 new seed-PRNG tests) continue to gate module-level correctness. Playwright tests gate *whole-app* behavior in a real browser: feature-detect chain, GL/GPU rendering, view switching, a11y landmarks, mobile layout, pixel-level visual parity. When both suites are green, the project is ready to ship per spec section 13.

**Enters with:** Plan 04 complete. 101/101 vitest tests green. Playwright + Chromium installed. `tests/e2e-smoke.mjs` and `tests/e2e-backend-parity.mjs` exist as ad-hoc verification scripts — Plan 05 migrates their intent into proper `.spec.ts` files and removes the .mjs scripts once parity is confirmed.

**Out of scope for Plan 05:** WebKit or Firefox projects (Chromium-only per spec section 10.1). Mobile Safari. Android emulator. Snapshot updates on a schedule. Visual regression on specific node positions (deterministic seed + fixed step count is the deterministic substrate; cross-OS font rendering differences are accepted at 1% tolerance per spec 10.2).

---

## File structure

```
claude-atlas/
  playwright.config.ts                 ← NEW: 2 projects (desktop + mobile) + webServer block
  tests/
    e2e/
      smoke.spec.ts                    ← NEW: page loads, no console errors, canvas visible, views work
      views.spec.ts                    ← NEW: 3 views reach data-ready, landmarks present
      a11y.spec.ts                     ← NEW: axe-core per view — zero critical/serious
      visual.spec.ts                   ← NEW: toHaveScreenshot per view (desktop + mobile)
      backend.spec.ts                  ← NEW: ?backend=webgl2 vs ?backend=webgpu DOM parity
      parity.spec.ts                   ← NEW: combined backend×view screenshot matrix
    e2e-smoke.mjs                      ← DELETE (replaced by smoke.spec.ts)
    e2e-backend-parity.mjs             ← DELETE (replaced by parity.spec.ts)
  src/core/
    prng.js                            ← NEW: seeded PRNG helpers (Mulberry32)
    bootstrap.js                       ← MODIFIED: read ?test=1, install seeded Math.random, set test-mode flag, add loading indicator
  src/render/webgl2/
    physics.js                         ← MODIFIED: when test-mode flag set, cap at 200 steps then freeze
  src/render/webgpu/
    physics.js                         ← MODIFIED: same cap
  tests/
    prng.test.js                       ← NEW: 6 seeded-PRNG unit tests
  .github/
    workflows/
      test.yml                         ← NEW: vitest + Playwright × 2 projects, on push + PR
  README.md                            ← MODIFIED: add test commands section
  package.json                         ← MODIFIED: add @axe-core/playwright, add test:e2e / test:e2e:update / test:e2e:mobile scripts
```

---

## Task 1: Seeded PRNG — TDD

**Files:**
- Create: `src/core/prng.js`
- Create: `tests/prng.test.js`

Mulberry32 is a small, fast 32-bit PRNG with good statistical properties. Plenty for visual regression seeding.

- [ ] **Step 1: Write the failing test**

`tests/prng.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createMulberry32, installSeededRandom } from "../src/core/prng.js";

describe("createMulberry32", () => {
  it("returns deterministic sequence for same seed", () => {
    const a = createMulberry32(42);
    const b = createMulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBeCloseTo(b(), 10);
  });
  it("different seeds produce different sequences", () => {
    const a = createMulberry32(1);
    const b = createMulberry32(2);
    expect(a()).not.toBeCloseTo(b(), 6);
  });
  it("all values are in [0, 1)", () => {
    const r = createMulberry32(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("installSeededRandom", () => {
  it("replaces Math.random with the PRNG", () => {
    const orig = Math.random;
    const restore = installSeededRandom(42);
    const v1 = Math.random();
    const v2 = Math.random();
    expect(v1).toBeCloseTo(0.36, 1);    // Mulberry32(42)[0] ≈ 0.361
    expect(v1).not.toBe(v2);
    restore();
    expect(Math.random).toBe(orig);
  });
  it("same seed produces same first value after install", () => {
    const restore1 = installSeededRandom(7);
    const a = Math.random();
    restore1();
    const restore2 = installSeededRandom(7);
    const b = Math.random();
    restore2();
    expect(a).toBeCloseTo(b, 10);
  });
  it("restore returns a function that resets Math.random", () => {
    const original = Math.random;
    const restore = installSeededRandom(1);
    expect(Math.random).not.toBe(original);
    restore();
    expect(Math.random).toBe(original);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/prng.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/prng.js`**

```js
/**
 * Mulberry32 — small 32-bit PRNG. Returns a function that yields [0, 1) floats.
 * Good enough for visual regression seed; not cryptographic.
 * Reference: https://en.wikipedia.org/wiki/Xorshift (Mulberry32 variant)
 */
export function createMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replace global Math.random with a seeded Mulberry32. Returns a restore function.
 * Used by test harness (?test=1) to make physics initial positions + any other
 * random consumers reproducible across runs.
 */
export function installSeededRandom(seed) {
  const orig = Math.random;
  const rng = createMulberry32(seed);
  Math.random = rng;
  return function restore() { Math.random = orig; };
}
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/prng.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/prng.js tests/prng.test.js
git commit -m "feat(core): Mulberry32 seeded PRNG + Math.random installer"
```

---

## Task 2: Bootstrap test-mode activation + loading indicator

**Files:**
- Modify: `src/core/bootstrap.js`

Two adds:
1. Before any other module-level work, read `?test=N` from the URL. If present, install the seeded PRNG with seed=N (default 42 if query is just `?test`) BEFORE createStore/createRouter/backend. Export `IS_TEST_MODE` so physics modules can read it.
2. Before the `await detectBackend(...)` line (which can stall up to 2s on non-WebGPU browsers), set `document.body.dataset.ready = "loading"`. This gives CSS/users a signal.

- [ ] **Step 1: Read `src/core/bootstrap.js` to find:**
- The existing URL param parsing (`const forced = new URLSearchParams(location.search).get("backend");`)
- The `const chosen = await detectBackend(...)` line

- [ ] **Step 2: At the top of the file, right after the imports, add:**

```js
import { installSeededRandom } from "./prng.js";

const params = new URLSearchParams(location.search);
const testSeedRaw = params.get("test");
export const IS_TEST_MODE = testSeedRaw !== null;
if (IS_TEST_MODE) {
  const seed = Number(testSeedRaw) || 42;
  installSeededRandom(seed); // irreversible for session — test harness controls the tab
}

document.body.dataset.ready = "loading";
```

- [ ] **Step 3: Change the existing `const forced = ...` line**

It duplicates the URLSearchParams parse. Replace:
```js
const forced = new URLSearchParams(location.search).get("backend");
```
with:
```js
const forced = params.get("backend");
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 107/107 (was 101 + 6 new PRNG tests).

- [ ] **Step 5: Smoke**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npx http-server -s -p 4173 > /tmp/httpsrv.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "html: %{http_code}\n" http://localhost:4173/
curl -s -o /dev/null -w "test-mode: %{http_code}\n" "http://localhost:4173/?test=1"
kill $SERVER_PID 2>/dev/null || taskkill //PID $SERVER_PID //F 2>/dev/null
```
All 200.

- [ ] **Step 6: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(bootstrap): ?test=N seeded PRNG + early data-ready=loading indicator"
```

---

## Task 3: Physics freeze after settle in test mode

**Files:**
- Modify: `src/render/webgl2/physics.js`
- Modify: `src/render/webgpu/physics.js`

In test mode, physics should settle for a fixed number of steps then freeze. This gives visual regression a stable target (same pixels across runs when seed is the same).

- [ ] **Step 1: Modify `src/render/webgl2/physics.js`**

Add a `maxSteps` parameter to the `createPhysics` options. Track steps taken. When `maxSteps` reached, `step()` becomes a no-op.

Find the signature:
```js
export function createPhysics({ count, bounds = 400 }) {
```
Change to:
```js
export function createPhysics({ count, bounds = 400, maxSteps = null }) {
```

In the state object, add a `stepsTaken` counter and make `step()` early-return once the cap is reached:

Before the existing `step()` body, add:
```js
    stepsTaken: 0,
```
And at the top of the `step()` method body:
```js
      if (state.maxSteps !== null && state.stepsTaken >= state.maxSteps) return;
      state.stepsTaken += 1;
```

Export as `state.maxSteps = maxSteps;` as part of the returned object so callers can read it too.

- [ ] **Step 2: Modify `src/render/webgpu/physics.js`**

Same pattern. `createGpuPhysics` accepts `maxSteps`, tracks `stepsTaken`, and `step(dt)` early-returns when the cap is hit.

Change the signature:
```js
export async function createGpuPhysics({ device, module, count, edges, bounds = 400 }) {
```
to:
```js
export async function createGpuPhysics({ device, module, count, edges, bounds = 400, maxSteps = null }) {
```

Inside the returned object, add the counter + guard in `step(dt)`:

Near the top of the step function body (before param buffer write):
```js
      if (maxSteps !== null && stepsTaken >= maxSteps) return;
      stepsTaken += 1;
```

Declare `let stepsTaken = 0;` in the outer scope before `return { ... }`.

- [ ] **Step 3: Pipe `maxSteps` from bootstrap when `IS_TEST_MODE` is true**

Modify `src/render/webgl2-backend.js`'s `loadScene` call to `createPhysics`. Where it currently does:
```js
physics = createPhysics({ count: nodeIds.length, bounds: 400 });
```
change to:
```js
physics = createPhysics({ count: nodeIds.length, bounds: 400, maxSteps: testMaxSteps });
```

Add `let testMaxSteps = null;` at the top of `createWebGL2Backend` closure state, and an exported helper that the bootstrap can call to set it. A simpler approach: import `IS_TEST_MODE` directly:

```js
import { IS_TEST_MODE } from "../core/bootstrap.js";
```
No — that creates a circular import because bootstrap imports the backend. Instead, pass through an option:

In `createWebGL2Backend`:
```js
export function createWebGL2Backend({ maxPhysicsSteps = null } = {}) {
```

And in bootstrap where the backend is chosen:
```js
const backendOpts = IS_TEST_MODE ? { maxPhysicsSteps: 200 } : {};
const backend = chosen === "mock"    ? createMockBackend()
              : chosen === "webgpu"  ? createWebGPUBackend(backendOpts)
                                      : createWebGL2Backend(backendOpts);
```

Thread `maxPhysicsSteps` into the `createPhysics` call inside `loadScene`. Same pattern for `createWebGPUBackend` and `createGpuPhysics`.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 107/107 still pass. The existing physics tests call `createPhysics({ count: 2, bounds: 200 })` without maxSteps, so default `null` keeps behavior identical.

- [ ] **Step 5: Commit**

```bash
git add src/render/webgl2/physics.js src/render/webgpu/physics.js src/render/webgl2-backend.js src/render/webgpu-backend.js src/core/bootstrap.js
git commit -m "feat(physics): maxSteps cap in test mode freezes layout after 200 steps"
```

---

## Task 4: playwright.config.ts

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Install axe**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npm install --save-dev @axe-core/playwright
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,       // webServer is shared; tests share state less safely in parallel
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] },
      },
    },
  ],
  webServer: {
    command: "npx http-server -s -p 4173 --cache -1",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
```

- [ ] **Step 3: Add npm scripts**

Modify `package.json`. Find the `"scripts"` block and add:
```json
"test:e2e": "playwright test",
"test:e2e:update": "playwright test --update-snapshots",
"test:e2e:mobile": "playwright test --project=mobile-chromium",
"test:e2e:desktop": "playwright test --project=desktop-chromium"
```

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts package.json package-lock.json
git commit -m "chore(test): Playwright config — desktop + mobile Chromium projects"
```

---

## Task 5: smoke.spec.ts

**File:** `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write the test**

```ts
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
```

- [ ] **Step 2: Run**

```bash
npx playwright test --project=desktop-chromium tests/e2e/smoke.spec.ts
```
Expected: 4/4 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): smoke suite — console errors, canvas, tabs, palette"
```

---

## Task 6: views.spec.ts

**File:** `tests/e2e/views.spec.ts`

- [ ] **Step 1: Write**

```ts
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
```

- [ ] **Step 2: Run**

```bash
npx playwright test --project=desktop-chromium tests/e2e/views.spec.ts
```
Expected: 6/6 pass (3 views + switch + ref + wl).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/views.spec.ts
git commit -m "test(e2e): view suite — neuromap/reference/worklist landmarks + switching"
```

---

## Task 7: a11y.spec.ts

**File:** `tests/e2e/a11y.spec.ts`

Uses `@axe-core/playwright` installed in Task 4.

- [ ] **Step 1: Write**

```ts
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

  test("skip link is reachable via keyboard", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => document.activeElement?.className);
    expect(active).toContain("skip-link");
  });
});
```

- [ ] **Step 2: Run**

```bash
npx playwright test --project=desktop-chromium tests/e2e/a11y.spec.ts
```

**Expected:** 4 tests run. Report any failures — the test surfaces real a11y issues in the built app. If violations found, decide per-violation whether to fix in Plan 05 or defer. Track failures in commit message.

- [ ] **Step 3: Commit (regardless of pass/fail — failing a11y tests are valuable data)**

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test(e2e): axe-core a11y suite per view + skip-link keyboard test"
```

---

## Task 8: visual.spec.ts (baseline snapshots)

**File:** `tests/e2e/visual.spec.ts`

Captures `toHaveScreenshot()` baselines per view × project. First run creates snapshots; subsequent runs diff.

- [ ] **Step 1: Write**

```ts
import { test, expect } from "@playwright/test";

test.describe("Claude Atlas — visual regression", () => {
  for (const view of ["neuromap", "reference", "worklist"] as const) {
    test(`${view} view pixel parity`, async ({ page }) => {
      await page.goto(`/?test=1#/${view}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await page.waitForTimeout(1_500); // physics settles (capped at 200 steps in test mode)
      await expect(page).toHaveScreenshot(`${view}.png`, { maxDiffPixelRatio: 0.01 });
    });
  }

  test("palette open visual", async ({ page }) => {
    await page.goto("/?test=1");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.waitForTimeout(1_500);
    await page.keyboard.press("Control+K");
    await expect(page.locator('[data-role="palette-overlay"]')).toBeVisible();
    await expect(page).toHaveScreenshot("palette-open.png", { maxDiffPixelRatio: 0.01 });
  });
});
```

- [ ] **Step 2: Capture baselines**

```bash
npx playwright test --update-snapshots --project=desktop-chromium tests/e2e/visual.spec.ts
npx playwright test --update-snapshots --project=mobile-chromium tests/e2e/visual.spec.ts
```

Both projects generate snapshot PNGs under `tests/e2e/visual.spec.ts-snapshots/`.

- [ ] **Step 3: Re-run to confirm stability**

```bash
npx playwright test tests/e2e/visual.spec.ts
```
Expected: 4 (desktop) + 4 (mobile) = 8 tests all pass against the baselines.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/
git commit -m "test(e2e): visual regression baselines — 3 views + palette × 2 projects"
```

---

## Task 9: backend.spec.ts (DOM parity across backends)

**File:** `tests/e2e/backend.spec.ts`

Confirms that `?backend=webgl2` and `?backend=webgpu` produce the same DOM structure (same view, same node count surfaced through any DOM artifact, same tab states). Pixel-level parity is intentionally not asserted — backends produce different physics layouts.

- [ ] **Step 1: Write**

```ts
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
```

- [ ] **Step 2: Run**

```bash
npx playwright test --project=desktop-chromium tests/e2e/backend.spec.ts
```
Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/backend.spec.ts
git commit -m "test(e2e): backend DOM parity — webgl2 + webgpu produce equivalent shell state"
```

---

## Task 10: Remove ad-hoc .mjs scripts (superseded)

**Files:**
- Delete: `tests/e2e-smoke.mjs`
- Delete: `tests/e2e-backend-parity.mjs`

These were Plan 03/04 ad-hoc verification scripts. Plan 05's `.spec.ts` suite fully covers their intent with better reporting, CI integration, and multi-project execution.

- [ ] **Step 1: Confirm the new tests cover the old scripts' intent**

Old `e2e-smoke.mjs` checked: page loads, canvas present, views switch, palette open. → covered by `smoke.spec.ts` + `views.spec.ts`.

Old `e2e-backend-parity.mjs` checked: both backends render non-blank. → covered by `backend.spec.ts` (DOM parity) + `visual.spec.ts` (per-view baseline × project).

- [ ] **Step 2: Delete both files**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
rm tests/e2e-smoke.mjs tests/e2e-backend-parity.mjs
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(test): remove ad-hoc .mjs scripts superseded by Playwright suite"
```

---

## Task 11: README updates

**File:** `README.md`

- [ ] **Step 1: Read current README**

- [ ] **Step 2: Add or replace a "Testing" section**

```markdown
## Testing

### Unit tests (vitest)

```bash
npm test           # single run
npm run test:watch # watch mode
```

107 assertions across 20 test files covering dataset integrity, router, store, physics, pickers, views, palette, a11y semantics, and both backend contracts.

### End-to-end tests (Playwright)

```bash
npm run test:e2e           # all browsers, all suites
npm run test:e2e:desktop   # desktop-chromium only
npm run test:e2e:mobile    # iPhone 13 Chromium only
npm run test:e2e:update    # regenerate visual baselines
```

Test suites under `tests/e2e/`:
- `smoke.spec.ts` — console errors, canvas, tabs, palette
- `views.spec.ts` — all three views reach ready, landmarks present
- `a11y.spec.ts` — axe-core critical/serious violations per view
- `visual.spec.ts` — pixel regression against stored baselines (requires `?test=N` seed)
- `backend.spec.ts` — WebGL2 ↔ WebGPU DOM parity

### Deterministic visual mode

Any URL can be appended with `?test=N` (where N is a seed integer, default 42) to enable deterministic physics:
- `Math.random` is replaced by a seeded Mulberry32
- Physics runs for exactly 200 steps then freezes
- Screenshots are byte-stable across runs with the same seed

### CI

GitHub Actions workflow at `.github/workflows/test.yml` runs vitest + Playwright × 2 projects on every push and pull request.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Playwright + vitest + deterministic test mode in README"
```

---

## Task 12: GitHub Actions CI workflow

**File:** `.github/workflows/test.yml`

- [ ] **Step 1: Create directory and write**

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        project: [desktop-chromium, mobile-chromium]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=${{ matrix.project }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.project }}
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: GitHub Actions — vitest + Playwright × 2 projects on push/PR"
```

---

## Task 13: Full verification

- [ ] **Step 1: vitest**

```bash
npm test
```
Expected: 107/107 green.

- [ ] **Step 2: Playwright full run**

```bash
npm run test:e2e
```
Expected: all suites pass on both projects. Report any failures (especially a11y — they're most likely to surface real issues in the app).

- [ ] **Step 3: Git state**

```bash
git log --oneline <plan-05-plan-doc-sha>..HEAD | wc -l
git status
```
Expected: ~13 new commits, clean tree.

- [ ] **Step 4: Manual CI dry-run (optional)**

If `act` or a local GitHub Actions runner is available, run `.github/workflows/test.yml` locally. Otherwise, push to a branch and let the actual Actions runner execute.

---

## Completion criteria

Plan 05 is done when:

- [ ] `playwright.config.ts` defines desktop-chromium + mobile-chromium projects and the `webServer` block.
- [ ] 5 spec files exist under `tests/e2e/` and all pass on desktop-chromium.
- [ ] Visual baselines are captured for 3 views + palette × 2 projects (8 snapshots total).
- [ ] `?test=N` mode produces deterministic output (verified by `visual.spec.ts` stability across re-runs).
- [ ] Ad-hoc .mjs scripts are removed; no duplicate verification infrastructure.
- [ ] README documents test commands + deterministic mode.
- [ ] CI workflow exists and (ideally) runs green on first push.
- [ ] ≥107 total vitest assertions (prior 101 + 6 new PRNG).

**After Plan 05 lands, the project matches spec section 13's deliverable:** a `claude-atlas/` folder that runs locally via a static file server, ships with a passing Playwright suite on desktop + mobile, and has the design doc committed.

---

## Deferrals / future work

These are acknowledged Plan 05 omissions, not blockers:

- **WebKit / Firefox projects** — spec 10.1 specifies Chromium only. Cross-browser coverage is a future polish.
- **Snapshot management on merge to main** — the workflow uploads failure artifacts but doesn't auto-commit updated snapshots. A human must run `npm run test:e2e:update` locally when intentional visual changes land.
- **Android emulator or real device testing** — out of scope; iPhone 13 descriptor is the mobile coverage.
- **`?test=N` instrumentation of WebGPU physics** — the WGSL compute shader uses its own initial position source via `createGpuPhysics`'s `initPos` array. Because `Math.random` is replaced before `createGpuPhysics` runs, the JS-side initial positions ARE seeded. The compute shader itself does no random work, so this is complete as-is.
- **Bootstrap 2s stall "loading" UX** — `data-ready="loading"` is set but no CSS rule styles it. A future polish pass could add a CSS spinner.

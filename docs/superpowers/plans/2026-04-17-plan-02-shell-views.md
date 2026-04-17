# Claude Atlas — Plan 02: Shell & DOM Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fully keyboard-navigable, mobile-first, accessible DOM shell with three working views (Neuromap placeholder · Reference · Worklist) reading from the canonical `DATASET`, a global command palette (`⌘K`/`Ctrl+K`), and a mock render backend stub so the app boots and all non-graph features work. The actual graph rendering lands in Plan 03 (WebGL2) and Plan 04 (WebGPU).

**Architecture:** Plain ES modules, no framework. Single `<canvas id="gpu">` z=0, DOM shell z=1, overlays z=2. ~40-line signal store drives reactive DOM updates. Hash-based router (`#/neuromap`, `#/reference`, `#/worklist`). Every view exposes `{ mount, unmount }` and consumes the store + a small `api` for palette/focus control. Mock render backend implements the `RenderBackend` contract with no-ops so Plan 03 can swap in the real implementation by changing one factory line.

**Tech Stack:** Node 20, vitest (with `jsdom` environment for DOM tests added here), plain ES modules, CSS container queries, no bundler. fuzzy-search inline (~30 LOC, no dep).

**Reference spec:** `docs/superpowers/specs/2026-04-17-claude-atlas-design.md` — Sections 4 (views & interactions), 5 (architecture), 7.1 (render backend interface), 9 (mobile/a11y).

**Enters with:** 21 commits on `main` from Plan 01. Dataset frozen and validated at `src/data/data.js`. Tokens/fonts/shell CSS in `styles/`. 35 vitest assertions green.

---

## Task 1: Add `jsdom` test environment for DOM tests

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mjs`

- [ ] **Step 1: Install jsdom**

Run: `npm install --save-dev jsdom@^25`
Expected: lockfile updated; `jsdom` in devDependencies.

- [ ] **Step 2: Write `vitest.config.mjs`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
  },
});
```

- [ ] **Step 3: Write `tests/setup.js`**

```js
// Silence noisy jsdom warnings for features we don't test here.
const origConsoleError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("Not implemented: HTMLCanvasElement.prototype.getContext")) return;
  origConsoleError(...args);
};
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: still 35/35 green.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.mjs tests/setup.js
git commit -m "chore(test): add jsdom environment for DOM-aware tests"
```

---

## Task 2: Signal store — TDD

**Files:**
- Create: `tests/signal-store.test.js`
- Create: `src/core/store.js`

- [ ] **Step 1: Write the failing test**

`tests/signal-store.test.js`:
```js
import { describe, it, expect, vi } from "vitest";
import { createStore } from "../src/core/store.js";

describe("createStore", () => {
  it("exposes initial state via get()", () => {
    const s = createStore({ a: 1, b: "x" });
    expect(s.get()).toEqual({ a: 1, b: "x" });
  });

  it("notifies subscribers on set()", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    s.subscribe(spy);
    s.set({ n: 1 });
    expect(spy).toHaveBeenCalledWith({ n: 1 }, { n: 0 });
  });

  it("does not notify when the new state is referentially equal", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    s.subscribe(spy);
    const cur = s.get();
    s.set(cur);
    expect(spy).not.toHaveBeenCalled();
  });

  it("supports unsubscribe", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    const off = s.subscribe(spy);
    off();
    s.set({ n: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("accepts an updater function", () => {
    const s = createStore({ n: 0 });
    s.set((prev) => ({ n: prev.n + 1 }));
    expect(s.get()).toEqual({ n: 1 });
  });

  it("shallow-merges when patch() is used", () => {
    const s = createStore({ a: 1, b: 2 });
    s.patch({ b: 3 });
    expect(s.get()).toEqual({ a: 1, b: 3 });
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run tests/signal-store.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/store.js`**

```js
/**
 * Tiny reactive store. Subscribers are called with (next, prev).
 * Referentially-equal writes are skipped.
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  const subs = new Set();

  function get() { return state; }

  function set(next) {
    const resolved = typeof next === "function" ? next(state) : next;
    if (Object.is(resolved, state)) return;
    const prev = state;
    state = resolved;
    for (const s of subs) s(state, prev);
  }

  function patch(partial) {
    set({ ...state, ...partial });
  }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return { get, set, patch, subscribe };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run tests/signal-store.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/store.js tests/signal-store.test.js
git commit -m "feat(core): reactive signal store with subscribe/patch"
```

---

## Task 3: Router (hash-based) — TDD

**Files:**
- Create: `tests/router.test.js`
- Create: `src/core/router.js`

- [ ] **Step 1: Write the failing test**

`tests/router.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter } from "../src/core/router.js";

beforeEach(() => { location.hash = ""; });

describe("createRouter", () => {
  it("parses current hash on start", () => {
    location.hash = "#/reference";
    const r = createRouter();
    r.start();
    expect(r.current()).toBe("reference");
  });

  it("defaults to 'neuromap' when hash is empty", () => {
    const r = createRouter();
    r.start();
    expect(r.current()).toBe("neuromap");
  });

  it("navigates to a new view via go()", () => {
    const r = createRouter();
    r.start();
    r.go("worklist");
    expect(r.current()).toBe("worklist");
    expect(location.hash).toBe("#/worklist");
  });

  it("notifies subscribers on hash change", () => {
    const r = createRouter();
    const spy = vi.fn();
    r.start();
    r.subscribe(spy);
    r.go("reference");
    expect(spy).toHaveBeenCalledWith("reference", "neuromap");
  });

  it("rejects unknown views", () => {
    const r = createRouter();
    r.start();
    expect(() => r.go("dashboard")).toThrow(/unknown view/i);
  });

  it("stops listening after stop()", () => {
    const r = createRouter();
    const spy = vi.fn();
    r.start();
    r.subscribe(spy);
    r.stop();
    r.go("reference"); // does not throw but also doesn't notify
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/router.js`**

```js
const VIEWS = ["neuromap", "reference", "worklist"];

function parseHash() {
  const m = location.hash.match(/^#\/(\w+)/);
  if (m && VIEWS.includes(m[1])) return m[1];
  return "neuromap";
}

export function createRouter() {
  let current = "neuromap";
  let started = false;
  const subs = new Set();

  function onHashChange() {
    if (!started) return;
    const next = parseHash();
    if (next === current) return;
    const prev = current;
    current = next;
    for (const s of subs) s(current, prev);
  }

  return {
    start() {
      started = true;
      current = parseHash();
      window.addEventListener("hashchange", onHashChange);
    },
    stop() {
      started = false;
      window.removeEventListener("hashchange", onHashChange);
    },
    current() { return current; },
    go(view) {
      if (!VIEWS.includes(view)) throw new Error(`unknown view: ${view}`);
      if (!started) {
        current = view;
        return;
      }
      location.hash = `#/${view}`;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export { VIEWS };
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/router.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/router.js tests/router.test.js
git commit -m "feat(core): hash-based router with subscribe and stop"
```

---

## Task 4: Render backend interface + mock implementation

**Files:**
- Create: `src/render/backend.js`
- Create: `src/render/mock-backend.js`
- Create: `tests/mock-backend.test.js`

- [ ] **Step 1: Write the interface contract**

`src/render/backend.js`:
```js
/**
 * @typedef {Object} LayoutHint
 * @property {"force"|"grid"|"flow"|"radial"} mode
 * @property {(n: any) => boolean} [filter]
 * @property {{x:number,y:number,w:number,h:number}} cameraFraction
 * @property {string[]} [highlights]
 */

/**
 * @typedef {Object} RenderBackend
 * @property {(canvas: HTMLCanvasElement) => Promise<void>} init
 * @property {(nodes: any[], edges: any[]) => void} loadScene
 * @property {(hint: LayoutHint, durationMs: number) => void} setLayout
 * @property {(nodeId: string | null) => void} setFocus
 * @property {(nodeIds: string[]) => void} setHighlight
 * @property {(rect: {x:number,y:number,w:number,h:number}) => void} setCameraFraction
 * @property {() => void} render
 * @property {() => void} destroy
 * @property {string} name
 */

export const BACKEND_METHODS = [
  "init", "loadScene", "setLayout", "setFocus", "setHighlight",
  "setCameraFraction", "render", "destroy",
];
```

- [ ] **Step 2: Write the mock**

`src/render/mock-backend.js`:
```js
import { BACKEND_METHODS } from "./backend.js";

/** @returns {import("./backend.js").RenderBackend} */
export function createMockBackend() {
  const log = [];
  const backend = {
    name: "mock",
    async init() { log.push(["init"]); },
    loadScene(nodes, edges) { log.push(["loadScene", nodes.length, edges.length]); },
    setLayout(hint, ms) { log.push(["setLayout", hint.mode, ms]); },
    setFocus(id) { log.push(["setFocus", id]); },
    setHighlight(ids) { log.push(["setHighlight", ids.length]); },
    setCameraFraction(rect) { log.push(["setCameraFraction", rect]); },
    render() { log.push(["render"]); },
    destroy() { log.push(["destroy"]); },
    _log: log,
  };
  return backend;
}
```

- [ ] **Step 3: Write the test**

`tests/mock-backend.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createMockBackend } from "../src/render/mock-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("mock backend", () => {
  it("implements every RenderBackend method", () => {
    const b = createMockBackend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("mock");
  });

  it("records calls for verification", async () => {
    const b = createMockBackend();
    await b.init();
    b.loadScene([{ id: "x" }], []);
    b.setLayout({ mode: "force", cameraFraction: { x:0, y:0, w:1, h:1 } }, 300);
    b.render();
    expect(b._log).toEqual([
      ["init"],
      ["loadScene", 1, 0],
      ["setLayout", "force", 300],
      ["render"],
    ]);
  });
});
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/mock-backend.test.js`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/backend.js src/render/mock-backend.js tests/mock-backend.test.js
git commit -m "feat(render): RenderBackend contract + mock impl"
```

---

## Task 5: `index.html` entry + `src/core/bootstrap.js`

**Files:**
- Create: `index.html`
- Create: `src/core/bootstrap.js`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Claude Atlas</title>
  <meta name="color-scheme" content="dark" />
  <link rel="stylesheet" href="./styles/shell.css" />
</head>
<body>
  <canvas id="gpu" aria-hidden="true"></canvas>
  <div id="shell" data-view="neuromap">
    <header id="topbar" role="banner"></header>
    <main id="view" role="main" aria-live="polite"></main>
    <nav id="bottom-tabs" role="navigation" aria-label="Views"></nav>
    <div id="overlays" aria-live="polite"></div>
  </div>
  <script type="module" src="./src/core/bootstrap.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/core/bootstrap.js`**

```js
import { DATASET } from "../data/data.js";
import { createStore } from "./store.js";
import { createRouter, VIEWS } from "./router.js";
import { createMockBackend } from "../render/mock-backend.js";

const store = createStore({
  view: "neuromap",
  focusedId: null,
  highlight: [],
  paletteOpen: false,
  theme: "dark",
  ready: false,
});

const router = createRouter();
const backend = createMockBackend();

async function main() {
  const canvas = document.getElementById("gpu");
  await backend.init(canvas);
  backend.loadScene(DATASET.nodes, DATASET.edges);

  router.start();
  store.patch({ view: router.current(), ready: true });

  router.subscribe((next) => store.patch({ view: next }));

  document.getElementById("shell").dataset.view = store.get().view;
  store.subscribe((s, p) => {
    if (s.view !== p.view) {
      document.getElementById("shell").dataset.view = s.view;
    }
  });

  document.body.dataset.ready = "true";
}

main().catch((err) => {
  document.body.dataset.ready = "error";
  document.body.textContent = `Claude Atlas failed to boot: ${err.message}`;
  throw err;
});

export { store, router, backend, VIEWS };
```

- [ ] **Step 3: Smoke-test in dev server**

Run:
```bash
npx http-server -s -p 4173 &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/
kill $SERVER_PID 2>/dev/null
```
Expected: 200. (The app boots but views aren't mounted yet — next tasks add them.)

- [ ] **Step 4: Commit**

```bash
git add index.html src/core/bootstrap.js
git commit -m "feat(core): index.html + bootstrap wires store/router/mock backend"
```

---

## Task 6: Top bar UI

**Files:**
- Create: `src/ui/topbar.js`
- Create: `styles/shell.css` — append top-bar rules (existing file; don't recreate)
- Create: `tests/topbar.test.js`

- [ ] **Step 1: Write the test**

`tests/topbar.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountTopbar } from "../src/ui/topbar.js";

beforeEach(() => {
  document.body.innerHTML = `<header id="topbar"></header>`;
});

describe("mountTopbar", () => {
  it("renders wordmark, three view buttons, and palette hint", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    const root = document.getElementById("topbar");
    expect(root.querySelector('[data-role="wordmark"]').textContent).toMatch(/ATLAS/i);
    const tabs = root.querySelectorAll('[data-role="view-tab"]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toMatch(/neuromap/i);
    expect(root.querySelector('[data-role="palette-hint"]')).toBeTruthy();
  });

  it("marks the current view's tab as [aria-current]", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "reference" }, api);
    const refTab = document.querySelector('[data-role="view-tab"][data-view="reference"]');
    expect(refTab.getAttribute("aria-current")).toBe("page");
  });

  it("calls api.go when a tab is clicked", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="view-tab"][data-view="worklist"]').click();
    expect(api.go).toHaveBeenCalledWith("worklist");
  });

  it("opens the palette when the hint is clicked", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="palette-hint"]').click();
    expect(api.openPalette).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/topbar.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/topbar.js`**

```js
import { VIEWS } from "../core/router.js";

export function mountTopbar({ currentView }, api) {
  const root = document.getElementById("topbar");
  root.innerHTML = `
    <div class="tb-left">
      <span data-role="wordmark">ATLAS</span>
    </div>
    <div class="tb-center" role="tablist">
      ${VIEWS.map((v) => `
        <button type="button" data-role="view-tab" data-view="${v}"
                ${v === currentView ? 'aria-current="page"' : ""}>${v}</button>
      `).join("")}
    </div>
    <div class="tb-right">
      <button type="button" data-role="palette-hint" aria-label="Open command palette">
        <span class="kbd">⌘K</span>
      </button>
    </div>
  `;
  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="view-tab"]');
    if (tab) { api.go(tab.dataset.view); return; }
    const hint = e.target.closest('[data-role="palette-hint"]');
    if (hint) { api.openPalette(); return; }
  });
  return function updateTopbar(view) {
    root.querySelectorAll('[data-role="view-tab"]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };
}
```

- [ ] **Step 4: Append CSS to `styles/shell.css`**

```css
/* top bar */
#topbar {
  position: fixed; inset: 0 0 auto 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  height: 56px;
  background: linear-gradient(to bottom, rgba(7,7,15,0.9), rgba(7,7,15,0));
  z-index: 10;
}
#topbar .tb-left [data-role="wordmark"] {
  font-family: var(--ff-display); font-weight: 700; letter-spacing: 0.1em;
  color: var(--fg-1);
}
#topbar .tb-center { display: flex; gap: 4px; }
#topbar [data-role="view-tab"] {
  background: transparent; border: 0; color: var(--fg-2);
  padding: 6px 12px; border-radius: var(--r-sm); cursor: pointer;
  font-size: 13px; text-transform: capitalize;
  transition: color var(--d-micro) var(--ease), background var(--d-micro) var(--ease);
}
#topbar [data-role="view-tab"]:hover { color: var(--fg-1); background: var(--bg-2); }
#topbar [data-role="view-tab"][aria-current="page"] { color: var(--fg-1); background: var(--bg-3); }
#topbar [data-role="palette-hint"] {
  background: var(--bg-2); border: 1px solid var(--line);
  color: var(--fg-2); padding: 4px 10px; border-radius: var(--r-sm);
  cursor: pointer; font-size: 12px; display: flex; gap: 6px; align-items: center;
}
#topbar .kbd { font-family: var(--ff-mono); font-size: 11px; }

@media (max-width: 480px) {
  #topbar .tb-center { display: none; }  /* mobile: use bottom tabs instead */
}
```

- [ ] **Step 5: Pass**

Run: `npx vitest run tests/topbar.test.js`
Expected: 4/4 pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/topbar.js styles/shell.css tests/topbar.test.js
git commit -m "feat(ui): top bar with view tabs and palette hint"
```

---

## Task 7: Bottom mobile tab bar

**Files:**
- Create: `src/ui/bottom-tabs.js`
- Modify: `styles/shell.css` — append
- Create: `tests/bottom-tabs.test.js`

- [ ] **Step 1: Write the test**

`tests/bottom-tabs.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountBottomTabs } from "../src/ui/bottom-tabs.js";

beforeEach(() => {
  document.body.innerHTML = `<nav id="bottom-tabs"></nav>`;
});

describe("mountBottomTabs", () => {
  it("renders three view buttons", () => {
    mountBottomTabs({ currentView: "neuromap" }, { go: vi.fn() });
    expect(document.querySelectorAll('[data-role="bt-tab"]').length).toBe(3);
  });

  it("marks current view with aria-current=page", () => {
    mountBottomTabs({ currentView: "worklist" }, { go: vi.fn() });
    const b = document.querySelector('[data-role="bt-tab"][data-view="worklist"]');
    expect(b.getAttribute("aria-current")).toBe("page");
  });

  it("calls api.go on tap", () => {
    const api = { go: vi.fn() };
    mountBottomTabs({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="bt-tab"][data-view="reference"]').click();
    expect(api.go).toHaveBeenCalledWith("reference");
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/bottom-tabs.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/bottom-tabs.js`**

```js
import { VIEWS } from "../core/router.js";

const ICONS = { neuromap: "◉", reference: "≡", worklist: "✓" };

export function mountBottomTabs({ currentView }, api) {
  const root = document.getElementById("bottom-tabs");
  root.innerHTML = VIEWS.map((v) => `
    <button type="button" data-role="bt-tab" data-view="${v}"
            ${v === currentView ? 'aria-current="page"' : ""}>
      <span class="bt-icon" aria-hidden="true">${ICONS[v]}</span>
      <span class="bt-label">${v}</span>
    </button>
  `).join("");
  root.addEventListener("click", (e) => {
    const t = e.target.closest('[data-role="bt-tab"]');
    if (t) api.go(t.dataset.view);
  });
  return function update(view) {
    root.querySelectorAll('[data-role="bt-tab"]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };
}
```

- [ ] **Step 4: Append CSS**

Append to `styles/shell.css`:
```css
/* bottom tabs (mobile only) */
#bottom-tabs {
  position: fixed; inset: auto 0 0 0;
  display: none;
  background: rgba(7,7,15,0.96);
  border-top: 1px solid var(--line);
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  z-index: 10;
}
#bottom-tabs [data-role="bt-tab"] {
  flex: 1; background: transparent; border: 0; color: var(--fg-2);
  padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 11px; cursor: pointer; min-height: 48px; min-width: 48px;
  border-radius: var(--r-sm); text-transform: capitalize;
}
#bottom-tabs [data-role="bt-tab"]:active { background: var(--bg-3); }
#bottom-tabs [data-role="bt-tab"][aria-current="page"] { color: var(--fg-1); }
#bottom-tabs .bt-icon { font-size: 18px; }

@media (max-width: 480px) {
  #bottom-tabs { display: flex; }
}
```

- [ ] **Step 5: Pass**

Run: `npx vitest run tests/bottom-tabs.test.js`
Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/bottom-tabs.js styles/shell.css tests/bottom-tabs.test.js
git commit -m "feat(ui): bottom tab bar for mobile view switching"
```

---

## Task 8: Reference view

**Files:**
- Create: `src/views/reference.js`
- Create: `styles/reference.css`
- Modify: `styles/shell.css` — `@import "./reference.css";` at top
- Create: `tests/reference-view.test.js`

- [ ] **Step 1: Write the test**

`tests/reference-view.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountReference } from "../src/views/reference.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
});

describe("reference view", () => {
  it("renders one <section> per node in the reference view", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const sections = document.querySelectorAll('#view [data-role="ref-entry"]');
    const expected = DATASET.nodes.filter((n) => n.views.includes("reference")).length;
    expect(sections.length).toBe(expected);
  });

  it("section headings include the node name", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const first = document.querySelector('#view [data-role="ref-entry"] h2');
    expect(first.textContent.length).toBeGreaterThan(0);
  });

  it("domain tabs filter entries", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const worklistTab = document.querySelector('[data-role="ref-domain-tab"][data-domain="worklist"]');
    worklistTab.click();
    const visible = document.querySelectorAll('#view [data-role="ref-entry"]:not([hidden])');
    for (const s of visible) {
      expect(s.dataset.domain).toBe("worklist");
    }
  });

  it("has a real <section id> per entry so find-in-page works", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const ids = Array.from(document.querySelectorAll('[data-role="ref-entry"]')).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    expect(ids[0]).toMatch(/^ref-/);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/reference-view.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/views/reference.js`**

```js
const DOMAINS = [
  { id: "all", label: "All" },
  { id: "claude", label: "Claude Tools" },
  { id: "worklist", label: "Worklist" },
  { id: "concept", label: "Concepts" },
];

function renderEntry(n) {
  const syntax = n.syntax ? `<pre><code>${escapeHtml(n.syntax)}</code></pre>` : "";
  const examples = (n.examples ?? []).map((e) =>
    `<pre><code>${escapeHtml(e)}</code></pre>`
  ).join("");
  const tags = n.tags.map((t) => `<span class="ref-tag">${escapeHtml(t)}</span>`).join("");
  return `
    <section class="ref-entry" data-role="ref-entry" data-domain="${n.domain}" data-kind="${n.kind}" id="ref-${n.id.replace(/\./g, "-")}">
      <header>
        <span class="ref-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
        <h2>${escapeHtml(n.name)}</h2>
      </header>
      <p class="ref-lede">${escapeHtml(n.oneLine)}</p>
      <div class="ref-body">${escapeHtml(n.description).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>")}</div>
      ${syntax}
      ${examples}
      <div class="ref-tags">${tags}</div>
    </section>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

export function mountReference(dataset, api) {
  const root = document.getElementById("view");
  const nodes = dataset.nodes.filter((n) => n.views.includes("reference"));
  root.innerHTML = `
    <div class="ref-root">
      <nav class="ref-tabs" role="tablist">
        ${DOMAINS.map((d) => `
          <button type="button" role="tab" data-role="ref-domain-tab" data-domain="${d.id}"
                  ${d.id === "all" ? 'aria-selected="true"' : 'aria-selected="false"'}>${d.label}</button>
        `).join("")}
      </nav>
      <div class="ref-list">
        ${nodes.map(renderEntry).join("")}
      </div>
    </div>
  `;

  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="ref-domain-tab"]');
    if (!tab) return;
    const domain = tab.dataset.domain;
    root.querySelectorAll('[data-role="ref-domain-tab"]').forEach((t) => {
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    root.querySelectorAll('[data-role="ref-entry"]').forEach((s) => {
      const match = domain === "all"
        || (domain === "concept" && s.dataset.kind === "concept")
        || (domain !== "concept" && s.dataset.domain === domain);
      s.hidden = !match;
    });
  });

  return function unmount() { root.innerHTML = ""; };
}
```

- [ ] **Step 4: Write `styles/reference.css`**

```css
.ref-root { padding: 72px 20px 24px; max-width: 860px; margin: 0 auto; overflow-y: auto; max-height: 100vh; }
.ref-tabs {
  display: flex; gap: 4px; padding: 4px;
  background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-md);
  position: sticky; top: 72px; z-index: 5;
  margin-bottom: 24px;
}
.ref-tabs button {
  background: transparent; border: 0; color: var(--fg-2); padding: 8px 14px;
  border-radius: var(--r-sm); cursor: pointer; font-size: 13px;
  transition: color var(--d-micro) var(--ease), background var(--d-micro) var(--ease);
}
.ref-tabs button[aria-selected="true"] { color: var(--fg-1); background: var(--bg-3); }
.ref-entry {
  padding: 18px 16px 20px; border-bottom: 1px solid var(--line);
  scroll-margin-top: 140px;
}
.ref-entry header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; }
.ref-badge {
  font-family: var(--ff-mono); font-size: 10px; letter-spacing: 0.1em;
  padding: 2px 6px; border-radius: 3px;
  background: hsl(var(--hue) 40% 20%); color: hsl(var(--hue) 85% 72%);
}
.ref-entry h2 { font-size: 20px; font-weight: 600; font-family: var(--ff-body); letter-spacing: -0.01em; }
.ref-lede { color: var(--fg-2); font-size: 14px; margin-bottom: 12px; }
.ref-body { color: var(--fg-1); font-size: 15px; line-height: 1.7; margin-bottom: 12px; }
.ref-body p + p { margin-top: 12px; }
.ref-entry pre {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-sm);
  padding: 10px 12px; margin: 10px 0; overflow-x: auto;
}
.ref-entry pre code { font-family: var(--ff-mono); font-size: 12px; color: var(--fg-1); }
.ref-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 12px; }
.ref-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--bg-2); color: var(--fg-3); border: 1px solid var(--line);
}
```

- [ ] **Step 5: Prepend `@import` to `styles/shell.css`**

After the existing `@import url("./fonts.css");` line, add:
```css
@import url("./reference.css");
```

- [ ] **Step 6: Pass**

Run: `npx vitest run tests/reference-view.test.js`
Expected: 4/4 pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/reference.js styles/reference.css styles/shell.css tests/reference-view.test.js
git commit -m "feat(view): reference view with domain tabs and semantic sections"
```

---

## Task 9: Worklist view — commands tab

**Files:**
- Create: `src/views/worklist.js`
- Create: `styles/worklist.css`
- Modify: `styles/shell.css` — `@import "./worklist.css";`
- Create: `tests/worklist-view.test.js`

- [ ] **Step 1: Write the test (commands tab only)**

`tests/worklist-view.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountWorklist } from "../src/views/worklist.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
  localStorage.clear();
});

describe("worklist view — commands tab", () => {
  it("renders three tab buttons (Commands / Quiz / Insights)", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const tabs = document.querySelectorAll('[data-role="wl-tab"]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toMatch(/commands/i);
    expect(tabs[1].textContent).toMatch(/quiz/i);
    expect(tabs[2].textContent).toMatch(/insights/i);
  });

  it("Commands tab lists every wl.* command", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const entries = document.querySelectorAll('[data-role="wl-cmd-entry"]');
    const expected = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command").length;
    expect(entries.length).toBe(expected);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/worklist-view.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/views/worklist.js` (commands tab only for now; quiz + insights in tasks 10 and 11)**

```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

function renderCommand(n) {
  return `
    <div class="wl-cmd" data-role="wl-cmd-entry" id="wl-${n.id.replace(/\./g, "-")}">
      <header>
        <span class="wl-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
        <h3>${escapeHtml(n.name)}</h3>
      </header>
      <p class="wl-lede">${escapeHtml(n.oneLine)}</p>
      <pre><code>${escapeHtml(n.syntax ?? n.name)}</code></pre>
      ${(n.examples ?? []).map((e) => `<pre><code>${escapeHtml(e)}</code></pre>`).join("")}
    </div>
  `;
}

export function mountWorklist(dataset, api) {
  const root = document.getElementById("view");
  const commands = dataset.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");

  root.innerHTML = `
    <div class="wl-root">
      <nav class="wl-tabs" role="tablist">
        <button type="button" role="tab" data-role="wl-tab" data-tab="commands" aria-selected="true">Commands</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="quiz" aria-selected="false">Quiz</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="insights" aria-selected="false">Insights</button>
      </nav>
      <section data-role="wl-panel" data-tab="commands">
        ${commands.map(renderCommand).join("")}
      </section>
      <section data-role="wl-panel" data-tab="quiz" hidden></section>
      <section data-role="wl-panel" data-tab="insights" hidden></section>
    </div>
  `;

  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="wl-tab"]');
    if (!tab) return;
    const target = tab.dataset.tab;
    root.querySelectorAll('[data-role="wl-tab"]').forEach((t) => {
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    root.querySelectorAll('[data-role="wl-panel"]').forEach((p) => {
      p.hidden = p.dataset.tab !== target;
    });
  });

  return function unmount() { root.innerHTML = ""; };
}
```

- [ ] **Step 4: Write `styles/worklist.css`**

```css
.wl-root { padding: 72px 20px 24px; max-width: 860px; margin: 0 auto; overflow-y: auto; max-height: 100vh; }
.wl-tabs {
  display: flex; gap: 4px; padding: 4px;
  background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-md);
  position: sticky; top: 72px; z-index: 5;
  margin-bottom: 24px;
}
.wl-tabs button {
  flex: 1;
  background: transparent; border: 0; color: var(--fg-2); padding: 8px 14px;
  border-radius: var(--r-sm); cursor: pointer; font-size: 13px;
  transition: color var(--d-micro) var(--ease), background var(--d-micro) var(--ease);
}
.wl-tabs button[aria-selected="true"] { color: var(--fg-1); background: var(--bg-3); }
.wl-cmd { padding: 14px 14px 18px; margin-bottom: 10px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--r-md); }
.wl-cmd header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
.wl-badge {
  font-family: var(--ff-mono); font-size: 10px; letter-spacing: 0.1em;
  padding: 2px 6px; border-radius: 3px;
  background: hsl(var(--hue) 40% 20%); color: hsl(var(--hue) 85% 72%);
}
.wl-cmd h3 { font-size: 16px; font-family: var(--ff-mono); font-weight: 500; color: var(--fg-1); }
.wl-lede { color: var(--fg-2); font-size: 13px; margin-bottom: 10px; }
.wl-cmd pre { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 12px; margin-top: 8px; overflow-x: auto; }
.wl-cmd pre code { font-family: var(--ff-mono); font-size: 12px; color: var(--fg-1); }
```

- [ ] **Step 5: Import in shell.css**

Append to `styles/shell.css` @imports:
```css
@import url("./worklist.css");
```

- [ ] **Step 6: Pass**

Run: `npx vitest run tests/worklist-view.test.js`
Expected: 2/2 pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/worklist.js styles/worklist.css styles/shell.css tests/worklist-view.test.js
git commit -m "feat(view): worklist view shell with Commands tab"
```

---

## Task 10: Worklist view — Quiz tab with localStorage score

**Files:**
- Modify: `src/views/worklist.js` — add quiz rendering
- Modify: `styles/worklist.css` — append
- Modify: `tests/worklist-view.test.js` — append quiz describe block

- [ ] **Step 1: Write the new tests**

Append to `tests/worklist-view.test.js` (inside the same file, new describe):
```js
describe("worklist view — quiz tab", () => {
  it("renders one card per quiz question", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const cards = document.querySelectorAll('[data-role="wl-quiz-card"]');
    expect(cards.length).toBe(DATASET.quizzes.length);
  });

  it("shows explanation after selecting a choice", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstChoice = document.querySelector('[data-role="wl-choice"]');
    firstChoice.click();
    const card = firstChoice.closest('[data-role="wl-quiz-card"]');
    const explanation = card.querySelector('[data-role="wl-explanation"]');
    expect(explanation.hidden).toBe(false);
  });

  it("persists correct-count to localStorage", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstQuiz = DATASET.quizzes[0];
    const correctButton = document.querySelector(
      `[data-role="wl-choice"][data-quiz="${firstQuiz.id}"][data-choice="${firstQuiz.correctChoiceId}"]`
    );
    correctButton.click();
    const raw = localStorage.getItem("atlas.quiz.v1");
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw);
    expect(state[firstQuiz.id]).toBe(firstQuiz.correctChoiceId);
  });

  it("highlights related nodes via api.highlight on choice click", () => {
    const api = { focus: vi.fn(), highlight: vi.fn() };
    mountWorklist(DATASET, api);
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstChoice = document.querySelector('[data-role="wl-choice"]');
    firstChoice.click();
    expect(api.highlight).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/worklist-view.test.js`
Expected: FAIL — quiz panel is empty.

- [ ] **Step 3: Modify `src/views/worklist.js` — add quiz rendering**

At the top of `worklist.js`, add the storage helpers and quiz rendering:

```js
const STORAGE_KEY = "atlas.quiz.v1";

function loadQuizState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveQuizState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function renderQuiz(q, chosenId) {
  const choices = q.choices.map((c) => {
    const isChosen = chosenId === c.id;
    const isCorrect = c.id === q.correctChoiceId;
    const classes = ["wl-choice"];
    if (chosenId) {
      if (isCorrect) classes.push("is-correct");
      if (isChosen && !isCorrect) classes.push("is-wrong");
    }
    return `<button type="button" class="${classes.join(" ")}" data-role="wl-choice"
              data-quiz="${q.id}" data-choice="${c.id}" ${chosenId ? "disabled" : ""}>${escapeHtml(c.text)}</button>`;
  }).join("");
  return `
    <div class="wl-quiz-card" data-role="wl-quiz-card" data-quiz="${q.id}">
      <p class="wl-prompt">${escapeHtml(q.prompt)}</p>
      <div class="wl-choices">${choices}</div>
      <p class="wl-explanation" data-role="wl-explanation" ${chosenId ? "" : "hidden"}>${escapeHtml(q.explanation)}</p>
    </div>
  `;
}

function renderQuizPanel(quizzes, state) {
  return `<div class="wl-quiz-list">${quizzes.map((q) => renderQuiz(q, state[q.id] ?? null)).join("")}</div>`;
}
```

In `mountWorklist`, find the `data-tab="quiz"` panel and populate it, and wire the click handler. Replace the existing `mountWorklist` body so it looks like this:

```js
export function mountWorklist(dataset, api) {
  const root = document.getElementById("view");
  const commands = dataset.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
  let quizState = loadQuizState();

  root.innerHTML = `
    <div class="wl-root">
      <nav class="wl-tabs" role="tablist">
        <button type="button" role="tab" data-role="wl-tab" data-tab="commands" aria-selected="true">Commands</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="quiz" aria-selected="false">Quiz</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="insights" aria-selected="false">Insights</button>
      </nav>
      <section data-role="wl-panel" data-tab="commands">
        ${commands.map(renderCommand).join("")}
      </section>
      <section data-role="wl-panel" data-tab="quiz" hidden>
        ${renderQuizPanel(dataset.quizzes, quizState)}
      </section>
      <section data-role="wl-panel" data-tab="insights" hidden></section>
    </div>
  `;

  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="wl-tab"]');
    if (tab) {
      const target = tab.dataset.tab;
      root.querySelectorAll('[data-role="wl-tab"]').forEach((t) => {
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      root.querySelectorAll('[data-role="wl-panel"]').forEach((p) => {
        p.hidden = p.dataset.tab !== target;
      });
      return;
    }
    const choice = e.target.closest('[data-role="wl-choice"]');
    if (choice) {
      const qid = choice.dataset.quiz;
      const cid = choice.dataset.choice;
      if (quizState[qid]) return; // already answered
      quizState = { ...quizState, [qid]: cid };
      saveQuizState(quizState);
      // highlight related nodes
      const quiz = dataset.quizzes.find((q) => q.id === qid);
      const chosenChoice = quiz.choices.find((c) => c.id === cid);
      api.highlight(chosenChoice.nodeIds ?? []);
      // re-render just this card
      const card = choice.closest('[data-role="wl-quiz-card"]');
      card.outerHTML = renderQuiz(quiz, cid);
      return;
    }
  });

  return function unmount() { root.innerHTML = ""; };
}
```

- [ ] **Step 4: Append quiz styles to `styles/worklist.css`**

```css
.wl-quiz-card { padding: 16px; margin-bottom: 14px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--r-md); }
.wl-prompt { font-size: 15px; font-weight: 500; margin-bottom: 12px; color: var(--fg-1); }
.wl-choices { display: flex; flex-direction: column; gap: 6px; }
.wl-choice {
  text-align: left; padding: 10px 14px; border-radius: var(--r-sm);
  background: var(--bg-2); border: 1px solid var(--line); color: var(--fg-1);
  cursor: pointer; font-size: 14px; min-height: 44px;
  transition: background var(--d-micro) var(--ease), border-color var(--d-micro) var(--ease);
}
.wl-choice:hover:not([disabled]) { background: var(--bg-3); }
.wl-choice.is-correct { background: color-mix(in srgb, var(--ok) 18%, var(--bg-2)); border-color: var(--ok); color: var(--fg-1); }
.wl-choice.is-wrong { background: color-mix(in srgb, var(--err) 18%, var(--bg-2)); border-color: var(--err); color: var(--fg-1); }
.wl-choice[disabled] { cursor: default; }
.wl-explanation { margin-top: 12px; color: var(--fg-2); font-size: 13px; line-height: 1.6; padding: 10px 12px; background: var(--bg-2); border-left: 2px solid var(--accent); border-radius: 0 var(--r-sm) var(--r-sm) 0; }
```

- [ ] **Step 5: Pass**

Run: `npx vitest run tests/worklist-view.test.js`
Expected: 6/6 pass (2 commands + 4 quiz).

- [ ] **Step 6: Commit**

```bash
git add src/views/worklist.js styles/worklist.css tests/worklist-view.test.js
git commit -m "feat(view): worklist quiz tab with localStorage persistence"
```

---

## Task 11: Worklist view — Insights tab

**Files:**
- Modify: `src/views/worklist.js` — render insights panel
- Modify: `tests/worklist-view.test.js` — add insights describe block

- [ ] **Step 1: Write tests**

Append:
```js
describe("worklist view — insights tab", () => {
  it("renders one card per concept node", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="insights"]').click();
    const cards = document.querySelectorAll('[data-role="wl-insight-card"]');
    const expected = DATASET.nodes.filter((n) => n.kind === "concept").length;
    expect(cards.length).toBe(expected);
  });
});
```

- [ ] **Step 2: Modify `worklist.js`**

Add near the other render helpers:
```js
function renderInsight(n) {
  return `
    <article class="wl-insight" data-role="wl-insight-card" id="wl-${n.id.replace(/\./g, "-")}">
      <h3>${escapeHtml(n.name)}</h3>
      <p class="wl-insight-lede">${escapeHtml(n.oneLine)}</p>
      <p class="wl-insight-body">${escapeHtml(n.description)}</p>
    </article>
  `;
}
```

In the `root.innerHTML` template, replace the empty insights panel with:
```js
<section data-role="wl-panel" data-tab="insights" hidden>
  ${dataset.nodes.filter((n) => n.kind === "concept").map(renderInsight).join("")}
</section>
```

- [ ] **Step 3: Append styles to `styles/worklist.css`**

```css
.wl-insight { padding: 18px; margin-bottom: 12px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--r-md); }
.wl-insight h3 { font-size: 17px; margin-bottom: 6px; color: var(--fg-1); }
.wl-insight-lede { color: var(--accent); font-size: 13px; margin-bottom: 10px; font-weight: 500; }
.wl-insight-body { color: var(--fg-1); font-size: 14px; line-height: 1.7; }
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/worklist-view.test.js`
Expected: 7/7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/views/worklist.js styles/worklist.css tests/worklist-view.test.js
git commit -m "feat(view): worklist insights tab"
```

---

## Task 12: Neuromap placeholder view

**Files:**
- Create: `src/views/neuromap.js`
- Modify: `styles/shell.css` — append
- Create: `tests/neuromap-view.test.js`

- [ ] **Step 1: Write the test**

`tests/neuromap-view.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountNeuromap } from "../src/views/neuromap.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
});

describe("neuromap placeholder view", () => {
  it("renders a placeholder notice + category filter chips", () => {
    mountNeuromap(DATASET, { focus: vi.fn() });
    expect(document.querySelector('[data-role="nm-placeholder"]')).toBeTruthy();
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    expect(chips.length).toBeGreaterThan(0);
  });

  it("includes one chip per unique category in the neuromap dataset", () => {
    mountNeuromap(DATASET, { focus: vi.fn() });
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    const cats = new Set(DATASET.nodes.filter((n) => n.views.includes("neuromap")).map((n) => n.category));
    expect(chips.length).toBe(cats.size);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/neuromap-view.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/views/neuromap.js`**

```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

export function mountNeuromap(dataset, api) {
  const root = document.getElementById("view");
  const nodes = dataset.nodes.filter((n) => n.views.includes("neuromap"));
  const categories = [...new Set(nodes.map((n) => n.category))].sort();

  root.innerHTML = `
    <div class="nm-root">
      <div class="nm-filters" role="group" aria-label="Category filters">
        ${categories.map((c) => `
          <button type="button" class="nm-chip" data-role="nm-filter-chip" data-category="${escapeHtml(c)}"
                  aria-pressed="true">${escapeHtml(c)}</button>
        `).join("")}
      </div>
      <div class="nm-placeholder" data-role="nm-placeholder">
        <p class="nm-hint">Graph rendering lands in Plan 03 (WebGL2) and Plan 04 (WebGPU).</p>
        <p class="nm-count">Dataset: <strong>${nodes.length}</strong> nodes in neuromap view</p>
        <p class="nm-hint2">Use Reference or Worklist tabs for now.</p>
      </div>
    </div>
  `;
  return function unmount() { root.innerHTML = ""; };
}
```

- [ ] **Step 4: Append CSS to `styles/shell.css`**

```css
.nm-root { padding: 72px 20px 24px; max-width: 1200px; margin: 0 auto; }
.nm-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 40px; }
.nm-chip {
  background: var(--bg-2); border: 1px solid var(--line);
  color: var(--fg-2); padding: 6px 12px; border-radius: 999px;
  font-size: 12px; cursor: pointer; text-transform: lowercase;
}
.nm-chip[aria-pressed="true"] { color: var(--fg-1); border-color: var(--line-2); }
.nm-placeholder { text-align: center; padding: 48px 20px; color: var(--fg-2); }
.nm-placeholder .nm-hint { color: var(--fg-3); font-size: 13px; margin-bottom: 12px; }
.nm-placeholder .nm-count { color: var(--fg-1); font-size: 20px; margin-bottom: 12px; }
.nm-placeholder .nm-hint2 { color: var(--fg-3); font-size: 13px; }
```

- [ ] **Step 5: Pass**

Run: `npx vitest run tests/neuromap-view.test.js`
Expected: 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add src/views/neuromap.js styles/shell.css tests/neuromap-view.test.js
git commit -m "feat(view): neuromap placeholder with category chips"
```

---

## Task 13: Wire views into bootstrap + view switching

**Files:**
- Modify: `src/core/bootstrap.js` — mount/unmount views, subscribe to router

- [ ] **Step 1: Replace `main()` contents**

```js
import { DATASET } from "../data/data.js";
import { createStore } from "./store.js";
import { createRouter, VIEWS } from "./router.js";
import { createMockBackend } from "../render/mock-backend.js";
import { mountTopbar } from "../ui/topbar.js";
import { mountBottomTabs } from "../ui/bottom-tabs.js";
import { mountNeuromap } from "../views/neuromap.js";
import { mountReference } from "../views/reference.js";
import { mountWorklist } from "../views/worklist.js";

const store = createStore({
  view: "neuromap",
  focusedId: null,
  highlight: [],
  paletteOpen: false,
  theme: "dark",
  ready: false,
});

const router = createRouter();
const backend = createMockBackend();

const api = {
  go: (v) => router.go(v),
  focus: (id) => store.patch({ focusedId: id }),
  highlight: (ids) => { backend.setHighlight(ids); store.patch({ highlight: ids }); },
  openPalette: () => store.patch({ paletteOpen: true }),
};

const VIEW_MOUNTERS = {
  neuromap: mountNeuromap,
  reference: mountReference,
  worklist: mountWorklist,
};

let unmountCurrent = null;

function switchView(view) {
  if (unmountCurrent) { unmountCurrent(); unmountCurrent = null; }
  const mounter = VIEW_MOUNTERS[view];
  unmountCurrent = mounter(DATASET, api);
  document.getElementById("shell").dataset.view = view;
}

async function main() {
  const canvas = document.getElementById("gpu");
  await backend.init(canvas);
  backend.loadScene(DATASET.nodes, DATASET.edges);

  router.start();
  const initialView = router.current();
  store.patch({ view: initialView });

  const updateTopbar = mountTopbar({ currentView: initialView }, api);
  const updateBottom = mountBottomTabs({ currentView: initialView }, api);

  switchView(initialView);

  router.subscribe((next) => {
    store.patch({ view: next });
    switchView(next);
    updateTopbar(next);
    updateBottom(next);
  });

  store.patch({ ready: true });
  document.body.dataset.ready = "true";
}

main().catch((err) => {
  document.body.dataset.ready = "error";
  document.body.textContent = `Claude Atlas failed to boot: ${err.message}`;
  throw err;
});

export { store, router, backend, VIEWS, api };
```

- [ ] **Step 2: Smoke in dev**

Run:
```bash
npx http-server -s -p 4173 &
SERVER_PID=$!
sleep 2
curl -s http://localhost:4173/ | head -c 200
kill $SERVER_PID 2>/dev/null
```
Expected: HTML output that references `styles/shell.css` and `bootstrap.js`.

Also: open `http://localhost:4173/` manually (Playwright optional) and verify by clicking through the three view tabs that content swaps. (Manual verification acceptable here; Plan 05 adds Playwright.)

- [ ] **Step 3: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(core): bootstrap mounts views and switches on router updates"
```

---

## Task 14: Command palette

**Files:**
- Create: `src/ui/palette.js`
- Create: `styles/palette.css`
- Modify: `styles/shell.css` — `@import "./palette.css";`
- Modify: `src/core/bootstrap.js` — open/close via `⌘K` / `Ctrl+K` / Escape
- Create: `tests/palette.test.js`

- [ ] **Step 1: Write the test**

`tests/palette.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountPalette } from "../src/ui/palette.js";

beforeEach(() => {
  document.body.innerHTML = `<div id="overlays"></div>`;
});

describe("command palette", () => {
  it("is hidden when opened=false", () => {
    mountPalette(DATASET, { opened: false, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() });
    const overlay = document.querySelector('[data-role="palette-overlay"]');
    expect(overlay.hidden).toBe(true);
  });

  it("shows results matching fuzzy query", () => {
    const update = mountPalette(DATASET, { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() });
    update({ opened: true, query: "claim" });
    const rows = document.querySelectorAll('[data-role="pl-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.textContent.toLowerCase()).toMatch(/claim/);
    }
  });

  it("Enter triggers focus on the first result's node", () => {
    const api = { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() };
    const update = mountPalette(DATASET, api);
    update({ opened: true, query: "wl" });
    const input = document.querySelector('[data-role="pl-input"]');
    input.value = "wl";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(api.focus).toHaveBeenCalled();
  });

  it("Escape calls onClose", () => {
    const api = { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() };
    mountPalette(DATASET, api);
    document.querySelector('[data-role="pl-input"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(api.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/palette.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/ui/palette.js`**

```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

function score(text, query) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let s = 0, i = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, i);
    if (idx === -1) return 0;
    s += 1;
    i = idx + 1;
  }
  return s;
}

function fuzzyFilter(nodes, query, limit = 30) {
  return nodes
    .map((n) => ({ n, s: score(`${n.name} ${n.oneLine} ${n.tags.join(" ")}`, query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.n);
}

function renderRow(n) {
  return `
    <button type="button" class="pl-row" data-role="pl-row" data-id="${n.id}">
      <span class="pl-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
      <span class="pl-name">${escapeHtml(n.name)}</span>
      <span class="pl-one">${escapeHtml(n.oneLine)}</span>
      <span class="pl-domain">${escapeHtml(n.domain)}</span>
    </button>
  `;
}

export function mountPalette(dataset, api) {
  const root = document.getElementById("overlays");
  const nodes = dataset.nodes;

  root.innerHTML = `
    <div class="pl-overlay" data-role="palette-overlay" ${api.opened ? "" : "hidden"}>
      <div class="pl-backdrop" data-role="pl-backdrop"></div>
      <div class="pl-dialog" role="dialog" aria-label="Command palette">
        <input type="text" class="pl-input" data-role="pl-input"
               placeholder="Search tools, commands, quizzes…" autocomplete="off" />
        <div class="pl-results" data-role="pl-results">
          ${fuzzyFilter(nodes, "").map(renderRow).join("")}
        </div>
        <div class="pl-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> jump</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('[data-role="palette-overlay"]');
  const input = root.querySelector('[data-role="pl-input"]');
  const results = root.querySelector('[data-role="pl-results"]');

  function rerender(query) {
    results.innerHTML = fuzzyFilter(nodes, query).map(renderRow).join("");
  }

  input.addEventListener("input", () => rerender(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { api.onClose(); return; }
    if (e.key === "Enter") {
      const first = results.querySelector('[data-role="pl-row"]');
      if (first) {
        api.focus(first.dataset.id);
        api.onClose();
      }
    }
  });

  root.querySelector('[data-role="pl-backdrop"]').addEventListener("click", () => api.onClose());
  results.addEventListener("click", (e) => {
    const row = e.target.closest('[data-role="pl-row"]');
    if (row) { api.focus(row.dataset.id); api.onClose(); }
  });

  return function update({ opened, query }) {
    overlay.hidden = !opened;
    if (opened) {
      if (typeof query === "string") { input.value = query; rerender(query); }
      input.focus();
    }
  };
}
```

- [ ] **Step 4: Write `styles/palette.css`**

```css
.pl-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: start center; padding-top: 12vh; }
.pl-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(6px); }
.pl-dialog { position: relative; width: min(640px, 90vw); background: var(--bg-2); border: 1px solid var(--line-2); border-radius: var(--r-lg); overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
.pl-input { width: 100%; padding: 16px 20px; background: transparent; border: 0; color: var(--fg-1); font-size: 16px; outline: 0; border-bottom: 1px solid var(--line); }
.pl-results { max-height: 48vh; overflow-y: auto; }
.pl-row {
  display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
  width: 100%; text-align: left; padding: 10px 16px;
  background: transparent; border: 0; color: var(--fg-1); cursor: pointer;
  border-bottom: 1px solid var(--line);
}
.pl-row:hover, .pl-row:focus-visible { background: var(--bg-3); }
.pl-badge { font-family: var(--ff-mono); font-size: 10px; padding: 2px 6px; border-radius: 3px;
  background: hsl(var(--hue) 40% 20%); color: hsl(var(--hue) 85% 72%); letter-spacing: 0.1em; }
.pl-name { font-weight: 500; font-family: var(--ff-mono); font-size: 13px; }
.pl-one { color: var(--fg-2); font-size: 13px; }
.pl-domain { color: var(--fg-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; grid-column: 4; }
.pl-footer { display: flex; gap: 16px; padding: 8px 16px; font-size: 11px; color: var(--fg-3); border-top: 1px solid var(--line); background: var(--bg-1); }
.pl-footer kbd { font-family: var(--ff-mono); padding: 1px 4px; border: 1px solid var(--line); border-radius: 3px; background: var(--bg-2); }
```

- [ ] **Step 5: Import palette CSS in shell.css**

Append to `styles/shell.css` @imports:
```css
@import url("./palette.css");
```

- [ ] **Step 6: Wire palette into bootstrap**

In `src/core/bootstrap.js`, extend `main()` after `switchView(initialView);`:

```js
  // palette
  const updatePalette = mountPalette(DATASET, {
    opened: false,
    onClose: () => store.patch({ paletteOpen: false }),
    go: api.go,
    focus: api.focus,
  });
  store.subscribe((s, p) => {
    if (s.paletteOpen !== p.paletteOpen) updatePalette({ opened: s.paletteOpen });
  });

  // global hotkey
  window.addEventListener("keydown", (e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      api.openPalette();
    } else if (e.key === "Escape" && store.get().paletteOpen) {
      store.patch({ paletteOpen: false });
    } else if (!isMeta && ["1","2","3"].includes(e.key) && e.target === document.body) {
      api.go(VIEWS[Number(e.key) - 1]);
    }
  });
```

Add the `mountPalette` import at top: `import { mountPalette } from "../ui/palette.js";`

- [ ] **Step 7: Pass**

Run: `npx vitest run tests/palette.test.js`
Expected: 4/4 pass.

- [ ] **Step 8: Commit**

```bash
git add src/ui/palette.js styles/palette.css styles/shell.css src/core/bootstrap.js tests/palette.test.js
git commit -m "feat(ui): command palette with fuzzy search and global hotkey"
```

---

## Task 15: Mobile responsive polish + reduced-motion

**Files:**
- Modify: `styles/shell.css` — add breakpoint rules
- Modify: `styles/reference.css` — mobile
- Modify: `styles/worklist.css` — mobile

- [ ] **Step 1: Append responsive rules to `styles/shell.css`**

```css
/* canvas + shell stacking */
#gpu { position: fixed; inset: 0; z-index: 0; background: var(--bg-0); }
#shell { position: relative; z-index: 1; height: 100dvh; }
#view { height: calc(100dvh - 56px); }

@media (max-width: 480px) {
  #view { height: calc(100dvh - 56px - 64px); /* bottom tabs */ }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0s !important; transition-duration: var(--d-micro) !important; }
}
```

- [ ] **Step 2: Append to `reference.css`**

```css
@media (max-width: 768px) {
  .ref-root { padding: 64px 14px 20px; }
  .ref-entry { padding: 14px 12px 16px; }
  .ref-entry h2 { font-size: 18px; }
}
@media (max-width: 480px) {
  .ref-tabs { top: 64px; }
  .ref-root { padding: 64px 12px 80px; /* room for bottom tabs */ }
}
```

- [ ] **Step 3: Append to `worklist.css`**

```css
@media (max-width: 768px) {
  .wl-root { padding: 64px 14px 20px; }
  .wl-tabs { top: 64px; }
}
@media (max-width: 480px) {
  .wl-root { padding: 64px 12px 80px; }
  .wl-choice { padding: 12px 14px; min-height: 48px; font-size: 15px; }
}
```

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:4173/` in a desktop browser, then resize to 375×667 via DevTools. Confirm:
- Bottom tab bar appears at narrow widths.
- Content is legible at 375px, no horizontal scroll.
- Tap targets ≥44px.

(Playwright automation for this lands in Plan 05.)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all prior passing; no regressions.

- [ ] **Step 6: Commit**

```bash
git add styles/shell.css styles/reference.css styles/worklist.css
git commit -m "style: mobile breakpoints and reduced-motion"
```

---

## Task 16: A11y polish — focus trap, live region, skip link

**Files:**
- Modify: `index.html` — add skip link
- Modify: `src/ui/palette.js` — focus trap
- Modify: `src/core/bootstrap.js` — aria-live announce on view change
- Create: `tests/a11y.test.js`

- [ ] **Step 1: Add skip link to `index.html`**

Just after `<body>`:
```html
  <a class="skip-link" href="#view">Skip to content</a>
```

- [ ] **Step 2: Append skip-link CSS to `styles/shell.css`**

```css
.skip-link { position: absolute; top: -100px; left: 10px; z-index: 200;
  padding: 8px 12px; background: var(--bg-2); color: var(--fg-1); border: 1px solid var(--line); border-radius: var(--r-sm); }
.skip-link:focus { top: 10px; }
```

- [ ] **Step 3: Write `tests/a11y.test.js`**

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("a11y — HTML landmarks & skip link", () => {
  const html = readFileSync("index.html", "utf8");
  it("has a skip link pointing to #view", () => {
    expect(html).toMatch(/class="skip-link"\s+href="#view"/);
  });
  it("main has aria-live='polite'", () => {
    expect(html).toMatch(/<main[^>]*aria-live="polite"/);
  });
  it("nav#bottom-tabs has aria-label", () => {
    expect(html).toMatch(/id="bottom-tabs"[^>]*aria-label=/);
  });
});
```

- [ ] **Step 4: Focus trap in palette**

In `src/ui/palette.js`, modify `mountPalette` so the `update` function also traps focus when opening:

Inside `update({ opened, query })`, after `input.focus();` add:
```js
      overlay.addEventListener("keydown", trapFocus, { once: false });
```
And at the end of the file add:
```js
function trapFocus(e) {
  if (e.key !== "Tab") return;
  const focusable = e.currentTarget.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
```

(Keep the handler simple — it runs only while the palette is open; since `overlay.hidden` controls visibility, tabbing behaviour is scoped to the open state.)

- [ ] **Step 5: Announce view changes**

In `src/core/bootstrap.js`, inside the `router.subscribe` callback after `updateBottom(next);`, add:
```js
    const main = document.getElementById("view");
    main.setAttribute("aria-busy", "true");
    queueMicrotask(() => main.setAttribute("aria-busy", "false"));
```

(The `aria-live="polite"` on `<main>` is already set in index.html; the busy toggle gives assistive tech a hint that content just swapped.)

- [ ] **Step 6: Pass**

Run: `npx vitest run tests/a11y.test.js`
Expected: 3/3 pass. Plus all prior tests still green.

- [ ] **Step 7: Commit**

```bash
git add index.html styles/shell.css src/ui/palette.js src/core/bootstrap.js tests/a11y.test.js
git commit -m "feat(a11y): skip link, palette focus trap, view-change announcement"
```

---

## Task 17: Full verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: ≥60 assertions green across ~13 test files (old 3 + new ones). Zero failures.

- [ ] **Step 2: Dev server smoke**

Run:
```bash
npx http-server -s -p 4173 &
SERVER_PID=$!
sleep 2
curl -s http://localhost:4173/ | head -c 400
kill $SERVER_PID 2>/dev/null
```
Expected: HTML with references to shell.css, bootstrap.js. Visit in a browser and confirm the three view tabs work.

- [ ] **Step 3: Check git log**

Run: `git log --oneline | head -30`
Expected: ~16–18 new commits on top of Plan 01's 21 = 37–39 total.

- [ ] **Step 4: Clean status**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Completion criteria

Plan 02 is done when:
- [ ] All three views render correctly from the DATASET.
- [ ] `⌘K` / `Ctrl+K` opens the command palette; Escape closes it; Enter jumps to a node.
- [ ] Keyboard navigation works: `1/2/3` switch views; `/` would focus search (deferred to Plan 03); `Esc` closes the palette.
- [ ] Mobile (375×667 viewport) shows bottom tabs, full-width DOM views, no horizontal scroll.
- [ ] `prefers-reduced-motion` is honoured.
- [ ] vitest suite passes with ≥60 assertions.
- [ ] Skip link, aria-live region, focus trap in palette.
- [ ] Mock render backend is wired — Plan 03 can replace it with WebGL2 by changing the factory line in `bootstrap.js`.

**Next:** Plan 03 — WebGL2 Backend.

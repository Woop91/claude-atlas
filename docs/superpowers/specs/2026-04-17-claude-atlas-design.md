# Claude Atlas — Unified Tool & Worklist Explorer

**Date:** 2026-04-17
**Status:** Approved for planning
**Author:** Claude (brainstormed with WARDIS)

## 1. Summary

Merge the five source files in `HTML files - Copy (2)/COMBINE/` into a single unified app — **Claude Atlas** — that presents Claude tool and worklist-command knowledge as an interactive, WebGPU-driven experience with graceful WebGL2 fallback. One canonical dataset; three views (Neuromap, Reference, Worklist) sharing one persistent shader-rendered scene; hybrid architecture where the GPU canvas never unmounts and DOM sidecars slide in for readable text content.

## 2. Source inventory

Five files in `COMBINE/`; two are byte-identical, so the merge operates on four unique sources:

| File | Role | Key signals |
|---|---|---|
| `claude-tools-neuromap_3.html` | Early neuromap (canvas + side panel) | superseded by v7 |
| `claude-tools-neuromap_7.html` | Evolved neuromap (SVG + filter bar + color vars) | authoritative node catalog |
| `claude-tools-reference_2.html` | Typographic tool reference (Syne + IBM Plex Mono) | authoritative long-form descriptions |
| `wl_command_reference.html` | Worklist tabs + quiz + insights | authoritative worklist commands, quiz, insights |
| `wl_command_reference_1.html` | Duplicate of above | ignore |

## 3. Goals / non-goals

**Goals**
- One deliverable: a folder named `claude-atlas/` that runs locally via a static file server.
- Single canonical dataset powering all three views.
- WebGPU rendering for the graph, ambient background, and view-morph transitions.
- WebGL2 fallback that preserves the visual language on mobile and non-WebGPU browsers.
- Mobile-first responsive design; passes AA contrast; respects `prefers-reduced-motion`.
- Playwright smoke, data integrity, accessibility, visual regression, and backend-parity tests.

**Non-goals**
- No backend, no network calls at runtime.
- No CMS, no build step, no framework.
- No authentication, analytics, or telemetry.
- Not a replacement for the Claude docs; this is a navigable reference + teaching tool.

## 4. User-facing shape

### 4.1 Entry
The app opens on **Neuromap** — a full-viewport force-directed graph of all tools/commands with a gentle "graph breath" ambient motion. Top bar offers view switches; `⌘K` / `Ctrl+K` opens the command palette from anywhere.

### 4.2 Three views, one scene
- **Neuromap** — graph occupies 100% viewport; click a node to open a detail card.
- **Reference** — graph reshapes into the left 33% as an alphabetical minimap; right 67% is a DOM-rendered typographic reference with sticky domain tabs (Claude Tools / Worklist / Concepts). Scroll-spy synchronises with minimap.
- **Worklist** — graph becomes a top-down DAG of worklist-command sequences in the left 33%; right 67% is a DOM sidecar with three tabs: Commands, Quiz (interactive, persists score in `localStorage`), Insights.

### 4.3 Command palette (global)
`⌘K` opens a fuzzy-search overlay over all nodes + commands + quiz prompts + runnable actions. Arrow-key navigation, `Enter` to jump, `⌘Enter` to open detail inline without leaving the current view. Keyboard-only users can reach every graph interaction through the palette.

### 4.4 Keyboard
`1`/`2`/`3` switch views · `⌘K` palette · `/` focus search · `?` shortcuts overlay · `Esc` close / unfocus.

### 4.5 Mobile
View switcher collapses to a bottom tab bar (thumb zone, safe-area-aware). Minimap collapses to a pill at the top of Reference/Worklist that expands into a bottom sheet. All form inputs ≥16px to suppress iOS zoom. Breakpoints at 480 / 768 / 1200.

## 5. Architecture

### 5.1 Layers (z-order)
1. **GPU canvas** (`<canvas id="gpu">`) full-bleed, z=0. Never unmounts; one WebGPU device or one WebGL2 context for the lifetime of the page.
2. **DOM shell** (top bar + current view sidecar + bottom tab bar on mobile) in a CSS grid, z=1. View modules mount/unmount only the sidecar.
3. **Overlays** (command palette, dialogs, toasts), z=2.

### 5.2 Runtime loop
A single `renderLoop(ts)` reads a global `scene` state (nodes, edges, layoutHint, cameraRect, tweenT, highlightSet). View transitions mutate `scene.targetLayout` and `scene.cameraTarget`; tween weights drive the morph. No framework; a ~40-line signal store handles reactive updates for the DOM shell.

### 5.3 Module boundaries
```
claude-atlas/
  index.html
  src/
    core/           bootstrap, router, signal store, feature detection
    render/         RenderBackend interface + WebGPUBackend + WebGL2Backend
    data/           data.js (canonical), schema.js (JSDoc @typedefs)
    views/          neuromap.js, reference.js, worklist.js
    ui/             palette.js, topbar.js, minimap.js, toast.js, focus.js
  shaders/          graph / physics / background / bloom / transition (WGSL + GLSL)
  styles/           tokens.css, shell.css, reference.css, worklist.css
  tests/            smoke / data / views / a11y / visual / backend (Playwright)
  run.cmd           Windows launcher (starts http-server + opens browser)
  run.sh            POSIX launcher
  playwright.config.ts
  package.json
  README.md
```

### 5.4 Contracts
```ts
interface RenderBackend {
  init(canvas: HTMLCanvasElement): Promise<void>;
  loadScene(nodes: NodePacked, edges: EdgePacked): void;
  setLayout(hint: LayoutHint, durationMs: number): void;
  setFocus(nodeId: string | null): void;
  setHighlight(nodeIds: string[]): void;
  setCameraFraction(rect: {x:number;y:number;w:number;h:number}): void;
  setTheme(tokens: Tokens): void;
  render(): void;
  destroy(): void;
}

interface View {
  mount(mountEl: HTMLElement, store: Store, api: ViewApi): void;
  unmount(): void;
  layoutHint: LayoutHint; // static or computed
}
type ViewApi = { focus(id:string):void; highlight(ids:string[]):void; openPalette():void };
```
Cross-module communication goes exclusively through `store` or `api`. No cross-view imports.

## 6. Canonical data model

### 6.1 Types
```ts
type Node = {
  id: string;                         // slug: "tool.read", "wl.claim"
  kind: "tool" | "command" | "concept";
  domain: "claude" | "worklist";
  name: string;                       // display name
  category: string;                   // e.g. "file-io"
  badge: { label: string; hue: number };  // hue drives shader color
  oneLine: string;                    // tooltip + minimap subtitle
  description: string;                // markdown, Reference view
  syntax?: string;                    // monospace signature
  examples?: string[];                // code/command snippets
  tags: string[];                     // fuzzy-search + filter
  views: ("neuromap" | "reference" | "worklist")[];
};

type Edge = {
  source: string; target: string;
  kind: "related" | "category" | "sequence" | "composes";
  weight: number;                     // spring + line opacity
};

type Quiz = {
  id: string;
  prompt: string;
  choices: { id: string; text: string; nodeIds: string[] }[];
  correctChoiceId: string;
  explanation: string;
};

type Dataset = { nodes: Node[]; edges: Edge[]; quizzes: Quiz[]; version: string };
```

### 6.2 Source-to-model mapping

| Source | Produces |
|---|---|
| `neuromap_7` nodes + categories | `Node{domain:"claude", views:["neuromap","reference"]}` with `badge.hue` from source category color |
| `reference_2` entries | merged into same `Node` by id → fills `description`, `syntax`, `examples` |
| `wl_command_reference` commands | `Node{domain:"worklist", views:["neuromap","reference","worklist"]}` |
| `wl_command_reference` quiz | `Quiz[]` |
| `wl_command_reference` insights | `Node{kind:"concept"}` |

### 6.3 Layout hints
```ts
type LayoutHint = {
  mode: "force" | "grid" | "flow" | "radial";
  filter: (n: Node) => boolean;
  positions?: Map<string, {x:number;y:number}>;  // pinned for grid/flow
  highlights?: string[];
  cameraFraction: {x:number;y:number;w:number;h:number};
};
```
- **Neuromap view** → `force` + full viewport.
- **Reference view** → `grid` alphabetical in left 33%.
- **Worklist view** → `flow` top-down DAG of `sequence` edges in left 33%.

## 7. Rendering stack

### 7.1 WebGPU pipelines
| Pass | Type | Purpose |
|---|---|---|
| `physics.repel` | compute | all-pairs repulsion → velocity delta |
| `physics.spring` | compute | edge springs to target length → velocity delta |
| `physics.integrate` | compute | blend physics pos with layout-hint pos by tween `t` |
| `edges.draw` | render | instanced segments with SDF glow, opacity = weight |
| `nodes.draw` | render | instanced quads → fragment draws disc + halo from hue |
| `bloom.*` | render | 2-pass gaussian extract/blur/composite |
| `background.flow` | render | fullscreen flow-field ambient, tinted per active view |
| `transition.curtain` | render | crossfade + chromatic-aberration on view switch |

### 7.2 WebGL2 fallback
- CPU physics (Barnes-Hut quadtree in `requestAnimationFrame`) — comfortable at ≤300 nodes.
- Same node/edge shaders rewritten as GLSL 3.00 ES.
- Single-pass bloom; no transition curtain (CSS mask fade replaces it).
- Background shader simplified (lower octaves).

### 7.3 Backend selection
```js
const hasWebGPU = ('gpu' in navigator) && !!(await navigator.gpu?.requestAdapter());
const forceBackend = new URLSearchParams(location.search).get('backend'); // test override
const backend = forceBackend === 'webgl2' ? new WebGL2Backend()
              : forceBackend === 'webgpu' ? new WebGPUBackend()
              : hasWebGPU ? new WebGPUBackend() : new WebGL2Backend();
```
WebGL2 failure → static SVG snapshot + notice (extremely rare; logs a warning).

### 7.4 Shaders on disk
```
shaders/
  graph.wgsl / graph.glsl             // node + edge draw
  physics.wgsl                        // compute (WebGPU only)
  background.wgsl / background.glsl   // ambient flow field
  bloom.wgsl / bloom.glsl
  transition.wgsl                     // WebGPU only
  tokens.shader.js                    // CSS-var → uniform bridge
```

### 7.5 Frame budget
| Work | Target | Mobile override |
|---|---|---|
| Physics (WebGPU) | ≤1.5ms | — |
| Node + edge draw | ≤3ms | — |
| Background | ≤1ms | half-res |
| Bloom | ≤2ms | **skipped** |
| Transition | ≤2ms | shorter window |

DPR capped at 1.75 on mobile, 2.0 on desktop. Loop drops to 30fps on `!document.hasFocus()` and pauses on `document.hidden`.

## 8. Visual language

### 8.1 Color tokens (CSS custom properties, mirrored in shader uniforms)
```css
:root {
  --bg-0:#07070f; --bg-1:#0d0d14; --bg-2:#15151f; --bg-3:#1e1e2c;
  --line:rgba(255,255,255,0.07); --line-2:rgba(255,255,255,0.14);
  --fg-1:#f2f0f8; --fg-2:#a6a4b8; --fg-3:#605f70;
  --hue-pink:340; --hue-purple:265; --hue-cyan:192;
  --hue-green:150; --hue-amber:42; --hue-orange:18;
  --accent:hsl(var(--hue-purple) 85% 72%);
  --ok:hsl(var(--hue-green) 70% 60%);
  --warn:hsl(var(--hue-amber) 85% 62%);
  --err:hsl(var(--hue-orange) 85% 62%);
}
:root[data-theme="warm"] { /* alt palette */ }
```

### 8.2 Typography
Self-hosted woff2 subsets (Latin):
- Display: **Syne** 600/700 — word-mark, view titles.
- UI/body: **Inter** 400/500/600.
- Code: **IBM Plex Mono** 400/500.

Ramp: `Display L clamp(28,4vw,48)/700/-0.03em`, `Display M clamp(22,2.4vw,32)/600/-0.02em`, `Heading clamp(16,1.6vw,20)/600/-0.01em`, `Body 15/400`, `Small 12/400/+0.02em`, `Label 11/500/0.1em uppercase (mono)`.

### 8.3 Motion
- Default easing: `cubic-bezier(.2,.8,.2,1)`.
- Durations: micro 120ms, small 220ms, medium 350ms, pulse 900ms.
- Signature: "graph breath" — 6s sine on global noise amplitude.
- `prefers-reduced-motion` → physics off, breath off, view morphs become 120ms cross-fade.

### 8.4 Components
Radii `--r-sm 6 / --r-md 10 / --r-lg 14 / pill 999`. Elevation via borders + inset highlights (no box-shadows on canvas overlay). Form inputs ≥16px on mobile.

## 9. Mobile, performance, accessibility

- **Breakpoints**: ≤480 compact, 481–768 phablet, 769–1200 tablet, ≥1201 desktop. Container queries on the DOM sidecar so it reflows whether 67% or 100% wide.
- **Touch**: 44×44 minimum; two-finger pan/zoom on graph; long-press = pin; swipe-up on minimap pill = expand sheet.
- **Budgets**: JS ≤180KB gz (excl. shaders & fonts), first interactive ≤1.5s mid-tier mobile, LCP ≤1.8s, CLS <0.02.
- **Accessibility**:
  - `role="application"` on GPU canvas; `aria-live="polite"` announces view changes + focused node.
  - All graph interactions mirrored in palette (keyboard-only reachable).
  - Every Reference/Worklist entry a real `<section id>` for find-in-page, screen readers, deep links.
  - Contrast ≥AA on all text; focus rings visible; 2-letter mono badge prefix so color is never sole encoder.
  - Tested with `prefers-reduced-motion`, `forced-colors`, `prefers-contrast: more`.

## 10. Testing (Playwright CLI)

### 10.1 Config
`playwright.config.ts` with two projects:
- **desktop-chromium** — launch args `--enable-unsafe-webgpu`, `--enable-features=Vulkan`; viewport 1440×900.
- **mobile-chromium** — iPhone 13 device descriptor; exercises WebGL2 fallback.

`webServer`: `npx http-server -s -p 4173 --cache -1`.

### 10.2 Suites
| File | Asserts |
|---|---|
| `smoke.spec.ts` | page loads, no console errors, `<canvas>` visible, three view buttons work, palette opens on `⌘K` |
| `data.spec.ts` | dataset integrity: every edge's endpoints exist, every node has required fields, `views` values match known views |
| `views.spec.ts` | each view reaches `data-ready="true"`; key landmarks present |
| `a11y.spec.ts` | `@axe-core/playwright` — zero critical/serious violations per view |
| `visual.spec.ts` | `.toHaveScreenshot()` with 1% tolerance; `?test=1` query seeds `Math.random` + pauses animations |
| `backend.spec.ts` | force `?backend=webgpu` and `?backend=webgl2` — assert parity of key DOM outputs |

### 10.3 Commands (README)
- `npm run dev` → `npx http-server -c-1 -p 4173`
- `npm run test` → `npx playwright test`
- `npm run test:update` → `npx playwright test --update-snapshots`
- `npm run test:mobile` → `npx playwright test --project=mobile-chromium`

### 10.4 Verification gate
Before declaring done: run full suite on both projects; share pass/fail + screenshots; fix failures before claiming completion (per memory rule on verification).

## 11. Open decisions deferred to implementation

These are intentionally left to the plan/implementation phase:
- Exact node id scheme (`tool.<snake>` vs `claude.tool.<snake>`) — pick during dataset extraction.
- Whether to self-host fonts via base64 in CSS vs `@font-face url()` — measure LCP both ways, pick the faster.
- Whether the "warm" theme ships at v1 or is deferred.
- Quiz persistence key format — trivial; decide during worklist view implementation.

## 12. Risks

| Risk | Mitigation |
|---|---|
| WebGPU feature detection false positives on some Linux / old drivers | Wrap `requestAdapter` with a 2s timeout; fall back on error |
| Shader parity drift between WGSL and GLSL | Shared `tokens.shader.js` for constants; `backend.spec.ts` enforces visual parity |
| Data extraction from source HTML loses context | Cross-check extracted dataset against source files during planning — every source tool must appear in `data.js` |
| Mobile battery burn | DPR cap, bloom off, 30fps when unfocused, pause on hidden |
| `file://` protocol issues for users opening without a server | Ship `run.cmd` / `run.sh` launchers; README has a "why a server" note |

## 13. Deliverable

A `claude-atlas/` folder on the user's Desktop containing:
- The source tree above.
- `README.md` with quickstart (`run.cmd`, `npm run test`) and architecture summary.
- Passing Playwright suite on desktop + mobile projects, with updated snapshots.
- The design doc (this file) committed into `docs/superpowers/specs/`.

## 14. Approval history
- 2026-04-17 — Scope (A), WebGPU scope (C), landing (A), data model (A), deliverable (B), fallback (A) — all approved by WARDIS.
- 2026-04-17 — Approach 2 (Hybrid Shell) selected over 1 (Spatial Atlas) and 3 (Shader-Chromed Tabs).
- 2026-04-17 — Architecture, data model, rendering stack, views & interactions, visual language, mobile/perf/a11y, and testing strategy approved section by section.

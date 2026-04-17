# Claude Atlas — Plan 04: WebGPU Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `createWebGPUBackend()` that renders the node+edge graph with a compute-shader physics pass, conforms to the `RenderBackend` contract from Plan 02, and is auto-selected over WebGL2 when `navigator.gpu` is available. Also lands the pre-Plan-04 cleanups flagged during Plan 02/03 review (canvas a11y, listener cleanup, shader-path robustness, physics dt normalization).

**Architecture:** Plain ES modules. `createWebGPUBackend()` mirrors the WebGL2 factory's surface but swaps the GL pipelines for WGPU pipelines and the CPU Barnes-Hut physics for a compute-shader pass. Bootstrap feature-detects `navigator.gpu.requestAdapter()` with a 2-second timeout (per spec risk mitigation) and selects: `webgpu > webgl2 > mock`. URL overrides (`?backend=webgpu|webgl2|mock`) still force a specific backend for testing.

**Tech Stack:** Node 20, vitest + jsdom (for pure-JS detection + contract tests), Playwright + Chromium with `--enable-unsafe-webgpu --enable-features=Vulkan` flag for browser verification, WGSL (WebGPU Shading Language), plain ES modules, no bundler.

**Reference spec:** `docs/superpowers/specs/2026-04-17-claude-atlas-design.md` — Sections 5.4 (contract), 7.1 (WebGPU pipelines), 7.3 (backend selection), 7.4 (shaders on disk), 12 (risks — WebGPU detection timeout).

**Test strategy:** `navigator.gpu` doesn't exist in jsdom, so the WebGPU factory + device detection can only be contract-tested (shape + feature-detect path). Visual parity with WebGL2 lands via Playwright `backend.spec.ts` launched with `--enable-unsafe-webgpu`. The CPU physics in Plan 03 remains the single source of truth for unit-testable layout semantics; the WGSL compute shader is empirically validated via Playwright screenshots compared against the WebGL2 baseline from Plan 03's `tests/e2e-artifacts/`.

**Enters with:** Plan 03 complete at HEAD (to be captured on commit). 91/91 vitest assertions green. Playwright installed via Plan 03 hotfixes. WebGL2 backend proven rendering end-to-end. Four Plan 2/3 cleanups flagged but unfixed.

**Out of scope for Plan 04:** Multi-pass bloom (`bloom.wgsl`). Transition curtain (`transition.wgsl`). Full CSS-var → shader-uniform bridge beyond a minimal theme color uniform. Playwright visual regression suite (that's Plan 05's dedicated scope). Barnes-Hut in WGSL (the compute shader uses all-pairs O(n²) at ≤300 nodes — fine on GPU).

---

## File structure

```
claude-atlas/
  src/
    render/
      webgpu-backend.js               ← NEW: factory (top-level, parallels webgl2-backend.js)
      webgpu/
        device.js                     ← NEW: requestAdapter/requestDevice with timeout
        shaders.js                    ← NEW: WGSL module loader + pipeline cache
        nodes.js                      ← NEW: instanced-quad node render pipeline (WGPU)
        edges.js                      ← NEW: instanced-segment edge render pipeline (WGPU)
        background.js                 ← NEW: fullscreen flow-field ambient pass (WGPU)
        physics.js                    ← NEW: compute-shader physics orchestrator (WGPU)
      backend-detect.js               ← NEW: async feature-detect for WebGPU (moved out of bootstrap for testability)
    core/
      bootstrap.js                    ← MODIFIED: 3-way backend selection (mock|webgl2|webgpu) with URL override + auto-detect
  shaders/
    graph.wgsl                        ← NEW: nodes + edges WGSL (parallel to graph.glsl)
    background.wgsl                   ← NEW: background flow-field WGSL
    physics.wgsl                      ← NEW: compute shader (repel + spring + integrate)
  tests/
    backend-detect.test.js            ← NEW: feature-detect logic under jsdom (mocked navigator.gpu)
    webgpu-backend-contract.test.js   ← NEW: factory shape matches BACKEND_METHODS
    e2e-backend-parity.mjs            ← NEW: Playwright script comparing WebGPU vs WebGL2 screenshots
```

**Why this split:** Each module has one responsibility and can be held in context alone. `webgpu-backend.js` is a thin wiring module composing `device` + `shaders` + pipelines + `physics` behind the contract. `backend-detect.js` is extracted from bootstrap so the detection logic is unit-testable without instantiating the full app.

---

## Task 1: Backend feature-detect — TDD

**Files:**
- Create: `src/render/backend-detect.js`
- Create: `tests/backend-detect.test.js`

Spec 7.3 specifies backend selection as `?backend=forced || (hasWebGPU ? webgpu : webgl2)`. Spec 12 requires wrapping `requestAdapter` in a 2-second timeout to avoid Linux/driver hangs. Extract this logic into a pure module so bootstrap can import a single `detectBackend()` function and so it's testable under jsdom via a mocked `navigator.gpu`.

- [ ] **Step 1: Write the failing test**

`tests/backend-detect.test.js`:
```js
import { describe, it, expect, vi } from "vitest";
import { detectBackend } from "../src/render/backend-detect.js";

describe("detectBackend", () => {
  it("returns 'mock' when forced to mock via override", async () => {
    const result = await detectBackend({ forced: "mock", gpu: { requestAdapter: async () => ({}) } });
    expect(result).toBe("mock");
  });

  it("returns 'webgl2' when forced to webgl2 even if webgpu is available", async () => {
    const result = await detectBackend({ forced: "webgl2", gpu: { requestAdapter: async () => ({}) } });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgpu' when gpu adapter resolves within timeout", async () => {
    const result = await detectBackend({ forced: null, gpu: { requestAdapter: async () => ({ ok: true }) } });
    expect(result).toBe("webgpu");
  });

  it("returns 'webgl2' when gpu is absent", async () => {
    const result = await detectBackend({ forced: null, gpu: null });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgl2' when requestAdapter returns null", async () => {
    const result = await detectBackend({ forced: null, gpu: { requestAdapter: async () => null } });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgl2' when requestAdapter hangs past timeout", async () => {
    const neverResolves = new Promise(() => {});
    const result = await detectBackend({
      forced: null,
      gpu: { requestAdapter: () => neverResolves },
      timeoutMs: 50,
    });
    expect(result).toBe("webgl2");
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/backend-detect.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/render/backend-detect.js`**

```js
/**
 * Pick a backend: "webgpu" | "webgl2" | "mock".
 * @param {Object} opts
 * @param {"mock"|"webgl2"|"webgpu"|null} opts.forced - URL override, if any
 * @param {{ requestAdapter: Function }|null} opts.gpu - navigator.gpu or null
 * @param {number} [opts.timeoutMs=2000] - max time to wait for requestAdapter
 */
export async function detectBackend({ forced, gpu, timeoutMs = 2000 }) {
  if (forced === "mock") return "mock";
  if (forced === "webgl2") return "webgl2";
  if (forced === "webgpu") {
    // still verify adapter is available; if not, force fails gracefully to webgl2
    if (!gpu) return "webgl2";
    const adapter = await withTimeout(gpu.requestAdapter(), timeoutMs);
    return adapter ? "webgpu" : "webgl2";
  }
  if (!gpu) return "webgl2";
  const adapter = await withTimeout(gpu.requestAdapter(), timeoutMs);
  return adapter ? "webgpu" : "webgl2";
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/backend-detect.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/backend-detect.js tests/backend-detect.test.js
git commit -m "feat(render): backend detection with URL override + requestAdapter timeout"
```

---

## Task 2: WebGPU device + adapter wrapper

**Files:**
- Create: `src/render/webgpu/device.js`

No tests (jsdom lacks `navigator.gpu`; the device requires a real GPU). The contract test in Task 11 will verify `init()` rejects cleanly when the device request fails.

- [ ] **Step 1: Implement**

```js
/**
 * Request a WebGPU adapter+device. Throws with a clear message on failure.
 * Returns { device, adapter, context, format } where context is a GPUCanvasContext
 * and format is the canvas's preferred color format.
 */
export async function createDevice(canvas) {
  if (!navigator.gpu) throw new Error("WebGPU not available");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("no WebGPU adapter");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context unavailable");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  return { device, adapter, context, format };
}

export function resizeCanvasForDevice(canvas) {
  const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent ?? "");
  const dprCap = isMobile ? 1.75 : 2.0;
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/device.js
git commit -m "feat(webgpu): adapter/device request + DPR-aware canvas resize"
```

---

## Task 3: Graph WGSL — nodes + edges in one module

**Files:**
- Create: `shaders/graph.wgsl`

WGSL is a different language from GLSL, but the vertex/fragment logic translates directly. One module file with both pipelines; Plan 04's JS loads the whole module and creates separate pipelines for the `node_vs`/`node_fs`/`edge_vs`/`edge_fs` entry points.

- [ ] **Step 1: Write `shaders/graph.wgsl`**

```wgsl
struct View {
  sx: f32,
  sy: f32,
  tx: f32,
  ty: f32,
  size: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> u: View;

struct NodeInst {
  @location(1) pos: vec2f,
  @location(2) hue: f32,
  @location(3) highlight: f32,
};

struct NodeVOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) hue: f32,
  @location(2) highlight: f32,
};

@vertex
fn node_vs(@location(0) corner: vec2f, inst: NodeInst) -> NodeVOut {
  let world = inst.pos + (corner - vec2f(0.5)) * u.size;
  let cx = u.sx * world.x + u.tx;
  let cy = u.sy * world.y + u.ty;
  var o: NodeVOut;
  o.clip = vec4f(cx, cy, 0.0, 1.0);
  o.uv = corner;
  o.hue = inst.hue;
  o.highlight = inst.highlight;
  return o;
}

fn hsl_to_rgb(h: f32, s: f32, l: f32) -> vec3f {
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  let hp = h * 6.0;
  let x = c * (1.0 - abs((hp % 2.0) - 1.0));
  var rgb = vec3f(0.0);
  if (hp < 1.0) { rgb = vec3f(c, x, 0.0); }
  else if (hp < 2.0) { rgb = vec3f(x, c, 0.0); }
  else if (hp < 3.0) { rgb = vec3f(0.0, c, x); }
  else if (hp < 4.0) { rgb = vec3f(0.0, x, c); }
  else if (hp < 5.0) { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  let m = l - 0.5 * c;
  return rgb + vec3f(m);
}

@fragment
fn node_fs(in: NodeVOut) -> @location(0) vec4f {
  let p = in.uv - vec2f(0.5);
  let d = length(p);
  let disc = smoothstep(0.48, 0.44, d);
  let halo = smoothstep(0.5, 0.35, d) - disc;
  let base = hsl_to_rgb(in.hue / 6.2831853, 0.7, 0.62);
  let bright = mix(base, vec3f(1.0), in.highlight * 0.6);
  let alpha = disc + halo * (0.25 + in.highlight * 0.5);
  return vec4f(bright * alpha, alpha);
}

struct EdgeInst {
  @location(1) seg: vec4f,
  @location(2) weight: f32,
};

struct EdgeVOut {
  @builtin(position) clip: vec4f,
  @location(0) weight: f32,
};

@vertex
fn edge_vs(@location(0) corner: vec2f, inst: EdgeInst) -> EdgeVOut {
  let a = inst.seg.xy;
  let b = inst.seg.zw;
  let dir = normalize(b - a);
  let perp = vec2f(-dir.y, dir.x);
  let thickness = mix(1.0, 3.0, inst.weight);
  let world = mix(a, b, corner.x) + perp * (corner.y - 0.5) * thickness;
  let cx = u.sx * world.x + u.tx;
  let cy = u.sy * world.y + u.ty;
  var o: EdgeVOut;
  o.clip = vec4f(cx, cy, 0.0, 1.0);
  o.weight = inst.weight;
  return o;
}

@fragment
fn edge_fs(in: EdgeVOut) -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 1.0, in.weight * 0.35);
}
```

- [ ] **Step 2: Commit**

```bash
git add shaders/graph.wgsl
git commit -m "feat(webgpu): graph.wgsl — node + edge vertex/fragment entry points"
```

---

## Task 4: Background WGSL — fullscreen flow field

**Files:**
- Create: `shaders/background.wgsl`

- [ ] **Step 1: Write**

```wgsl
struct Frame {
  time: f32,
  _pad: vec3f,
};

@group(0) @binding(0) var<uniform> f: Frame;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = p;
  return o;
}

fn hash2(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let g = fract(p);
  let u = g * g * (3.0 - 2.0 * g);
  return mix(
    mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let p = in.uv * 4.0 + f.time * 0.04;
  let n = noise2(p) * 0.8 + noise2(p * 2.0) * 0.2;
  let col = mix(vec3f(0.028, 0.028, 0.060), vec3f(0.05, 0.05, 0.10), n);
  return vec4f(col, 1.0);
}
```

- [ ] **Step 2: Commit**

```bash
git add shaders/background.wgsl
git commit -m "feat(webgpu): background.wgsl — fullscreen flow-field ambient"
```

---

## Task 5: Physics WGSL — compute shader (all-pairs repulsion + springs + integrate)

**Files:**
- Create: `shaders/physics.wgsl`

All-pairs O(n²) instead of Barnes-Hut — on GPU at ≤300 nodes this is ~90k ops per step, negligible at 60fps.

- [ ] **Step 1: Write**

```wgsl
struct Params {
  n: u32,                // node count
  edge_count: u32,
  repulsion: f32,
  spring: f32,
  damping: f32,
  center_pull: f32,
  dt: f32,
  _pad: f32,
};

struct Edge {
  src: u32,
  dst: u32,
  rest: f32,
  weight: f32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec2f>;
@group(0) @binding(3) var<storage, read> edges: array<Edge>;
@group(0) @binding(4) var<storage, read> pinned: array<vec2f>;  // NaN encodes "not pinned"

@compute @workgroup_size(64)
fn repel_and_integrate(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let me = positions[i];
  var force = vec2f(0.0);
  // all-pairs repulsion
  for (var j: u32 = 0u; j < P.n; j = j + 1u) {
    if (j == i) { continue; }
    let other = positions[j];
    let d = other - me;
    let r2 = dot(d, d) + 1e-6;
    let inv = 1.0 / sqrt(r2);
    // Barnes-Hut-equivalent attraction/repulsion; negate below for repel
    force = force - d * inv * (P.repulsion / 100.0) / r2;
  }
  // center pull
  force = force - me * P.center_pull;
  // write the result into velocity; springs add on top in the second pass
  velocities[i] = (velocities[i] + force) * P.damping;
}

@compute @workgroup_size(64)
fn springs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.edge_count) { return; }
  let e = edges[i];
  let a = positions[e.src];
  let b = positions[e.dst];
  let d = b - a;
  let len = length(d) + 1e-6;
  let f = (len - e.rest) * P.spring * e.weight;
  let fv = f * d / len;
  // NOTE: race — two compute invocations may write the same node's velocity.
  // Acceptable because the subsequent integrate pass runs after all springs complete
  // (dispatches are serialized on the same queue). Values are approximate per step,
  // which matches CPU physics' single-threaded semantics well enough.
  velocities[e.src] = velocities[e.src] + fv;
  velocities[e.dst] = velocities[e.dst] - fv;
}

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pin = pinned[i];
  if (pin.x == pin.x && pin.y == pin.y) {  // not NaN
    positions[i] = pin;
    velocities[i] = vec2f(0.0);
  } else {
    positions[i] = positions[i] + velocities[i] * P.dt;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add shaders/physics.wgsl
git commit -m "feat(webgpu): physics.wgsl — all-pairs repel + spring + integrate compute shaders"
```

**Note on the race in `springs`:** Multiple invocations may concurrently read-modify-write `velocities[src]` if the same node is a source for multiple edges. WGSL doesn't guarantee atomic add on f32 storage; the physics is approximate-per-frame, which matches CPU sequential semantics well enough at ≤300 nodes. If this produces visible layout jitter during verification, fall back to a CPU fixup in JS for the spring pass (the repulsion + integrate passes are safe).

---

## Task 6: Shader loader — WGSL module cache

**Files:**
- Create: `src/render/webgpu/shaders.js`

- [ ] **Step 1: Implement**

```js
const cache = new Map();

/** Fetch a WGSL source by path (relative to page). Cached across calls. */
export async function loadWGSL(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`wgsl fetch failed: ${path} ${res.status}`);
  const src = await res.text();
  cache.set(path, src);
  return src;
}

/** Build a GPUShaderModule and surface compilation diagnostics. */
export async function createModule(device, code, label = "wgsl") {
  const mod = device.createShaderModule({ label, code });
  const info = await mod.getCompilationInfo?.();
  if (info) {
    const errs = info.messages.filter((m) => m.type === "error");
    if (errs.length) {
      throw new Error(`wgsl compile (${label}):\n${errs.map((m) => `  ${m.lineNum}:${m.linePos} ${m.message}`).join("\n")}`);
    }
  }
  return mod;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/shaders.js
git commit -m "feat(webgpu): WGSL loader with compilation diagnostics"
```

---

## Task 7: Nodes render pipeline (WebGPU)

**Files:**
- Create: `src/render/webgpu/nodes.js`

- [ ] **Step 1: Implement**

```js
/** Build the node render pipeline. Returns { update(f32arr, count), draw(encoder, view, size), destroy() }. */
export function createNodesPipeline(device, format, module, viewBuffer) {
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module, entryPoint: "node_vs",
      buffers: [
        { arrayStride: 8, stepMode: "vertex", attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }] },
        {
          arrayStride: 16, stepMode: "instance",
          attributes: [
            { shaderLocation: 1, format: "float32x2", offset: 0 },
            { shaderLocation: 2, format: "float32",   offset: 8 },
            { shaderLocation: 3, format: "float32",   offset: 12 },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: "node_fs", targets: [{ format, blend: premulBlend() }] },
    primitive: { topology: "triangle-list" },
  });

  const cornerBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cornerBuf, 0, new Float32Array([0,0, 1,0, 1,1,  0,0, 1,1, 0,1]));

  let instBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  let instanceCount = 0;

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer } }],
  });

  return {
    update(float32Array, count) {
      const bytes = float32Array.byteLength;
      if (instBuf.size < bytes) {
        instBuf.destroy();
        instBuf = device.createBuffer({ size: Math.max(bytes, 256), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      }
      device.queue.writeBuffer(instBuf, 0, float32Array);
      instanceCount = count;
    },
    draw(pass) {
      if (!instanceCount) return;
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, cornerBuf);
      pass.setVertexBuffer(1, instBuf);
      pass.draw(6, instanceCount, 0, 0);
    },
    destroy() { cornerBuf.destroy(); instBuf.destroy(); },
  };
}

function premulBlend() {
  return {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/nodes.js
git commit -m "feat(webgpu): instanced-quad node render pipeline"
```

---

## Task 8: Edges render pipeline (WebGPU)

**Files:**
- Create: `src/render/webgpu/edges.js`

- [ ] **Step 1: Implement**

```js
export function createEdgesPipeline(device, format, module, viewBuffer) {
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module, entryPoint: "edge_vs",
      buffers: [
        { arrayStride: 8, stepMode: "vertex", attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }] },
        {
          arrayStride: 20, stepMode: "instance",
          attributes: [
            { shaderLocation: 1, format: "float32x4", offset: 0 },
            { shaderLocation: 2, format: "float32",   offset: 16 },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: "edge_fs", targets: [{ format, blend: premulBlend() }] },
    primitive: { topology: "triangle-list" },
  });

  const cornerBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cornerBuf, 0, new Float32Array([0,0, 1,0, 1,1,  0,0, 1,1, 0,1]));

  let instBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  let instanceCount = 0;

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer } }],
  });

  return {
    update(f32arr, count) {
      const bytes = f32arr.byteLength;
      if (instBuf.size < bytes) {
        instBuf.destroy();
        instBuf = device.createBuffer({ size: Math.max(bytes, 256), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      }
      device.queue.writeBuffer(instBuf, 0, f32arr);
      instanceCount = count;
    },
    draw(pass) {
      if (!instanceCount) return;
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, cornerBuf);
      pass.setVertexBuffer(1, instBuf);
      pass.draw(6, instanceCount, 0, 0);
    },
    destroy() { cornerBuf.destroy(); instBuf.destroy(); },
  };
}

function premulBlend() {
  return {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/edges.js
git commit -m "feat(webgpu): instanced-segment edge render pipeline"
```

---

## Task 9: Background render pipeline (WebGPU)

**Files:**
- Create: `src/render/webgpu/background.js`

- [ ] **Step 1: Implement**

```js
export function createBackgroundPipeline(device, format, module, frameBuffer) {
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: frameBuffer } }],
  });
  return {
    draw(pass) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3, 1, 0, 0);
    },
    destroy() {},
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/background.js
git commit -m "feat(webgpu): background flow-field render pipeline"
```

---

## Task 10: Compute physics orchestrator

**Files:**
- Create: `src/render/webgpu/physics.js`

- [ ] **Step 1: Implement**

```js
/**
 * GPU-side physics. Wraps the physics.wgsl compute passes.
 * Matches the CPU physics.js API: { positions (Float32Array mirror), step(dt), pin(i,x,y), unpin(i), dispose }.
 * positions mirror is an optional read-back for debugging/picking; populate via copyBufferToBuffer + mapReadAsync.
 */
export async function createGpuPhysics({ device, module, count, edges, bounds = 400 }) {
  const paramsSize = 32; // 2*u32 + 6*f32, padded
  const paramsBuf = device.createBuffer({ size: paramsSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const posBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const velBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const pinBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

  // Initial positions in [-bounds/2, bounds/2]
  const initPos = new Float32Array(count * 2);
  for (let i = 0; i < count * 2; i++) initPos[i] = (Math.random() - 0.5) * bounds;
  device.queue.writeBuffer(posBuf, 0, initPos);

  const initVel = new Float32Array(count * 2);
  device.queue.writeBuffer(velBuf, 0, initVel);

  const initPin = new Float32Array(count * 2).fill(NaN);
  device.queue.writeBuffer(pinBuf, 0, initPin);

  // Edge storage: 2 u32 + 2 f32 = 16B each
  const edgeCount = edges.length;
  const edgeBytes = Math.max(16, edgeCount * 16);
  const edgeBuf = device.createBuffer({ size: edgeBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  if (edgeCount) {
    const ab = new ArrayBuffer(edgeCount * 16);
    const dv = new DataView(ab);
    for (let i = 0; i < edgeCount; i++) {
      dv.setUint32(i*16, edges[i].source, true);
      dv.setUint32(i*16+4, edges[i].target, true);
      dv.setFloat32(i*16+8, edges[i].rest ?? 60, true);
      dv.setFloat32(i*16+12, edges[i].weight ?? 1, true);
    }
    device.queue.writeBuffer(edgeBuf, 0, ab);
  }

  const repelPipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "repel_and_integrate" } });
  const springPipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "springs" } });
  const integratePipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "integrate" } });

  function bindFor(pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: posBuf } },
        { binding: 2, resource: { buffer: velBuf } },
        { binding: 3, resource: { buffer: edgeBuf } },
        { binding: 4, resource: { buffer: pinBuf } },
      ],
    });
  }

  return {
    posBuf, velBuf,
    step(dt = 1/60) {
      const params = new ArrayBuffer(paramsSize);
      const dv = new DataView(params);
      dv.setUint32(0, count, true);
      dv.setUint32(4, edgeCount, true);
      dv.setFloat32(8, 800, true);    // repulsion
      dv.setFloat32(12, 0.05, true);  // spring
      dv.setFloat32(16, 0.85, true);  // damping
      dv.setFloat32(20, 0.002, true); // centerPull
      dv.setFloat32(24, dt, true);
      device.queue.writeBuffer(paramsBuf, 0, params);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      const wg = Math.ceil(count / 64);
      const ewg = Math.max(1, Math.ceil(edgeCount / 64));

      pass.setPipeline(repelPipe);
      pass.setBindGroup(0, bindFor(repelPipe));
      pass.dispatchWorkgroups(wg);

      if (edgeCount) {
        pass.setPipeline(springPipe);
        pass.setBindGroup(0, bindFor(springPipe));
        pass.dispatchWorkgroups(ewg);
      }

      pass.setPipeline(integratePipe);
      pass.setBindGroup(0, bindFor(integratePipe));
      pass.dispatchWorkgroups(wg);

      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    pin(i, x, y) {
      const data = new Float32Array([x, y]);
      device.queue.writeBuffer(pinBuf, i * 8, data);
    },
    unpin(i) {
      const data = new Float32Array([NaN, NaN]);
      device.queue.writeBuffer(pinBuf, i * 8, data);
    },
    async readbackPositions() {
      const staging = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(posBuf, 0, staging, 0, count * 8);
      device.queue.submit([enc.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const out = new Float32Array(staging.getMappedRange().slice(0));
      staging.unmap(); staging.destroy();
      return out;
    },
    destroy() { paramsBuf.destroy(); posBuf.destroy(); velBuf.destroy(); pinBuf.destroy(); edgeBuf.destroy(); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgpu/physics.js
git commit -m "feat(webgpu): compute-shader physics — repel/springs/integrate + readback"
```

---

## Task 11: `createWebGPUBackend()` factory + contract test

**Files:**
- Create: `src/render/webgpu-backend.js`
- Create: `tests/webgpu-backend-contract.test.js`

- [ ] **Step 1: Implement `src/render/webgpu-backend.js`**

```js
import { BACKEND_METHODS } from "./backend.js";
import { createDevice, resizeCanvasForDevice } from "./webgpu/device.js";
import { loadWGSL, createModule } from "./webgpu/shaders.js";
import { createNodesPipeline } from "./webgpu/nodes.js";
import { createEdgesPipeline } from "./webgpu/edges.js";
import { createBackgroundPipeline } from "./webgpu/background.js";
import { createGpuPhysics } from "./webgpu/physics.js";
import { pickNearestNode } from "./webgl2/picker.js";

export function createWebGPUBackend() {
  let device = null, format = null, context = null;
  let nodesPipe = null, edgesPipe = null, bgPipe = null;
  let physics = null;
  let rafId = 0, running = false;
  let nodeIds = [], nodeHues = [], edgesData = [];
  let focusId = null, highlightSet = new Set();
  let camFrac = { x: 0, y: 0, w: 1, h: 1 };
  let canvasEl = null;
  let clickHandler = null;
  let viewBuffer = null, frameBuffer = null;
  let cpuPosMirror = null;

  function viewBytes() {
    const { x, y, w, h } = camFrac;
    const worldHalf = 200;
    const sx = w / worldHalf, sy = h / worldHalf;
    const tx = (x + w / 2) * 2 - 1, ty = -((y + h / 2) * 2 - 1);
    return new Float32Array([sx, sy, tx, ty, 20, 0]); // size=20
  }

  async function startLoop() {
    running = true;
    let t0 = performance.now();
    const tick = async () => {
      if (!running) return;
      const t = (performance.now() - t0) / 1000;
      // update uniforms
      device.queue.writeBuffer(viewBuffer, 0, viewBytes());
      device.queue.writeBuffer(frameBuffer, 0, new Float32Array([t, 0, 0, 0]));
      // physics
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) physics.step(1/60);
      // read back positions every frame for picker (best-effort; async)
      physics.readbackPositions().then((arr) => { cpuPosMirror = arr; }).catch(() => {});
      // upload node + edge instance buffers from the latest cpuPosMirror (if available)
      if (cpuPosMirror) {
        const nodesArr = new Float32Array(nodeIds.length * 4);
        for (let i = 0; i < nodeIds.length; i++) {
          nodesArr[4*i]   = cpuPosMirror[2*i];
          nodesArr[4*i+1] = cpuPosMirror[2*i+1];
          nodesArr[4*i+2] = (nodeHues[i] ?? 0) * Math.PI / 180;
          nodesArr[4*i+3] = (focusId === nodeIds[i] || highlightSet.has(nodeIds[i])) ? 1 : 0;
        }
        nodesPipe.update(nodesArr, nodeIds.length);
        const edgesArr = new Float32Array(edgesData.length * 5);
        for (let i = 0; i < edgesData.length; i++) {
          const e = edgesData[i];
          edgesArr[5*i]   = cpuPosMirror[2*e.sourceIdx];
          edgesArr[5*i+1] = cpuPosMirror[2*e.sourceIdx+1];
          edgesArr[5*i+2] = cpuPosMirror[2*e.targetIdx];
          edgesArr[5*i+3] = cpuPosMirror[2*e.targetIdx+1];
          edgesArr[5*i+4] = e.weight;
        }
        edgesPipe.update(edgesArr, edgesData.length);
      }
      // draw
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.028, g: 0.028, b: 0.060, a: 1 },
          loadOp: "clear", storeOp: "store",
        }],
      });
      bgPipe.draw(pass);
      edgesPipe.draw(pass);
      nodesPipe.draw(pass);
      pass.end();
      device.queue.submit([enc.finish()]);

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  return {
    name: "webgpu",
    async init(canvas) {
      canvasEl = canvas;
      resizeCanvasForDevice(canvas);
      ({ device, format, context } = await createDevice(canvas));
      window.addEventListener("resize", () => resizeCanvasForDevice(canvas));
      const graphSrc = await loadWGSL("./shaders/graph.wgsl");
      const bgSrc    = await loadWGSL("./shaders/background.wgsl");
      const physSrc  = await loadWGSL("./shaders/physics.wgsl");
      const graphMod = await createModule(device, graphSrc, "graph.wgsl");
      const bgMod    = await createModule(device, bgSrc, "background.wgsl");
      const physMod  = await createModule(device, physSrc, "physics.wgsl");

      viewBuffer  = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      frameBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      nodesPipe = createNodesPipeline(device, format, graphMod, viewBuffer);
      edgesPipe = createEdgesPipeline(device, format, graphMod, viewBuffer);
      bgPipe    = createBackgroundPipeline(device, format, bgMod, frameBuffer);
    },
    async loadScene(dsNodes, dsEdges) {
      nodeIds = dsNodes.map((n) => n.id);
      nodeHues = dsNodes.map((n) => n.badge?.hue ?? 0);
      const idx = new Map(nodeIds.map((id, i) => [id, i]));
      edgesData = dsEdges
        .map((e) => ({ sourceIdx: idx.get(e.source), targetIdx: idx.get(e.target), weight: e.weight ?? 0.5 }))
        .filter((e) => e.sourceIdx !== undefined && e.targetIdx !== undefined);
      const physicsEdges = edgesData.map((e) => ({ source: e.sourceIdx, target: e.targetIdx, rest: 60, weight: e.weight }));
      physics = await createGpuPhysics({ device, module: await createModule(device, await loadWGSL("./shaders/physics.wgsl"), "physics.wgsl"), count: nodeIds.length, edges: physicsEdges });
      if (clickHandler) canvasEl.removeEventListener("click", clickHandler);
      clickHandler = (ev) => {
        if (!cpuPosMirror) return;
        const rect = canvasEl.getBoundingClientRect();
        const world = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height, camFrac);
        const id = pickNearestNode(world, cpuPosMirror, nodeIds, { radius: 20 });
        if (id) canvasEl.dispatchEvent(new CustomEvent("atlas:pick", { detail: { id } }));
      };
      canvasEl.addEventListener("click", clickHandler);
      if (!running) startLoop();
    },
    setLayout(_hint, _ms) {},
    setFocus(id) { focusId = id; },
    setHighlight(ids) { highlightSet = new Set(ids); },
    setCameraFraction(rect) { camFrac = rect; },
    render() { /* loop drives rendering; explicit render() is a no-op for WebGPU */ },
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      if (nodesPipe) nodesPipe.destroy();
      if (edgesPipe) edgesPipe.destroy();
      if (bgPipe) bgPipe.destroy();
      if (physics) physics.destroy();
      if (clickHandler && canvasEl) canvasEl.removeEventListener("click", clickHandler);
    },
  };
}

function screenToWorld(sx, sy, w, h, cf) {
  const ndcX = (sx / w) * 2 - 1;
  const ndcY = 1 - (sy / h) * 2;
  const tx = (cf.x + cf.w / 2) * 2 - 1;
  const ty = -((cf.y + cf.h / 2) * 2 - 1);
  return { x: (ndcX - tx) / cf.w * 200, y: (ndcY - ty) / cf.h * 200 };
}
```

- [ ] **Step 2: Write `tests/webgpu-backend-contract.test.js`**

```js
import { describe, it, expect } from "vitest";
import { createWebGPUBackend } from "../src/render/webgpu-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("WebGPU backend — contract", () => {
  it("implements every RenderBackend method", () => {
    const b = createWebGPUBackend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("webgpu");
  });

  it("BACKEND_METHODS is exhaustive for WebGPU backend", () => {
    const b = createWebGPUBackend();
    const implemented = Object.keys(b).filter((k) => typeof b[k] === "function").sort();
    expect(implemented).toEqual([...BACKEND_METHODS].sort());
  });

  it("init() rejects when WebGPU is unavailable (jsdom)", async () => {
    const b = createWebGPUBackend();
    const canvas = document.createElement("canvas");
    await expect(b.init(canvas)).rejects.toThrow(/WebGPU not available|webgpu/i);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/webgpu-backend-contract.test.js
```
Expected: 3/3 pass.

- [ ] **Step 4: Full suite**

```bash
npm test
```
Expected: ≥100 assertions green (91 prior + 6 backend-detect + 3 webgpu-backend-contract).

- [ ] **Step 5: Commit**

```bash
git add src/render/webgpu-backend.js tests/webgpu-backend-contract.test.js
git commit -m "feat(webgpu): createWebGPUBackend factory + contract test"
```

---

## Task 12: Bootstrap — 3-way backend selection

**Files:**
- Modify: `src/core/bootstrap.js`

Replace the current 2-way selector with a 3-way async selector that uses `detectBackend()`.

- [ ] **Step 1: Read current `src/core/bootstrap.js` — find the `createMockBackend` + `createWebGL2Backend` import block and the `const backend = forced === ... ? ... : ...` line.

- [ ] **Step 2: Replace the imports + selection block**

```js
import { createMockBackend } from "../render/mock-backend.js";
import { createWebGL2Backend } from "../render/webgl2-backend.js";
import { createWebGPUBackend } from "../render/webgpu-backend.js";
import { detectBackend } from "../render/backend-detect.js";

const forced = new URLSearchParams(location.search).get("backend");
// async detection — bootstrap must await this before constructing the backend
const chosen = await detectBackend({ forced, gpu: navigator.gpu ?? null });
const backend = chosen === "mock"    ? createMockBackend()
              : chosen === "webgpu"  ? createWebGPUBackend()
                                      : createWebGL2Backend();
```

**Important:** The current bootstrap.js has `const backend = ...` at module top level. Module top-level `await` is supported in ES modules served as `type="module"` (which is what `index.html` uses). Verify this works by running the smoke test below.

- [ ] **Step 3: Smoke-test the dev server**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npx http-server -s -p 4173 > /tmp/httpsrv.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/
kill $SERVER_PID 2>/dev/null || taskkill //PID $SERVER_PID //F 2>/dev/null
```

Expected: HTTP 200.

- [ ] **Step 4: `npm test` still green**

All vitest tests still pass because vitest doesn't execute bootstrap.js directly.

- [ ] **Step 5: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(bootstrap): 3-way backend selection — webgpu > webgl2 > mock"
```

---

## Task 13: Playwright backend-parity smoke

**Files:**
- Create: `tests/e2e-backend-parity.mjs`

This script boots the app twice — once with `?backend=webgpu` and once with `?backend=webgl2` — takes a Neuromap screenshot after physics settles, and asserts both are non-black (i.e., both successfully rendered a graph). Pixel-perfect visual parity is deferred to Plan 05; this is a sanity check that neither backend is silently broken.

- [ ] **Step 1: Write**

```js
// Run with dev server already live on :4173
// Chromium is launched with --enable-unsafe-webgpu so WebGPU is available
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
```

- [ ] **Step 2: Run**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npx http-server -s -p 4173 > /tmp/httpsrv.log 2>&1 &
sleep 2
node tests/e2e-backend-parity.mjs
kill %1 2>/dev/null || taskkill //F //IM node.exe //FI "WINDOWTITLE eq http-server*" 2>/dev/null
```

Expected: exit 0. Screenshots in `tests/e2e-artifacts/parity-webgl2.png` and `parity-webgpu.png`.

- [ ] **Step 3: Manually compare screenshots**

Open both PNGs. Both should show a graph with colored nodes + edges. Layouts will differ (different physics seeds + GPU vs CPU), but both should have visible, non-black content.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e-backend-parity.mjs
git commit -m "test(e2e): Playwright backend-parity smoke — webgl2 + webgpu snapshot"
```

---

## Task 14: Pre-Plan-04 cleanups (batched)

Small fixes flagged during Plan 02/03 reviews that are cheap to land now.

**Files:**
- Modify: `index.html` — canvas role
- Modify: `src/render/webgl2/anim.js` — cleanup visibilitychange listener
- Modify: `src/render/webgl2/shaders.js` — `import.meta.url`-based shader resolution
- Modify: `src/render/webgl2-backend.js` — pass `dt` to `physics.step(dt)`
- Modify: `src/render/webgl2/physics.js` — accept optional `dt` parameter

### Step A: Canvas `role="application"` (spec 9)

In `index.html`, change:
```html
<canvas id="gpu" aria-hidden="true"></canvas>
```
to:
```html
<canvas id="gpu" role="application" aria-label="Atlas graph canvas — use keyboard shortcuts or the command palette to interact"></canvas>
```

Update `tests/a11y.test.js` to assert the new attribute — find the existing HTML-landmark test and add a case:
```js
it("canvas has role=application", () => {
  expect(html).toMatch(/<canvas[^>]*role="application"/);
});
```

### Step B: `anim.js` visibilitychange listener cleanup

In `src/render/webgl2/anim.js`, extract the handler and return a cleanup in the loop object.

```js
export function createAnimLoop(onFrame) {
  let rafId = 0, last = 0, running = true;
  function tick(ms) {
    if (!running) return;
    const t = ms / 1000;
    const dt = last === 0 ? 1/60 : Math.min(0.05, t - last);
    last = t;
    onFrame(t, dt);
    const idle = typeof document !== "undefined" && document.hasFocus && !document.hasFocus();
    if (idle) setTimeout(() => { rafId = requestAnimationFrame(tick); }, 33);
    else rafId = requestAnimationFrame(tick);
  }
  function start() { running = true; rafId = requestAnimationFrame(tick); }
  function stop()  { running = false; cancelAnimationFrame(rafId); }
  const onVis = () => { if (document.hidden) stop(); else start(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
  return {
    start, stop,
    dispose() {
      stop();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    },
  };
}
```

Update `src/render/webgl2-backend.js`'s `destroy()` to call `loop.dispose()` instead of `loop.stop()`.

### Step C: `import.meta.url`-based shader paths (robustness if deployed to subpath)

In `src/render/webgl2/shaders.js`, update `loadShader`:
```js
export async function loadShader(path) {
  // Resolve relative to the module's URL rather than the page's URL, so subpath deploys still find shaders.
  const url = new URL(path, import.meta.url);
  // shaders/ lives at repo root; from src/render/webgl2/shaders.js, that's ../../../shaders/<name>
  const resolved = path.startsWith("./shaders/")
    ? new URL(`../../../${path.slice(2)}`, import.meta.url)
    : url;
  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`shader fetch failed: ${resolved} ${res.status}`);
  return await res.text();
}
```

### Step D: Physics `dt` pass-through

In `src/render/webgl2/physics.js`, change `step()` to `step(dt = 1/60)` and scale velocities by `dt`:
```js
step(dt = 1/60) {
  // ... existing body ...
  // replace the integrate block's `positions[2*i] += velocities[2*i]` with:
  //   positions[2*i]     += velocities[2*i]     * dt * 60;
  //   positions[2*i + 1] += velocities[2*i + 1] * dt * 60;
  // The `* 60` preserves current 60fps-tuned constants; removing it would require re-tuning.
}
```

In `src/render/webgl2-backend.js`, the render loop is driven by `anim.js` which passes `(t, dt)`. Change:
```js
loop = createAnimLoop((t) => this.render(t));
```
to:
```js
loop = createAnimLoop((t, dt) => this.render(t, dt));
```

And change `render(tSeconds = 0)` to `render(tSeconds = 0, dt = 1/60)`, and `physics.step()` to `physics.step(dt)`.

### Step E: Run tests + commit

```bash
npm test
```
Expected: prior tests pass + the new a11y assertion passes.

```bash
git add index.html tests/a11y.test.js src/render/webgl2/anim.js src/render/webgl2/shaders.js src/render/webgl2/physics.js src/render/webgl2-backend.js
git commit -m "fix: canvas role=application, anim listener cleanup, shader import.meta.url, physics dt pass-through"
```

---

## Task 15: Full verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: ~100+ assertions green across ~19 test files.

- [ ] **Step 2: Dev-server HTTP smoke**

```bash
npx http-server -s -p 4173 > /tmp/httpsrv.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/
for p in graph.wgsl background.wgsl physics.wgsl graph.glsl background.glsl; do
  curl -s -o /dev/null -w "shaders/$p: %{http_code}\n" http://localhost:4173/shaders/$p
done
kill %1 2>/dev/null
```
Expected: all 200.

- [ ] **Step 3: Backend-parity Playwright script**

```bash
node tests/e2e-backend-parity.mjs
```
Expected: exit 0, both `parity-webgl2.png` and `parity-webgpu.png` in `tests/e2e-artifacts/`.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:4173/` in a WebGPU-capable browser (Chrome ≥113). Verify:
- Neuromap renders a graph. Check DevTools → Application → Performance → the selected backend is "webgpu" (exposed via `window.backend?.name` from bootstrap's re-exports — or check the console).
- `?backend=webgl2` falls back cleanly.
- `?backend=mock` shows the shell but no graph (mock is a no-op renderer).
- View switching still works under both backends.
- ⌘K palette still works.

- [ ] **Step 5: Git state**

```bash
git log --oneline <plan-04-plan-doc-sha>..HEAD
git status
```
Expected: ~14–16 new commits, clean tree.

---

## Completion criteria

Plan 04 is done when:

- [ ] `createWebGPUBackend()` returns an object conforming to `BACKEND_METHODS` (contract test passes).
- [ ] `detectBackend()` returns `"webgpu"` when adapter resolves within timeout, `"webgl2"` otherwise. 6/6 unit tests green.
- [ ] Bootstrap auto-selects WebGPU when available; `?backend=mock|webgl2|webgpu` URL overrides work.
- [ ] Neuromap renders a visible graph under WebGPU (Playwright parity screenshot non-blank).
- [ ] Compute-shader physics produces force-directed layout comparable to CPU Barnes-Hut (same visual convergence, different random seed ok).
- [ ] Plan-02/03 cleanups applied: canvas `role="application"`, `anim.js` listener cleanup, `import.meta.url` shader paths, physics `dt` normalization.
- [ ] ≥100 total vitest assertions across all Plan 01–04 tests.

**Next:** Plan 05 — Playwright visual regression suite. Covers pixel-perfect backend parity, view-switch screenshots, a11y violations via `@axe-core/playwright`, and the full CI gate.

---

## Deferrals / known limitations

These are deliberate Plan 04 omissions, tracked for future passes:

- **Multi-pass bloom:** spec 7.1 lists `bloom.*` as separate render passes. Plan 04 ships without bloom. Adds a softer look; not load-bearing.
- **Transition curtain:** spec 7.1's `transition.wgsl` for view-switch crossfades is deferred. View switching uses the existing instant swap.
- **Full CSS token → uniform bridge:** spec 7.4 mentions `tokens.shader.js`. Plan 04 hardcodes the palette in shaders (matching Plan 03). Wiring CSS custom properties into the shader uniform stream is a polish task.
- **Barnes-Hut on GPU:** the compute shader uses O(n²) all-pairs. At the 300-node cap this is fine; scaling past that needs a grid-based approximation.
- **Spring-pass race condition:** `physics.wgsl` has an acknowledged non-atomic `velocities[src] += fv` in the spring pass. If empirical verification shows jitter, falling back to a CPU spring fixup is a 30-line change.
- **Pin() latency:** GPU `pin(i,x,y)` writes to a storage buffer asynchronously. The effect applies on the next compute pass rather than the current frame. Acceptable.
- **Mobile WebGPU:** patchy support on mobile Chromium as of 2026. The auto-detect falls through to WebGL2 cleanly.

# Claude Atlas — Plan 03: WebGL2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock render backend with a working WebGL2 implementation that draws nodes, edges, an ambient background, and a CPU-driven force-directed layout — all conforming to the existing `RenderBackend` contract so `bootstrap.js:22` becomes the single swap point from mock to real graphics.

**Architecture:** Plain ES modules, no bundler. A `createWebGL2Backend()` factory returns an object implementing all 8 `BACKEND_METHODS`. Rendering uses GLSL 3.00 ES shaders loaded from `shaders/` at runtime via `fetch()`. Physics runs on CPU via a Barnes-Hut quadtree in a `requestAnimationFrame` loop (≤300 nodes per the spec's fallback tier). The shell, views, router, store, palette from Plan 02 are untouched — the only file modified in `src/core/` is `bootstrap.js` which changes exactly one factory line.

**Tech Stack:** Node 20, vitest + jsdom (for pure-JS physics tests), raw WebGL2 (no three.js / no regl), GLSL 3.00 ES, no framework, no bundler.

**Reference spec:** `docs/superpowers/specs/2026-04-17-claude-atlas-design.md` — Sections 5.4 (contract), 7.2 (WebGL2 fallback), 7.3 (backend selection), 7.4 (shaders on disk), 7.5 (frame budget), 8.1 (tokens → uniforms), 8.3 (motion), 9 (mobile caps).

**Test strategy:** Physics module is pure JS → unit-tested under jsdom. WebGL2 rendering cannot be tested under jsdom (no GL context). Tests assert: (a) the factory returns an object with all `BACKEND_METHODS` as functions, matching the drift-guard test from Plan 02 Task 4; (b) the physics layout converges to a stable state for a given seed; (c) Barnes-Hut quadtree insert/query works correctly; (d) the backend's `init()` throws a clear error when WebGL2 is unavailable. Visual regression of the actual pixels lands in Plan 05 (Playwright).

**Enters with:** Plan 02 complete at HEAD `efc769e` + 4 cleanup commits. 78/78 vitest assertions green. Mock backend still wired. `src/core/bootstrap.js:22` is the single factory call — Plan 03 changes that line (once, at the end).

**Out of scope for Plan 03:** WebGPU pipelines (Plan 04). Playwright visual regression (Plan 05). Multi-pass bloom / transition curtain / WebGPU-only effects. `setTheme(tokens)` contract extension — spec mentions it but no view calls it, so YAGNI until a theme switcher ships.

---

## File structure

```
claude-atlas/
  src/
    render/
      webgl2-backend.js               ← the factory (new; exported main)
      webgl2/
        context.js                    ← GL context, DPR scaling, resize, clear
        shaders.js                    ← compile/link helpers, shader cache
        nodes.js                      ← node render pipeline (instanced quads)
        edges.js                      ← edge render pipeline (line segments)
        background.js                 ← flow-field ambient pass
        physics.js                    ← force-directed layout + Barnes-Hut
        quadtree.js                   ← Barnes-Hut quadtree (pure JS)
        picker.js                     ← click-to-node ray/AABB picking
        anim.js                       ← rAF loop driver + frame budget
    core/
      bootstrap.js                    ← MODIFIED at one line: createMockBackend → createWebGL2Backend (behind a feature-detect)
  shaders/
    graph.glsl                        ← nodes + edges (fragment + vertex)
    background.glsl                   ← flow-field noise
  tests/
    quadtree.test.js                  ← Barnes-Hut insertion + bounds-query
    physics.test.js                   ← force integrator, layout convergence
    webgl2-backend-contract.test.js   ← factory shape matches BACKEND_METHODS
```

**Why this split:** Each file has one responsibility and can be held in context alone. `webgl2-backend.js` is a thin wiring module — it composes `context` + `shaders` + `nodes` + `edges` + `background` + `physics` + `picker` + `anim` behind the `RenderBackend` contract.

---

## Task 1: Quadtree (Barnes-Hut) — TDD

**Files:**
- Create: `src/render/webgl2/quadtree.js`
- Create: `tests/quadtree.test.js`

Barnes-Hut repulsion is the expensive physics step. A quadtree reduces it from O(n²) to O(n log n). Pure-JS, fully testable in jsdom.

- [ ] **Step 1: Write the failing test**

`tests/quadtree.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createQuadtree } from "../src/render/webgl2/quadtree.js";

describe("createQuadtree", () => {
  it("returns empty when no points are inserted", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    expect(qt.root.count).toBe(0);
    expect(qt.root.mass).toBe(0);
  });

  it("inserts a single point and records center of mass", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    qt.insert({ id: "a", x: 10, y: 20, mass: 1 });
    expect(qt.root.count).toBe(1);
    expect(qt.root.com).toEqual({ x: 10, y: 20 });
  });

  it("aggregates center of mass across multiple points", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    qt.insert({ id: "a", x: 10, y: 0, mass: 1 });
    qt.insert({ id: "b", x: 30, y: 0, mass: 1 });
    expect(qt.root.count).toBe(2);
    expect(qt.root.com.x).toBeCloseTo(20, 5);
    expect(qt.root.com.y).toBeCloseTo(0, 5);
  });

  it("approximates force for far points using the root node (theta test)", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    for (let i = 0; i < 4; i++) qt.insert({ id: `n${i}`, x: 60 + i, y: 60 + i, mass: 1 });
    const force = qt.forceAt({ x: -1000, y: -1000 }, { theta: 0.5 });
    expect(Number.isFinite(force.x)).toBe(true);
    expect(Number.isFinite(force.y)).toBe(true);
    // the force vector should point from the query point toward the cluster
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeGreaterThan(0);
  });

  it("returns zero force when the query point is inside an empty region", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    const force = qt.forceAt({ x: 10, y: 10 }, { theta: 0.5 });
    expect(force).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/quadtree.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/render/webgl2/quadtree.js`**

```js
/**
 * Barnes-Hut quadtree. Nodes are either leaves (0 or 1 body) or internal
 * (mass = sum of children, com = mass-weighted center of mass).
 * theta < 1 = more accurate (more recursion). theta = 0.5 is the classic.
 */

function makeNode(bounds) {
  return { bounds, count: 0, mass: 0, com: { x: 0, y: 0 }, body: null, children: null };
}

function inside(b, p) {
  return p.x >= b.x && p.x < b.x + b.size && p.y >= b.y && p.y < b.y + b.size;
}

function subdivide(node) {
  const { x, y, size } = node.bounds;
  const half = size / 2;
  node.children = [
    makeNode({ x,        y,        size: half }),
    makeNode({ x: x+half, y,       size: half }),
    makeNode({ x,        y: y+half, size: half }),
    makeNode({ x: x+half, y: y+half, size: half }),
  ];
}

function insertInto(node, body) {
  if (node.children === null && node.body === null) {
    node.body = body;
    node.count = 1;
    node.mass = body.mass;
    node.com = { x: body.x, y: body.y };
    return;
  }
  if (node.children === null) {
    // was a leaf with one body — subdivide and re-insert existing
    const existing = node.body;
    node.body = null;
    subdivide(node);
    insertInto(node.children.find((c) => inside(c.bounds, existing)), existing);
  }
  // internal node: accumulate and recurse
  const newMass = node.mass + body.mass;
  node.com = {
    x: (node.com.x * node.mass + body.x * body.mass) / newMass,
    y: (node.com.y * node.mass + body.y * body.mass) / newMass,
  };
  node.mass = newMass;
  node.count += 1;
  const target = node.children.find((c) => inside(c.bounds, body));
  if (target) insertInto(target, body);
}

function forceFromNode(node, p, theta) {
  if (node.count === 0) return { x: 0, y: 0 };
  const dx = node.com.x - p.x;
  const dy = node.com.y - p.y;
  const dist2 = dx * dx + dy * dy + 1e-6;
  const dist = Math.sqrt(dist2);
  // leaf or sufficiently far → single-node approximation
  if (node.children === null || (node.bounds.size / dist) < theta) {
    const f = node.mass / dist2;
    return { x: f * dx / dist, y: f * dy / dist };
  }
  // otherwise recurse
  let fx = 0, fy = 0;
  for (const c of node.children) {
    const f = forceFromNode(c, p, theta);
    fx += f.x; fy += f.y;
  }
  return { x: fx, y: fy };
}

export function createQuadtree(bounds) {
  const root = makeNode(bounds);
  return {
    root,
    insert(body) { if (inside(bounds, body)) insertInto(root, body); },
    forceAt(p, { theta = 0.5 } = {}) { return forceFromNode(root, p, theta); },
  };
}
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/quadtree.test.js`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/webgl2/quadtree.js tests/quadtree.test.js
git commit -m "feat(webgl2): Barnes-Hut quadtree for O(n log n) repulsion"
```

---

## Task 2: Force-directed physics integrator — TDD

**Files:**
- Create: `src/render/webgl2/physics.js`
- Create: `tests/physics.test.js`

- [ ] **Step 1: Write the failing test**

`tests/physics.test.js`:
```js
import { describe, it, expect } from "vitest";
import { createPhysics } from "../src/render/webgl2/physics.js";

describe("createPhysics", () => {
  it("initializes positions for N nodes in a bounded region", () => {
    const p = createPhysics({ count: 10, bounds: 200 });
    expect(p.positions.length).toBe(20); // x,y interleaved
    for (let i = 0; i < 20; i++) {
      expect(Math.abs(p.positions[i])).toBeLessThanOrEqual(100);
    }
  });

  it("step() mutates positions toward equilibrium for a 2-node spring", () => {
    const p = createPhysics({ count: 2, bounds: 200 });
    p.positions[0] = -50; p.positions[1] = 0;
    p.positions[2] = 50;  p.positions[3] = 0;
    p.edges = [{ source: 0, target: 1, weight: 1, rest: 20 }];
    const before = Math.abs(p.positions[0] - p.positions[2]);
    for (let i = 0; i < 200; i++) p.step();
    const after = Math.abs(p.positions[0] - p.positions[2]);
    expect(after).toBeLessThan(before);       // spring pulled them together
    expect(after).toBeGreaterThan(10);        // repulsion keeps them apart
  });

  it("pin()d nodes do not move", () => {
    const p = createPhysics({ count: 2, bounds: 200 });
    p.positions[0] = 100; p.positions[1] = 0;
    p.positions[2] = -100; p.positions[3] = 0;
    p.pin(0, 100, 0);
    for (let i = 0; i < 50; i++) p.step();
    expect(p.positions[0]).toBeCloseTo(100, 5);
    expect(p.positions[1]).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/physics.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/render/webgl2/physics.js`**

```js
import { createQuadtree } from "./quadtree.js";

/**
 * CPU force-directed layout.
 * - Repulsion via Barnes-Hut quadtree (O(n log n))
 * - Edge springs toward rest length
 * - Center gravity
 * - Pinned nodes override velocity each step
 */
export function createPhysics({ count, bounds = 400 }) {
  const positions = new Float32Array(count * 2);
  const velocities = new Float32Array(count * 2);
  const pinned = new Float32Array(count * 2); // NaN means not pinned
  pinned.fill(NaN);
  for (let i = 0; i < count; i++) {
    positions[2 * i]     = (Math.random() - 0.5) * bounds;
    positions[2 * i + 1] = (Math.random() - 0.5) * bounds;
  }
  const state = {
    positions, velocities, pinned,
    edges: [],
    repulsion: 800,
    spring: 0.05,
    damping: 0.85,
    centerPull: 0.002,
    theta: 0.8,
    step() {
      const half = bounds;
      const qt = createQuadtree({ x: -half, y: -half, size: 2 * half });
      for (let i = 0; i < count; i++) {
        qt.insert({ id: i, x: positions[2*i], y: positions[2*i+1], mass: 1 });
      }
      // repulsion
      for (let i = 0; i < count; i++) {
        const p = { x: positions[2*i], y: positions[2*i+1] };
        const f = qt.forceAt(p, { theta: state.theta });
        // Barnes-Hut returns force TOWARD mass — we want AWAY for repulsion
        velocities[2*i]     -= f.x * state.repulsion / 100;
        velocities[2*i + 1] -= f.y * state.repulsion / 100;
        // center pull
        velocities[2*i]     -= p.x * state.centerPull;
        velocities[2*i + 1] -= p.y * state.centerPull;
      }
      // springs
      for (const e of state.edges) {
        const s = e.source, t = e.target;
        const dx = positions[2*t] - positions[2*s];
        const dy = positions[2*t+1] - positions[2*s+1];
        const dist = Math.sqrt(dx*dx + dy*dy) + 1e-6;
        const force = (dist - (e.rest ?? 40)) * state.spring * (e.weight ?? 1);
        const fx = force * dx / dist, fy = force * dy / dist;
        velocities[2*s]     += fx; velocities[2*s+1] += fy;
        velocities[2*t]     -= fx; velocities[2*t+1] -= fy;
      }
      // integrate + damping + pins
      for (let i = 0; i < count; i++) {
        velocities[2*i]     *= state.damping;
        velocities[2*i + 1] *= state.damping;
        if (!Number.isNaN(pinned[2*i])) {
          positions[2*i]     = pinned[2*i];
          positions[2*i + 1] = pinned[2*i + 1];
          velocities[2*i]    = 0; velocities[2*i + 1] = 0;
        } else {
          positions[2*i]     += velocities[2*i];
          positions[2*i + 1] += velocities[2*i + 1];
        }
      }
    },
    pin(i, x, y) { pinned[2*i] = x; pinned[2*i + 1] = y; },
    unpin(i)     { pinned[2*i] = NaN; pinned[2*i + 1] = NaN; },
  };
  return state;
}
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/physics.test.js`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/webgl2/physics.js tests/physics.test.js
git commit -m "feat(webgl2): CPU force-directed layout with Barnes-Hut repulsion"
```

---

## Task 3: GL context + DPR + resize

**Files:**
- Create: `src/render/webgl2/context.js`

- [ ] **Step 1: Implement `src/render/webgl2/context.js`**

```js
/**
 * Initialize a WebGL2 rendering context with correct DPR scaling.
 * Caps DPR at 1.75 on mobile and 2.0 on desktop per spec 7.5.
 * Returns { gl, resize, dpr } where resize() must be called on window resize.
 */
export function createContext(canvas) {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("WebGL2 not available");

  const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent ?? "");
  const dprCap = isMobile ? 1.75 : 2.0;

  function resize() {
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    return { w, h, dpr };
  }

  // set the canvas to fill its container via CSS (shell.css already does this)
  resize();
  window.addEventListener("resize", resize);

  return {
    gl,
    resize,
    get dpr() { return Math.min(window.devicePixelRatio || 1, dprCap); },
    destroy() { window.removeEventListener("resize", resize); },
  };
}
```

- [ ] **Step 2: Commit (no test — WebGL2 unavailable under jsdom)**

```bash
git add src/render/webgl2/context.js
git commit -m "feat(webgl2): GL context with DPR cap and resize handling"
```

---

## Task 4: Shader compile/link helpers

**Files:**
- Create: `src/render/webgl2/shaders.js`

- [ ] **Step 1: Implement `src/render/webgl2/shaders.js`**

```js
/** Compile a single shader stage. Throws with the full info log on failure. */
export function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed:\n${log}`);
  }
  return sh;
}

/** Link vertex+fragment into a program. Deletes shaders after linking. */
export function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link failed:\n${log}`);
  }
  return prog;
}

/** Fetch shader source from the shaders/ directory. */
export async function loadShader(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`shader fetch failed: ${path} ${res.status}`);
  return await res.text();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgl2/shaders.js
git commit -m "feat(webgl2): shader compile/link/load helpers"
```

---

## Task 5: Graph shader (GLSL) — nodes + edges in one program

**Files:**
- Create: `shaders/graph.glsl`

The file contains both vertex and fragment stages, separated by a sentinel. `loadShader` reads the full file; a small split utility extracts the two halves. (Single-file shaders keep related GLSL together; avoids 4 separate files for node/edge × vs/fs.)

- [ ] **Step 1: Write `shaders/graph.glsl`**

```glsl
#version 300 es
// ----- VERTEX (node & edge draw) -----
// Build flag: pass -DEDGE when linking the edge program, otherwise nodes.

#ifdef EDGE
// per-vertex quad corner (0..1)
in vec2 a_corner;
// per-instance: x,y of source and x,y of target
in vec4 a_segment;
// per-instance: weight in [0,1]
in float a_weight;
uniform mat3 u_view; // world → clip
out float v_weight;
void main() {
  vec2 a = a_segment.xy;
  vec2 b = a_segment.zw;
  vec2 dir = normalize(b - a);
  vec2 perp = vec2(-dir.y, dir.x);
  float thickness = mix(1.0, 3.0, a_weight);
  vec2 world = mix(a, b, a_corner.x) + perp * (a_corner.y - 0.5) * thickness;
  vec3 clip = u_view * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_weight = a_weight;
}

#else
// node: per-instance x,y,hue,highlight
in vec2 a_corner;           // quad corner 0..1
in vec4 a_node;              // xy = pos, z = hue (radians), w = highlight in [0,1]
uniform mat3 u_view;
uniform float u_size;         // pixel size in world units
out vec2 v_uv;
out float v_hue;
out float v_highlight;
void main() {
  vec2 world = a_node.xy + (a_corner - 0.5) * u_size;
  vec3 clip = u_view * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_corner;
  v_hue = a_node.z;
  v_highlight = a_node.w;
}
#endif

// ----- FRAGMENT (node) -----
#ifndef EDGE
in vec2 v_uv; in float v_hue; in float v_highlight;
out vec4 o_col;
vec3 hslToRgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb;
  if      (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);
  float m = l - 0.5 * c;
  return rgb + vec3(m);
}
void main() {
  vec2 p = v_uv - 0.5;
  float d = length(p);
  float disc = smoothstep(0.48, 0.44, d);
  float halo = smoothstep(0.5, 0.35, d) - disc;
  vec3 base = hslToRgb(v_hue / 6.2831853, 0.7, 0.62);
  vec3 bright = mix(base, vec3(1.0), v_highlight * 0.6);
  float alpha = disc + halo * (0.25 + v_highlight * 0.5);
  o_col = vec4(bright * alpha, alpha);
}

// ----- FRAGMENT (edge) -----
#else
in float v_weight;
out vec4 o_col;
void main() {
  o_col = vec4(1.0, 1.0, 1.0, v_weight * 0.35);
}
#endif
```

- [ ] **Step 2: Commit**

```bash
git add shaders/graph.glsl
git commit -m "feat(webgl2): GLSL 3.00 ES node + edge shader"
```

---

## Task 6: Node render pipeline

**Files:**
- Create: `src/render/webgl2/nodes.js`

- [ ] **Step 1: Implement**

```js
import { linkProgram } from "./shaders.js";

/**
 * Instanced-quad node renderer. Reads GLSL source once, compiles once,
 * accepts position/hue/highlight updates via updateInstances().
 */
export function createNodesPipeline(gl, glslSrc) {
  // graph.glsl is a combined file; node program uses the #ifndef EDGE branches
  const prog = linkProgram(gl, `#define NODE\n${glslSrc}`, `#define NODE\n${glslSrc}`);
  const aCorner = gl.getAttribLocation(prog, "a_corner");
  const aNode   = gl.getAttribLocation(prog, "a_node");
  const uView   = gl.getUniformLocation(prog, "u_view");
  const uSize   = gl.getUniformLocation(prog, "u_size");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // per-vertex quad corners (2 triangles)
  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

  // per-instance node data: xy, hue, highlight (vec4)
  const instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.enableVertexAttribArray(aNode);
  gl.vertexAttribPointer(aNode, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aNode, 1);

  gl.bindVertexArray(null);

  let instanceCount = 0;

  return {
    updateInstances(float32Array, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, float32Array, gl.DYNAMIC_DRAW);
      instanceCount = count;
    },
    draw(view, sizeWorld) {
      if (!instanceCount) return;
      gl.useProgram(prog);
      gl.uniformMatrix3fv(uView, false, view);
      gl.uniform1f(uSize, sizeWorld);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteBuffer(cornerBuf); gl.deleteBuffer(instBuf); gl.deleteVertexArray(vao); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgl2/nodes.js
git commit -m "feat(webgl2): instanced-quad node render pipeline"
```

---

## Task 7: Edge render pipeline

**Files:**
- Create: `src/render/webgl2/edges.js`

- [ ] **Step 1: Implement**

```js
import { linkProgram } from "./shaders.js";

export function createEdgesPipeline(gl, glslSrc) {
  const prog = linkProgram(gl, `#define EDGE\n${glslSrc}`, `#define EDGE\n${glslSrc}`);
  const aCorner  = gl.getAttribLocation(prog, "a_corner");
  const aSegment = gl.getAttribLocation(prog, "a_segment");
  const aWeight  = gl.getAttribLocation(prog, "a_weight");
  const uView    = gl.getUniformLocation(prog, "u_view");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

  const segBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  gl.enableVertexAttribArray(aSegment);
  gl.vertexAttribPointer(aSegment, 4, gl.FLOAT, false, 5 * 4, 0);
  gl.vertexAttribDivisor(aSegment, 1);
  gl.enableVertexAttribArray(aWeight);
  gl.vertexAttribPointer(aWeight, 1, gl.FLOAT, false, 5 * 4, 4 * 4);
  gl.vertexAttribDivisor(aWeight, 1);

  gl.bindVertexArray(null);

  let count = 0;

  return {
    updateInstances(float32Array, instanceCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
      gl.bufferData(gl.ARRAY_BUFFER, float32Array, gl.DYNAMIC_DRAW);
      count = instanceCount;
    },
    draw(view) {
      if (!count) return;
      gl.useProgram(prog);
      gl.uniformMatrix3fv(uView, false, view);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteBuffer(cornerBuf); gl.deleteBuffer(segBuf); gl.deleteVertexArray(vao); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgl2/edges.js
git commit -m "feat(webgl2): instanced-segment edge render pipeline"
```

---

## Task 8: Background flow field

**Files:**
- Create: `shaders/background.glsl`
- Create: `src/render/webgl2/background.js`

- [ ] **Step 1: Write `shaders/background.glsl`**

```glsl
#version 300 es
// fullscreen triangle
#ifdef VERT
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
#else
precision highp float;
in vec2 v_uv;
uniform float u_time;
out vec4 o_col;
// cheap 2D noise (Perlin-ish, low-octave per spec 7.2)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
void main() {
  vec2 p = v_uv * 4.0 + u_time * 0.04;
  float n = noise(p) * 0.8 + noise(p * 2.0) * 0.2;
  vec3 col = mix(vec3(0.028, 0.028, 0.060), vec3(0.05, 0.05, 0.10), n);
  o_col = vec4(col, 1.0);
}
#endif
```

- [ ] **Step 2: Implement `src/render/webgl2/background.js`**

```js
import { linkProgram } from "./shaders.js";

export function createBackgroundPipeline(gl, glslSrc) {
  const prog = linkProgram(gl, `#define VERT\n${glslSrc}`, glslSrc);
  const uTime = gl.getUniformLocation(prog, "u_time");
  const vao = gl.createVertexArray();
  return {
    draw(tSeconds) {
      gl.useProgram(prog);
      gl.uniform1f(uTime, tSeconds);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteVertexArray(vao); },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add shaders/background.glsl src/render/webgl2/background.js
git commit -m "feat(webgl2): flow-field ambient background pass"
```

---

## Task 9: Animation loop + frame budget

**Files:**
- Create: `src/render/webgl2/anim.js`

- [ ] **Step 1: Implement**

```js
/**
 * rAF-driven loop. Caller provides onFrame(tSeconds, dt). Pauses when
 * document.hidden. Drops to ~30fps when the window is unfocused (spec 7.5).
 */
export function createAnimLoop(onFrame) {
  let rafId = 0, last = 0, running = true;
  function tick(ms) {
    if (!running) return;
    const t = ms / 1000;
    const dt = last === 0 ? 1/60 : Math.min(0.05, t - last);
    last = t;
    onFrame(t, dt);
    const idle = typeof document !== "undefined" && document.hasFocus && !document.hasFocus();
    if (idle) {
      setTimeout(() => { rafId = requestAnimationFrame(tick); }, 33);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }
  function start() { running = true; rafId = requestAnimationFrame(tick); }
  function stop()  { running = false; cancelAnimationFrame(rafId); }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else start();
    });
  }
  return { start, stop };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgl2/anim.js
git commit -m "feat(webgl2): rAF loop with focus/hidden frame-budget control"
```

---

## Task 10: Picker (click → nodeId)

**Files:**
- Create: `src/render/webgl2/picker.js`
- Create: `tests/picker.test.js`

- [ ] **Step 1: Write the failing test**

`tests/picker.test.js`:
```js
import { describe, it, expect } from "vitest";
import { pickNearestNode } from "../src/render/webgl2/picker.js";

describe("pickNearestNode", () => {
  it("returns the nearest node within radius", () => {
    const positions = new Float32Array([0,0, 100,0, 0,100]);
    const ids = ["a","b","c"];
    expect(pickNearestNode({ x: 5, y: 5 }, positions, ids, { radius: 20 })).toBe("a");
  });
  it("returns null if all nodes are outside radius", () => {
    const positions = new Float32Array([0,0, 100,0]);
    const ids = ["a","b"];
    expect(pickNearestNode({ x: 500, y: 500 }, positions, ids, { radius: 20 })).toBe(null);
  });
});
```

- [ ] **Step 2: Fail**

Run: `npx vitest run tests/picker.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/render/webgl2/picker.js`**

```js
/**
 * Linear scan nearest-neighbor with radius cutoff (world space).
 * Good enough for ≤300 nodes per spec 7.2.
 */
export function pickNearestNode({ x, y }, positions, ids, { radius = 16 } = {}) {
  let best = null, bestD2 = radius * radius;
  for (let i = 0; i < ids.length; i++) {
    const dx = positions[2*i]     - x;
    const dy = positions[2*i + 1] - y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; best = ids[i]; }
  }
  return best;
}
```

- [ ] **Step 4: Pass**

Run: `npx vitest run tests/picker.test.js`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/webgl2/picker.js tests/picker.test.js
git commit -m "feat(webgl2): nearest-node picker for click-to-focus"
```

---

## Task 11: `createWebGL2Backend()` factory — wire it all together

**Files:**
- Create: `src/render/webgl2-backend.js`

This is the module that implements the `RenderBackend` contract. It imports every `webgl2/*` helper and exposes the 8 `BACKEND_METHODS` methods plus a `name: "webgl2"` property.

- [ ] **Step 1: Implement `src/render/webgl2-backend.js`**

```js
import { BACKEND_METHODS } from "./backend.js";
import { createContext } from "./webgl2/context.js";
import { loadShader } from "./webgl2/shaders.js";
import { createNodesPipeline } from "./webgl2/nodes.js";
import { createEdgesPipeline } from "./webgl2/edges.js";
import { createBackgroundPipeline } from "./webgl2/background.js";
import { createPhysics } from "./webgl2/physics.js";
import { createAnimLoop } from "./webgl2/anim.js";
import { pickNearestNode } from "./webgl2/picker.js";

/**
 * Factory for the WebGL2 RenderBackend. Conforms to the BACKEND_METHODS
 * contract from Plan 02. Loads shaders asynchronously during init().
 */
export function createWebGL2Backend() {
  let ctx = null, nodes = null, edges = null, bg = null, physics = null, loop = null;
  let nodeIds = [], edgesData = [];
  let highlightSet = new Set();
  let focusId = null;
  let camFrac = { x: 0, y: 0, w: 1, h: 1 };
  let canvasEl = null;
  let clickHandler = null;

  function view() {
    // construct a 3x3 matrix from camFrac that maps world-[-1,1] to clip-[-1+2x, -1+2(x+w)]
    const { x, y, w, h } = camFrac;
    const sx = w, sy = h;
    const tx = (x + w / 2) * 2 - 1, ty = -((y + h / 2) * 2 - 1);
    // column-major 3x3
    return new Float32Array([sx, 0, 0,  0, sy, 0,  tx, ty, 1]);
  }

  function packNodes() {
    if (!physics) return new Float32Array();
    const out = new Float32Array(nodeIds.length * 4);
    for (let i = 0; i < nodeIds.length; i++) {
      out[4*i]     = physics.positions[2*i];
      out[4*i + 1] = physics.positions[2*i + 1];
      out[4*i + 2] = (nodeHues[i] ?? 0) * Math.PI / 180;
      out[4*i + 3] = (focusId === nodeIds[i] || highlightSet.has(nodeIds[i])) ? 1 : 0;
    }
    return out;
  }

  function packEdges() {
    const out = new Float32Array(edgesData.length * 5);
    for (let i = 0; i < edgesData.length; i++) {
      const e = edgesData[i];
      out[5*i]     = physics.positions[2 * e.sourceIdx];
      out[5*i + 1] = physics.positions[2 * e.sourceIdx + 1];
      out[5*i + 2] = physics.positions[2 * e.targetIdx];
      out[5*i + 3] = physics.positions[2 * e.targetIdx + 1];
      out[5*i + 4] = e.weight ?? 0.5;
    }
    return out;
  }

  let nodeHues = [];

  return {
    name: "webgl2",
    async init(canvas) {
      canvasEl = canvas;
      ctx = createContext(canvas);
      const graphSrc = await loadShader("./shaders/graph.glsl");
      const bgSrc    = await loadShader("./shaders/background.glsl");
      nodes = createNodesPipeline(ctx.gl, graphSrc);
      edges = createEdgesPipeline(ctx.gl, graphSrc);
      bg    = createBackgroundPipeline(ctx.gl, bgSrc);
      loop = createAnimLoop((t) => this.render(t));
      loop.start();
    },
    loadScene(dsNodes, dsEdges) {
      nodeIds = dsNodes.map((n) => n.id);
      nodeHues = dsNodes.map((n) => n.badge?.hue ?? 0);
      const idx = new Map(nodeIds.map((id, i) => [id, i]));
      edgesData = dsEdges
        .map((e) => ({ sourceIdx: idx.get(e.source), targetIdx: idx.get(e.target), weight: e.weight ?? 0.5 }))
        .filter((e) => e.sourceIdx !== undefined && e.targetIdx !== undefined);
      physics = createPhysics({ count: nodeIds.length, bounds: 400 });
      physics.edges = edgesData.map((e) => ({ source: e.sourceIdx, target: e.targetIdx, weight: e.weight, rest: 60 }));
      // click picker
      if (clickHandler) canvasEl.removeEventListener("click", clickHandler);
      clickHandler = (ev) => {
        const rect = canvasEl.getBoundingClientRect();
        const world = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height);
        const id = pickNearestNode(world, physics.positions, nodeIds, { radius: 20 });
        if (id) canvasEl.dispatchEvent(new CustomEvent("atlas:pick", { detail: { id } }));
      };
      canvasEl.addEventListener("click", clickHandler);
    },
    setLayout(_hint, _ms) { /* plan 04 — for now physics alone drives layout */ },
    setFocus(id) { focusId = id; },
    setHighlight(ids) { highlightSet = new Set(ids); },
    setCameraFraction(rect) { camFrac = rect; },
    render(tSeconds = 0) {
      if (!ctx || !physics) return;
      physics.step();
      ctx.gl.clearColor(0.028, 0.028, 0.060, 1);
      ctx.gl.clear(ctx.gl.COLOR_BUFFER_BIT);
      ctx.gl.enable(ctx.gl.BLEND);
      ctx.gl.blendFunc(ctx.gl.SRC_ALPHA, ctx.gl.ONE_MINUS_SRC_ALPHA);
      bg.draw(tSeconds);
      edges.updateInstances(packEdges(), edgesData.length);
      edges.draw(view());
      nodes.updateInstances(packNodes(), nodeIds.length);
      nodes.draw(view(), 20);
    },
    destroy() {
      if (loop) loop.stop();
      if (nodes) nodes.destroy();
      if (edges) edges.destroy();
      if (bg) bg.destroy();
      if (ctx) ctx.destroy();
      if (clickHandler && canvasEl) canvasEl.removeEventListener("click", clickHandler);
    },
  };
}

function screenToWorld(sx, sy, w, h) {
  // placeholder — world units scale with camFrac; world [-200, 200] → screen [0, w]
  return { x: (sx / w - 0.5) * 400, y: (0.5 - sy / h) * 400 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/webgl2-backend.js
git commit -m "feat(webgl2): createWebGL2Backend factory wiring all pipelines"
```

---

## Task 12: Backend-contract test

**Files:**
- Create: `tests/webgl2-backend-contract.test.js`

- [ ] **Step 1: Write the test**

Because jsdom has no WebGL2 context, we can test the **shape** of the factory without calling `init()`. We assert: the factory returns an object with every `BACKEND_METHODS` method as a function and has `name === "webgl2"`. The drift-guard pattern from Plan 02 Task 4 applies here.

```js
import { describe, it, expect } from "vitest";
import { createWebGL2Backend } from "../src/render/webgl2-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("WebGL2 backend — contract", () => {
  it("implements every RenderBackend method", () => {
    const b = createWebGL2Backend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("webgl2");
  });

  it("BACKEND_METHODS is exhaustive for WebGL2 backend", () => {
    const b = createWebGL2Backend();
    const implemented = Object.keys(b).filter((k) => typeof b[k] === "function").sort();
    expect(implemented).toEqual([...BACKEND_METHODS].sort());
  });

  it("init() rejects when WebGL2 is unavailable (jsdom)", async () => {
    const b = createWebGL2Backend();
    const canvas = document.createElement("canvas");
    await expect(b.init(canvas)).rejects.toThrow(/WebGL2 not available/);
  });
});
```

- [ ] **Step 2: Pass**

Run: `npx vitest run tests/webgl2-backend-contract.test.js`
Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/webgl2-backend-contract.test.js
git commit -m "test(webgl2): contract conformance + init error path"
```

---

## Task 13: Bootstrap — feature-detect swap

**Files:**
- Modify: `src/core/bootstrap.js` — replace the mock-backend factory line with a feature-detect selector

- [ ] **Step 1: Modify the factory line**

In `src/core/bootstrap.js`, change:

```js
import { createMockBackend } from "../render/mock-backend.js";
// ...
const backend = createMockBackend();
```

to:

```js
import { createMockBackend } from "../render/mock-backend.js";
import { createWebGL2Backend } from "../render/webgl2-backend.js";

// Backend selection per spec 7.3. No WebGPU in Plan 03 — that lands in Plan 04.
// URL override: ?backend=mock|webgl2 for testing
const forced = new URLSearchParams(location.search).get("backend");
const backend = forced === "mock" ? createMockBackend()
               : forced === "webgl2" ? createWebGL2Backend()
               : createWebGL2Backend();
```

- [ ] **Step 2: Verify tests still pass**

Run: `npm test`
Expected: still green (the bootstrap import change doesn't run in tests because vitest doesn't execute bootstrap.js directly — only the tests import the modules they need).

- [ ] **Step 3: Smoke test the real app**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npx http-server -s -p 4173 > /tmp/http-server.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -s http://localhost:4173/ | head -c 200
kill $SERVER_PID 2>/dev/null || taskkill //PID $SERVER_PID //F 2>/dev/null
```

Open `http://localhost:4173/` manually in a WebGL2-capable browser. The Neuromap view should show a dark canvas with dots drifting under force physics, and edges between connected nodes. Clicking near a dot should dispatch the `atlas:pick` event (not yet wired to focus — that's task 14).

- [ ] **Step 4: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(bootstrap): swap mock for WebGL2 backend with URL override"
```

---

## Task 14: Wire the picker to `api.focus`

**Files:**
- Modify: `src/core/bootstrap.js` — listen for `atlas:pick` and forward to api.focus

- [ ] **Step 1: Add listener in bootstrap**

In `src/core/bootstrap.js`, inside `main()` after `await backend.init(canvas)`, add:

```js
  canvas.addEventListener("atlas:pick", (e) => {
    api.focus(e.detail.id);
  });
```

- [ ] **Step 2: Smoke test**

Run `npm test` — still green.

Manually: open the app, switch to Neuromap, click a node. The focus state in the store updates (visible via `window.store` if bootstrap exports it — it does: `export { store }`).

- [ ] **Step 3: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(bootstrap): wire canvas atlas:pick event to api.focus"
```

---

## Task 15: setCameraFraction math + Reference/Worklist views sync

**Files:**
- Modify: `src/core/bootstrap.js` — on view change, call `backend.setCameraFraction()` with the correct rect per view

- [ ] **Step 1: Extend `switchView(view)`**

In `src/core/bootstrap.js`, extend `switchView(view)` to also inform the backend about the new camera fraction. Per spec 4.2, Neuromap = full viewport, Reference = left 33% (graph as minimap), Worklist = left 33%.

```js
const CAMERA_FRAC = {
  neuromap:  { x: 0, y: 0, w: 1,    h: 1 },
  reference: { x: 0, y: 0, w: 0.33, h: 1 },
  worklist:  { x: 0, y: 0, w: 0.33, h: 1 },
};

function switchView(view) {
  if (unmountCurrent) { unmountCurrent(); unmountCurrent = null; }
  const mounter = VIEW_MOUNTERS[view];
  unmountCurrent = mounter(DATASET, api);
  document.getElementById("shell").dataset.view = view;
  backend.setCameraFraction(CAMERA_FRAC[view] ?? CAMERA_FRAC.neuromap);
}
```

- [ ] **Step 2: Verify tests still pass**

Run: `npm test`
Expected: 78+ still green.

- [ ] **Step 3: Smoke test**

Open the app, click through the three view tabs. Neuromap shows a full-viewport graph; Reference and Worklist show the graph shrunk to the left third while the DOM sidecar (the existing view content from Plan 02) fills the right.

- [ ] **Step 4: Commit**

```bash
git add src/core/bootstrap.js
git commit -m "feat(bootstrap): sync backend camera fraction to active view"
```

---

## Task 16: Reduced-motion — pause physics

**Files:**
- Modify: `src/render/webgl2-backend.js` — respect `prefers-reduced-motion` in the render loop

- [ ] **Step 1: Add the check**

In `src/render/webgl2-backend.js`'s `render()` method, replace `physics.step();` with:

```js
      const reduceMotion = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) physics.step();
```

- [ ] **Step 2: Smoke test**

Open the app in DevTools → toggle "Reduce motion" in the Rendering panel. The graph should freeze in its current position (no more drift).

- [ ] **Step 3: Commit**

```bash
git add src/render/webgl2-backend.js
git commit -m "feat(webgl2): honour prefers-reduced-motion by pausing physics"
```

---

## Task 17: Pause when document hidden

The `anim.js` loop already handles visibility via `visibilitychange`. Verify it works:

- [ ] **Step 1: Manual test**

Open the app, switch to another tab for 5+ seconds, return. The graph should have continued from where it was — no runaway physics simulation during the hidden period.

- [ ] **Step 2: No commit** (already handled in Task 9 `anim.js`)

---

## Task 18: Full verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: ~87+ assertions green across ~16 test files. No failures.

- [ ] **Step 2: Dev server smoke**

```bash
cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"
npx http-server -s -p 4173 > /tmp/http-server.log 2>&1 &
SERVER_PID=$!
sleep 2
curl -s http://localhost:4173/ | head -c 400
kill $SERVER_PID 2>/dev/null || taskkill //PID $SERVER_PID //F 2>/dev/null
```

Expected: HTML with references to shell.css, bootstrap.js.

- [ ] **Step 3: Manual WebGL2 verification in a real browser**

Open `http://localhost:4173/` in Chrome/Firefox/Safari. Verify:
- Neuromap view shows a dark canvas with glowing dots under drifting force-directed layout.
- Clicking a dot calls `api.focus()` (check `store.focusedId` in console).
- Switching to Reference/Worklist shrinks the graph to the left 33%; DOM sidecar fills right 67%.
- Command palette `⌘K` still works.
- `prefers-reduced-motion` (DevTools → Rendering) freezes the physics.
- Switching tabs and returning does not runaway-simulate.
- `?backend=mock` URL override falls back to the mock backend — app should boot but graph is invisible (mock renders nothing).

- [ ] **Step 4: Git state**

```bash
git log --oneline | head -20
git status
```
Expected: ~18 new commits since Plan 02 HEAD `efc769e`. Working tree clean.

---

## Completion criteria

Plan 03 is done when:

- [ ] `createWebGL2Backend()` returns an object conforming to `BACKEND_METHODS` (drift-guard test passes).
- [ ] Bootstrap uses `createWebGL2Backend()` by default; `?backend=mock` falls back to the mock.
- [ ] Neuromap view shows a running force-directed graph with dots + edges.
- [ ] Click-picking dispatches `atlas:pick` and `api.focus` is called.
- [ ] `setCameraFraction` correctly maps Reference/Worklist views to the left 33%.
- [ ] `prefers-reduced-motion` freezes physics.
- [ ] `document.hidden` pauses the animation loop.
- [ ] Physics + quadtree + picker unit tests all green under jsdom.
- [ ] ≥87 vitest assertions total across all Plan 01+02+03 tests.

**Next:** Plan 04 — WebGPU backend (compute-shader physics, multi-pass bloom, transition curtain). Swap `createWebGL2Backend()` for `createWebGPUBackend()` with feature detection.

---

## Deviations from spec allowed for Plan 03

The spec mentions several aesthetic features that are downgraded or deferred in Plan 03 to keep scope manageable. Each is a deliberate Plan 03 choice, not a permanent reduction:

- **Bloom:** spec 7.2 says "single-pass bloom". Plan 03 ships without bloom. Can be added as a follow-up after Plan 03 lands, or rolled into Plan 04's WebGPU multi-pass bloom if it's easier there.
- **Layout morph tweening:** `setLayout(hint, durationMs)` is a no-op in Plan 03 — physics alone drives the layout. Plan 04 can add target-position blending.
- **Transition curtain:** spec 7.1 mentions a WebGPU-only transition pass. N/A for WebGL2.
- **Graph breath:** spec 8.3's 6s sine breath animation is omitted. Ambient background flow field covers the "app isn't dead" visual signal.
- **Shader-uniform CSS token bridge:** spec 7.4 mentions `tokens.shader.js`. Plan 03 hard-codes colors in the shader (dark-background-compatible HSL). Plan 04 (WebGPU) is a better venue for the token bridge since it's building uniform buffers anyway.

If any of these become Plan 02-style "plan has a bug" moments during implementation, the review cycle should surface them.

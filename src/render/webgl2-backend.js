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
    // Maps physics world [-200, 200] → clip subregion determined by camFrac.
    const { x, y, w, h } = camFrac;
    const worldHalf = 200; // physics bounds/2
    const sx = w / worldHalf, sy = h / worldHalf;
    const tx = (x + w / 2) * 2 - 1, ty = -((y + h / 2) * 2 - 1);
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
        const world = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height, camFrac);
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
      const reduceMotion = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) physics.step();
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

function screenToWorld(sx, sy, w, h, cf) {
  // Inverse of view(): screen → NDC → physics world (±200) factoring the active camFrac subregion.
  const ndcX = (sx / w) * 2 - 1;
  const ndcY = 1 - (sy / h) * 2;
  const tx = (cf.x + cf.w / 2) * 2 - 1;
  const ty = -((cf.y + cf.h / 2) * 2 - 1);
  return { x: (ndcX - tx) / cf.w * 200, y: (ndcY - ty) / cf.h * 200 };
}

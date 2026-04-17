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

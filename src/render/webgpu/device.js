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

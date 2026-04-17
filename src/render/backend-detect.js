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

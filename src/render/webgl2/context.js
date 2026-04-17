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

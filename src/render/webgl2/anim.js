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

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

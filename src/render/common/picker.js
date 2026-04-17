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

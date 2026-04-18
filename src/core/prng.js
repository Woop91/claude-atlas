/**
 * Mulberry32 — small 32-bit PRNG. Returns a function that yields [0, 1) floats.
 * Good enough for visual regression seed; not cryptographic.
 */
export function createMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replace global Math.random with a seeded Mulberry32. Returns a restore function.
 * Used by test harness (?test=1) to make physics initial positions + any other
 * random consumers reproducible across runs.
 */
export function installSeededRandom(seed) {
  const orig = Math.random;
  const rng = createMulberry32(seed);
  Math.random = rng;
  return function restore() { Math.random = orig; };
}

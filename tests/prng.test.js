import { describe, it, expect } from "vitest";
import { createMulberry32, installSeededRandom } from "../src/core/prng.js";

describe("createMulberry32", () => {
  it("returns deterministic sequence for same seed", () => {
    const a = createMulberry32(42);
    const b = createMulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBeCloseTo(b(), 10);
  });
  it("different seeds produce different sequences", () => {
    const a = createMulberry32(1);
    const b = createMulberry32(2);
    expect(a()).not.toBeCloseTo(b(), 6);
  });
  it("all values are in [0, 1)", () => {
    const r = createMulberry32(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("installSeededRandom", () => {
  it("replaces Math.random with the PRNG", () => {
    const orig = Math.random;
    const restore = installSeededRandom(42);
    const v1 = Math.random();
    const v2 = Math.random();
    expect(v1).toBeCloseTo(0.60, 1);    // Mulberry32(42)[0] ≈ 0.601
    expect(v1).not.toBe(v2);
    restore();
    expect(Math.random).toBe(orig);
  });
  it("same seed produces same first value after install", () => {
    const restore1 = installSeededRandom(7);
    const a = Math.random();
    restore1();
    const restore2 = installSeededRandom(7);
    const b = Math.random();
    restore2();
    expect(a).toBeCloseTo(b, 10);
  });
  it("restore returns a function that resets Math.random", () => {
    const original = Math.random;
    const restore = installSeededRandom(1);
    expect(Math.random).not.toBe(original);
    restore();
    expect(Math.random).toBe(original);
  });
});

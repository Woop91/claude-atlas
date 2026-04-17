import { describe, it, expect } from "vitest";
import { createPhysics } from "../src/render/webgl2/physics.js";

describe("createPhysics", () => {
  it("initializes positions for N nodes in a bounded region", () => {
    const p = createPhysics({ count: 10, bounds: 200 });
    expect(p.positions.length).toBe(20); // x,y interleaved
    for (let i = 0; i < 20; i++) {
      expect(Math.abs(p.positions[i])).toBeLessThanOrEqual(100);
    }
  });

  it("step() mutates positions toward equilibrium for a 2-node spring", () => {
    const p = createPhysics({ count: 2, bounds: 200 });
    p.positions[0] = -50; p.positions[1] = 0;
    p.positions[2] = 50;  p.positions[3] = 0;
    p.edges = [{ source: 0, target: 1, weight: 1, rest: 20 }];
    const before = Math.abs(p.positions[0] - p.positions[2]);
    for (let i = 0; i < 200; i++) p.step();
    const after = Math.abs(p.positions[0] - p.positions[2]);
    expect(after).toBeLessThan(before);       // spring pulled them together
    expect(after).toBeGreaterThan(10);        // repulsion keeps them apart
  });

  it("pin()d nodes do not move", () => {
    const p = createPhysics({ count: 2, bounds: 200 });
    p.positions[0] = 100; p.positions[1] = 0;
    p.positions[2] = -100; p.positions[3] = 0;
    p.pin(0, 100, 0);
    for (let i = 0; i < 50; i++) p.step();
    expect(p.positions[0]).toBeCloseTo(100, 5);
    expect(p.positions[1]).toBeCloseTo(0, 5);
  });
});

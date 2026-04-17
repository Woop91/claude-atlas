import { describe, it, expect } from "vitest";
import { createQuadtree } from "../src/render/webgl2/quadtree.js";

describe("createQuadtree", () => {
  it("returns empty when no points are inserted", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    expect(qt.root.count).toBe(0);
    expect(qt.root.mass).toBe(0);
  });

  it("inserts a single point and records center of mass", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    qt.insert({ id: "a", x: 10, y: 20, mass: 1 });
    expect(qt.root.count).toBe(1);
    expect(qt.root.com).toEqual({ x: 10, y: 20 });
  });

  it("aggregates center of mass across multiple points", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    qt.insert({ id: "a", x: 10, y: 0, mass: 1 });
    qt.insert({ id: "b", x: 30, y: 0, mass: 1 });
    expect(qt.root.count).toBe(2);
    expect(qt.root.com.x).toBeCloseTo(20, 5);
    expect(qt.root.com.y).toBeCloseTo(0, 5);
  });

  it("approximates force for far points using the root node (theta test)", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    for (let i = 0; i < 4; i++) qt.insert({ id: `n${i}`, x: 60 + i, y: 60 + i, mass: 1 });
    const force = qt.forceAt({ x: -1000, y: -1000 }, { theta: 0.5 });
    expect(Number.isFinite(force.x)).toBe(true);
    expect(Number.isFinite(force.y)).toBe(true);
    // the force vector should point from the query point toward the cluster
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeGreaterThan(0);
  });

  it("returns zero force when the query point is inside an empty region", () => {
    const qt = createQuadtree({ x: 0, y: 0, size: 100 });
    const force = qt.forceAt({ x: 10, y: 10 }, { theta: 0.5 });
    expect(force).toEqual({ x: 0, y: 0 });
  });
});

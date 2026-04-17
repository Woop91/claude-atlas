import { describe, it, expect } from "vitest";
import { pickNearestNode } from "../src/render/webgl2/picker.js";

describe("pickNearestNode", () => {
  it("returns the nearest node within radius", () => {
    const positions = new Float32Array([0,0, 100,0, 0,100]);
    const ids = ["a","b","c"];
    expect(pickNearestNode({ x: 5, y: 5 }, positions, ids, { radius: 20 })).toBe("a");
  });
  it("returns null if all nodes are outside radius", () => {
    const positions = new Float32Array([0,0, 100,0]);
    const ids = ["a","b"];
    expect(pickNearestNode({ x: 500, y: 500 }, positions, ids, { radius: 20 })).toBe(null);
  });
});

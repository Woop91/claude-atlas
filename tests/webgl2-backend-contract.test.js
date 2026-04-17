import { describe, it, expect } from "vitest";
import { createWebGL2Backend } from "../src/render/webgl2-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("WebGL2 backend — contract", () => {
  it("implements every RenderBackend method", () => {
    const b = createWebGL2Backend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("webgl2");
  });

  it("BACKEND_METHODS is exhaustive for WebGL2 backend", () => {
    const b = createWebGL2Backend();
    const implemented = Object.keys(b).filter((k) => typeof b[k] === "function").sort();
    expect(implemented).toEqual([...BACKEND_METHODS].sort());
  });

  it("init() rejects when WebGL2 is unavailable (jsdom)", async () => {
    const b = createWebGL2Backend();
    const canvas = document.createElement("canvas");
    await expect(b.init(canvas)).rejects.toThrow(/WebGL2 not available/);
  });
});

import { describe, it, expect } from "vitest";
import { createWebGPUBackend } from "../src/render/webgpu-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("WebGPU backend — contract", () => {
  it("implements every RenderBackend method", () => {
    const b = createWebGPUBackend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("webgpu");
  });

  it("BACKEND_METHODS is exhaustive for WebGPU backend", () => {
    const b = createWebGPUBackend();
    const implemented = Object.keys(b).filter((k) => typeof b[k] === "function").sort();
    expect(implemented).toEqual([...BACKEND_METHODS].sort());
  });

  it("init() rejects when WebGPU is unavailable (jsdom)", async () => {
    const b = createWebGPUBackend();
    const canvas = document.createElement("canvas");
    await expect(b.init(canvas)).rejects.toThrow(/WebGPU not available|webgpu/i);
  });
});

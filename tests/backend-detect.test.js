import { describe, it, expect, vi } from "vitest";
import { detectBackend } from "../src/render/backend-detect.js";

describe("detectBackend", () => {
  it("returns 'mock' when forced to mock via override", async () => {
    const result = await detectBackend({ forced: "mock", gpu: { requestAdapter: async () => ({}) } });
    expect(result).toBe("mock");
  });

  it("returns 'webgl2' when forced to webgl2 even if webgpu is available", async () => {
    const result = await detectBackend({ forced: "webgl2", gpu: { requestAdapter: async () => ({}) } });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgpu' when gpu adapter resolves within timeout", async () => {
    const result = await detectBackend({ forced: null, gpu: { requestAdapter: async () => ({ ok: true }) } });
    expect(result).toBe("webgpu");
  });

  it("returns 'webgl2' when gpu is absent", async () => {
    const result = await detectBackend({ forced: null, gpu: null });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgl2' when requestAdapter returns null", async () => {
    const result = await detectBackend({ forced: null, gpu: { requestAdapter: async () => null } });
    expect(result).toBe("webgl2");
  });

  it("returns 'webgl2' when requestAdapter hangs past timeout", async () => {
    const neverResolves = new Promise(() => {});
    const result = await detectBackend({
      forced: null,
      gpu: { requestAdapter: () => neverResolves },
      timeoutMs: 50,
    });
    expect(result).toBe("webgl2");
  });
});

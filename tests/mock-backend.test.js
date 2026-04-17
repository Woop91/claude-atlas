import { describe, it, expect } from "vitest";
import { createMockBackend } from "../src/render/mock-backend.js";
import { BACKEND_METHODS } from "../src/render/backend.js";

describe("mock backend", () => {
  it("implements every RenderBackend method", () => {
    const b = createMockBackend();
    for (const m of BACKEND_METHODS) {
      expect(typeof b[m], `missing method ${m}`).toBe("function");
    }
    expect(b.name).toBe("mock");
  });

  it("records calls for verification", async () => {
    const b = createMockBackend();
    await b.init();
    b.loadScene([{ id: "x" }], []);
    b.setLayout({ mode: "force", cameraFraction: { x:0, y:0, w:1, h:1 } }, 300);
    b.render();
    expect(b._log).toEqual([
      ["init"],
      ["loadScene", 1, 0],
      ["setLayout", "force", 300],
      ["render"],
    ]);
  });

  it("BACKEND_METHODS is exhaustive for the mock", () => {
    const b = createMockBackend();
    const implemented = Object.keys(b)
      .filter((k) => typeof b[k] === "function")
      .sort();
    expect(implemented).toEqual([...BACKEND_METHODS].sort());
  });
});
